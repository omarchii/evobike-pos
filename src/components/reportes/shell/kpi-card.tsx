"use client";

import { Delta } from "@/components/primitives/delta";
import { Sparkline } from "@/components/primitives/sparkline";
import type { AlertMetricKey } from "@/lib/reportes/alert-metrics";
import { ThresholdBadge } from "./threshold-badge";

export type KpiSpec = {
  key: string;
  label: string;
  value: string;
  rawValue?: number;
  delta?: { value: number; format: "percent" | "currency" | "number" };
  sparkline?: number[];
  featured?: boolean;
  metricKey?: AlertMetricKey;
  branchId?: string | null;
};

type KpiCardProps = {
  kpi: KpiSpec;
};

export function KpiCard({ kpi }: KpiCardProps) {
  const badge =
    kpi.metricKey !== undefined && kpi.rawValue !== undefined ? (
      <ThresholdBadge
        metricKey={kpi.metricKey}
        branchId={kpi.branchId ?? null}
        value={kpi.rawValue}
      />
    ) : null;

  if (kpi.featured) {
    return (
      <div
        className="col-span-2 rounded-[var(--r-lg)] p-5 flex flex-col gap-3"
        style={{
          background: "linear-gradient(135deg, var(--p), var(--p-bright))",
          color: "#ffffff",
        }}
      >
        <div>
          <p
            className="text-[0.5625rem] font-medium uppercase tracking-[0.05em]"
            style={{ color: "rgba(255,255,255,0.7)" }}
          >
            {kpi.label}
          </p>
          <p
            className="mt-1 font-bold tracking-[-0.02em] leading-none tabular-nums"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "3.25rem",
              color: "#ffffff",
            }}
          >
            {kpi.value}
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {kpi.delta && (
            <span
              className="inline-flex items-center gap-1 text-xs font-semibold"
              style={{ color: "rgba(255,255,255,0.9)" }}
            >
              <Delta
                value={kpi.delta.value}
                format={kpi.delta.format}
                showIcon
              />
            </span>
          )}
          {kpi.delta && (
            <span className="text-[0.6875rem]" style={{ color: "rgba(255,255,255,0.6)" }}>
              vs período anterior
            </span>
          )}
          {badge}
        </div>

        {kpi.sparkline && kpi.sparkline.length >= 2 && (
          <div className="mt-auto opacity-40">
            <Sparkline
              data={kpi.sparkline}
              color="#ffffff"
              height={36}
              strokeWidth={1.5}
            />
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="col-span-1 rounded-[var(--r-lg)] flex flex-col gap-2"
      style={{ background: "var(--surf-lowest)", padding: "var(--density-card)" }}
    >
      <p
        className="text-[0.5625rem] font-medium uppercase tracking-[0.05em]"
        style={{ color: "var(--on-surf-var)" }}
      >
        {kpi.label}
      </p>
      <p
        className="font-bold tracking-[-0.02em] leading-none tabular-nums"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "2rem",
          color: "var(--on-surf)",
        }}
      >
        {kpi.value}
      </p>
      {kpi.delta && (
        <div className="flex items-center gap-1.5">
          <Delta value={kpi.delta.value} format={kpi.delta.format} />
          <span className="text-[0.6875rem]" style={{ color: "var(--on-surf-var)" }}>
            vs período anterior
          </span>
        </div>
      )}
      {badge}
    </div>
  );
}
