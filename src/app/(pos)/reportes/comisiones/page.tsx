import type { SessionUser } from "@/lib/auth-types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CommissionsTable } from "./commissions-table";
import { parseLocalDate } from "@/lib/reportes/date-range";

export const dynamic = "force-dynamic";

export interface CommissionRow {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  saleId: string;
  saleFolio: string;
  saleTotal: number;
  amount: number;
  status: "PENDING" | "APPROVED" | "PAID" | "CANCELLED";
  commissionType: "PERCENTAGE" | "FIXED_AMOUNT";
  ruleValue: number;
  createdAt: string;
}

export interface CommissionKpis {
  totalPending: number;
  totalApproved: number;
  totalPaid: number;
}

export interface UserOption {
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

export default async function ComisionesPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user) redirect("/login");

  const params = await searchParams;
  const fromParam = getString(params.from);
  const toParam = getString(params.to);
  const statusParam = getString(params.status);
  const userIdParam = getString(params.userId);

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromDate =
    (fromParam ? parseLocalDate(fromParam, false) : null) ?? defaultFrom;
  const toDate =
    (toParam ? parseLocalDate(toParam, true) : null) ?? now;

  const statuses = statusParam ? statusParam.split(",").filter(Boolean) : [];

  // Build query filter
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    createdAt: { gte: fromDate, lte: toDate },
    ...(statuses.length > 0 && { status: { in: statuses } }),
  };

  if (user.role === "SELLER") {
    where.userId = user.id;
  } else if (user.role === "MANAGER") {
    if (!user.branchId) redirect("/");
    where.user = { branchId: user.branchId };
    if (userIdParam) where.userId = userIdParam;
  } else if (user.role === "ADMIN") {
    if (userIdParam) where.userId = userIdParam;
  } else {
    redirect("/");
  }

  const [records, sellers] = await Promise.all([
    prisma.commissionRecord.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, role: true } },
        sale: { select: { folio: true, total: true } },
        rule: { select: { commissionType: true, value: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    // For filter dropdown: users with commissions in this branch
    user.role !== "SELLER"
      ? prisma.user.findMany({
          where: user.role === "MANAGER"
            ? { branchId: user.branchId! }
            : {},
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([]),
  ]);

  const rows: CommissionRow[] = records.map((r) => ({
    id: r.id,
    userId: r.userId,
    userName: r.user.name,
    userRole: r.user.role,
    saleId: r.saleId,
    saleFolio: r.sale.folio,
    saleTotal: Number(r.sale.total),
    amount: Number(r.amount),
    status: r.status as CommissionRow["status"],
    commissionType: r.rule.commissionType as CommissionRow["commissionType"],
    ruleValue: Number(r.rule.value),
    createdAt: r.createdAt.toISOString(),
  }));

  const totals = rows.reduce(
    (acc, r) => {
      if (r.status === "PENDING") acc.pending += r.amount;
      else if (r.status === "APPROVED") acc.approved += r.amount;
      else if (r.status === "PAID") acc.paid += r.amount;
      return acc;
    },
    { pending: 0, approved: 0, paid: 0 },
  );

  const round = (n: number): number => Math.round(n * 100) / 100;
  const kpis: CommissionKpis = {
    totalPending: round(totals.pending),
    totalApproved: round(totals.approved),
    totalPaid: round(totals.paid),
  };

  const userOptions: UserOption[] = sellers.map((s) => ({
    id: s.id,
    name: s.name,
  }));

  return (
    <CommissionsTable
      initialRows={rows}
      kpis={kpis}
      userOptions={userOptions}
      userRole={user.role}
      currentFilters={{
        from: fromParam ?? defaultFrom.toISOString().substring(0, 10),
        to: toParam ?? now.toISOString().substring(0, 10),
        status: statusParam ?? "",
        userId: userIdParam ?? "",
      }}
    />
  );
}
