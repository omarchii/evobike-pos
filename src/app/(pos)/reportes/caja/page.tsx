import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CashReport } from "./cash-report";
import type { Prisma } from "@prisma/client";
import { parseLocalDate } from "@/lib/reportes/date-range";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  branchId: string | null;
  role: string;
}

// ── Types shared with client component ───────────────────────────────────────

export type PaymentMethodKey = "CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE" | "ATRATO";

export interface TransactionRow {
  id: string;
  type: string;
  method: string;
  amount: number;
  reference: string | null;
  collectionStatus: string;
  createdAt: string;
  saleFolio: string | null;
}

export interface SessionRow {
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

export interface PeriodSummary {
  totalCollected: number;
  totalPending: number;
  totalRefunds: number;
  totalExpenses: number;
  totalWithdrawals: number;
  netOperating: number;
}

export interface MethodBreakdown {
  collected: number;
  pending: number;
}

export interface DayRow {
  date: string;
  collected: number;
  pending: number;
}

export interface CashierOption {
  id: string;
  name: string;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getString(val: string | string[] | undefined): string | undefined {
  if (!val) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

export default async function ReportesCajaPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    redirect("/");
  }

  const branchId = user.branchId;
  if (!branchId) redirect("/");

  const params = await searchParams;
  const view = (getString(params.view) ?? "sessions") as "sessions" | "period";
  const fromParam = getString(params.from);
  const toParam = getString(params.to);
  const userIdParam = getString(params.userId);

  // Default: current month
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromDate =
    (fromParam ? parseLocalDate(fromParam, false) : null) ?? defaultFrom;
  const toDate =
    (toParam ? parseLocalDate(toParam, true) : null) ?? now;

  // Fetch cashiers for filter
  const cashiers = await prisma.user.findMany({
    where: {
      branchId,
      sessions: { some: {} },
    },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  const cashierOptions: CashierOption[] = cashiers.map((c) => ({
    id: c.id,
    name: c.name ?? "–",
  }));

  // Build session query
  const sessionWhere: Prisma.CashRegisterSessionWhereInput = {
    branchId,
    openedAt: { gte: fromDate, lte: toDate },
    ...(userIdParam && { userId: userIdParam }),
  };

  if (view === "sessions") {
    const data = await buildSessionsData(sessionWhere);
    return (
      <CashReport
        view="sessions"
        sessionsData={data}
        periodData={null}
        cashiers={cashierOptions}
        currentFilters={{
          view,
          from: fromParam ?? defaultFrom.toISOString().substring(0, 10),
          to: toParam ?? now.toISOString().substring(0, 10),
          userId: userIdParam ?? "",
        }}
        role={user.role}
      />
    );
  } else {
    const data = await buildPeriodData(branchId, fromDate, toDate, userIdParam);
    return (
      <CashReport
        view="period"
        sessionsData={null}
        periodData={data}
        cashiers={cashierOptions}
        currentFilters={{
          view,
          from: fromParam ?? defaultFrom.toISOString().substring(0, 10),
          to: toParam ?? now.toISOString().substring(0, 10),
          userId: userIdParam ?? "",
        }}
        role={user.role}
      />
    );
  }
}

// ── Sessions data builder ────────────────────────────────────────────────────

async function buildSessionsData(
  where: Prisma.CashRegisterSessionWhereInput,
): Promise<SessionRow[]> {
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

  return sessions.map((s) => {
    const openingAmt = Number(s.openingAmt);
    const closingAmt = s.closingAmt !== null ? Number(s.closingAmt) : null;

    let cashIn = 0;
    let cashOut = 0;
    let totalCollected = 0;
    let totalPending = 0;

    const byMethod: Record<PaymentMethodKey, number> = {
      CASH: 0, CARD: 0, TRANSFER: 0, CREDIT_BALANCE: 0, ATRATO: 0,
    };

    const transactions: TransactionRow[] = [];

    for (const tx of s.transactions) {
      const amt = Number(tx.amount);
      const method = tx.method as PaymentMethodKey;

      byMethod[method] = (byMethod[method] ?? 0) + amt;

      if (tx.type === "PAYMENT_IN") {
        if (tx.collectionStatus === "COLLECTED") {
          totalCollected += amt;
        } else {
          totalPending += amt;
        }
      }

      if (method === "CASH") {
        if (tx.type === "PAYMENT_IN") {
          cashIn += amt;
        } else {
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
    const round = (n: number): number => Math.round(n * 100) / 100;

    return {
      id: s.id,
      userName: s.user.name ?? "–",
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt?.toISOString() ?? null,
      openingAmt,
      closingAmt,
      cashReal: round(cashReal),
      difference: difference !== null ? round(difference) : null,
      totalCollected: round(totalCollected),
      totalPending: round(totalPending),
      transactionCount: s.transactions.length,
      byMethod,
      transactions,
    };
  });
}

// ── Period data builder ──────────────────────────────────────────────────────

async function buildPeriodData(
  branchId: string,
  from: Date,
  to: Date,
  userId?: string,
): Promise<{
  summary: PeriodSummary;
  byMethod: Record<PaymentMethodKey, MethodBreakdown>;
  byDay: DayRow[];
}> {
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

  const round = (n: number): number => Math.round(n * 100) / 100;

  const summary: PeriodSummary = {
    totalCollected: round(totalCollected),
    totalPending: round(totalPending),
    totalRefunds: round(totalRefunds),
    totalExpenses: round(totalExpenses),
    totalWithdrawals: round(totalWithdrawals),
    netOperating: round(totalCollected - totalRefunds - totalExpenses - totalWithdrawals),
  };

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
