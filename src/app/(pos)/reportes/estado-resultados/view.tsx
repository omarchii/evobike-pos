"use client";

import * as React from "react";
import {
  DetailHeader,
  CompareToggle,
  DateRangeChip,
  ExportDrawer,
  ThresholdsModal,
  ThresholdsProvider,
  KpiCard,
} from "@/components/reportes/shell";
import type { KpiSpec, ThresholdRow } from "@/components/reportes/shell";
import { formatMXN, formatPercent } from "@/lib/format";
import { useReportFilters } from "@/components/reportes/shell";
import type { CompareMode } from "@/lib/reportes/date-range";
import { PnlTable } from "./pnl-table";
import type { PnlData } from "./queries";

// ── Tipos de props ────────────────────────────────────────────────────────────

type EstadoResultadosViewProps = {
  data: PnlData;
  compareData: PnlData | null;
  initialFrom: string;
  initialTo: string;
  compareMode: CompareMode;
  compareEnabled: boolean;
  view: "consolidado" | "comparativa";
  currentBranchId: string | null;
  branches: Array<{ id: string; label: string }>;
  thresholds: ThresholdRow[];
};

// ── Toggle de vista Consolidado / Por sucursal ────────────────────────────────

function ViewToggle({ value }: { value: "consolidado" | "comparativa" }) {
  const { setFilter } = useReportFilters();
  const options = [
    { value: "consolidado", label: "Consolidado" },
    { value: "comparativa", label: "Por sucursal" },
  ] as const;

  return (
    <div
      className="flex items-center gap-0.5 rounded-[var(--r-full)] p-0.5"
      style={{ background: "var(--surf-low)" }}
      role="radiogroup"
      aria-label="Vista de datos"
    >
      {options.map((opt) => {
        const isActive = value === opt.value;
        return (
          <button
            key={opt.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => setFilter("view", opt.value)}
            className="rounded-[var(--r-full)] px-3 py-1 text-xs font-medium transition-colors"
            style={{
              background: isActive ? "var(--p-container)" : "transparent",
              color: isActive ? "var(--on-p-container)" : "var(--on-surf-var)",
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Builders de KPIs ──────────────────────────────────────────────────────────

function delta(
  current: number,
  prev: number | undefined,
): { value: number; format: "percent" } | undefined {
  if (prev === undefined || prev === 0) return undefined;
  return { value: (current - prev) / prev, format: "percent" };
}

function buildKpis(
  data: PnlData,
  compareData: PnlData | null,
  compareEnabled: boolean,
): KpiSpec[] {
  const c = data.consolidated;
  const prev = compareEnabled ? compareData?.consolidated : null;

  const margenBrutoPct = c.ingresos > 0 ? (c.margenBruto / c.ingresos) * 100 : 0;
  const prevMargenBrutoPct =
    prev && prev.ingresos > 0 ? (prev.margenBruto / prev.ingresos) * 100 : undefined;

  return [
    {
      key: "ingresosTotales",
      label: "Ingresos totales",
      value: formatMXN(c.ingresos),
      rawValue: c.ingresos,
      delta: delta(c.ingresos, prev?.ingresos),
      sparkline: data.sparkline,
    },
    {
      key: "margenBrutoPct",
      label: "Margen bruto %",
      value: formatPercent(margenBrutoPct / 100, { decimals: 1 }),
      rawValue: margenBrutoPct,
      delta:
        prevMargenBrutoPct !== undefined
          ? delta(margenBrutoPct, prevMargenBrutoPct)
          : undefined,
      metricKey: "MARGEN_BRUTO_PCT",
      branchId: null,
    },
    {
      key: "margenOperativo",
      label: "Margen operativo",
      value: formatMXN(c.margenOperativo),
      rawValue: c.margenOperativo,
      delta: delta(c.margenOperativo, prev?.margenOperativo),
      featured: true,
      metricKey: "MARGEN_OPERATIVO_MXN",
      branchId: null,
    },
    {
      key: "topGasto",
      label: "Categoría de gasto más alta",
      value: data.topExpenseCategory
        ? `${data.topExpenseCategory.name} · ${formatMXN(data.topExpenseCategory.amount)}`
        : "Sin datos",
    },
  ];
}

// ── Vista principal ───────────────────────────────────────────────────────────

export function EstadoResultadosView({
  data,
  compareData,
  initialFrom,
  initialTo,
  compareMode,
  compareEnabled,
  view,
  currentBranchId,
  branches,
  thresholds,
}: EstadoResultadosViewProps) {
  const [drawerOpen, setDrawerOpen] = React.useState(false);
  const [thresholdsOpen, setThresholdsOpen] = React.useState(false);

  const kpiSpecs = buildKpis(data, compareData, compareEnabled);

  const currentFilters: Record<string, unknown> = {
    from: initialFrom,
    to: initialTo,
    ...(currentBranchId ? { branchId: currentBranchId } : {}),
  };

  return (
    <ThresholdsProvider value={thresholds}>
      <div className="mx-auto max-w-7xl px-6 pb-12">
        {/* Header */}
        <DetailHeader
          title="Estado de resultados"
          subtitle="P&L del período por categoría y sucursal"
          onExport={() => setDrawerOpen(true)}
          onOpenThresholds={() => setThresholdsOpen(true)}
        />

        {/* Banner gerencial — plano, sin glassmorphism */}
        <div
          className="mb-6 flex items-center gap-2 rounded-[var(--r-md)] px-4 py-2.5 text-xs font-medium"
          style={{
            background: "var(--sec-container)",
            color: "var(--on-sec-container)",
          }}
          role="note"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 20 20"
            fill="none"
            aria-hidden="true"
            style={{ flexShrink: 0 }}
          >
            <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M10 9v5M10 7h.01" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          <span>
            Vista gerencial — cifras en bruto con IVA incluido. No sustituye el P&amp;L fiscal de Contpaq.
          </span>
        </div>

        {/* Barra de filtros */}
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <DateRangeChip fromValue={initialFrom} toValue={initialTo} />
          <ViewToggle value={view} />
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
              Comparar con:
            </span>
            <CompareToggle value={compareMode} />
          </div>
        </div>

        {/* KPI Grid — grid-cols-5 para 4 KPIs donde KPI3 es featured (col-span-2) */}
        <div className="mb-6 grid grid-cols-5 gap-4 max-[768px]:grid-cols-2">
          {kpiSpecs.map((kpi) => (
            <KpiCard key={kpi.key} kpi={kpi} />
          ))}
        </div>

        {/* Tabla P&L */}
        <PnlTable
          data={data}
          compareData={compareEnabled ? compareData : null}
          view={view}
        />

        {/* Export drawer */}
        <ExportDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          slug="estado-resultados"
          filters={currentFilters}
          rowCount={7}
          columnLabels={["Concepto", "Importe"]}
        />

        {/* Thresholds modal */}
        <ThresholdsModal
          open={thresholdsOpen}
          onClose={() => setThresholdsOpen(false)}
          reportSlug="estado-resultados"
          branchOptions={branches}
          currentBranchId={currentBranchId}
          initialThresholds={thresholds}
        />
      </div>
    </ThresholdsProvider>
  );
}
