import { KpiCard } from "./kpi-card";
import type { KpiSpec } from "./kpi-card";

export type { KpiSpec };

type KpiGridProps = {
  kpis: KpiSpec[];
};

export function KpiGrid({ kpis }: KpiGridProps) {
  return (
    <div className="grid grid-cols-6 gap-4 max-[768px]:grid-cols-2">
      {kpis.map((kpi) => (
        <KpiCard key={kpi.key} kpi={kpi} />
      ))}
    </div>
  );
}
