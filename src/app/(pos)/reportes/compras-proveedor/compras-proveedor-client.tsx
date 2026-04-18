"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Truck, Download, Building2, CalendarRange } from "lucide-react";
import type { CSSProperties } from "react";
import { ReportHeader } from "@/app/(pos)/reportes/_components/report-header";
import { ReportKpiCards } from "@/app/(pos)/reportes/_components/report-kpi-cards";
import { ReportTable } from "@/app/(pos)/reportes/_components/report-table";
import type { TableColumn } from "@/app/(pos)/reportes/_components/report-table";
import { ReportDateFilter } from "@/app/(pos)/reportes/_components/report-date-filter";
import { ReportBranchFilter } from "@/app/(pos)/reportes/_components/report-branch-filter";
import { ReportEmptyState } from "@/app/(pos)/reportes/_components/report-empty-state";
import { downloadCSV } from "@/lib/reportes/csv";
import { parseLocalDate, toDateString } from "@/lib/reportes/date-range";
import { formatMXN } from "@/lib/reportes/money";
import type { ReportKPI } from "@/lib/reportes/types";
import type {
  KpiData,
  ProveedorRow,
  MesRow,
  BranchOption,
  CurrentFilters,
} from "./page";

// ── Styles ────────────────────────────────────────────────────────────────────

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
  minWidth: 180,
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatDate(value: string): string {
  const d = parseLocalDate(value, false) ?? new Date(value);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function vencBadge(
  ymd: string | null,
  tieneVencida: boolean,
): { label: string; color: "red" | "amber" | null } | null {
  if (!ymd) return tieneVencida ? { label: "Vencida", color: "red" } : null;
  const now = new Date();
  const todayYMD = toDateString(now);
  const sevenDaysYMD = toDateString(
    new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
  );
  if (ymd < todayYMD) return { label: formatDate(ymd), color: "red" };
  if (ymd <= sevenDaysYMD) return { label: formatDate(ymd), color: "amber" };
  return { label: formatDate(ymd), color: null };
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface ComprasProveedorClientProps {
  kpis: KpiData;
  proveedorRows: ProveedorRow[];
  mesRows: MesRow[];
  branches: BranchOption[];
  currentFilters: CurrentFilters;
  isAdmin: boolean;
  userRole: string;
}

// ── Columnas tabla proveedores ────────────────────────────────────────────────

function buildProveedorColumns(
  filters: CurrentFilters,
): TableColumn<ProveedorRow>[] {
  return [
    {
      key: "nombre",
      header: "Proveedor",
      render: (row) => {
        const params = new URLSearchParams({
          proveedor: row.nombre,
          ...(filters.efectiveBranchId
            ? { branchId: filters.efectiveBranchId }
            : {}),
          from: filters.from,
          to: filters.to,
        });
        return (
          <a
            href={`/inventario/recepciones?${params.toString()}`}
            style={{
              fontWeight: 500,
              color: "var(--p)",
              textDecoration: "none",
            }}
            onMouseEnter={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.textDecoration =
                "underline")
            }
            onMouseLeave={(e) =>
              ((e.currentTarget as HTMLAnchorElement).style.textDecoration =
                "none")
            }
          >
            {row.nombre}
          </a>
        );
      },
    },
    {
      key: "recepciones",
      header: "Recepciones",
      align: "right",
      render: (row) => row.recepciones.toLocaleString("es-MX"),
    },
    {
      key: "totalComprado",
      header: "Total comprado",
      align: "right",
      render: (row) => (
        <span style={{ fontWeight: 600 }}>{formatMXN(row.totalComprado)}</span>
      ),
    },
    {
      key: "pagado",
      header: "Pagado",
      align: "right",
      render: (row) => (
        <span style={{ color: row.pagado > 0 ? "var(--on-surf)" : "var(--on-surf-var)" }}>
          {formatMXN(row.pagado)}
        </span>
      ),
    },
    {
      key: "pendiente",
      header: "Pendiente",
      align: "right",
      render: (row) => {
        if (row.pendiente === 0) {
          return (
            <span style={{ color: "var(--on-surf-var)" }}>
              {formatMXN(0)}
            </span>
          );
        }
        const color = row.tieneVencida ? "var(--err)" : "var(--warn)";
        return <span style={{ fontWeight: 500, color }}>{formatMXN(row.pendiente)}</span>;
      },
    },
    {
      key: "proximoVencimiento",
      header: "Próximo vencimiento",
      render: (row) => {
        const badge = vencBadge(row.proximoVencimiento, row.tieneVencida);
        if (!badge) return <span style={{ color: "var(--on-surf-var)" }}>—</span>;

        const badgeBg =
          badge.color === "red"
            ? "var(--err-container)"
            : badge.color === "amber"
              ? "var(--warn-container)"
              : "var(--surf-high)";
        const badgeColor =
          badge.color === "red"
            ? "var(--err)"
            : badge.color === "amber"
              ? "var(--warn)"
              : "var(--on-surf-var)";

        return (
          <span
            style={{
              display: "inline-block",
              background: badgeBg,
              color: badgeColor,
              borderRadius: "var(--r-full)",
              padding: "0.15rem 0.55rem",
              fontSize: "0.75rem",
              fontWeight: 500,
              fontFamily: "var(--font-body)",
              whiteSpace: "nowrap",
            }}
          >
            {badge.label}
          </span>
        );
      },
    },
  ];
}

// ── Componente principal ──────────────────────────────────────────────────────

export function ComprasProveedorClient({
  kpis,
  proveedorRows,
  mesRows,
  branches,
  currentFilters,
  isAdmin,
  userRole,
}: ComprasProveedorClientProps): React.JSX.Element {
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
      label: "Total comprado",
      value: kpis.totalComprado,
      format: "currency",
    },
    {
      label: "Total pagado",
      value: kpis.totalPagado,
      format: "currency",
    },
    {
      label: "Cuentas por pagar",
      value: kpis.cuentasPorPagar,
      format: "currency",
    },
    {
      label: "Cuentas vencidas",
      value: kpis.cuentasVencidas,
      format: "number",
      trend:
        kpis.cuentasVencidas > 0
          ? `${formatMXN(kpis.cuentasVencidasMonto)} pendiente`
          : undefined,
    },
    {
      label: "Proveedores distintos",
      value: kpis.proveedoresDistintos,
      format: "number",
    },
  ];

  // ── CSV exports ──────────────────────────────────────────────────────────
  const rango = `${currentFilters.from}-${currentFilters.to}`;

  function exportProveedorCSV(): void {
    downloadCSV(
      proveedorRows.map((r) => ({
        Proveedor: r.nombre,
        Recepciones: r.recepciones,
        "Total comprado": r.totalComprado,
        Pagado: r.pagado,
        Pendiente: r.pendiente,
        "Próximo vencimiento": r.proximoVencimiento
          ? formatDate(r.proximoVencimiento)
          : "—",
      })),
      `compras-por-proveedor-${rango}`,
    );
  }

  function exportMesCSV(): void {
    downloadCSV(
      mesRows.map((r) => ({
        Mes: r.mesLabel,
        "Total comprado": r.totalComprado,
        Recepciones: r.recepciones,
        "Proveedores distintos": r.proveedores,
      })),
      `compras-por-mes-${rango}`,
    );
  }

  // ── Barra CSS para serie mensual ─────────────────────────────────────────
  const maxMesTotal = Math.max(0, ...mesRows.map((r) => r.totalComprado));

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

      <div>
        <label style={LABEL_STYLE}>Estado de pago</label>
        <select
          defaultValue={currentFilters.estadoPago}
          style={SELECT_STYLE}
          onChange={(e) => updateParam("estadoPago", e.target.value)}
        >
          <option value="all">Todos</option>
          <option value="pagada">Solo pagadas</option>
          <option value="pendiente">Solo pendientes</option>
        </select>
      </div>

      <div>
        <label style={LABEL_STYLE}>Buscar proveedor</label>
        <input
          type="text"
          defaultValue={currentFilters.q}
          placeholder="Nombre del proveedor..."
          style={INPUT_STYLE}
          onChange={(e) => updateParam("q", e.target.value)}
        />
      </div>
    </div>
  );

  const proveedorColumns = buildProveedorColumns(currentFilters);
  const isEmpty = proveedorRows.length === 0 && mesRows.length === 0;

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      <ReportHeader
        title="Compras al proveedor"
        subtitle="Resumen agregado de recepciones de mercancía por proveedor y mes."
        icon={Truck}
        filters={filtersNode}
      />

      {/* KPI Cards */}
      <ReportKpiCards kpis={kpiCards} />

      {isEmpty ? (
        <ReportEmptyState message="No hay recepciones en el rango seleccionado." />
      ) : (
        <>
          {/* Tabla por proveedor */}
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
                <Building2
                  className="h-4 w-4"
                  style={{ color: "var(--on-surf-var)" }}
                />
                <h2 style={SECTION_HEADER_STYLE}>Por proveedor</h2>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.75rem",
                    color: "var(--on-surf-var)",
                    marginLeft: "0.25rem",
                  }}
                >
                  · {proveedorRows.length} proveedor
                  {proveedorRows.length !== 1 ? "es" : ""}
                </span>
              </div>
              <button
                type="button"
                style={EXPORT_BTN_STYLE}
                onClick={exportProveedorCSV}
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
              <ReportTable<ProveedorRow>
                columns={proveedorColumns}
                rows={proveedorRows}
                keyExtractor={(row) => row.key}
                emptyMessage="No hay recepciones para los filtros seleccionados."
              />
            </div>
          </section>

          {/* Serie mensual */}
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
                <CalendarRange
                  className="h-4 w-4"
                  style={{ color: "var(--on-surf-var)" }}
                />
                <h2 style={SECTION_HEADER_STYLE}>Serie mensual</h2>
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.75rem",
                    color: "var(--on-surf-var)",
                    marginLeft: "0.25rem",
                  }}
                >
                  · {mesRows.length} mes{mesRows.length !== 1 ? "es" : ""}
                </span>
              </div>
              <button
                type="button"
                style={EXPORT_BTN_STYLE}
                onClick={exportMesCSV}
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
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr
                    style={{
                      borderBottom: "1px solid var(--ghost-border)",
                    }}
                  >
                    {(
                      [
                        ["Mes", "left"],
                        ["Total comprado", "right"],
                        ["Recepciones", "right"],
                        ["Proveedores", "right"],
                        ["", "left"],
                      ] as [string, "left" | "right"][]
                    ).map(([label, align]) => (
                      <th
                        key={label || "bar"}
                        style={{
                          fontFamily: "var(--font-body)",
                          fontSize: "0.6875rem",
                          fontWeight: 500,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "var(--on-surf-var)",
                          padding: "0.75rem 1rem",
                          textAlign: align,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mesRows.map((row) => {
                    const pct =
                      maxMesTotal > 0
                        ? Math.min(100, (row.totalComprado / maxMesTotal) * 100)
                        : 0;
                    return (
                      <tr
                        key={row.mesKey}
                        style={{
                          borderBottom: "1px solid var(--ghost-border)",
                        }}
                        className="hover:bg-[var(--surf-low)] transition-colors"
                      >
                        <td
                          style={{
                            padding: "0.75rem 1rem",
                            fontFamily: "var(--font-body)",
                            fontSize: "0.875rem",
                            fontWeight: 500,
                            color: "var(--on-surf)",
                            whiteSpace: "nowrap",
                            textTransform: "capitalize",
                          }}
                        >
                          {row.mesLabel}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem 1rem",
                            fontFamily: "var(--font-body)",
                            fontSize: "0.875rem",
                            fontWeight: 600,
                            color: "var(--on-surf)",
                            textAlign: "right",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatMXN(row.totalComprado)}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem 1rem",
                            fontFamily: "var(--font-body)",
                            fontSize: "0.875rem",
                            color: "var(--on-surf-var)",
                            textAlign: "right",
                          }}
                        >
                          {row.recepciones.toLocaleString("es-MX")}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem 1rem",
                            fontFamily: "var(--font-body)",
                            fontSize: "0.875rem",
                            color: "var(--on-surf-var)",
                            textAlign: "right",
                          }}
                        >
                          {row.proveedores.toLocaleString("es-MX")}
                        </td>
                        <td
                          style={{
                            padding: "0.75rem 1rem",
                            width: "30%",
                            minWidth: 120,
                          }}
                        >
                          <div
                            className="h-2 rounded-[var(--r-full)] overflow-hidden"
                            style={{ background: "var(--surf-high)" }}
                          >
                            <div
                              className="h-full rounded-[var(--r-full)]"
                              style={{
                                width: `${pct}%`,
                                background:
                                  "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
