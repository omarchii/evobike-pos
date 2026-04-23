import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { serializeDecimal } from "@/lib/reportes/money";
import { AnualClient } from "./anual-client";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function getStr(v: string | string[] | undefined): string | undefined {
  if (!v) return undefined;
  return Array.isArray(v) ? v[0] : v;
}

const MES_LABELS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

// ── Tipos serializados para el Client Component ───────────────────────────────

export interface BranchData {
  ingresos: number;
  gastosOperativos: number;
  comprasProveedor: number;
  margenOperativo: number;
}

export interface MonthRow {
  monthKey: string;    // "2026-01"
  monthLabel: string;  // "Enero"
  monthShort: string;  // "Ene"
  byBranch: Record<string, BranchData>;
  totalIngresos: number;
  totalGastos: number;
  totalCompras: number;
  totalMargen: number;
}

export interface BranchOption {
  id: string;
  name: string;
  code: string;
}

export interface AnualData {
  year: number;
  view: "comparativa" | "consolidado";
  months: MonthRow[];
  branches: BranchOption[];
  availableYears: number[];
  isEmpty: boolean;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function ReporteAnualPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user || user.role !== "ADMIN") {
    redirect("/reportes");
  }

  const params = await searchParams;
  const yearStr = getStr(params.year);
  const viewStr = getStr(params.view);

  const now = new Date();
  const currentYear = now.getFullYear();

  const year = (() => {
    const n = yearStr ? parseInt(yearStr, 10) : currentYear;
    if (Number.isNaN(n) || n < 2020 || n > currentYear + 1) return currentYear;
    return n;
  })();

  const view = viewStr === "consolidado" ? "consolidado" : "comparativa";

  const yearStart = new Date(year, 0, 1, 0, 0, 0, 0);
  const yearEnd =
    year === currentYear ? now : new Date(year, 11, 31, 23, 59, 59, 999);

  const [sales, operationalExpenses, cashExpenses, purchaseReceipts, branches] =
    await Promise.all([
      prisma.sale.findMany({
        where: {
          status: "COMPLETED",
          excludeFromRevenue: false,
          createdAt: { gte: yearStart, lte: yearEnd },
        },
        select: { branchId: true, total: true, createdAt: true },
      }),
      prisma.operationalExpense.findMany({
        where: {
          isAnulado: false,
          fecha: { gte: yearStart, lte: yearEnd },
          metodoPago: { in: ["CARD", "TRANSFER", "CREDIT_BALANCE"] },
        },
        select: { branchId: true, monto: true, fecha: true },
      }),
      prisma.cashTransaction.findMany({
        where: {
          type: "EXPENSE_OUT",
          createdAt: { gte: yearStart, lte: yearEnd },
        },
        select: {
          amount: true,
          createdAt: true,
          session: { select: { branchId: true } },
        },
      }),
      prisma.purchaseReceipt.findMany({
        where: {
          createdAt: { gte: yearStart, lte: yearEnd },
        },
        select: { branchId: true, totalPagado: true, createdAt: true },
      }),
      prisma.branch.findMany({
        select: { id: true, name: true, code: true },
        orderBy: { code: "asc" },
      }),
    ]);

  // ── Aggregation matrix: branchId → monthKey → BranchData ─────────────────

  const matrix = new Map<string, Map<string, BranchData>>();

  for (const branch of branches) {
    const branchMap = new Map<string, BranchData>();
    for (let m = 0; m < 12; m++) {
      const mk = `${year}-${String(m + 1).padStart(2, "0")}`;
      branchMap.set(mk, {
        ingresos: 0,
        gastosOperativos: 0,
        comprasProveedor: 0,
        margenOperativo: 0,
      });
    }
    matrix.set(branch.id, branchMap);
  }

  function getEntry(branchId: string, date: Date): BranchData | null {
    const branchMap = matrix.get(branchId);
    if (!branchMap) return null;
    if (date.getFullYear() !== year) return null;
    const mk = `${year}-${String(date.getMonth() + 1).padStart(2, "0")}`;
    return branchMap.get(mk) ?? null;
  }

  for (const s of sales) {
    const entry = getEntry(s.branchId, s.createdAt);
    if (entry) entry.ingresos += serializeDecimal(s.total);
  }

  for (const e of operationalExpenses) {
    const entry = getEntry(e.branchId, e.fecha);
    if (entry) entry.gastosOperativos += serializeDecimal(e.monto);
  }

  for (const c of cashExpenses) {
    const branchId = c.session.branchId;
    const entry = getEntry(branchId, c.createdAt);
    if (entry) entry.gastosOperativos += serializeDecimal(c.amount);
  }

  for (const p of purchaseReceipts) {
    const entry = getEntry(p.branchId, p.createdAt);
    if (entry) entry.comprasProveedor += serializeDecimal(p.totalPagado);
  }

  for (const branchMap of matrix.values()) {
    for (const entry of branchMap.values()) {
      entry.margenOperativo = entry.ingresos - entry.gastosOperativos;
    }
  }

  // ── Build MonthRow[] ──────────────────────────────────────────────────────

  const SHORT_LABELS = [
    "Ene", "Feb", "Mar", "Abr", "May", "Jun",
    "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
  ];

  const months: MonthRow[] = [];
  for (let m = 0; m < 12; m++) {
    const mk = `${year}-${String(m + 1).padStart(2, "0")}`;
    const byBranch: Record<string, BranchData> = {};
    let totalIngresos = 0;
    let totalGastos = 0;
    let totalCompras = 0;

    for (const branch of branches) {
      const entry = matrix.get(branch.id)?.get(mk) ?? {
        ingresos: 0,
        gastosOperativos: 0,
        comprasProveedor: 0,
        margenOperativo: 0,
      };
      byBranch[branch.id] = entry;
      totalIngresos += entry.ingresos;
      totalGastos += entry.gastosOperativos;
      totalCompras += entry.comprasProveedor;
    }

    months.push({
      monthKey: mk,
      monthLabel: MES_LABELS[m]!,
      monthShort: SHORT_LABELS[m]!,
      byBranch,
      totalIngresos,
      totalGastos,
      totalCompras,
      totalMargen: totalIngresos - totalGastos,
    });
  }

  const isEmpty =
    sales.length === 0 &&
    operationalExpenses.length === 0 &&
    cashExpenses.length === 0 &&
    purchaseReceipts.length === 0;

  // Last 5 years (tech-debt: derive from actual data — see ROADMAP P10-I)
  const availableYears: number[] = [];
  for (let y = currentYear; y >= Math.max(2020, currentYear - 4); y--) {
    availableYears.push(y);
  }

  const data: AnualData = {
    year,
    view,
    months,
    branches: branches.map((b) => ({ id: b.id, name: b.name, code: b.code })),
    availableYears,
    isEmpty,
  };

  return <AnualClient data={data} />;
}
