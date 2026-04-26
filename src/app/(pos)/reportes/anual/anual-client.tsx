"use client";

import { useRouter } from "next/navigation";
import { CalendarRange, Download, TrendingUp } from "lucide-react";
import type { CSSProperties } from "react";
import { ReportEmptyState } from "@/app/(pos)/reportes/_components/report-empty-state";
import { downloadCSV } from "@/lib/reportes/csv";
import { formatMXN } from "@/lib/reportes/money";
import type { AnualData, MonthRow, BranchData } from "./page";

// ── Style tokens ─────────────────────────────────────────────────────────────

const LABEL: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.6875rem",
  fontWeight: 500,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--on-surf-var)",
};

const SELECT: CSSProperties = {
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
  minWidth: 120,
};

const CARD: CSSProperties = {
  background: "var(--surf-lowest)",
  boxShadow: "var(--shadow)",
  borderRadius: "var(--r-xl)",
};

const BTN_EXPORT: CSSProperties = {
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function pct(val: number, max: number): number {
  if (max === 0) return 0;
  return Math.max(2, Math.round((val / max) * 100));
}

function MargenBadge({ val }: { val: number }): React.JSX.Element {
  const color = val >= 0 ? "#2ecc71" : "var(--ter)";
  return (
    <span
      className="tabular-nums"
      style={{
        fontFamily: "var(--font-display)",
        fontWeight: 600,
        color,
        fontSize: "0.9375rem",
      }}
    >
      {formatMXN(val)}
    </span>
  );
}

// ── Bar Chart (vertical columns, CSS-only) ────────────────────────────────────

interface BarChartProps {
  months: MonthRow[];
  getIngresos: (m: MonthRow) => number;
  getGastos: (m: MonthRow) => number;
  title: string;
}

function BarChart({
  months,
  getIngresos,
  getGastos,
  title,
}: BarChartProps): React.JSX.Element {
  const maxVal = Math.max(
    ...months.map((m) => Math.max(getIngresos(m), getGastos(m))),
    1,
  );

  return (
    <div className="p-5" style={CARD}>
      <p
        className="mb-4"
        style={{
          fontFamily: "var(--font-display)",
          fontSize: "0.875rem",
          fontWeight: 700,
          letterSpacing: "-0.01em",
          color: "var(--on-surf)",
        }}
      >
        {title}
      </p>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "0.25rem",
          height: 160,
          overflowX: "auto",
        }}
      >
        {months.map((m) => {
          const ing = getIngresos(m);
          const gas = getGastos(m);
          const ingPct = pct(ing, maxVal);
          const gasPct = pct(gas, maxVal);
          return (
            <div
              key={m.monthKey}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.125rem",
                minWidth: 32,
                flex: 1,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-end",
                  gap: 2,
                  height: 140,
                  width: "100%",
                  justifyContent: "center",
                }}
              >
                <div
                  title={`Ingresos ${m.monthLabel}: ${formatMXN(ing)}`}
                  style={{
                    width: 10,
                    height: `${ingPct}%`,
                    borderRadius: "2px 2px 0 0",
                    background:
                      "linear-gradient(180deg, #2ecc71 0%, #1b4332 100%)",
                    transition: "height 0.3s ease",
                  }}
                />
                <div
                  title={`Gastos ${m.monthLabel}: ${formatMXN(gas)}`}
                  style={{
                    width: 10,
                    height: `${gasPct}%`,
                    borderRadius: "2px 2px 0 0",
                    background: "var(--ter)",
                    opacity: 0.85,
                    transition: "height 0.3s ease",
                  }}
                />
              </div>
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.5625rem",
                  color: "var(--on-surf-var)",
                  whiteSpace: "nowrap",
                }}
              >
                {m.monthShort}
              </span>
            </div>
          );
        })}
      </div>
      <div
        className="flex items-center gap-4 mt-3"
        style={{ fontFamily: "var(--font-body)", fontSize: "0.6875rem", color: "var(--on-surf-var)" }}
      >
        <span className="flex items-center gap-1">
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: 2,
              background: "linear-gradient(180deg, #2ecc71 0%, #1b4332 100%)",
            }}
          />
          Ingresos
        </span>
        <span className="flex items-center gap-1">
          <span
            style={{
              display: "inline-block",
              width: 10,
              height: 10,
              borderRadius: 2,
              background: "var(--ter)",
              opacity: 0.85,
            }}
          />
          Gastos op.
        </span>
      </div>
    </div>
  );
}

// ── KPI Cards ─────────────────────────────────────────────────────────────────

interface KpiProps {
  months: MonthRow[];
  year: number;
}

function KpiCards({ months, year }: KpiProps): React.JSX.Element {
  const totalIngresos = months.reduce((s, m) => s + m.totalIngresos, 0);
  const totalGastos = months.reduce((s, m) => s + m.totalGastos, 0);
  const totalMargen = totalIngresos - totalGastos;
  const totalCompras = months.reduce((s, m) => s + m.totalCompras, 0);
  const margenPct = totalIngresos > 0 ? (totalMargen / totalIngresos) * 100 : 0;

  const mejorMes = months.reduce(
    (best, m) => (m.totalMargen > best.totalMargen ? m : best),
    months[0]!,
  );

  const cards: { label: string; value: string; sub?: string; highlight?: boolean }[] = [
    {
      label: "Ingresos del año",
      value: formatMXN(totalIngresos),
      highlight: true,
    },
    {
      label: "Gastos operativos",
      value: formatMXN(totalGastos),
    },
    {
      label: "Margen operativo",
      value: formatMXN(totalMargen),
      sub: `${margenPct.toFixed(1)}% del ingreso`,
    },
    {
      label: "Compras al proveedor",
      value: formatMXN(totalCompras),
      sub: "Informativo — no resta del margen",
    },
    {
      label: "Mejor mes",
      value: mejorMes.totalMargen > 0 ? `${mejorMes.monthLabel} ${year}` : "—",
      sub: mejorMes.totalMargen > 0 ? formatMXN(mejorMes.totalMargen) : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl p-5"
          style={{
            background: c.highlight
              ? "var(--velocity-gradient)"
              : "var(--surf-lowest)",
            boxShadow: "var(--shadow)",
          }}
        >
          <p
            style={{
              ...LABEL,
              color: c.highlight ? "rgba(255,255,255,0.75)" : "var(--on-surf-var)",
              marginBottom: "0.5rem",
            }}
          >
            {c.label}
          </p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.375rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              lineHeight: 1.1,
              color: c.highlight ? "#ffffff" : "var(--on-surf)",
            }}
          >
            {c.value}
          </p>
          {c.sub && (
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.6875rem",
                color: c.highlight ? "rgba(255,255,255,0.65)" : "var(--on-surf-var)",
                marginTop: "0.375rem",
              }}
            >
              {c.sub}
            </p>
          )}
        </div>
      ))}
    </div>
  );
}

// ── Tabla comparativa ─────────────────────────────────────────────────────────

interface TablaComparativaProps {
  months: MonthRow[];
  branches: AnualData["branches"];
}

function TablaComparativa({ months, branches }: TablaComparativaProps): React.JSX.Element {
  const totals: Record<string, BranchData> = {};
  for (const b of branches) {
    totals[b.id] = { ingresos: 0, gastosOperativos: 0, comprasProveedor: 0, margenOperativo: 0 };
  }

  for (const m of months) {
    for (const b of branches) {
      const d = m.byBranch[b.id];
      if (!d) continue;
      totals[b.id]!.ingresos += d.ingresos;
      totals[b.id]!.gastosOperativos += d.gastosOperativos;
      totals[b.id]!.comprasProveedor += d.comprasProveedor;
      totals[b.id]!.margenOperativo += d.margenOperativo;
    }
  }

  const cellStyle: CSSProperties = {
    padding: "0.5rem 0.75rem",
    fontFamily: "var(--font-body)",
    fontSize: "0.8125rem",
    color: "var(--on-surf)",
    textAlign: "right",
    whiteSpace: "nowrap",
    borderBottom: "1px solid var(--ghost-border)",
  };

  const headCell: CSSProperties = {
    ...cellStyle,
    color: "var(--on-surf-var)",
    fontWeight: 600,
    fontSize: "0.6875rem",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    background: "var(--surf-low)",
    position: "sticky",
    top: 0,
    zIndex: 1,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", minWidth: 600 }}>
        <thead>
          <tr>
            <th style={{ ...headCell, textAlign: "left", minWidth: 100 }}>Mes</th>
            {branches.flatMap((b) => [
              <th key={`${b.id}-ing`} style={headCell}>{b.code} Ingresos</th>,
              <th key={`${b.id}-gas`} style={headCell}>{b.code} Gastos Op.</th>,
              <th key={`${b.id}-mar`} style={headCell}>{b.code} Margen</th>,
              <th key={`${b.id}-com`} style={headCell}>{b.code} Compras</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {months.map((m, idx) => (
            <tr
              key={m.monthKey}
              style={{ background: idx % 2 === 0 ? "transparent" : "rgba(178,204,192,0.04)" }}
            >
              <td
                style={{
                  ...cellStyle,
                  textAlign: "left",
                  fontWeight: 600,
                  color: "var(--on-surf)",
                }}
              >
                {m.monthLabel}
              </td>
              {branches.flatMap((b) => {
                const d = m.byBranch[b.id] ?? {
                  ingresos: 0, gastosOperativos: 0, comprasProveedor: 0, margenOperativo: 0,
                };
                return [
                  <td key={`${b.id}-ing`} style={cellStyle}>{formatMXN(d.ingresos)}</td>,
                  <td key={`${b.id}-gas`} style={cellStyle}>{formatMXN(d.gastosOperativos)}</td>,
                  <td key={`${b.id}-mar`} style={cellStyle}>
                    <MargenBadge val={d.margenOperativo} />
                  </td>,
                  <td key={`${b.id}-com`} style={{ ...cellStyle, color: "var(--on-surf-var)" }}>
                    {formatMXN(d.comprasProveedor)}
                  </td>,
                ];
              })}
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr
            style={{
              borderTop: "2px solid rgba(178,204,192,0.3)",
              background: "var(--surf-low)",
            }}
          >
            <td
              style={{
                ...cellStyle,
                textAlign: "left",
                fontWeight: 700,
                borderBottom: "none",
              }}
            >
              Total
            </td>
            {branches.flatMap((b) => {
              const t = totals[b.id]!;
              return [
                <td key={`${b.id}-ing`} style={{ ...cellStyle, fontWeight: 700, borderBottom: "none" }}>
                  {formatMXN(t.ingresos)}
                </td>,
                <td key={`${b.id}-gas`} style={{ ...cellStyle, fontWeight: 700, borderBottom: "none" }}>
                  {formatMXN(t.gastosOperativos)}
                </td>,
                <td key={`${b.id}-mar`} style={{ ...cellStyle, fontWeight: 700, borderBottom: "none" }}>
                  <MargenBadge val={t.margenOperativo} />
                </td>,
                <td key={`${b.id}-com`} style={{ ...cellStyle, fontWeight: 700, borderBottom: "none", color: "var(--on-surf-var)" }}>
                  {formatMXN(t.comprasProveedor)}
                </td>,
              ];
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── Tabla consolidada ─────────────────────────────────────────────────────────

interface TablaConsolidadaProps {
  months: MonthRow[];
}

function TablaConsolidada({ months }: TablaConsolidadaProps): React.JSX.Element {
  const totalIngresos = months.reduce((s, m) => s + m.totalIngresos, 0);
  const totalGastos = months.reduce((s, m) => s + m.totalGastos, 0);
  const totalCompras = months.reduce((s, m) => s + m.totalCompras, 0);
  const totalMargen = totalIngresos - totalGastos;

  const cellStyle: CSSProperties = {
    padding: "0.5rem 0.75rem",
    fontFamily: "var(--font-body)",
    fontSize: "0.8125rem",
    color: "var(--on-surf)",
    textAlign: "right",
    whiteSpace: "nowrap",
    borderBottom: "1px solid var(--ghost-border)",
  };

  const headCell: CSSProperties = {
    ...cellStyle,
    color: "var(--on-surf-var)",
    fontWeight: 600,
    fontSize: "0.6875rem",
    letterSpacing: "0.03em",
    textTransform: "uppercase",
    background: "var(--surf-low)",
    position: "sticky",
    top: 0,
    zIndex: 1,
  };

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ ...headCell, textAlign: "left" }}>Mes</th>
            <th style={headCell}>Ingresos</th>
            <th style={headCell}>Gastos Op.</th>
            <th style={headCell}>Margen Op.</th>
            <th style={headCell}>Compras Proveedor</th>
          </tr>
        </thead>
        <tbody>
          {months.map((m, idx) => (
            <tr
              key={m.monthKey}
              style={{ background: idx % 2 === 0 ? "transparent" : "rgba(178,204,192,0.04)" }}
            >
              <td
                style={{
                  ...cellStyle,
                  textAlign: "left",
                  fontWeight: 600,
                  color: "var(--on-surf)",
                }}
              >
                {m.monthLabel}
              </td>
              <td style={cellStyle}>{formatMXN(m.totalIngresos)}</td>
              <td style={cellStyle}>{formatMXN(m.totalGastos)}</td>
              <td style={cellStyle}>
                <MargenBadge val={m.totalMargen} />
              </td>
              <td style={{ ...cellStyle, color: "var(--on-surf-var)" }}>
                {formatMXN(m.totalCompras)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr style={{ borderTop: "2px solid rgba(178,204,192,0.3)", background: "var(--surf-low)" }}>
            <td style={{ ...cellStyle, textAlign: "left", fontWeight: 700, borderBottom: "none" }}>
              Total
            </td>
            <td style={{ ...cellStyle, fontWeight: 700, borderBottom: "none" }}>
              {formatMXN(totalIngresos)}
            </td>
            <td style={{ ...cellStyle, fontWeight: 700, borderBottom: "none" }}>
              {formatMXN(totalGastos)}
            </td>
            <td style={{ ...cellStyle, fontWeight: 700, borderBottom: "none" }}>
              <MargenBadge val={totalMargen} />
            </td>
            <td style={{ ...cellStyle, fontWeight: 700, borderBottom: "none", color: "var(--on-surf-var)" }}>
              {formatMXN(totalCompras)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

// ── CSV helpers ───────────────────────────────────────────────────────────────

function buildComparativaCSV(
  months: MonthRow[],
  branches: AnualData["branches"],
): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = months.map((m) => {
    const row: Record<string, unknown> = { Mes: m.monthLabel };
    for (const b of branches) {
      const d = m.byBranch[b.id] ?? { ingresos: 0, gastosOperativos: 0, comprasProveedor: 0, margenOperativo: 0 };
      row[`${b.code} Ingresos`] = d.ingresos.toFixed(2);
      row[`${b.code} Gastos Op`] = d.gastosOperativos.toFixed(2);
      row[`${b.code} Margen`] = d.margenOperativo.toFixed(2);
      row[`${b.code} Compras`] = d.comprasProveedor.toFixed(2);
    }
    return row;
  });

  const total: Record<string, unknown> = { Mes: "TOTAL" };
  for (const b of branches) {
    const totals = { ingresos: 0, gastos: 0, compras: 0, margen: 0 };
    for (const m of months) {
      const d = m.byBranch[b.id] ?? { ingresos: 0, gastosOperativos: 0, comprasProveedor: 0, margenOperativo: 0 };
      totals.ingresos += d.ingresos;
      totals.gastos += d.gastosOperativos;
      totals.compras += d.comprasProveedor;
      totals.margen += d.margenOperativo;
    }
    total[`${b.code} Ingresos`] = totals.ingresos.toFixed(2);
    total[`${b.code} Gastos Op`] = totals.gastos.toFixed(2);
    total[`${b.code} Margen`] = totals.margen.toFixed(2);
    total[`${b.code} Compras`] = totals.compras.toFixed(2);
  }
  rows.push(total);
  return rows;
}

function buildConsolidadoCSV(months: MonthRow[]): Record<string, unknown>[] {
  const rows: Record<string, unknown>[] = months.map((m) => ({
    Mes: m.monthLabel,
    Ingresos: m.totalIngresos.toFixed(2),
    "Gastos Op": m.totalGastos.toFixed(2),
    Margen: m.totalMargen.toFixed(2),
    "Compras Proveedor": m.totalCompras.toFixed(2),
  }));

  rows.push({
    Mes: "TOTAL",
    Ingresos: months.reduce((s, m) => s + m.totalIngresos, 0).toFixed(2),
    "Gastos Op": months.reduce((s, m) => s + m.totalGastos, 0).toFixed(2),
    Margen: months.reduce((s, m) => s + m.totalMargen, 0).toFixed(2),
    "Compras Proveedor": months.reduce((s, m) => s + m.totalCompras, 0).toFixed(2),
  });

  return rows;
}

// ── Root client component ─────────────────────────────────────────────────────

interface AnualClientProps {
  data: AnualData;
}

export function AnualClient({ data }: AnualClientProps): React.JSX.Element {
  const { year, view, months, branches, availableYears, isEmpty } = data;
  const router = useRouter();

  function navigate(newYear: number, newView: string): void {
    router.push(`/reportes/anual?year=${newYear}&view=${newView}`);
  }

  function handleCSV(): void {
    if (view === "comparativa") {
      downloadCSV(
        buildComparativaCSV(months, branches),
        `reporte-anual-${year}-comparativa`,
      );
    } else {
      downloadCSV(
        buildConsolidadoCSV(months),
        `reporte-anual-${year}-consolidado`,
      );
    }
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Header */}
      <header className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="text-[2.25rem] lg:text-[2.75rem] font-bold tracking-[-0.01em] leading-none flex items-center gap-3"
            style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
          >
            <CalendarRange
              className="h-8 w-8"
              style={{ color: "var(--on-surf-var)" }}
            />
            Reporte anual
          </h1>
          <p
            className="mt-2 text-[0.8125rem]"
            style={{ color: "var(--on-surf-var)" }}
          >
            Ingresos, gastos operativos y margen por mes. Solo administradores.
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-end gap-3">
          {/* Year selector */}
          <div>
            <span style={{ ...LABEL, display: "block", marginBottom: "0.25rem" }}>Año</span>
            <select
              style={SELECT}
              value={year}
              onChange={(e) => navigate(Number(e.target.value), view)}
            >
              {availableYears.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          </div>

          {/* View toggle */}
          <div
            className="flex rounded-[var(--r-md)] overflow-hidden"
            style={{ border: "1px solid var(--ghost-border-strong)" }}
          >
            {(["comparativa", "consolidado"] as const).map((v) => (
              <button
                key={v}
                onClick={() => navigate(year, v)}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.8125rem",
                  fontWeight: 500,
                  padding: "0 0.875rem",
                  height: 36,
                  border: "none",
                  cursor: "pointer",
                  background:
                    view === v ? "var(--p)" : "var(--surf-low)",
                  color: view === v ? "#fff" : "var(--on-surf-var)",
                  textTransform: "capitalize",
                }}
              >
                {v}
              </button>
            ))}
          </div>

          {/* CSV export */}
          {!isEmpty && (
            <button onClick={handleCSV} style={BTN_EXPORT}>
              <Download className="h-3.5 w-3.5" />
              Exportar CSV
            </button>
          )}
        </div>
      </header>

      {/* Empty state */}
      {isEmpty ? (
        <ReportEmptyState
          message={`No hay datos para el año ${year}.`}
          icon={TrendingUp}
        />
      ) : (
        <>
          {/* KPI cards */}
          <KpiCards months={months} year={year} />

          {/* Charts */}
          {view === "comparativa" ? (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {branches.map((b) => (
                <BarChart
                  key={b.id}
                  title={`${b.name} — Ingresos vs. Gastos Op.`}
                  months={months}
                  getIngresos={(m) => m.byBranch[b.id]?.ingresos ?? 0}
                  getGastos={(m) => m.byBranch[b.id]?.gastosOperativos ?? 0}
                />
              ))}
            </div>
          ) : (
            <BarChart
              title="Consolidado — Ingresos vs. Gastos Op."
              months={months}
              getIngresos={(m) => m.totalIngresos}
              getGastos={(m) => m.totalGastos}
            />
          )}

          {/* Table */}
          <div
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
          >
            <div
              className="px-5 py-4 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--ghost-border)" }}
            >
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  letterSpacing: "-0.01em",
                  color: "var(--on-surf)",
                }}
              >
                {view === "comparativa"
                  ? `Detalle por sucursal — ${year}`
                  : `Consolidado — ${year}`}
              </p>
            </div>
            {view === "comparativa" ? (
              <TablaComparativa months={months} branches={branches} />
            ) : (
              <TablaConsolidada months={months} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
