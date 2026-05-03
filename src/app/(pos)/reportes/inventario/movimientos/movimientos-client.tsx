"use client";

import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { ArrowUpDown, ChevronLeft, ChevronRight, Download } from "lucide-react";
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
  MovimientoRow,
  MovimientosKpis,
  BranchOption,
  CurrentFilters,
  MovementTypeFilter,
  KindFilter,
  SignFilter,
} from "./page";

// ── Tuplas locales (los enums de Prisma son server-only en runtime) ───────────

const MOVEMENT_TYPES = [
  "SALE",
  "RETURN",
  "TRANSFER_OUT",
  "TRANSFER_IN",
  "ADJUSTMENT",
  "PURCHASE_RECEIPT",
  "WORKSHOP_USAGE",
] as const;

const TYPE_LABELS: Record<string, string> = {
  SALE: "Venta",
  RETURN: "Devolución",
  TRANSFER_OUT: "Transferencia salida",
  TRANSFER_IN: "Transferencia entrada",
  ADJUSTMENT: "Ajuste",
  PURCHASE_RECEIPT: "Recepción",
  WORKSHOP_USAGE: "Uso en taller",
};

// Colores de badge por tipo de movimiento
const TYPE_COLORS: Record<
  string,
  { bg: string; color: string }
> = {
  SALE: { bg: "rgba(239,68,68,0.12)", color: "#b91c1c" },
  RETURN: { bg: "rgba(34,197,94,0.12)", color: "#15803d" },
  TRANSFER_OUT: { bg: "rgba(249,115,22,0.12)", color: "#c2410c" },
  TRANSFER_IN: { bg: "rgba(59,130,246,0.12)", color: "#1d4ed8" },
  ADJUSTMENT: { bg: "rgba(168,85,247,0.12)", color: "#7e22ce" },
  PURCHASE_RECEIPT: { bg: "rgba(16,185,129,0.12)", color: "#065f46" },
  WORKSHOP_USAGE: { bg: "rgba(239,68,68,0.12)", color: "#b91c1c" },
};

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

// ── Helpers de render ─────────────────────────────────────────────────────────

function MovementTypeBadge({ type }: { type: string }): React.JSX.Element {
  const colors = TYPE_COLORS[type] ?? { bg: "var(--surf-high)", color: "var(--on-surf)" };
  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.1875rem 0.5rem",
        borderRadius: "var(--r-full)",
        fontFamily: "var(--font-body)",
        fontSize: "0.6875rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        background: colors.bg,
        color: colors.color,
        whiteSpace: "nowrap",
      }}
    >
      {TYPE_LABELS[type] ?? type}
    </span>
  );
}

function DirectionBadge({ sign }: { sign: "in" | "out" | "neutral" }): React.JSX.Element {
  const config =
    sign === "in"
      ? { label: "Entrada", bg: "rgba(16,185,129,0.12)", color: "#065f46" }
      : sign === "out"
        ? { label: "Salida", bg: "rgba(239,68,68,0.12)", color: "#b91c1c" }
        : { label: "Neutro", bg: "rgba(107,114,128,0.12)", color: "var(--on-surf-var)" };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.1875rem 0.5rem",
        borderRadius: "var(--r-full)",
        fontFamily: "var(--font-body)",
        fontSize: "0.6875rem",
        fontWeight: 600,
        background: config.bg,
        color: config.color,
        whiteSpace: "nowrap",
      }}
    >
      {config.label}
    </span>
  );
}

function KindBadge({ kind }: { kind: "variant" | "simple" | "unknown" }): React.JSX.Element {
  const config =
    kind === "variant"
      ? { label: "Variante", bg: "rgba(59,130,246,0.10)", color: "#1d4ed8" }
      : kind === "simple"
        ? { label: "Simple", bg: "rgba(249,115,22,0.10)", color: "#c2410c" }
        : { label: "—", bg: "transparent", color: "var(--on-surf-var)" };

  return (
    <span
      style={{
        display: "inline-block",
        padding: "0.1875rem 0.5rem",
        borderRadius: "var(--r-full)",
        fontFamily: "var(--font-body)",
        fontSize: "0.6875rem",
        fontWeight: 500,
        background: config.bg,
        color: config.color,
        whiteSpace: "nowrap",
      }}
    >
      {config.label}
    </span>
  );
}

function formatDate(isoString: string): string {
  const d = new Date(isoString);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

// ── Columnas de la tabla ──────────────────────────────────────────────────────

const columns: TableColumn<MovimientoRow>[] = [
  {
    key: "fecha",
    header: "Fecha",
    render: (row) => (
      <span style={{ whiteSpace: "nowrap", color: "var(--on-surf-var)", fontFamily: "var(--font-body)", fontSize: "0.75rem" }}>
        {formatDate(row.createdAt)}
      </span>
    ),
  },
  {
    key: "tipo",
    header: "Tipo",
    render: (row) => <MovementTypeBadge type={row.type} />,
  },
  {
    key: "direccion",
    header: "Dirección",
    render: (row) => <DirectionBadge sign={row.sign} />,
  },
  {
    key: "producto",
    header: "Producto",
    render: (row) => (
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.8125rem",
          color: "var(--on-surf)",
          maxWidth: 220,
          display: "block",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
        title={row.productName}
      >
        {row.productName}
      </span>
    ),
  },
  {
    key: "sku",
    header: "SKU / Código",
    render: (row) => (
      <span
        style={{
          fontFamily: "var(--font-mono, var(--font-body))",
          fontSize: "0.75rem",
          color: "var(--on-surf-var)",
          whiteSpace: "nowrap",
        }}
      >
        {row.productCode}
      </span>
    ),
  },
  {
    key: "kind",
    header: "Tipo prod.",
    render: (row) => <KindBadge kind={row.kind} />,
  },
  {
    key: "cantidad",
    header: "Cantidad",
    align: "right",
    render: (row) => (
      <span
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.875rem",
          fontWeight: 700,
          color:
            row.sign === "in"
              ? "#15803d"
              : row.sign === "out"
                ? "#b91c1c"
                : "var(--on-surf)",
        }}
      >
        {row.quantity > 0 ? `+${row.quantity}` : row.quantity}
      </span>
    ),
  },
  {
    key: "sucursal",
    header: "Sucursal",
    render: (row) => (
      <span style={{ color: "var(--on-surf-var)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
        {row.branchName}
      </span>
    ),
  },
  {
    key: "usuario",
    header: "Usuario",
    render: (row) => (
      <span style={{ color: "var(--on-surf)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
        {row.userName}
      </span>
    ),
  },
  {
    key: "referencia",
    header: "Referencia",
    render: (row) => {
      const style = {
        fontSize: "0.75rem",
        maxWidth: 180,
        display: "block",
        overflow: "hidden" as const,
        textOverflow: "ellipsis" as const,
        whiteSpace: "nowrap" as const,
      };
      if (row.referenceUrl) {
        return (
          <Link
            href={row.referenceUrl}
            style={{ ...style, color: "var(--p)", textDecoration: "none" }}
            title={row.referenceLabel}
          >
            {row.referenceLabel}
          </Link>
        );
      }
      return (
        <span style={{ ...style, color: "var(--on-surf-var)" }} title={row.referenceLabel}>
          {row.referenceLabel}
        </span>
      );
    },
  },
  {
    key: "costo",
    header: "Costo unit.",
    align: "right",
    render: (row) => (
      <span style={{ color: "var(--on-surf)", fontSize: "0.75rem", whiteSpace: "nowrap" }}>
        {row.precioUnitarioPagado !== null
          ? formatMXN(row.precioUnitarioPagado)
          : "—"}
      </span>
    ),
  },
];

// ── Componente principal ──────────────────────────────────────────────────────

interface MovimientosClientProps {
  rows: MovimientoRow[];
  kpis: MovimientosKpis;
  branches: BranchOption[];
  currentFilters: CurrentFilters;
  isAdmin: boolean;
  userRole: string;
}

export function MovimientosClient({
  rows,
  kpis,
  branches,
  currentFilters,
  isAdmin,
  userRole,
}: MovimientosClientProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "all") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    router.replace(`?${params.toString()}`);
  }

  function handleSearchChange(value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (value.trim()) {
      params.set("q", value.trim());
    } else {
      params.delete("q");
    }
    params.delete("page");
    router.replace(`?${params.toString()}`);
  }

  function goToPage(p: number): void {
    const params = new URLSearchParams(searchParams.toString());
    if (p <= 1) {
      params.delete("page");
    } else {
      params.set("page", String(p));
    }
    router.replace(`?${params.toString()}`);
  }

  const totalPages = Math.max(1, Math.ceil(currentFilters.total / currentFilters.pageSize));

  // KPI cards
  const kpiCards: ReportKPI[] = [
    {
      label: "Movimientos totales",
      value: kpis.totalMovimientos,
      format: "number",
    },
    {
      label: "Entradas totales",
      value: kpis.entradasTotal,
      format: "number",
      trend: "unidades ingresadas",
    },
    {
      label: "Salidas totales",
      value: kpis.salidasTotal,
      format: "number",
      trend: "unidades egresadas",
    },
    {
      label: "Ajustes",
      value: kpis.ajustesCount,
      format: "number",
      trend:
        kpis.ajustesCount > 0
          ? `${kpis.ajustesNeto >= 0 ? "+" : ""}${kpis.ajustesNeto} u. netas`
          : undefined,
    },
  ];

  function handleCSV(): void {
    const csvRows = rows.map((r) => ({
      Fecha: formatDate(r.createdAt),
      Tipo: TYPE_LABELS[r.type] ?? r.type,
      Dirección: r.sign === "in" ? "Entrada" : r.sign === "out" ? "Salida" : "Neutro",
      Producto: r.productName,
      "SKU / Código": r.productCode,
      "Tipo producto": r.kind === "variant" ? "Variante" : r.kind === "simple" ? "Simple" : "—",
      Cantidad: r.quantity,
      Sucursal: r.branchName,
      Usuario: r.userName,
      Referencia: r.referenceLabel,
      "Costo unitario": r.precioUnitarioPagado !== null ? r.precioUnitarioPagado : "",
    }));
    downloadCSV(csvRows, `movimientos-inventario-${currentFilters.from}-${currentFilters.to}`);
  }

  const filters = (
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

      {/* Tipo de movimiento */}
      <div>
        <label style={LABEL_STYLE}>Tipo</label>
        <select
          defaultValue={currentFilters.type}
          style={SELECT_STYLE}
          onChange={(e) => updateParam("type", e.target.value as MovementTypeFilter)}
        >
          <option value="all">Todos los tipos</option>
          {MOVEMENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t]}
            </option>
          ))}
        </select>
      </div>

      {/* Tipo de producto */}
      <div>
        <label style={LABEL_STYLE}>Producto</label>
        <select
          defaultValue={currentFilters.kind}
          style={{ ...SELECT_STYLE, minWidth: 130 }}
          onChange={(e) => updateParam("kind", e.target.value as KindFilter)}
        >
          <option value="all">Variante y simple</option>
          <option value="variant">Solo variante</option>
          <option value="simple">Solo simple</option>
        </select>
      </div>

      {/* Dirección */}
      <div>
        <label style={LABEL_STYLE}>Dirección</label>
        <select
          defaultValue={currentFilters.sign}
          style={{ ...SELECT_STYLE, minWidth: 130 }}
          onChange={(e) => updateParam("sign", e.target.value as SignFilter)}
        >
          <option value="all">Entradas y salidas</option>
          <option value="in">Solo entradas</option>
          <option value="out">Solo salidas</option>
        </select>
      </div>

      {/* Búsqueda */}
      <div>
        <label style={LABEL_STYLE}>Buscar</label>
        <input
          type="search"
          placeholder="SKU, código, nombre..."
          defaultValue={currentFilters.q}
          style={INPUT_STYLE}
          onBlur={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              handleSearchChange((e.target as HTMLInputElement).value);
            }
          }}
        />
      </div>
    </div>
  );

  const actions = (
    <button style={EXPORT_BTN_STYLE} onClick={handleCSV} disabled={rows.length === 0}>
      <Download className="h-3.5 w-3.5" />
      Exportar CSV
    </button>
  );

  return (
    <div className="space-y-6 p-6">
      <ReportHeader
        title="Movimientos de inventario"
        subtitle={`${currentFilters.total.toLocaleString("es-MX")} movimientos en el período seleccionado`}
        icon={ArrowUpDown}
        filters={filters}
        actions={actions}
      />

      <ReportKpiCards kpis={kpiCards} />

      {/* Tabla principal */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: "var(--surf-lowest)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="p-5">
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--on-surf)",
              marginBottom: "1rem",
            }}
          >
            Historial de movimientos
          </p>
          <ReportTable
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.id}
            emptyMessage="Sin movimientos en el período seleccionado"
          />

          {/* Paginación */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                paddingTop: "1rem",
                borderTop: "1px solid var(--surf-high)",
                marginTop: "1rem",
              }}
            >
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.75rem",
                  color: "var(--on-surf-var)",
                }}
              >
                Página {currentFilters.page} de {totalPages}
              </span>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  onClick={() => goToPage(currentFilters.page - 1)}
                  disabled={currentFilters.page <= 1}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    background: "var(--surf-high)",
                    border: "none",
                    borderRadius: "var(--r-md)",
                    color: currentFilters.page <= 1 ? "var(--on-surf-var)" : "var(--on-surf)",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    height: 28,
                    paddingInline: "0.625rem",
                    cursor: currentFilters.page <= 1 ? "default" : "pointer",
                    opacity: currentFilters.page <= 1 ? 0.5 : 1,
                  }}
                >
                  <ChevronLeft className="h-3 w-3" /> Anterior
                </button>
                <button
                  onClick={() => goToPage(currentFilters.page + 1)}
                  disabled={currentFilters.page >= totalPages}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    background: "var(--surf-high)",
                    border: "none",
                    borderRadius: "var(--r-md)",
                    color: currentFilters.page >= totalPages ? "var(--on-surf-var)" : "var(--on-surf)",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    height: 28,
                    paddingInline: "0.625rem",
                    cursor: currentFilters.page >= totalPages ? "default" : "pointer",
                    opacity: currentFilters.page >= totalPages ? 0.5 : 1,
                  }}
                >
                  Siguiente <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
