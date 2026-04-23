// KPI strip del perfil de cliente (BRIEF §7.4 Sub-fase E):
// LTV total · Última visita · Sucursal preferida.
// Reusa <KpiCard> de los reportes para coherencia visual.

import { KpiCard, type KpiSpec } from "@/components/reportes/shell/kpi-card";
import { formatMXN, formatRelative, formatPercent } from "@/lib/format";
import type { ProfileKpis } from "@/lib/customers/profile-data";

interface Props {
  kpis: ProfileKpis;
}

export function CustomerKpiStrip({ kpis }: Props): React.JSX.Element {
  const ltvSpec: KpiSpec = {
    key: "ltv",
    label: "LTV total",
    value: formatMXN(kpis.ltvTotal, { compact: true }),
    delta:
      kpis.ltvDeltaPct !== null
        ? { value: kpis.ltvDeltaPct, format: "percent" }
        : undefined,
    featured: true,
  };

  const lastSpec: KpiSpec = {
    key: "last",
    label: "Última visita",
    value: kpis.lastActivityAt ? formatRelative(kpis.lastActivityAt) : "—",
  };

  const branchSpec: KpiSpec = {
    key: "branch",
    label: "Sucursal preferida",
    value: kpis.preferredBranch
      ? kpis.preferredBranch.name
      : "—",
  };

  return (
    <div className="grid grid-cols-4 gap-4 max-[768px]:grid-cols-2">
      <KpiCard kpi={ltvSpec} />
      <KpiCard kpi={lastSpec} />
      <div
        className="col-span-1 rounded-[var(--r-lg)] flex flex-col gap-2"
        style={{ background: "var(--surf-lowest)", padding: "var(--density-card)" }}
      >
        <p
          className="text-[0.5625rem] font-medium uppercase tracking-[0.05em]"
          style={{ color: "var(--on-surf-var)" }}
        >
          {branchSpec.label}
        </p>
        <p
          className="font-bold tracking-[-0.02em] leading-tight tabular-nums truncate"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "1.5rem",
            color: "var(--on-surf)",
          }}
          title={kpis.preferredBranch?.name ?? "—"}
        >
          {branchSpec.value}
        </p>
        {kpis.preferredBranch && (
          <span
            className="text-[0.6875rem]"
            style={{ color: "var(--on-surf-var)" }}
          >
            {formatPercent(kpis.preferredBranch.pct, { decimals: 0 })} de visitas
          </span>
        )}
      </div>
    </div>
  );
}
