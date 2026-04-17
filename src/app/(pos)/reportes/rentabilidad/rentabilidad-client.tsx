"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, Download } from "lucide-react";
import type { CSSProperties } from "react";
import { ReportHeader } from "@/app/(pos)/reportes/_components/report-header";
import { ReportKpiCards } from "@/app/(pos)/reportes/_components/report-kpi-cards";
import { ReportTable } from "@/app/(pos)/reportes/_components/report-table";
import type { TableColumn } from "@/app/(pos)/reportes/_components/report-table";
import { ReportDateFilter } from "@/app/(pos)/reportes/_components/report-date-filter";
import { ReportBranchFilter } from "@/app/(pos)/reportes/_components/report-branch-filter";
import { downloadCSV } from "@/lib/reportes/csv";
import { formatMXN } from "@/lib/reportes/money";
import type { ReportKPI } from "@/lib/reportes/types";
import type {
  ProductoRow,
  BranchOption,
  RentabilidadFilters,
  RentabilidadKpis,
  CostSource,
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

const INPUT_STYLE: CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-md)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  height: 36,
  padding: "0 0.75rem",
  outline: "none",
  minWidth: 200,
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

// ── Helpers de badges ─────────────────────────────────────────────────────────

function KindBadge({ kind }: { kind: "variant" | "simple" }): React.JSX.Element {
  const label = kind === "variant" ? "Vehículo" : "Prod. simple";
  const bg = kind === "variant" ? "var(--sec-container)" : "var(--surf-high)";
  const color =
    kind === "variant" ? "var(--on-sec-container)" : "var(--on-surf-var)";

  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color,
        borderRadius: "var(--r-full)",
        padding: "0.15rem 0.55rem",
        fontSize: "0.625rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontFamily: "var(--font-body)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

function CostSourceBadge({
  source,
}: {
  source: CostSource;
}): React.JSX.Element {
  let label: string;
  let bg: string;
  let color: string;

  switch (source) {
    case "RECEIPT":
      label = "Recepción";
      bg = "var(--sec-container)";
      color = "var(--on-sec-container)";
      break;
    case "CATALOG":
      label = "Catálogo";
      bg = "var(--warn-container)";
      color = "var(--warn)";
      break;
    case "NONE":
    default:
      label = "Sin costo";
      bg = "var(--ter-container)";
      color = "var(--on-ter-container)";
      break;
  }

  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color,
        borderRadius: "var(--r-full)",
        padding: "0.15rem 0.45rem",
        fontSize: "0.5625rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontFamily: "var(--font-body)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

// ── Helpers de sort ───────────────────────────────────────────────────────────

type SortKey = "margen-desc" | "margen-asc" | "revenue-desc" | "unidades-desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "margen-desc", label: "Mayor margen $" },
  { value: "margen-asc", label: "Menor margen $" },
  { value: "revenue-desc", label: "Mayor revenue" },
  { value: "unidades-desc", label: "Más unidades" },
];

function applySort(rows: ProductoRow[], sort: string): ProductoRow[] {
  const sorted = [...rows];
  switch (sort) {
    case "margen-desc":
      return sorted.sort((a, b) => b.margen - a.margen);
    case "margen-asc":
      return sorted.sort((a, b) => a.margen - b.margen);
    case "revenue-desc":
      return sorted.sort((a, b) => b.revenueNeto - a.revenueNeto);
    case "unidades-desc":
      return sorted.sort((a, b) => b.unidades - a.unidades);
    default:
      return sorted.sort((a, b) => b.margen - a.margen);
  }
}

// ── Columnas de tabla ─────────────────────────────────────────────────────────

const tableColumns: TableColumn<ProductoRow>[] = [
  {
    key: "kind",
    header: "Tipo",
    render: (row) => <KindBadge kind={row.kind} />,
  },
  {
    key: "codigo",
    header: "Código",
    render: (row) => (
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.75rem",
          color: "var(--on-surf-var)",
          fontFeatureSettings: '"tnum"',
        }}
      >
        {row.codigo}
      </span>
    ),
  },
  {
    key: "nombre",
    header: "Nombre",
    render: (row) => (
      <span style={{ fontWeight: 500, color: "var(--on-surf)" }}>
        {row.nombre}
      </span>
    ),
  },
  {
    key: "unidades",
    header: "Unidades",
    align: "right",
    render: (row) => row.unidades.toLocaleString("es-MX"),
  },
  {
    key: "revenueNeto",
    header: "Revenue neto",
    align: "right",
    render: (row) => (
      <span style={{ fontWeight: 600 }}>{formatMXN(row.revenueNeto)}</span>
    ),
  },
  {
    key: "costoTotal",
    header: "Costo total",
    align: "right",
    render: (row) => (
      <span style={{ display: "flex", alignItems: "center", gap: "0.375rem", justifyContent: "flex-end" }}>
        {formatMXN(row.costoTotal)}
        <CostSourceBadge source={row.costSource} />
      </span>
    ),
  },
  {
    key: "margen",
    header: "Margen $",
    align: "right",
    render: (row) => (
      <span
        style={{
          fontWeight: 600,
          color: row.margen >= 0 ? "var(--p)" : "var(--on-ter-container)",
        }}
      >
        {formatMXN(row.margen)}
      </span>
    ),
  },
  {
    key: "margenPct",
    header: "Margen %",
    align: "right",
    render: (row) => (
      <span
        style={{
          fontWeight: 500,
          color: row.margenPct >= 0 ? "var(--p)" : "var(--on-ter-container)",
        }}
      >
        {row.margenPct.toFixed(1)}%
      </span>
    ),
  },
  {
    key: "ticketPromedio",
    header: "Ticket promedio",
    align: "right",
    render: (row) => formatMXN(row.ticketPromedio),
  },
];

// ── Props ─────────────────────────────────────────────────────────────────────

interface RentabilidadClientProps {
  rows: ProductoRow[];
  kpis: RentabilidadKpis;
  branches: BranchOption[];
  currentFilters: RentabilidadFilters;
  isAdmin: boolean;
  userRole: string;
}

// ── Componente principal ──────────────────────────────────────────────────────

export function RentabilidadClient({
  rows,
  kpis,
  branches,
  currentFilters,
  isAdmin,
  userRole,
}: RentabilidadClientProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [q, setQ] = useState("");
  const [kind, setKind] = useState<string>(currentFilters.kind);
  const [sort, setSort] = useState<string>(currentFilters.sort);

  // ── Filtrado en cliente ────────────────────────────────────────────────
  let filtered = rows;

  if (kind !== "all") {
    filtered = filtered.filter((r) => r.kind === kind);
  }

  if (q.trim() !== "") {
    const qLower = q.trim().toLowerCase();
    filtered = filtered.filter(
      (r) =>
        r.codigo.toLowerCase().includes(qLower) ||
        r.nombre.toLowerCase().includes(qLower),
    );
  }

  filtered = applySort(filtered, sort);

  // ── KPI cards ──────────────────────────────────────────────────────────
  const kpiCards: ReportKPI[] = [
    {
      label: "Revenue neto",
      value: kpis.revenueNetoTotal,
      format: "currency",
    },
    {
      label: "Costo total",
      value: kpis.costoTotal,
      format: "currency",
    },
    {
      label: "Margen bruto",
      value: kpis.margenBruto,
      format: "currency",
    },
    {
      label: "Margen % pond.",
      value: kpis.margenPct,
      format: "percent",
    },
    {
      label: "Líneas libres",
      value: kpis.lineasLibresCount,
      format: "number",
      trend: "líneas sin producto de catálogo",
    },
  ];

  // ── Handlers de filtros URL ────────────────────────────────────────────
  function handleKindChange(value: string): void {
    setKind(value);
    const p = new URLSearchParams(searchParams.toString());
    if (value !== "all") {
      p.set("kind", value);
    } else {
      p.delete("kind");
    }
    router.replace(`?${p.toString()}`);
  }

  function handleSortChange(value: string): void {
    setSort(value);
    const p = new URLSearchParams(searchParams.toString());
    if (value !== "margen-desc") {
      p.set("sort", value);
    } else {
      p.delete("sort");
    }
    router.replace(`?${p.toString()}`);
  }

  // ── CSV ────────────────────────────────────────────────────────────────
  function handleExportCSV(): void {
    const costSourceLabel: Record<CostSource, string> = {
      RECEIPT: "Recepción",
      CATALOG: "Catálogo",
      NONE: "Sin costo",
    };
    const kindLabel: Record<string, string> = {
      variant: "Vehículo",
      simple: "Prod. simple",
    };
    const csvRows = filtered.map((r) => ({
      Tipo: kindLabel[r.kind] ?? r.kind,
      Código: r.codigo,
      Nombre: r.nombre,
      Unidades: r.unidades,
      "Revenue neto": r.revenueNeto,
      "Costo total": r.costoTotal,
      Margen: r.margen,
      "Margen %": `${r.margenPct.toFixed(1)}%`,
      "Ticket promedio": r.ticketPromedio,
      "Fuente del costo": costSourceLabel[r.costSource],
    }));
    downloadCSV(csvRows, "rentabilidad-productos");
  }

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <div
      className="space-y-6 p-6"
      style={{
        background: "var(--surf-lowest)",
        minHeight: "100vh",
        fontFamily: "var(--font-body)",
      }}
    >
      <ReportHeader
        title="Rentabilidad por producto"
        subtitle="Estimación operativa — costo resuelto por último precio pagado a proveedor, con fallback al costo de catálogo. Líneas libres excluidas del margen."
        icon={TrendingUp}
        filters={
          <div className="flex flex-wrap items-end gap-3">
            <ReportDateFilter
              currentFrom={currentFilters.from}
              currentTo={currentFilters.to}
            />
            {isAdmin && (
              <ReportBranchFilter
                role={userRole}
                branches={branches}
                currentBranchId={currentFilters.branchId}
              />
            )}
            <div>
              <label style={LABEL_STYLE}>Tipo</label>
              <select
                value={kind}
                style={SELECT_STYLE}
                onChange={(e) => handleKindChange(e.target.value)}
              >
                <option value="all">Todos</option>
                <option value="variant">Vehículos</option>
                <option value="simple">Prod. simples</option>
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Ordenar por</label>
              <select
                value={sort}
                style={SELECT_STYLE}
                onChange={(e) => handleSortChange(e.target.value)}
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={LABEL_STYLE}>Buscar</label>
              <input
                type="search"
                placeholder="Código o nombre…"
                value={q}
                style={INPUT_STYLE}
                onChange={(e) => setQ(e.target.value)}
              />
            </div>
          </div>
        }
        actions={
          <button style={EXPORT_BTN_STYLE} onClick={handleExportCSV}>
            <Download size={14} />
            Exportar CSV
          </button>
        }
      />

      {kpis.lineasLibresCount > 0 && (
        <div
          style={{
            background: "var(--warn-container)",
            color: "var(--warn)",
            borderRadius: "var(--r-md)",
            padding: "0.625rem 1rem",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
          }}
        >
          <strong>{kpis.lineasLibresCount}</strong> línea
          {kpis.lineasLibresCount !== 1 ? "s" : ""} libre
          {kpis.lineasLibresCount !== 1 ? "s" : ""} excluida
          {kpis.lineasLibresCount !== 1 ? "s" : ""} del cálculo de margen
          (ítems sin producto de catálogo).
        </div>
      )}

      <ReportKpiCards kpis={kpiCards} />

      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--surf-lowest)",
          border: "1px solid var(--ghost-border)",
          boxShadow: "var(--shadow)",
        }}
      >
        <ReportTable<ProductoRow>
          columns={tableColumns}
          rows={filtered}
          keyExtractor={(row) => row.key}
          emptyMessage="No hay ventas en el rango seleccionado."
        />
      </div>
    </div>
  );
}
