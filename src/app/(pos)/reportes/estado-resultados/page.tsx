import type { SessionUser } from "@/lib/auth-types";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  parseDateRange,
  parseCompareMode,
  previousComparableRange,
} from "@/lib/reportes/date-range";
import { REPORTS_BY_SLUG } from "@/lib/reportes/reports-config";
import type { ReportRole } from "@/lib/reportes/reports-config";
import { getMetricsForReport } from "@/lib/reportes/alert-metrics";
import { fetchEstadoResultados } from "./queries";
import { EstadoResultadosView } from "./view";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function getString(v: string | string[] | undefined): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function EstadoResultadosPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;

  const reportMeta = REPORTS_BY_SLUG["estado-resultados"];
  if (!reportMeta || !reportMeta.allowedRoles.includes(user.role as ReportRole)) {
    notFound();
  }

  const sp = await searchParams;

  const fromParam = getString(sp.from);
  const toParam = getString(sp.to);
  const compareMode = parseCompareMode(getString(sp.compareMode));
  const compareEnabled = getString(sp.compare) !== "0";
  const filterBranchId = getString(sp.branchId) ?? null;
  const view = getString(sp.view) === "comparativa" ? "comparativa" : "consolidado";

  const { from, to } = parseDateRange({ from: fromParam, to: toParam });
  const compareRange = previousComparableRange({ from, to }, compareMode);

  const metricKeys = getMetricsForReport("estado-resultados");

  const [data, compareData, branches, rawThresholds] = await Promise.all([
    fetchEstadoResultados({ from, to, branchId: filterBranchId }),
    compareEnabled
      ? fetchEstadoResultados({
          from: compareRange.from,
          to: compareRange.to,
          branchId: filterBranchId,
        })
      : Promise.resolve(null),
    prisma.branch.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { code: "asc" },
    }),
    prisma.alertThreshold.findMany({
      where: {
        metricKey: { in: metricKeys },
        ...(filterBranchId ? { branchId: filterBranchId } : {}),
      },
    }),
  ]);

  const thresholds = rawThresholds.map((t) => ({
    id: t.id,
    metricKey: t.metricKey,
    branchId: t.branchId,
    thresholdValue: Number(t.thresholdValue),
    comparator: t.comparator as "LT" | "LTE" | "GT" | "GTE" | "EQ",
    isActive: t.isActive,
  }));

  return (
    <EstadoResultadosView
      data={data}
      compareData={compareData}
      initialFrom={fromParam ?? ""}
      initialTo={toParam ?? ""}
      compareMode={compareMode}
      compareEnabled={compareEnabled}
      view={view}
      currentBranchId={filterBranchId}
      branches={branches.map((b) => ({ id: b.id, label: `${b.name} (${b.code})` }))}
      thresholds={thresholds}
    />
  );
}
