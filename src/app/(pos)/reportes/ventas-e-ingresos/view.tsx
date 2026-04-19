"use client";

import * as React from "react";
import { toast } from "sonner";
import {
  DetailHeader,
  FilterPanel,
  KpiGrid,
  CompareToggle,
  DateRangeChip,
} from "@/components/reportes/shell";
import type { KpiSpec } from "@/components/reportes/shell";
import type { FilterSpec } from "@/components/reportes/shell";
import { formatMXN, formatNumber } from "@/lib/format";
import type { CompareMode } from "@/lib/reportes/date-range";
import { SalesChart } from "./sales-chart";
import { SalesTable } from "./sales-table";
import { SaleDetailModal } from "./sale-detail-modal";
import type { SalesKpis, SalesChartRow, SalesTableRow, VendedorOption } from "./queries";

type SalesViewProps = {
  kpis: SalesKpis;
  compareKpis: SalesKpis | null;
  chartData: SalesChartRow[];
  tableRows: SalesTableRow[];
  vendedoresOptions: VendedorOption[];
  initialFrom: string;
  initialTo: string;
  initialVendedor: string;
  initialMetodo: string;
  compareMode: CompareMode;
  compareEnabled: boolean;
  isAdmin: boolean;
};

const METODO_OPTIONS = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "CREDIT_BALANCE", label: "Saldo a favor" },
  { value: "ATRATO", label: "Atrato" },
];

function buildKpis(kpis: SalesKpis, compareKpis: SalesKpis | null): KpiSpec[] {
  function delta(current: number, prev: number | undefined): { value: number; format: "percent" } | undefined {
    if (prev === undefined || prev === 0) return undefined;
    return { value: (current - prev) / prev, format: "percent" };
  }

  return [
    {
      key: "ingresoTotal",
      label: "Ingreso total",
      value: formatMXN(kpis.ingresoTotal),
      delta: delta(kpis.ingresoTotal, compareKpis?.ingresoTotal),
      sparkline: kpis.sparkline,
      featured: true,
    },
    {
      key: "ticketPromedio",
      label: "Ticket promedio",
      value: formatMXN(kpis.ticketPromedio),
      delta: delta(kpis.ticketPromedio, compareKpis?.ticketPromedio),
    },
    {
      key: "numVentas",
      label: "# Ventas",
      value: formatNumber(kpis.numVentas),
      delta: delta(kpis.numVentas, compareKpis?.numVentas),
    },
    {
      key: "margenBruto",
      label: "Margen bruto",
      value: formatMXN(kpis.margenBruto),
      delta: delta(kpis.margenBruto, compareKpis?.margenBruto),
    },
    {
      key: "topVendedor",
      label: "Top vendedor",
      value: kpis.topVendedor ? `${kpis.topVendedor.nombre.split(" ")[0]} · ${formatMXN(kpis.topVendedor.total, { compact: true })}` : "—",
    },
  ];
}

export function SalesView({
  kpis,
  compareKpis,
  chartData,
  tableRows,
  vendedoresOptions,
  initialFrom,
  initialTo,
  initialVendedor,
  initialMetodo,
  compareMode,
  compareEnabled,
}: SalesViewProps) {
  const [selectedSaleId, setSelectedSaleId] = React.useState<string | null>(null);

  const kpiSpecs = buildKpis(kpis, compareEnabled ? compareKpis : null);

  const filterSpecs: FilterSpec[] = [
    {
      key: "vendedor",
      label: "Vendedor",
      kind: "single-select",
      icon: "user",
      options: vendedoresOptions.map((v) => ({ value: v.id, label: v.nombre })),
    },
    {
      key: "metodo",
      label: "Método de pago",
      kind: "single-select",
      icon: "cash",
      options: METODO_OPTIONS,
    },
  ];

  async function handleSaveView() {
    try {
      await fetch("/api/user/ui-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preferences: {
            "ventas-e-ingresos": {
              from: initialFrom,
              to: initialTo,
              vendedor: initialVendedor,
              metodo: initialMetodo,
            },
          },
        }),
      });
      toast.success("Filtros guardados como vista predeterminada");
    } catch {
      toast.error("No se pudieron guardar los filtros");
    }
  }

  function handleExport() {
    toast.info("Exportación disponible próximamente (Sesión 5)");
  }

  return (
    <div className="mx-auto max-w-7xl px-6 pb-12">
      <DetailHeader
        title="Ventas e ingresos"
        subtitle="Ingresos por período, método de pago y vendedor"
        onExport={handleExport}
        onSaveView={handleSaveView}
      />

      {/* Filter bar */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <DateRangeChip fromValue={initialFrom} toValue={initialTo} />
        <FilterPanel specs={filterSpecs} />
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
            Comparar con:
          </span>
          <CompareToggle value={compareMode} />
        </div>
      </div>

      {/* KPIs */}
      <div className="mb-6">
        <KpiGrid kpis={kpiSpecs} />
      </div>

      {/* Chart */}
      <div className="mb-6">
        <SalesChart data={chartData} />
      </div>

      {/* Table */}
      <SalesTable rows={tableRows} onRowClick={setSelectedSaleId} />

      {/* Modal */}
      {selectedSaleId && (
        <SaleDetailModal
          saleId={selectedSaleId}
          onClose={() => setSelectedSaleId(null)}
        />
      )}
    </div>
  );
}
