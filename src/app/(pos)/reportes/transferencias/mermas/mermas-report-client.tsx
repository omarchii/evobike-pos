"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle, ArrowRight, Download, X } from "lucide-react";
import type { CSSProperties } from "react";
import { ReportHeader } from "@/app/(pos)/reportes/_components/report-header";
import { ReportKpiCards } from "@/app/(pos)/reportes/_components/report-kpi-cards";
import { ReportTable } from "@/app/(pos)/reportes/_components/report-table";
import type { TableColumn } from "@/app/(pos)/reportes/_components/report-table";
import { ReportDateFilter } from "@/app/(pos)/reportes/_components/report-date-filter";
import { downloadCSV } from "@/lib/reportes/csv";
import type { ReportKPI } from "@/lib/reportes/types";
import type {
  MermaRow,
  MermasKpis,
  BranchOption,
  MermasReportFilters,
} from "./page";

// ── Estilos ───────────────────────────────────────────────────────────────────

const LABEL_STYLE: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.6875rem",
  fontWeight: 500,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--on-surf-var)",
  display: "block",
  marginBottom: "0.25rem",
};

const SELECT_STYLE: CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-md)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  height: 36,
  padding: "0 2rem 0 0.75rem",
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233d5247' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.6rem center",
  minWidth: 160,
};

const EXPORT_BTN_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
  background: "var(--surf-high)",
  color: "var(--p)",
  border: "none",
  borderRadius: "var(--r-full)",
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  fontSize: "0.8125rem",
  height: 32,
  paddingInline: "0.875rem",
  cursor: "pointer",
};

const TAB_ACTIVE_STYLE: CSSProperties = {
  background: "var(--p-container)",
  color: "var(--on-p-container)",
  border: "none",
  borderRadius: "var(--r-full)",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "0.8125rem",
  height: 32,
  paddingInline: "1rem",
  cursor: "pointer",
};

const TAB_INACTIVE_STYLE: CSSProperties = {
  background: "var(--surf-low)",
  color: "var(--on-surf-var)",
  border: "none",
  borderRadius: "var(--r-full)",
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  fontSize: "0.8125rem",
  height: 32,
  paddingInline: "1rem",
  cursor: "pointer",
};

const CHIP_STYLE: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "0.375rem",
  background: "var(--warn-container)",
  color: "var(--warn)",
  borderRadius: "var(--r-full)",
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  fontSize: "0.75rem",
  height: 28,
  paddingInline: "0.75rem",
};

// ── Types ─────────────────────────────────────────────────────────────────────

type ViewMode = "detalle" | "producto" | "sucursal";

interface DrilldownFilter {
  type: "producto" | "sucursal";
  label: string;
  productVariantId?: string | null;
  simpleProductId?: string | null;
  fromBranchId?: string;
}

interface ProductoAgrupado {
  key: string;
  productName: string;
  productVariantId: string | null;
  simpleProductId: string | null;
  transferenciasCount: number;
  unidadesPerdidas: number;
}

interface SucursalAgrupada {
  fromBranchId: string;
  fromBranchName: string;
  transferenciasCount: number;
  unidadesPerdidas: number;
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  mermaRows: MermaRow[];
  kpis: MermasKpis;
  branches: BranchOption[];
  currentFilters: MermasReportFilters;
  isAdmin: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function MermasReportClient({
  mermaRows,
  kpis,
  branches,
  currentFilters,
  isAdmin,
}: Props): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [viewMode, setViewMode] = useState<ViewMode>(currentFilters.agruparPor);
  const [drilldown, setDrilldown] = useState<DrilldownFilter | null>(null);

  function push(overrides: Record<string, string>): void {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.replace(`?${params.toString()}`);
  }

  function switchView(mode: ViewMode): void {
    setViewMode(mode);
    setDrilldown(null);
    push({ agruparPor: mode === "detalle" ? "" : mode });
  }

  function drillIntoProducto(row: ProductoAgrupado): void {
    setViewMode("detalle");
    setDrilldown({
      type: "producto",
      label: row.productName,
      productVariantId: row.productVariantId,
      simpleProductId: row.simpleProductId,
    });
    push({ agruparPor: "" });
  }

  function drillIntoSucursal(row: SucursalAgrupada): void {
    setViewMode("detalle");
    setDrilldown({
      type: "sucursal",
      label: row.fromBranchName,
      fromBranchId: row.fromBranchId,
    });
    push({ agruparPor: "" });
  }

  function clearDrilldown(): void {
    setDrilldown(null);
  }

  // ── Filas visibles según drilldown ────────────────────────────────────────
  const visibleRows: MermaRow[] = drilldown
    ? mermaRows.filter((r) => {
        if (drilldown.type === "producto") {
          if (drilldown.productVariantId)
            return r.productVariantId === drilldown.productVariantId;
          if (drilldown.simpleProductId)
            return r.simpleProductId === drilldown.simpleProductId;
          return false;
        }
        return r.fromBranchId === drilldown.fromBranchId;
      })
    : mermaRows;

  // ── Agrupación por producto ───────────────────────────────────────────────
  const productoMap = new Map<
    string,
    { productName: string; productVariantId: string | null; simpleProductId: string | null; transferIds: Set<string>; unidades: number }
  >();
  for (const row of mermaRows) {
    const key = row.productVariantId
      ? `v:${row.productVariantId}`
      : row.simpleProductId
        ? `s:${row.simpleProductId}`
        : `name:${row.productName}`;
    const entry = productoMap.get(key);
    if (entry) {
      entry.transferIds.add(row.transferId);
      entry.unidades += row.mermaUnidades;
    } else {
      productoMap.set(key, {
        productName: row.productName,
        productVariantId: row.productVariantId,
        simpleProductId: row.simpleProductId,
        transferIds: new Set([row.transferId]),
        unidades: row.mermaUnidades,
      });
    }
  }
  const productoRows: ProductoAgrupado[] = Array.from(productoMap.entries())
    .map(([key, v]) => ({
      key,
      productName: v.productName,
      productVariantId: v.productVariantId,
      simpleProductId: v.simpleProductId,
      transferenciasCount: v.transferIds.size,
      unidadesPerdidas: v.unidades,
    }))
    .sort((a, b) => b.unidadesPerdidas - a.unidadesPerdidas);

  // ── Agrupación por sucursal ───────────────────────────────────────────────
  const sucursalMap = new Map<
    string,
    { fromBranchName: string; transferIds: Set<string>; unidades: number }
  >();
  for (const row of mermaRows) {
    const entry = sucursalMap.get(row.fromBranchId);
    if (entry) {
      entry.transferIds.add(row.transferId);
      entry.unidades += row.mermaUnidades;
    } else {
      sucursalMap.set(row.fromBranchId, {
        fromBranchName: row.fromBranchName,
        transferIds: new Set([row.transferId]),
        unidades: row.mermaUnidades,
      });
    }
  }
  const sucursalRows: SucursalAgrupada[] = Array.from(sucursalMap.entries())
    .map(([id, v]) => ({
      fromBranchId: id,
      fromBranchName: v.fromBranchName,
      transferenciasCount: v.transferIds.size,
      unidadesPerdidas: v.unidades,
    }))
    .sort((a, b) => b.unidadesPerdidas - a.unidadesPerdidas);

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpiCards: ReportKPI[] = [
    { label: "Ítems con merma", value: kpis.totalItemsConMerma, format: "number" },
    { label: "Unidades perdidas", value: kpis.unidadesPerdidas, format: "number" },
    {
      label: "Transferencias afectadas",
      value: kpis.transferenciasAfectadas,
      format: "number",
    },
    {
      label: "Sucursal con más mermas",
      value: kpis.sucursalOrigenTopCount,
      format: "number",
      trend: kpis.sucursalOrigenTopNombre,
    },
  ];

  // ── CSV export (siempre detalle completo) ─────────────────────────────────
  function handleCSV(): void {
    downloadCSV(
      mermaRows.map((r) => ({
        Folio: r.folio,
        "Fecha recepción": new Date(r.recibidoAt).toLocaleDateString("es-MX"),
        "Sucursal origen": r.fromBranchName,
        "Sucursal destino": r.toBranchName,
        Producto: r.productName,
        Enviado: r.cantidadEnviada,
        Recibido: r.cantidadRecibida,
        Merma: r.mermaUnidades,
        "% merma": r.pctMerma,
      })),
      `mermas-${currentFilters.from}-${currentFilters.to}`,
    );
  }

  // ── Columnas: vista detalle ───────────────────────────────────────────────
  const columnsDetalle: TableColumn<MermaRow>[] = [
    {
      key: "folio",
      header: "Folio",
      render: (row) => (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "0.8125rem",
            color: "var(--p)",
          }}
        >
          {row.folio}
        </span>
      ),
    },
    {
      key: "recibidoAt",
      header: "Recepción",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--on-surf-var)" }}>
          {new Date(row.recibidoAt).toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "branches",
      header: "Origen → Destino",
      render: (row) => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "var(--on-surf)",
          }}
        >
          {row.fromBranchName}
          <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "var(--on-surf-var)" }} />
          {row.toBranchName}
        </span>
      ),
    },
    {
      key: "producto",
      header: "Producto",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--on-surf)" }}>
          {row.productName}
        </span>
      ),
    },
    {
      key: "enviado",
      header: "Enviado",
      align: "right",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--on-surf)" }}>
          {row.cantidadEnviada}
        </span>
      ),
    },
    {
      key: "recibido",
      header: "Recibido",
      align: "right",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--on-surf)" }}>
          {row.cantidadRecibida}
        </span>
      ),
    },
    {
      key: "merma",
      header: "Merma",
      align: "right",
      render: (row) => (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--ter)",
          }}
        >
          {row.mermaUnidades}
        </span>
      ),
    },
    {
      key: "pct",
      header: "% merma",
      align: "right",
      render: (row) => (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: row.pctMerma >= 50 ? "var(--ter)" : "var(--on-surf-var)",
          }}
        >
          {row.pctMerma}%
        </span>
      ),
    },
  ];

  // ── Columnas: vista producto ──────────────────────────────────────────────
  const columnsProducto: TableColumn<ProductoAgrupado>[] = [
    {
      key: "producto",
      header: "Producto",
      render: (row) => (
        <button
          onClick={() => drillIntoProducto(row)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--p)",
            textAlign: "left",
          }}
        >
          {row.productName}
        </button>
      ),
    },
    {
      key: "transferencias",
      header: "Transferencias",
      align: "right",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--on-surf)" }}>
          {row.transferenciasCount}
        </span>
      ),
    },
    {
      key: "unidades",
      header: "Unidades perdidas",
      align: "right",
      render: (row) => (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--ter)",
          }}
        >
          {row.unidadesPerdidas}
        </span>
      ),
    },
  ];

  // ── Columnas: vista sucursal ──────────────────────────────────────────────
  const columnasSucursal: TableColumn<SucursalAgrupada>[] = [
    {
      key: "sucursal",
      header: "Sucursal origen",
      render: (row) => (
        <button
          onClick={() => drillIntoSucursal(row)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--p)",
            textAlign: "left",
          }}
        >
          {row.fromBranchName}
        </button>
      ),
    },
    {
      key: "transferencias",
      header: "Transferencias",
      align: "right",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--on-surf)" }}>
          {row.transferenciasCount}
        </span>
      ),
    },
    {
      key: "unidades",
      header: "Unidades perdidas",
      align: "right",
      render: (row) => (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            fontWeight: 600,
            color: "var(--ter)",
          }}
        >
          {row.unidadesPerdidas}
        </span>
      ),
    },
  ];

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtersNode = (
    <div className="flex flex-wrap items-end gap-3">
      <ReportDateFilter currentFrom={currentFilters.from} currentTo={currentFilters.to} />

      {isAdmin && (
        <>
          <div>
            <label style={LABEL_STYLE}>Sucursal origen</label>
            <select
              style={SELECT_STYLE}
              defaultValue={currentFilters.fromBranchId}
              onChange={(e) => push({ fromBranchId: e.target.value })}
            >
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Sucursal destino</label>
            <select
              style={SELECT_STYLE}
              defaultValue={currentFilters.toBranchId}
              onChange={(e) => push({ toBranchId: e.target.value })}
            >
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );

  const actionsNode = (
    <button style={EXPORT_BTN_STYLE} onClick={handleCSV}>
      <Download className="h-3.5 w-3.5" />
      Exportar CSV
    </button>
  );

  // ── Vista activa ──────────────────────────────────────────────────────────
  const tableTitle =
    viewMode === "producto"
      ? "Mermas por producto"
      : viewMode === "sucursal"
        ? "Mermas por sucursal"
        : "Detalle de mermas";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      <ReportHeader
        title="Mermas en transferencias"
        subtitle="Ítems con cantidades recibidas menores a las enviadas"
        icon={AlertTriangle}
        filters={filtersNode}
        actions={actionsNode}
      />

      <ReportKpiCards kpis={kpiCards} />

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="p-5 space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1rem",
                fontWeight: 600,
                color: "var(--on-surf)",
              }}
            >
              {tableTitle}
            </h2>

            <div className="flex items-center gap-2">
              <button
                style={viewMode === "detalle" ? TAB_ACTIVE_STYLE : TAB_INACTIVE_STYLE}
                onClick={() => switchView("detalle")}
              >
                Detalle
              </button>
              <button
                style={viewMode === "producto" ? TAB_ACTIVE_STYLE : TAB_INACTIVE_STYLE}
                onClick={() => switchView("producto")}
              >
                Por producto
              </button>
              <button
                style={viewMode === "sucursal" ? TAB_ACTIVE_STYLE : TAB_INACTIVE_STYLE}
                onClick={() => switchView("sucursal")}
              >
                Por sucursal
              </button>
            </div>
          </div>

          {drilldown && (
            <div className="flex items-center gap-2">
              <span style={CHIP_STYLE}>
                {drilldown.type === "producto" ? "Producto:" : "Sucursal:"}{" "}
                <strong>{drilldown.label}</strong>
                <button
                  onClick={clearDrilldown}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    color: "inherit",
                  }}
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.75rem",
                  color: "var(--on-surf-var)",
                }}
              >
                {visibleRows.length} ítem{visibleRows.length !== 1 ? "s" : ""}
              </span>
            </div>
          )}

          {viewMode === "detalle" && (
            <ReportTable<MermaRow>
              columns={columnsDetalle}
              rows={visibleRows}
              keyExtractor={(row, i) => `${row.transferId}-${i}`}
              emptyMessage="No hay mermas en el rango seleccionado"
            />
          )}

          {viewMode === "producto" && (
            <ReportTable<ProductoAgrupado>
              columns={columnsProducto}
              rows={productoRows}
              keyExtractor={(row) => row.key}
              emptyMessage="No hay mermas en el rango seleccionado"
            />
          )}

          {viewMode === "sucursal" && (
            <ReportTable<SucursalAgrupada>
              columns={columnasSucursal}
              rows={sucursalRows}
              keyExtractor={(row) => row.fromBranchId}
              emptyMessage="No hay mermas en el rango seleccionado"
            />
          )}
        </div>
      </div>
    </div>
  );
}
