import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { branchWhere } from "@/lib/reportes/branch-scope";
import {
  parseDateRange,
  parseCompareMode,
  previousComparableRange,
} from "@/lib/reportes/date-range";
import { REPORTS_BY_SLUG } from "@/lib/reportes/reports-config";
import type { ReportRole } from "@/lib/reportes/reports-config";
import {
  getSalesKpis,
  getSalesChart,
  getSalesTable,
  getVendedoresOptions,
} from "./queries";
import { SalesView } from "./view";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function VentasEIngresosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;

  // Verificar rol permitido
  const reportMeta = REPORTS_BY_SLUG["ventas-e-ingresos"];
  if (!reportMeta || !reportMeta.allowedRoles.includes(user.role as ReportRole)) {
    notFound();
  }

  const sp = await searchParams;
  const isAdmin = user.role === "ADMIN";

  // Parsear filtros desde URL params
  const fromParam = getString(sp.from);
  const toParam = getString(sp.to);
  const vendedorId = getString(sp.vendedor) ?? undefined;
  const metodo = getString(sp.metodo) ?? undefined;
  const compareMode = parseCompareMode(getString(sp.compareMode));
  const compareEnabled = getString(sp.compare) !== "0";
  const filterBranchId = isAdmin ? (getString(sp.branchId) ?? null) : null;

  const { from, to } = parseDateRange({ from: fromParam, to: toParam });

  // Resolver branchId efectivo
  const scope = branchWhere({ role: user.role, branchId: user.branchId }, filterBranchId ?? undefined);
  const effectiveBranchId = scope.branchId ?? null;

  const filters = { from, to, vendedorId, metodo };

  // Leer uiPreferences para restaurar último estado si no hay URL params
  let restoredFilters: Record<string, string> = {};
  const hasUrlFilters = fromParam || toParam || vendedorId || metodo;
  if (!hasUrlFilters) {
    const userData = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { uiPreferences: true },
    });
    if (
      userData?.uiPreferences &&
      typeof userData.uiPreferences === "object" &&
      !Array.isArray(userData.uiPreferences)
    ) {
      const prefs = userData.uiPreferences as Record<string, unknown>;
      const saved = prefs["ventas-e-ingresos"];
      if (saved && typeof saved === "object" && !Array.isArray(saved)) {
        restoredFilters = saved as Record<string, string>;
      }
    }
  }

  // Queries en paralelo
  const compareRange = previousComparableRange({ from, to }, compareMode);
  const compareFilters = { ...filters, from: compareRange.from, to: compareRange.to };

  const [kpis, chartData, tableRows, compareKpis, vendedoresOptions] = await Promise.all([
    getSalesKpis(effectiveBranchId, filters),
    getSalesChart(effectiveBranchId, filters),
    getSalesTable(effectiveBranchId, filters),
    compareEnabled ? getSalesKpis(effectiveBranchId, compareFilters) : Promise.resolve(null),
    getVendedoresOptions(effectiveBranchId),
  ]);

  return (
    <SalesView
      kpis={kpis}
      compareKpis={compareKpis}
      chartData={chartData}
      tableRows={tableRows}
      vendedoresOptions={vendedoresOptions}
      initialFrom={fromParam ?? restoredFilters.from ?? ""}
      initialTo={toParam ?? restoredFilters.to ?? ""}
      initialVendedor={vendedorId ?? restoredFilters.vendedor ?? ""}
      initialMetodo={metodo ?? restoredFilters.metodo ?? ""}
      compareMode={compareMode}
      compareEnabled={compareEnabled}
      isAdmin={isAdmin}
    />
  );
}
