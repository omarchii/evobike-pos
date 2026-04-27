import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { normalizeForSearch } from "@/lib/customers/normalize";
import { branchWhere, getViewBranchId } from "@/lib/branch-filter";

const querySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().positive().max(100).default(25),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  userId: z.string().uuid().optional(),
  status: z.string().optional(), // comma-separated: COMPLETED,LAYAWAY,CANCELLED
  paymentMethod: z.string().optional(), // comma-separated
  folio: z.string().optional(),
  customer: z.string().optional(),
  branch: z.string().uuid().optional(),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const { id: sessionUserId, role } = user;

  // Parse query params
  const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(rawParams);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Parámetros inválidos";
    return NextResponse.json({ success: false, error: msg }, { status: 422 });
  }

  const params = parsed.data;

  // Default date range: last 30 days
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const fromDate = params.from ? new Date(params.from) : defaultFrom;
  const toDate = params.to ? new Date(params.to) : now;

  // Filtro sucursal unificado: admin respeta ?branch= / cookie / Global;
  // non-admin queda forzado a su sucursal.
  const viewBranchId = await getViewBranchId(rawParams);

  // Build where clause with role-based enforcement
  const where: Prisma.SaleWhereInput = {
    createdAt: { gte: fromDate, lte: toDate },
    ...branchWhere(viewBranchId),
  };

  if (role === "SELLER") {
    where.userId = sessionUserId;
  } else if (params.userId) {
    // MANAGER/ADMIN: filtro opcional por vendedor
    where.userId = params.userId;
  }

  // Status filter
  if (params.status) {
    const statuses = params.status.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length > 0) {
      where.status = { in: statuses as ("COMPLETED" | "LAYAWAY" | "CANCELLED")[] };
    }
  }

  // Folio search (case-insensitive partial)
  if (params.folio) {
    where.folio = { contains: params.folio, mode: "insensitive" };
  }

  // Customer name search
  if (params.customer) {
    where.customer = { nameNormalized: { contains: normalizeForSearch(params.customer) } };
  }

  // Payment method filter via CashTransaction relation
  const paymentMethods = params.paymentMethod
    ? params.paymentMethod.split(",").map((m) => m.trim()).filter(Boolean)
    : [];

  if (paymentMethods.length > 0) {
    where.payments = {
      some: {
        method: { in: paymentMethods as ("CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE" | "ATRATO")[] },
      },
    };
  }

  const limit = params.limit;
  const cursorId = params.cursor;

  try {
    // Run count and findMany in parallel
    const [totalCount, rawItems] = await Promise.all([
      prisma.sale.count({ where }),
      prisma.sale.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit + 1,
        ...(cursorId && { cursor: { id: cursorId }, skip: 1 }),
        select: {
          id: true,
          folio: true,
          createdAt: true,
          status: true,
          orderType: true,
          total: true,
          customer: { select: { name: true } },
          user: { select: { name: true } },
          payments: {
            take: 1,
            orderBy: { createdAt: "asc" },
            select: { method: true },
          },
        },
      }),
    ]);

    const hasMore = rawItems.length > limit;
    const items = hasMore ? rawItems.slice(0, limit) : rawItems;
    const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

    const data = items.map((sale) => ({
      id: sale.id,
      folio: sale.folio,
      createdAt: sale.createdAt.toISOString(),
      customerName: sale.customer?.name ?? null,
      userName: sale.user.name ?? "–",
      status: sale.status as string,
      orderType: sale.orderType as string | null,
      total: Number(sale.total),
      paymentMethod: sale.payments[0]?.method ?? null,
    }));

    return NextResponse.json({
      success: true,
      data: {
        items: data,
        nextCursor,
        totalCount,
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error al obtener ventas";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
