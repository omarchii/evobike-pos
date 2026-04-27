import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { parseLocalDate } from "@/lib/reportes/date-range";

const querySchema = z.object({
  view: z.enum(["sessions", "period"]).default("sessions"),
  from: z.string().optional(),
  to: z.string().optional(),
  branchId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
});

// ── Types for response ───────────────────────────────────────────────────────

type PaymentMethodKey = "CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE" | "ATRATO";

interface TransactionRow {
  id: string;
  type: string;
  method: string;
  amount: number;
  reference: string | null;
  collectionStatus: string;
  createdAt: string;
  saleFolio: string | null;
}

interface SessionRow {
  id: string;
  userName: string;
  openedAt: string;
  closedAt: string | null;
  openingAmt: number;
  closingAmt: number | null;
  cashReal: number;
  difference: number | null;
  totalCollected: number;
  totalPending: number;
  transactionCount: number;
  byMethod: Record<PaymentMethodKey, number>;
  transactions: TransactionRow[];
}

interface PeriodSummary {
  totalCollected: number;
  totalPending: number;
  totalRefunds: number;
  totalExpenses: number;
  totalWithdrawals: number;
  netOperating: number;
}

interface MethodBreakdown {
  collected: number;
  pending: number;
}

interface DayRow {
  date: string;
  collected: number;
  pending: number;
}

// GET /api/reportes/caja — reporte de caja por turnos o por período
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;

  // Only MANAGER and ADMIN can access cash reports
  if (user.role !== "MANAGER" && user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
  }

  const rawParams = Object.fromEntries(req.nextUrl.searchParams.entries());
  const parsed = querySchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Parámetros inválidos" },
      { status: 422 },
    );
  }

  const params = parsed.data;

  // Date range defaults: current month
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromDate =
    (params.from ? parseLocalDate(params.from, false) : null) ?? defaultFrom;
  const toDate =
    (params.to ? parseLocalDate(params.to, true) : null) ?? now;

  // Branch enforcement
  const branchId =
    user.role === "ADMIN" && params.branchId
      ? params.branchId
      : user.branchId;

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 },
    );
  }

  try {
    if (params.view === "sessions") {
      const data = await buildSessionsView(branchId, fromDate, toDate, params.userId);
      return NextResponse.json({ success: true, data });
    } else {
      const data = await buildPeriodView(branchId, fromDate, toDate, params.userId);
      return NextResponse.json({ success: true, data });
    }
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error al generar reporte";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── Sessions view ────────────────────────────────────────────────────────────

async function buildSessionsView(
  branchId: string,
  from: Date,
  to: Date,
  userId?: string,
): Promise<{ sessions: SessionRow[] }> {
  const where: Prisma.CashRegisterSessionWhereInput = {
    branchId,
    openedAt: { gte: from, lte: to },
    ...(userId && { userId }),
  };

  const sessions = await prisma.cashRegisterSession.findMany({
    where,
    orderBy: { openedAt: "desc" },
    include: {
      user: { select: { name: true } },
      transactions: {
        orderBy: { createdAt: "asc" },
        include: {
          sale: { select: { folio: true } },
        },
      },
    },
  });

  const rows: SessionRow[] = sessions.map((s) => {
    const openingAmt = Number(s.openingAmt);
    const closingAmt = s.closingAmt !== null ? Number(s.closingAmt) : null;

    // Compute cash-only flows for the physical cash in drawer
    let cashIn = 0;
    let cashOut = 0;
    let totalCollected = 0;
    let totalPending = 0;

    const byMethod: Record<PaymentMethodKey, number> = {
      CASH: 0,
      CARD: 0,
      TRANSFER: 0,
      CREDIT_BALANCE: 0,
      ATRATO: 0,
    };

    const transactions: TransactionRow[] = [];

    for (const tx of s.transactions) {
      const amt = Number(tx.amount);
      const method = tx.method as PaymentMethodKey;

      // Accumulate by method (all types)
      byMethod[method] = (byMethod[method] ?? 0) + amt;

      // COLLECTED vs PENDING split
      if (tx.type === "PAYMENT_IN") {
        if (tx.collectionStatus === "COLLECTED") {
          totalCollected += amt;
        } else {
          totalPending += amt;
        }
      }

      // Cash drawer physical flow (only CASH method affects the physical drawer)
      if (method === "CASH") {
        if (tx.type === "PAYMENT_IN") {
          cashIn += amt;
        } else {
          // REFUND_OUT, EXPENSE_OUT, WITHDRAWAL
          cashOut += amt;
        }
      }

      transactions.push({
        id: tx.id,
        type: tx.type,
        method: tx.method,
        amount: amt,
        reference: tx.reference,
        collectionStatus: tx.collectionStatus,
        createdAt: tx.createdAt.toISOString(),
        saleFolio: tx.sale?.folio ?? null,
      });
    }

    const cashReal = openingAmt + cashIn - cashOut;
    const difference = closingAmt !== null ? closingAmt - cashReal : null;

    return {
      id: s.id,
      userName: s.user.name ?? "–",
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      openingAmt,
      closingAmt,
      cashReal: Math.round(cashReal * 100) / 100,
      difference: difference !== null ? Math.round(difference * 100) / 100 : null,
      totalCollected: Math.round(totalCollected * 100) / 100,
      totalPending: Math.round(totalPending * 100) / 100,
      transactionCount: s.transactions.length,
      byMethod,
      transactions,
    };
  });

  return { sessions: rows };
}

// ── Period view ──────────────────────────────────────────────────────────────

async function buildPeriodView(
  branchId: string,
  from: Date,
  to: Date,
  userId?: string,
): Promise<{
  summary: PeriodSummary;
  byMethod: Record<PaymentMethodKey, MethodBreakdown>;
  byDay: DayRow[];
}> {
  // Get all sessions in range for the branch, with their transactions
  const sessionWhere: Prisma.CashRegisterSessionWhereInput = {
    branchId,
    ...(userId && { userId }),
  };

  const transactions = await prisma.cashTransaction.findMany({
    where: {
      createdAt: { gte: from, lte: to },
      session: sessionWhere,
    },
    select: {
      type: true,
      method: true,
      amount: true,
      collectionStatus: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });

  // Aggregation
  let totalCollected = 0;
  let totalPending = 0;
  let totalRefunds = 0;
  let totalExpenses = 0;
  let totalWithdrawals = 0;

  const byMethod: Record<PaymentMethodKey, MethodBreakdown> = {
    CASH: { collected: 0, pending: 0 },
    CARD: { collected: 0, pending: 0 },
    TRANSFER: { collected: 0, pending: 0 },
    CREDIT_BALANCE: { collected: 0, pending: 0 },
    ATRATO: { collected: 0, pending: 0 },
  };

  const dayMap = new Map<string, { collected: number; pending: number }>();

  for (const tx of transactions) {
    const amt = Number(tx.amount);
    const method = tx.method as PaymentMethodKey;
    const dateKey = tx.createdAt.toISOString().substring(0, 10);

    // Ensure day entry exists
    if (!dayMap.has(dateKey)) {
      dayMap.set(dateKey, { collected: 0, pending: 0 });
    }
    const dayEntry = dayMap.get(dateKey)!;

    if (tx.type === "PAYMENT_IN") {
      if (tx.collectionStatus === "COLLECTED") {
        totalCollected += amt;
        byMethod[method].collected += amt;
        dayEntry.collected += amt;
      } else {
        totalPending += amt;
        byMethod[method].pending += amt;
        dayEntry.pending += amt;
      }
    } else if (tx.type === "REFUND_OUT") {
      totalRefunds += amt;
    } else if (tx.type === "EXPENSE_OUT") {
      totalExpenses += amt;
    } else if (tx.type === "WITHDRAWAL") {
      totalWithdrawals += amt;
    }
  }

  const netOperating = totalCollected - totalRefunds - totalExpenses - totalWithdrawals;

  const round = (n: number): number => Math.round(n * 100) / 100;

  const summary: PeriodSummary = {
    totalCollected: round(totalCollected),
    totalPending: round(totalPending),
    totalRefunds: round(totalRefunds),
    totalExpenses: round(totalExpenses),
    totalWithdrawals: round(totalWithdrawals),
    netOperating: round(netOperating),
  };

  // Round method breakdowns
  for (const key of Object.keys(byMethod) as PaymentMethodKey[]) {
    byMethod[key].collected = round(byMethod[key].collected);
    byMethod[key].pending = round(byMethod[key].pending);
  }

  const byDay: DayRow[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, vals]) => ({
      date,
      collected: round(vals.collected),
      pending: round(vals.pending),
    }));

  return { summary, byMethod, byDay };
}
