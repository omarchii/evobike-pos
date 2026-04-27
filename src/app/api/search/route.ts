import type { SessionUser } from "@/lib/auth-types";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";

import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// ─────────────────────────────────────────────────────────────────────────────
// Tipos públicos — consumidos por <CommandPalette>
// ─────────────────────────────────────────────────────────────────────────────

export type SearchCategory =
    | "customer"
    | "service-order"
    | "sale"
    | "product"
    | "quotation"
    | "receipt"
    | "expense"
    | "authorization";

export type SearchResult = {
    id: string;
    category: SearchCategory;
    title: string;
    subtitle: string;
    href: string;
};

export type SearchGroup = {
    category: SearchCategory;
    label: string;
    count: number;
    hasMore: boolean;
    results: SearchResult[];
};

export type SearchResponse = {
    total: number;
    groups: SearchGroup[];
};

const CATEGORY_LABEL: Record<SearchCategory, string> = {
    customer: "Clientes",
    "service-order": "Órdenes de taller",
    sale: "Ventas",
    product: "Productos",
    quotation: "Cotizaciones",
    receipt: "Recepciones",
    expense: "Gastos",
    authorization: "Autorizaciones",
};

const CATEGORY_ORDER: SearchCategory[] = [
    "customer",
    "service-order",
    "sale",
    "product",
    "quotation",
    "receipt",
    "expense",
    "authorization",
];

const LIMIT_PER_GROUP = 5;

type Match = { id: string; score: number; total_count: bigint };

function takeLimited(rows: Match[]): { ids: string[]; hasMore: boolean; count: number } {
    const count = rows.length > 0 ? Number(rows[0].total_count) : 0;
    const ids = rows.slice(0, LIMIT_PER_GROUP).map((r) => r.id);
    const hasMore = count > LIMIT_PER_GROUP;
    return { ids, hasMore, count };
}

function preserveOrder<T extends { id: string }>(ids: string[], rows: T[]): T[] {
    const map = new Map(rows.map((r) => [r.id, r]));
    return ids.map((id) => map.get(id)).filter((r): r is T => r !== undefined);
}

// Construye el filtro `AND <alias>."branchId" = $branchId` cuando no es admin.
// Para admin devuelve un fragmento vacío (sin filtro).
function branchFilter(branchId: string | null, alias = ""): Prisma.Sql {
    if (branchId === null) return Prisma.empty;
    const col = alias ? `"${alias}"."branchId"` : `"branchId"`;
    return Prisma.sql`AND ${Prisma.raw(col)} = ${branchId}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Handler
// ─────────────────────────────────────────────────────────────────────────────

export async function GET(request: Request): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ error: "No autenticado" }, { status: 401 });
    }

    const user = session.user as unknown as SessionUser;
    const isAdmin = user.role === "ADMIN";
    const canSeeAuthorizations = user.role === "ADMIN" || user.role === "MANAGER";
    if (!isAdmin && !user.branchId) {
        return NextResponse.json({ error: "Usuario sin sucursal asignada" }, { status: 400 });
    }
    const branchId: string | null = isAdmin ? null : user.branchId;

    const url = new URL(request.url);
    const rawQ = url.searchParams.get("q") ?? "";
    const q = rawQ.trim();

    if (q.length < 2) {
        return NextResponse.json({ error: "Query demasiado corto" }, { status: 400 });
    }

    const qLower = q.toLowerCase();

    const [
        customerGroup,
        serviceOrderGroup,
        saleGroup,
        productGroup,
        quotationGroup,
        receiptGroup,
        expenseGroup,
        authorizationGroup,
    ] = await Promise.all([
        searchCustomers(qLower),
        searchServiceOrders(qLower, branchId),
        searchSales(qLower, branchId),
        searchProducts(qLower),
        searchQuotations(qLower, branchId),
        searchReceipts(qLower, branchId),
        searchExpenses(qLower, branchId),
        canSeeAuthorizations ? searchAuthorizations(qLower, branchId) : Promise.resolve(null),
    ]);

    const groupsMap: Record<SearchCategory, SearchGroup | null> = {
        customer: customerGroup,
        "service-order": serviceOrderGroup,
        sale: saleGroup,
        product: productGroup,
        quotation: quotationGroup,
        receipt: receiptGroup,
        expense: expenseGroup,
        authorization: authorizationGroup,
    };

    const groups: SearchGroup[] = CATEGORY_ORDER
        .map((cat) => groupsMap[cat])
        .filter((g): g is SearchGroup => g !== null && g.count > 0);

    const total = groups.reduce((sum, g) => sum + g.count, 0);

    return NextResponse.json({ total, groups } satisfies SearchResponse);
}

// ─────────────────────────────────────────────────────────────────────────────
// Customer — modelo global, sin filtro de branch
// ─────────────────────────────────────────────────────────────────────────────

async function searchCustomers(qLower: string): Promise<SearchGroup | null> {
    const matches = await prisma.$queryRaw<Match[]>`
        SELECT id,
            CASE
                WHEN LOWER(unaccent(name)) = LOWER(unaccent(${qLower})) THEN 0
                WHEN LOWER(unaccent(name)) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                ELSE 2
            END AS score,
            COUNT(*) OVER() AS total_count
        FROM "Customer"
        WHERE LOWER(unaccent(name)) LIKE '%' || LOWER(unaccent(${qLower})) || '%'
           OR LOWER(COALESCE(phone, '')) LIKE '%' || ${qLower} || '%'
           OR LOWER(COALESCE(email, '')) LIKE '%' || ${qLower} || '%'
        ORDER BY score ASC, id DESC
        LIMIT ${LIMIT_PER_GROUP + 1}
    `;

    const { ids, hasMore, count } = takeLimited(matches);
    if (count === 0) return null;

    const rows = await prisma.customer.findMany({
        where: { id: { in: ids } },
        select: { id: true, name: true, phone: true, email: true },
    });

    const ordered = preserveOrder(ids, rows);
    const results: SearchResult[] = ordered.map((c) => {
        const parts: string[] = [];
        if (c.phone) parts.push(c.phone);
        if (c.email) parts.push(c.email);
        return {
            id: c.id,
            category: "customer",
            title: c.name,
            subtitle: parts.join(" · "),
            href: `/customers/${c.id}`,
        };
    });

    return { category: "customer", label: CATEGORY_LABEL.customer, count, hasMore, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// ServiceOrder
// ─────────────────────────────────────────────────────────────────────────────

async function searchServiceOrders(qLower: string, branchId: string | null): Promise<SearchGroup | null> {
    const branchSql = branchFilter(branchId, "so");
    const matches = await prisma.$queryRaw<Match[]>`
        SELECT so.id,
            CASE
                WHEN LOWER(so.folio) = LOWER(${qLower}) THEN 0
                WHEN LOWER(so.folio) LIKE LOWER(${qLower}) || '%' THEN 1
                WHEN LOWER(unaccent(COALESCE(so."bikeInfo", ''))) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                WHEN LOWER(unaccent(c.name)) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                ELSE 2
            END AS score,
            COUNT(*) OVER() AS total_count
        FROM "ServiceOrder" so
        JOIN "Customer" c ON so."customerId" = c.id
        WHERE (LOWER(so.folio) LIKE '%' || LOWER(${qLower}) || '%'
            OR LOWER(unaccent(COALESCE(so."bikeInfo", ''))) LIKE '%' || LOWER(unaccent(${qLower})) || '%'
            OR LOWER(unaccent(c.name)) LIKE '%' || LOWER(unaccent(${qLower})) || '%')
            ${branchSql}
        ORDER BY score ASC, so."createdAt" DESC
        LIMIT ${LIMIT_PER_GROUP + 1}
    `;

    const { ids, hasMore, count } = takeLimited(matches);
    if (count === 0) return null;

    const rows = await prisma.serviceOrder.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            folio: true,
            bikeInfo: true,
            customer: { select: { name: true } },
        },
    });

    const ordered = preserveOrder(ids, rows);
    const results: SearchResult[] = ordered.map((so) => ({
        id: so.id,
        category: "service-order",
        title: so.folio,
        subtitle: so.bikeInfo ? `${so.customer.name} · ${so.bikeInfo}` : so.customer.name,
        href: `/workshop/${so.id}`,
    }));

    return {
        category: "service-order",
        label: CATEGORY_LABEL["service-order"],
        count,
        hasMore,
        results,
    };
}

// ─────────────────────────────────────────────────────────────────────────────
// Sale
// ─────────────────────────────────────────────────────────────────────────────

async function searchSales(qLower: string, branchId: string | null): Promise<SearchGroup | null> {
    const branchSql = branchFilter(branchId, "s");
    const matches = await prisma.$queryRaw<Match[]>`
        SELECT s.id,
            CASE
                WHEN LOWER(s.folio) = LOWER(${qLower}) THEN 0
                WHEN LOWER(s.folio) LIKE LOWER(${qLower}) || '%' THEN 1
                WHEN LOWER(unaccent(COALESCE(c.name, ''))) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                ELSE 2
            END AS score,
            COUNT(*) OVER() AS total_count
        FROM "Sale" s
        LEFT JOIN "Customer" c ON s."customerId" = c.id
        WHERE (LOWER(s.folio) LIKE '%' || LOWER(${qLower}) || '%'
            OR LOWER(unaccent(COALESCE(c.name, ''))) LIKE '%' || LOWER(unaccent(${qLower})) || '%')
            ${branchSql}
        ORDER BY score ASC, s."createdAt" DESC
        LIMIT ${LIMIT_PER_GROUP + 1}
    `;

    const { ids, hasMore, count } = takeLimited(matches);
    if (count === 0) return null;

    const rows = await prisma.sale.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            folio: true,
            total: true,
            customer: { select: { name: true } },
        },
    });

    const ordered = preserveOrder(ids, rows);
    const results: SearchResult[] = ordered.map((s) => {
        const name = s.customer?.name ?? "Walk-in";
        const total = Number(s.total).toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN",
            maximumFractionDigits: 0,
        });
        return {
            id: s.id,
            category: "sale",
            title: s.folio,
            subtitle: `${name} · ${total}`,
            href: `/ventas/${s.id}`,
        };
    });

    return { category: "sale", label: CATEGORY_LABEL.sale, count, hasMore, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// Product — merge ProductVariant ("ModeloConfiguracion") + SimpleProduct
// ─────────────────────────────────────────────────────────────────────────────

type ProductMatch = Match & { source: "variant" | "simple" };

async function searchProducts(qLower: string): Promise<SearchGroup | null> {
    const [variantMatches, simpleMatches] = await Promise.all([
        prisma.$queryRaw<Match[]>`
            SELECT mc.id,
                CASE
                    WHEN LOWER(mc.sku) = LOWER(${qLower})
                      OR LOWER(unaccent(m.nombre)) = LOWER(unaccent(${qLower})) THEN 0
                    WHEN LOWER(mc.sku) LIKE LOWER(${qLower}) || '%'
                      OR LOWER(unaccent(m.nombre)) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                    ELSE 2
                END AS score,
                COUNT(*) OVER() AS total_count
            FROM "ModeloConfiguracion" mc
            JOIN "Modelo" m ON mc.modelo_id = m.id
            WHERE mc."isActive" = true
              AND (LOWER(mc.sku) LIKE '%' || LOWER(${qLower}) || '%'
                OR LOWER(unaccent(m.nombre)) LIKE '%' || LOWER(unaccent(${qLower})) || '%')
            ORDER BY score ASC, mc.id DESC
            LIMIT ${LIMIT_PER_GROUP + 1}
        `,
        prisma.$queryRaw<Match[]>`
            SELECT id,
                CASE
                    WHEN LOWER(codigo) = LOWER(${qLower})
                      OR LOWER(unaccent(nombre)) = LOWER(unaccent(${qLower})) THEN 0
                    WHEN LOWER(codigo) LIKE LOWER(${qLower}) || '%'
                      OR LOWER(unaccent(nombre)) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                    ELSE 2
                END AS score,
                COUNT(*) OVER() AS total_count
            FROM "SimpleProduct"
            WHERE "isActive" = true
              AND (LOWER(codigo) LIKE '%' || LOWER(${qLower}) || '%'
                OR LOWER(unaccent(nombre)) LIKE '%' || LOWER(unaccent(${qLower})) || '%'
                OR LOWER(unaccent(COALESCE(descripcion, ''))) LIKE '%' || LOWER(unaccent(${qLower})) || '%')
            ORDER BY score ASC, "createdAt" DESC
            LIMIT ${LIMIT_PER_GROUP + 1}
        `,
    ]);

    const variantCount = variantMatches.length > 0 ? Number(variantMatches[0].total_count) : 0;
    const simpleCount = simpleMatches.length > 0 ? Number(simpleMatches[0].total_count) : 0;
    const count = variantCount + simpleCount;
    if (count === 0) return null;

    const merged: ProductMatch[] = [
        ...variantMatches.map((m) => ({ ...m, source: "variant" as const })),
        ...simpleMatches.map((m) => ({ ...m, source: "simple" as const })),
    ].sort((a, b) => a.score - b.score);

    const top = merged.slice(0, LIMIT_PER_GROUP);
    const hasMore = count > LIMIT_PER_GROUP;

    const variantIds = top.filter((m) => m.source === "variant").map((m) => m.id);
    const simpleIds = top.filter((m) => m.source === "simple").map((m) => m.id);

    const [variantRows, simpleRows] = await Promise.all([
        variantIds.length === 0
            ? Promise.resolve([])
            : prisma.productVariant.findMany({
                where: { id: { in: variantIds } },
                select: {
                    id: true,
                    sku: true,
                    modelo: { select: { nombre: true } },
                    color: { select: { nombre: true } },
                    voltaje: { select: { valor: true } },
                },
            }),
        simpleIds.length === 0
            ? Promise.resolve([])
            : prisma.simpleProduct.findMany({
                where: { id: { in: simpleIds } },
                select: { id: true, codigo: true, nombre: true },
            }),
    ]);

    const variantMap = new Map(variantRows.map((r) => [r.id, r]));
    const simpleMap = new Map(simpleRows.map((r) => [r.id, r]));

    const results: SearchResult[] = top
        .map((m): SearchResult | null => {
            if (m.source === "variant") {
                const v = variantMap.get(m.id);
                if (!v) return null;
                const title = `${v.modelo.nombre} ${v.color.nombre} ${v.voltaje.valor}V`;
                return {
                    id: v.id,
                    category: "product",
                    title,
                    subtitle: `SKU ${v.sku}`,
                    href: `/configuracion/catalogo?search=${encodeURIComponent(v.sku)}`,
                };
            } else {
                const s = simpleMap.get(m.id);
                if (!s) return null;
                return {
                    id: s.id,
                    category: "product",
                    title: s.nombre,
                    subtitle: `Código ${s.codigo}`,
                    href: `/configuracion/catalogo?search=${encodeURIComponent(s.codigo)}`,
                };
            }
        })
        .filter((r): r is SearchResult => r !== null);

    return { category: "product", label: CATEGORY_LABEL.product, count, hasMore, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// Quotation — tabla "cotizaciones" (@@map)
// ─────────────────────────────────────────────────────────────────────────────

async function searchQuotations(qLower: string, branchId: string | null): Promise<SearchGroup | null> {
    const branchSql = branchFilter(branchId, "q");
    const matches = await prisma.$queryRaw<Match[]>`
        SELECT q.id,
            CASE
                WHEN LOWER(q.folio) = LOWER(${qLower}) THEN 0
                WHEN LOWER(q.folio) LIKE LOWER(${qLower}) || '%' THEN 1
                WHEN LOWER(unaccent(COALESCE(c.name, q."anonymousCustomerName", ''))) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                ELSE 2
            END AS score,
            COUNT(*) OVER() AS total_count
        FROM "cotizaciones" q
        LEFT JOIN "Customer" c ON q."customerId" = c.id
        WHERE (LOWER(q.folio) LIKE '%' || LOWER(${qLower}) || '%'
            OR LOWER(unaccent(COALESCE(c.name, q."anonymousCustomerName", ''))) LIKE '%' || LOWER(unaccent(${qLower})) || '%')
            ${branchSql}
        ORDER BY score ASC, q."createdAt" DESC
        LIMIT ${LIMIT_PER_GROUP + 1}
    `;

    const { ids, hasMore, count } = takeLimited(matches);
    if (count === 0) return null;

    const rows = await prisma.quotation.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            folio: true,
            anonymousCustomerName: true,
            customer: { select: { name: true } },
        },
    });

    const ordered = preserveOrder(ids, rows);
    const results: SearchResult[] = ordered.map((q) => ({
        id: q.id,
        category: "quotation",
        title: q.folio,
        subtitle: q.customer?.name ?? q.anonymousCustomerName ?? "Sin cliente",
        href: `/cotizaciones/${q.id}`,
    }));

    return { category: "quotation", label: CATEGORY_LABEL.quotation, count, hasMore, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// PurchaseReceipt
// ─────────────────────────────────────────────────────────────────────────────

async function searchReceipts(qLower: string, branchId: string | null): Promise<SearchGroup | null> {
    const branchSql = branchFilter(branchId);
    const matches = await prisma.$queryRaw<Match[]>`
        SELECT id,
            CASE
                WHEN LOWER(unaccent(proveedor)) = LOWER(unaccent(${qLower})) THEN 0
                WHEN LOWER(unaccent(proveedor)) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                WHEN LOWER(COALESCE("folioFacturaProveedor", '')) LIKE LOWER(${qLower}) || '%' THEN 1
                ELSE 2
            END AS score,
            COUNT(*) OVER() AS total_count
        FROM "PurchaseReceipt"
        WHERE (LOWER(unaccent(proveedor)) LIKE '%' || LOWER(unaccent(${qLower})) || '%'
            OR LOWER(COALESCE("folioFacturaProveedor", '')) LIKE '%' || LOWER(${qLower}) || '%')
            ${branchSql}
        ORDER BY score ASC, "createdAt" DESC
        LIMIT ${LIMIT_PER_GROUP + 1}
    `;

    const { ids, hasMore, count } = takeLimited(matches);
    if (count === 0) return null;

    const rows = await prisma.purchaseReceipt.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            proveedor: true,
            folioFacturaProveedor: true,
            totalPagado: true,
        },
    });

    const ordered = preserveOrder(ids, rows);
    const results: SearchResult[] = ordered.map((r) => {
        const folio = r.folioFacturaProveedor ?? "Sin factura";
        const total = Number(r.totalPagado).toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN",
            maximumFractionDigits: 0,
        });
        return {
            id: r.id,
            category: "receipt",
            title: r.proveedor,
            subtitle: `${folio} · ${total}`,
            href: `/inventario/recepciones/${r.id}`,
        };
    });

    return { category: "receipt", label: CATEGORY_LABEL.receipt, count, hasMore, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// OperationalExpense
// ─────────────────────────────────────────────────────────────────────────────

async function searchExpenses(qLower: string, branchId: string | null): Promise<SearchGroup | null> {
    const branchSql = branchFilter(branchId);
    const matches = await prisma.$queryRaw<Match[]>`
        SELECT id,
            CASE
                WHEN LOWER(unaccent(descripcion)) = LOWER(unaccent(${qLower})) THEN 0
                WHEN LOWER(unaccent(descripcion)) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                ELSE 2
            END AS score,
            COUNT(*) OVER() AS total_count
        FROM "OperationalExpense"
        WHERE "isAnulado" = false
          AND LOWER(unaccent(descripcion)) LIKE '%' || LOWER(unaccent(${qLower})) || '%'
          ${branchSql}
        ORDER BY score ASC, "createdAt" DESC
        LIMIT ${LIMIT_PER_GROUP + 1}
    `;

    const { ids, hasMore, count } = takeLimited(matches);
    if (count === 0) return null;

    const rows = await prisma.operationalExpense.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            descripcion: true,
            categoria: true,
            monto: true,
            fecha: true,
        },
    });

    const ordered = preserveOrder(ids, rows);
    const results: SearchResult[] = ordered.map((e) => {
        const monto = Number(e.monto).toLocaleString("es-MX", {
            style: "currency",
            currency: "MXN",
            maximumFractionDigits: 0,
        });
        const fecha = e.fecha.toISOString().slice(0, 10);
        return {
            id: e.id,
            category: "expense",
            title: e.descripcion,
            subtitle: `${e.categoria} · ${monto} · ${fecha}`,
            href: `/tesoreria`,
        };
    });

    return { category: "expense", label: CATEGORY_LABEL.expense, count, hasMore, results };
}

// ─────────────────────────────────────────────────────────────────────────────
// AuthorizationRequest — últimos 30 días
// ─────────────────────────────────────────────────────────────────────────────

async function searchAuthorizations(qLower: string, branchId: string | null): Promise<SearchGroup | null> {
    const branchSql = branchFilter(branchId, "ar");
    const matches = await prisma.$queryRaw<Match[]>`
        SELECT ar.id,
            CASE
                WHEN LOWER(unaccent(COALESCE(ar.motivo, ''))) = LOWER(unaccent(${qLower})) THEN 0
                WHEN LOWER(unaccent(COALESCE(ar.motivo, ''))) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                WHEN LOWER(unaccent(COALESCE(ar."rejectReason", ''))) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                WHEN LOWER(unaccent(u.name)) LIKE LOWER(unaccent(${qLower})) || '%' THEN 1
                ELSE 2
            END AS score,
            COUNT(*) OVER() AS total_count
        FROM "AuthorizationRequest" ar
        JOIN "User" u ON ar."requestedBy" = u.id
        WHERE ar.status IN ('PENDING', 'APPROVED', 'REJECTED')
          AND ar."createdAt" >= NOW() - INTERVAL '30 days'
          AND (LOWER(unaccent(COALESCE(ar.motivo, ''))) LIKE '%' || LOWER(unaccent(${qLower})) || '%'
            OR LOWER(unaccent(COALESCE(ar."rejectReason", ''))) LIKE '%' || LOWER(unaccent(${qLower})) || '%'
            OR LOWER(unaccent(u.name)) LIKE '%' || LOWER(unaccent(${qLower})) || '%')
          ${branchSql}
        ORDER BY score ASC, ar."createdAt" DESC
        LIMIT ${LIMIT_PER_GROUP + 1}
    `;

    const { ids, hasMore, count } = takeLimited(matches);
    if (count === 0) return null;

    const rows = await prisma.authorizationRequest.findMany({
        where: { id: { in: ids } },
        select: {
            id: true,
            tipo: true,
            monto: true,
            status: true,
            requester: { select: { name: true } },
        },
    });

    const ordered = preserveOrder(ids, rows);
    const results: SearchResult[] = ordered.map((ar) => {
        const monto = ar.monto
            ? ` · ${Number(ar.monto).toLocaleString("es-MX", {
                style: "currency",
                currency: "MXN",
                maximumFractionDigits: 0,
            })}`
            : "";
        return {
            id: ar.id,
            category: "authorization",
            title: `${ar.tipo}${monto}`,
            subtitle: `${ar.requester.name} · ${ar.status}`,
            href: `/autorizaciones`,
        };
    });

    return {
        category: "authorization",
        label: CATEGORY_LABEL.authorization,
        count,
        hasMore,
        results,
    };
}
