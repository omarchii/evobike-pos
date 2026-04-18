import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import type { AuthorizationType, CashRegisterSession } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getOrphanedSession } from "@/lib/cash-register";
import { formatRelative } from "@/lib/notifications/format-relative";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos del feed — consumidos por <NotificationBell>
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationCategory =
    | "autorizaciones"
    | "taller"
    | "recepciones"
    | "cortes";

export type NotificationItem = {
    id: string;
    category: NotificationCategory;
    title: string;
    description: string;
    href: string;
    createdAt: string;
};

export type NotificationGroup = {
    category: NotificationCategory;
    label: string;
    count: number;
    items: NotificationItem[];
};

export type NotificationFeedResponse = {
    total: number;
    groups: NotificationGroup[];
};

interface SessionUser {
    id: string;
    branchId: string;
    role: string;
}

const CATEGORY_LABEL: Record<NotificationCategory, string> = {
    autorizaciones: "Autorizaciones",
    taller: "Taller",
    recepciones: "Recepciones",
    cortes: "Cortes huérfanos",
};

const ITEMS_PER_GROUP = 5;

// ─────────────────────────────────────────────────────────────────────────────
// Prisma payload selectors
// ─────────────────────────────────────────────────────────────────────────────

const authSelector = Prisma.validator<Prisma.AuthorizationRequestDefaultArgs>()({
    select: {
        id: true,
        tipo: true,
        monto: true,
        createdAt: true,
        requester: { select: { name: true } },
    },
});
type AuthRow = Prisma.AuthorizationRequestGetPayload<typeof authSelector>;

const approvalSelector = Prisma.validator<Prisma.ServiceOrderApprovalDefaultArgs>()({
    select: {
        id: true,
        serviceOrderId: true,
        requestedAt: true,
        serviceOrder: {
            select: {
                folio: true,
                customer: { select: { name: true } },
            },
        },
    },
});
type ApprovalRow = Prisma.ServiceOrderApprovalGetPayload<typeof approvalSelector>;

const receiptSelector = Prisma.validator<Prisma.PurchaseReceiptDefaultArgs>()({
    select: {
        id: true,
        proveedor: true,
        totalPagado: true,
        createdAt: true,
    },
});
type ReceiptRow = Prisma.PurchaseReceiptGetPayload<typeof receiptSelector>;

// ─────────────────────────────────────────────────────────────────────────────
// Formatters
// ─────────────────────────────────────────────────────────────────────────────

function formatMoney(value: Prisma.Decimal | number | null): string {
    if (value === null) return "0.00";
    const n = Number(value);
    return n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function titleForAuth(tipo: AuthorizationType, monto: Prisma.Decimal | null): string {
    if (tipo === "CIERRE_DIFERENCIA") return "Cierre con diferencia";
    const label = tipo === "DESCUENTO" ? "Descuento" : "Cancelación";
    return `${label} · $${formatMoney(monto)}`;
}

function formatOpenedAt(date: Date): string {
    return date.toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
    });
}

// ─────────────────────────────────────────────────────────────────────────────
// Mappers
// ─────────────────────────────────────────────────────────────────────────────

function mapAuthItem(row: AuthRow): NotificationItem {
    const requesterName = row.requester?.name ?? "Usuario desconocido";
    return {
        id: row.id,
        category: "autorizaciones",
        title: titleForAuth(row.tipo, row.monto),
        description: `Solicitado por ${requesterName} · ${formatRelative(row.createdAt)}`,
        href: "/autorizaciones",
        createdAt: row.createdAt.toISOString(),
    };
}

function mapApprovalItem(row: ApprovalRow): NotificationItem {
    const folio = row.serviceOrder.folio;
    const customer = row.serviceOrder.customer?.name ?? "Cliente sin nombre";
    return {
        id: row.id,
        category: "taller",
        title: `${folio} · ${customer}`,
        description: formatRelative(row.requestedAt),
        href: `/workshop/${row.serviceOrderId}`,
        createdAt: row.requestedAt.toISOString(),
    };
}

function mapReceiptItem(row: ReceiptRow): NotificationItem {
    return {
        id: row.id,
        category: "recepciones",
        title: `${row.proveedor} · $${formatMoney(row.totalPagado)}`,
        description: formatRelative(row.createdAt),
        href: `/inventario/recepciones/${row.id}`,
        createdAt: row.createdAt.toISOString(),
    };
}

function mapOrphanItem(
    session: CashRegisterSession,
    branchName: string | null,
    isAdmin: boolean,
): NotificationItem {
    const relative = formatRelative(session.openedAt);
    const branchSuffix = isAdmin && branchName ? ` · ${branchName}` : "";
    return {
        id: session.id,
        category: "cortes",
        title: `Caja abierta desde ${formatOpenedAt(session.openedAt)}`,
        description: `${relative}${branchSuffix}`,
        href: "/cash-register",
        createdAt: session.openedAt.toISOString(),
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// GET handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse<NotificationFeedResponse | { error: string }>> {
    const session = await getServerSession(authOptions);
    const user = session?.user as unknown as SessionUser | undefined;

    if (!user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }
    if (user.role !== "MANAGER" && user.role !== "ADMIN") {
        return NextResponse.json({ error: "No autorizado" }, { status: 403 });
    }

    const isAdmin = user.role === "ADMIN";
    const now = new Date();

    // Autorizaciones pendientes no expiradas
    const authWhere: Prisma.AuthorizationRequestWhereInput = {
        status: "PENDING",
        AND: [
            {
                OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
            },
        ],
        ...(isAdmin ? {} : { branchId: user.branchId }),
    };

    // OTs esperando aprobación — ServiceOrderApproval PENDING (source of truth formal)
    const approvalWhere: Prisma.ServiceOrderApprovalWhereInput = {
        status: "PENDING",
        ...(isAdmin
            ? {}
            : { serviceOrder: { branchId: user.branchId } }),
    };

    // Recepciones sin factura (últimos 30 días)
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const receiptWhere: Prisma.PurchaseReceiptWhereInput = {
        facturaUrl: null,
        createdAt: { gte: thirtyDaysAgo },
        ...(isAdmin ? {} : { branchId: user.branchId }),
    };

    // Cortes huérfanos — MANAGER: una sola branch. ADMIN: agregamos todas las activas.
    const orphansPromise: Promise<Array<{ session: CashRegisterSession; branchName: string | null }>> =
        isAdmin
            ? (async () => {
                  // `Branch` no tiene `isActive` — se iteran todas las sucursales.
                  const branches = await prisma.branch.findMany({
                      select: { id: true, name: true },
                  });
                  const results = await Promise.all(
                      branches.map(async (b) => {
                          const s = await getOrphanedSession(b.id);
                          return s ? { session: s, branchName: b.name } : null;
                      }),
                  );
                  return results.filter(
                      (r): r is { session: CashRegisterSession; branchName: string } => r !== null,
                  );
              })()
            : (async () => {
                  const s = await getOrphanedSession(user.branchId);
                  return s ? [{ session: s, branchName: null }] : [];
              })();

    const [
        authCount,
        authRows,
        approvalCount,
        approvalRows,
        receiptCount,
        receiptRows,
        orphans,
    ] = await Promise.all([
        prisma.authorizationRequest.count({ where: authWhere }),
        prisma.authorizationRequest.findMany({
            where: authWhere,
            select: authSelector.select,
            orderBy: { createdAt: "desc" },
            take: ITEMS_PER_GROUP,
        }),
        prisma.serviceOrderApproval.count({ where: approvalWhere }),
        prisma.serviceOrderApproval.findMany({
            where: approvalWhere,
            select: approvalSelector.select,
            orderBy: { requestedAt: "desc" },
            take: ITEMS_PER_GROUP,
        }),
        prisma.purchaseReceipt.count({ where: receiptWhere }),
        prisma.purchaseReceipt.findMany({
            where: receiptWhere,
            select: receiptSelector.select,
            orderBy: { createdAt: "desc" },
            take: ITEMS_PER_GROUP,
        }),
        orphansPromise,
    ]);

    const orphansSorted = [...orphans].sort(
        (a, b) => b.session.openedAt.getTime() - a.session.openedAt.getTime(),
    );

    const groups: NotificationGroup[] = [
        {
            category: "autorizaciones",
            label: CATEGORY_LABEL.autorizaciones,
            count: authCount,
            items: authRows.map(mapAuthItem),
        },
        {
            category: "taller",
            label: CATEGORY_LABEL.taller,
            count: approvalCount,
            items: approvalRows.map(mapApprovalItem),
        },
        {
            category: "recepciones",
            label: CATEGORY_LABEL.recepciones,
            count: receiptCount,
            items: receiptRows.map(mapReceiptItem),
        },
        {
            category: "cortes",
            label: CATEGORY_LABEL.cortes,
            count: orphansSorted.length,
            items: orphansSorted
                .slice(0, ITEMS_PER_GROUP)
                .map((o) => mapOrphanItem(o.session, o.branchName, isAdmin)),
        },
    ];

    const total = groups.reduce((acc, g) => acc + g.count, 0);

    return NextResponse.json({ total, groups });
}
