"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { TrendingUp, Download, Users2, Receipt, BarChart3 } from "lucide-react";
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
  KpiData,
  SummaryRow,
  DetailRow,
  UserOption,
  BranchOption,
  CurrentFilters,
} from "./page";

// ── Tuplas locales (los enums de Prisma son server-only en runtime) ───────────

const PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "TRANSFER",
  "CREDIT_BALANCE",
  "ATRATO",
] as const;

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  CREDIT_BALANCE: "Saldo a favor",
  ATRATO: "Atrato",
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

const SECTION_HEADER_STYLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "var(--on-surf)",
};

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const isCancelled = status === "CANCELLED";
  const isLayaway = status === "LAYAWAY";

  let bg = "var(--sec-container)";
  let color = "var(--on-sec-container)";
  let label = "Completada";

  if (isCancelled) {
    bg = "var(--surf-high)";
    color = "var(--on-surf-var)";
    label = "Cancelada";
  } else if (isLayaway) {
    bg = "var(--warn-container)";
    color = "var(--warn)";
    label = "Apartado";
  }

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
        textDecoration: isCancelled ? "line-through" : "none",
      }}
    >
      {label}
    </span>
  );
}

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Props del componente ──────────────────────────────────────────────────────

interface VentasVendedorClientProps {
  kpis: KpiData;
  summaryRows: SummaryRow[];
  detailRows: DetailRow[];
  userOptions: UserOption[];
  branches: BranchOption[];
  currentFilters: CurrentFilters;
  isAdmin: boolean;
  userRole: string;
}

// ── Columnas de tablas ────────────────────────────────────────────────────────

const summaryColumns: TableColumn<SummaryRow>[] = [
  {
    key: "userName",
    header: "Vendedor",
    render: (row) => (
      <span style={{ fontWeight: 500, color: "var(--on-surf)" }}>
        {row.userName}
      </span>
    ),
  },
  {
    key: "tickets",
    header: "Tickets",
    align: "right",
    render: (row) => row.tickets.toLocaleString("es-MX"),
  },
  {
    key: "totalVendido",
    header: "Total vendido",
    align: "right",
    render: (row) => (
      <span style={{ fontWeight: 600 }}>{formatMXN(row.totalVendido)}</span>
    ),
  },
  {
    key: "ticketPromedio",
    header: "Ticket promedio",
    align: "right",
    render: (row) => formatMXN(row.ticketPromedio),
  },
  {
    key: "unidades",
    header: "Unidades",
    align: "right",
    render: (row) => row.unidades.toLocaleString("es-MX"),
  },
];

const detailColumns: TableColumn<DetailRow>[] = [
  {
    key: "folio",
    header: "Folio",
    render: (row) => (
      <span
        style={{
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          color: "var(--p)",
          whiteSpace: "nowrap",
        }}
      >
        {row.folio}
      </span>
    ),
  },
  {
    key: "clienteNombre",
    header: "Cliente",
    render: (row) => (
      <span
        style={{
          color:
            row.clienteNombre === "Sin cliente"
              ? "var(--on-surf-var)"
              : "var(--on-surf)",
          fontStyle:
            row.clienteNombre === "Sin cliente" ? "italic" : "normal",
        }}
      >
        {row.clienteNombre}
      </span>
    ),
  },
  {
    key: "modelo",
    header: "Modelo",
    render: (row) => (
      <span
        style={{
          color:
            row.modelo === "Sin modelo" || row.modelo === "Mixto"
              ? "var(--on-surf-var)"
              : "var(--on-surf)",
        }}
      >
        {row.modelo}
      </span>
    ),
  },
  {
    key: "voltaje",
    header: "Voltaje",
    render: (row) => (
      <span style={{ color: row.voltaje === "—" ? "var(--on-surf-var)" : "var(--on-surf)" }}>
        {row.voltaje}
      </span>
    ),
  },
  {
    key: "fechaISO",
    header: "Fecha",
    render: (row) => (
      <span style={{ whiteSpace: "nowrap", color: "var(--on-surf-var)" }}>
        {formatDate(row.fechaISO)}
      </span>
    ),
  },
  {
    key: "total",
    header: "Total",
    align: "right",
    render: (row) => (
      <span
        style={{
          fontWeight: 600,
          textDecoration:
            row.status === "CANCELLED" ? "line-through" : "none",
          color:
            row.status === "CANCELLED"
              ? "var(--on-surf-var)"
              : "var(--on-surf)",
        }}
      >
        {formatMXN(row.total)}
      </span>
    ),
  },
  {
    key: "metodoPago",
    header: "Método",
    render: (row) => row.metodoPago,
  },
  {
    key: "status",
    header: "Estado",
    render: (row) => <StatusBadge status={row.status} />,
  },
];

// ── Componente principal ──────────────────────────────────────────────────────

export function VentasVendedorClient({
  kpis,
  summaryRows,
  detailRows,
  userOptions,
  branches,
  currentFilters,
  isAdmin,
  userRole,
}: VentasVendedorClientProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`?${params.toString()}`);
  }

  // ── KPI cards ────────────────────────────────────────────────────────────
  const kpiCards: ReportKPI[] = [
    {
      label: "Total vendido",
      value: kpis.totalVendido,
      format: "currency",
    },
    {
      label: "Tickets",
      value: kpis.tickets,
      format: "number",
    },
    {
      label: "Ticket promedio",
      value: kpis.ticketPromedio,
      format: "currency",
    },
    {
      label: "Unidades vendidas",
      value: kpis.unidadesVendidas,
      format: "number",
    },
    {
      label: "Vendedores activos",
      value: kpis.vendedoresActivos,
      format: "number",
    },
  ];

  // ── Export CSV ───────────────────────────────────────────────────────────
  function exportSummaryCSV(): void {
    downloadCSV(
      summaryRows.map((r) => ({
        Vendedor: r.userName,
        Tickets: r.tickets,
        "Total Vendido": r.totalVendido,
        "Ticket Promedio": r.ticketPromedio,
        Unidades: r.unidades,
      })),
      `ventas-por-vendedor-resumen-${currentFilters.from}-${currentFilters.to}`,
    );
  }

  function exportDetailCSV(): void {
    downloadCSV(
      detailRows.map((r) => ({
        Folio: r.folio,
        Cliente: r.clienteNombre,
        Modelo: r.modelo,
        Voltaje: r.voltaje,
        Fecha: formatDate(r.fechaISO),
        Total: r.total,
        "Método de Pago": r.metodoPago,
        Estado: r.status === "COMPLETED" ? "Completada" : "Cancelada",
      })),
      `ventas-por-vendedor-detalle-${currentFilters.from}-${currentFilters.to}`,
    );
  }

  // ── Filtros ──────────────────────────────────────────────────────────────
  const filtersNode = (
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

      {/* Filtro por vendedor */}
      <div>
        <label style={LABEL_STYLE}>Vendedor</label>
        <select
          defaultValue={currentFilters.userId}
          style={SELECT_STYLE}
          onChange={(e) => updateParam("userId", e.target.value)}
        >
          <option value="">Todos los vendedores</option>
          {userOptions.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name}
            </option>
          ))}
        </select>
      </div>

      {/* Filtro por método de pago */}
      <div>
        <label style={LABEL_STYLE}>Método de pago</label>
        <select
          defaultValue={currentFilters.method}
          style={SELECT_STYLE}
          onChange={(e) => updateParam("method", e.target.value)}
        >
          <option value="">Todos</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m} value={m}>
              {METHOD_LABELS[m]}
            </option>
          ))}
        </select>
      </div>

      {/* Filtro de estado */}
      <div>
        <label style={LABEL_STYLE}>Estado</label>
        <select
          defaultValue={currentFilters.status}
          style={SELECT_STYLE}
          onChange={(e) => updateParam("status", e.target.value)}
        >
          <option value="completed">Solo completadas</option>
          <option value="all">Incluir canceladas</option>
        </select>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      <ReportHeader
        title="Ventas por vendedor"
        subtitle="Resumen de rendimiento por vendedor en el período seleccionado."
        icon={TrendingUp}
        filters={filtersNode}
      />

      {/* KPI Cards */}
      <ReportKpiCards kpis={kpiCards} />

      {/* Resumen por vendedor */}
      <section>
        <div
          className="flex items-center justify-between mb-4"
          style={{
            paddingBottom: "0.75rem",
            background:
              "linear-gradient(to bottom, var(--surf-low) 0%, transparent 100%)",
            borderRadius: "var(--r-md) var(--r-md) 0 0",
            padding: "0.875rem 0.25rem",
          }}
        >
          <div className="flex items-center gap-2">
            <Users2
              className="h-4 w-4"
              style={{ color: "var(--on-surf-var)" }}
            />
            <h2 style={SECTION_HEADER_STYLE}>Resumen por vendedor</h2>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "var(--on-surf-var)",
                marginLeft: "0.25rem",
              }}
            >
              · {summaryRows.length} vendedor{summaryRows.length !== 1 ? "es" : ""}
            </span>
          </div>
          <button
            type="button"
            style={EXPORT_BTN_STYLE}
            onClick={exportSummaryCSV}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
        <div
          style={{
            background: "var(--surf-lowest)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow)",
            overflow: "hidden",
          }}
        >
          <ReportTable<SummaryRow>
            columns={summaryColumns}
            rows={summaryRows}
            keyExtractor={(row) => row.userId}
            emptyMessage="No hay ventas completadas en el período seleccionado."
          />
        </div>
      </section>

      {/* Detalle de ventas */}
      <section>
        <div
          className="flex items-center justify-between mb-4"
          style={{
            background:
              "linear-gradient(to bottom, var(--surf-low) 0%, transparent 100%)",
            borderRadius: "var(--r-md) var(--r-md) 0 0",
            padding: "0.875rem 0.25rem",
          }}
        >
          <div className="flex items-center gap-2">
            <Receipt
              className="h-4 w-4"
              style={{ color: "var(--on-surf-var)" }}
            />
            <h2 style={SECTION_HEADER_STYLE}>Detalle de ventas</h2>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "var(--on-surf-var)",
                marginLeft: "0.25rem",
              }}
            >
              · {detailRows.length} venta{detailRows.length !== 1 ? "s" : ""}
            </span>
          </div>
          <button
            type="button"
            style={EXPORT_BTN_STYLE}
            onClick={exportDetailCSV}
          >
            <Download className="h-3.5 w-3.5" />
            Exportar CSV
          </button>
        </div>
        <div
          style={{
            background: "var(--surf-lowest)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow)",
            overflow: "hidden",
          }}
        >
          <ReportTable<DetailRow>
            columns={detailColumns}
            rows={detailRows}
            keyExtractor={(row) => row.id}
            emptyMessage="No hay ventas en el período y filtros seleccionados."
          />
        </div>
      </section>

      {/* Nota informativa para el status de KPIs */}
      {currentFilters.status === "all" && detailRows.some((r) => r.status === "CANCELLED") && (
        <div
          style={{
            background: "var(--surf-low)",
            borderRadius: "var(--r-md)",
            padding: "0.75rem 1rem",
          }}
        >
          <div className="flex items-start gap-2">
            <BarChart3
              className="h-4 w-4 mt-0.5 shrink-0"
              style={{ color: "var(--on-surf-var)" }}
            />
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "var(--on-surf-var)",
              }}
            >
              Los KPI superiores (Total vendido, Tickets, Ticket promedio, Unidades vendidas, Vendedores activos) solo
              cuentan ventas con estado <strong>Completada</strong>. Las ventas canceladas aparecen en la tabla de
              detalle con monto tachado.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
