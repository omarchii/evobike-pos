"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  CheckCircle,
  AlertCircle,
  ArrowUpDown,
  Calculator,
  FileDown,
  Printer,
  Loader2,
  ShieldCheck,
  ClipboardList,
} from "lucide-react";
import { openPDFInNewTab } from "@/lib/pdf-client";
import { downloadCSV } from "@/lib/reportes/csv";
import type {
  CorteRow,
  HistorialKpis,
  OperadorOption,
  SucursalOption,
} from "./page";

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmtCurrency(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Props ────────────────────────────────────────────────────────────────────

interface CurrentFilters {
  from: string;
  to: string;
  userId: string;
  branchId: string;
}

interface Props {
  rows: CorteRow[];
  kpis: HistorialKpis;
  operadores: OperadorOption[];
  sucursales: SucursalOption[];
  isAdmin: boolean;
  currentFilters: CurrentFilters;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function HistorialCortes({
  rows,
  kpis,
  operadores,
  sucursales,
  isAdmin,
  currentFilters,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [filterFrom, setFilterFrom] = useState(currentFilters.from);
  const [filterTo, setFilterTo] = useState(currentFilters.to);
  const [filterUserId, setFilterUserId] = useState(currentFilters.userId);
  const [filterBranchId, setFilterBranchId] = useState(currentFilters.branchId);
  const [pdfLoadingId, setPdfLoadingId] = useState<string | null>(null);

  function applyFilters(): void {
    const p = new URLSearchParams();
    if (filterFrom) p.set("from", filterFrom);
    if (filterTo) p.set("to", filterTo);
    if (filterUserId) p.set("userId", filterUserId);
    if (filterBranchId && isAdmin) p.set("branchId", filterBranchId);
    startTransition(() => {
      router.replace(`/reportes/caja/historial?${p.toString()}`);
    });
  }

  async function handlePrintPDF(sessionId: string): Promise<void> {
    setPdfLoadingId(sessionId);
    await openPDFInNewTab(`/api/cash-register/session/${sessionId}/pdf`);
    setPdfLoadingId(null);
  }

  function handleExportCSV(): void {
    downloadCSV(
      rows.map((r) => ({
        Folio: r.id.slice(0, 8).toUpperCase(),
        Sucursal: r.branchName,
        Operador: r.operadorName,
        Apertura: fmtDateTime(r.openedAt),
        Cierre: fmtDateTime(r.closedAt),
        "Efectivo Esperado":
          r.efectivoEsperado !== null ? r.efectivoEsperado : "No registrado",
        "Efectivo Contado":
          r.efectivoContado !== null ? r.efectivoContado : "No registrado",
        Diferencia: r.diferencia !== null ? r.diferencia : "No registrado",
        "Autorización": r.autorizadorName ?? "—",
      })),
      `historial-cortes-${currentFilters.from}-${currentFilters.to}`,
    );
  }

  const diferenciaNetaPositive = kpis.diferenciaNeta >= 0;

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: "var(--p-container)" }}
          >
            <ClipboardList size={20} style={{ color: "var(--on-p-container)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              Historial de Cortes
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
              Cortes de caja cerrados · {fmtDate(currentFilters.from)} – {fmtDate(currentFilters.to)}
            </p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={rows.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
          style={{
            background: "var(--surf-high)",
            color: "var(--on-surf)",
            opacity: rows.length === 0 ? 0.5 : 1,
          }}
        >
          <FileDown size={15} />
          Exportar CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard
          label="Cortes cerrados"
          value={String(kpis.totalCortes)}
          icon={<CheckCircle size={17} />}
          iconBg="var(--sec-container)"
          iconColor="var(--on-sec-container)"
        />
        <KpiCard
          label="Efectivo esperado"
          value={fmtCurrency(kpis.efectivoEsperadoAcumulado)}
          icon={<Calculator size={17} />}
          iconBg="var(--p-container)"
          iconColor="var(--on-p-container)"
          mono
        />
        <KpiCard
          label="Efectivo contado"
          value={fmtCurrency(kpis.efectivoContadoAcumulado)}
          icon={<Banknote size={17} />}
          iconBg="var(--p-container)"
          iconColor="var(--on-p-container)"
          mono
        />
        <KpiCard
          label="Diferencia neta"
          value={
            (diferenciaNetaPositive && kpis.diferenciaNeta > 0 ? "+" : "") +
            fmtCurrency(kpis.diferenciaNeta)
          }
          icon={<ArrowUpDown size={17} />}
          iconBg={diferenciaNetaPositive ? "var(--sec-container)" : "var(--ter-container)"}
          iconColor={diferenciaNetaPositive ? "var(--on-sec-container)" : "var(--on-ter-container)"}
          mono
          valueColor={
            kpis.diferenciaNeta > 0.01
              ? "var(--on-sec-container)"
              : kpis.diferenciaNeta < -0.01
              ? "var(--on-ter-container)"
              : undefined
          }
        />
        <KpiCard
          label="Con diferencia"
          value={String(kpis.cortesConDiferencia)}
          icon={<AlertCircle size={17} />}
          iconBg={kpis.cortesConDiferencia > 0 ? "var(--warn-container)" : "var(--sec-container)"}
          iconColor={kpis.cortesConDiferencia > 0 ? "var(--warn)" : "var(--on-sec-container)"}
        />
      </div>

      {/* Filters */}
      <div
        className="rounded-2xl p-4 mb-5 flex flex-wrap gap-3 items-end"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <FilterField label="Desde">
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={inputStyle}
          />
        </FilterField>
        <FilterField label="Hasta">
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={inputStyle}
          />
        </FilterField>
        {operadores.length > 0 && (
          <FilterField label="Operador">
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm"
              style={inputStyle}
            >
              <option value="">Todos</option>
              {operadores.map((op) => (
                <option key={op.id} value={op.id}>
                  {op.name}
                </option>
              ))}
            </select>
          </FilterField>
        )}
        {isAdmin && sucursales.length > 0 && (
          <FilterField label="Sucursal">
            <select
              value={filterBranchId}
              onChange={(e) => setFilterBranchId(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm"
              style={inputStyle}
            >
              <option value="">Todas</option>
              {sucursales.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </FilterField>
        )}
        <button
          onClick={applyFilters}
          className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, #1b4332, #2ecc71)",
            color: "#fff",
          }}
        >
          Filtrar
        </button>
      </div>

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {rows.length === 0 ? (
          <div className="px-5 py-16 text-center" style={{ color: "var(--on-surf-var)" }}>
            <ClipboardList size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">No hay cortes cerrados en este período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                  <Th>Folio</Th>
                  {isAdmin && <Th>Sucursal</Th>}
                  <Th>Operador</Th>
                  <Th>Apertura</Th>
                  <Th>Cierre</Th>
                  <Th align="right">Ef. Esperado</Th>
                  <Th align="right">Ef. Contado</Th>
                  <Th align="right">Diferencia</Th>
                  <Th>Autorización</Th>
                  <Th align="right">Acción</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr
                    key={row.id}
                    style={{ borderBottom: "1px solid rgba(178,204,192,0.08)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surf-high)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <td className="px-4 py-3">
                      <span
                        className="font-mono text-xs px-2 py-1 rounded-lg"
                        style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
                      >
                        {row.id.slice(0, 8).toUpperCase()}
                      </span>
                    </td>
                    {isAdmin && (
                      <td className="px-4 py-3 text-xs" style={{ color: "var(--on-surf-var)" }}>
                        {row.branchName}
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span style={{ color: "var(--on-surf)" }}>{row.operadorName}</span>
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--on-surf-var)" }}>
                      {fmtDateTime(row.openedAt)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: "var(--on-surf-var)" }}>
                      {fmtDateTime(row.closedAt)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.efectivoEsperado !== null ? (
                        <span
                          className="font-mono text-sm"
                          style={{ color: "var(--on-surf)" }}
                        >
                          {fmtCurrency(row.efectivoEsperado)}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                          No registrado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.efectivoContado !== null ? (
                        <span
                          className="font-mono text-sm"
                          style={{ color: "var(--on-surf)" }}
                        >
                          {fmtCurrency(row.efectivoContado)}
                        </span>
                      ) : (
                        <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                          No registrado
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <DiferenciaBadge val={row.diferencia} />
                    </td>
                    <td className="px-4 py-3">
                      <AutorizadorBadge name={row.autorizadorName} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        disabled={!row.isClosed || pdfLoadingId === row.id}
                        onClick={() => void handlePrintPDF(row.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
                        style={{
                          background:
                            pdfLoadingId === row.id
                              ? "var(--surf-high)"
                              : "var(--p)",
                          color:
                            pdfLoadingId === row.id ? "var(--on-surf-var)" : "#ffffff",
                          cursor: "pointer",
                        }}
                      >
                        {pdfLoadingId === row.id ? (
                          <Loader2 size={13} className="animate-spin" />
                        ) : (
                          <Printer size={13} />
                        )}
                        {pdfLoadingId === row.id ? "Generando..." : "Imprimir"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ───────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--surf-high)",
  color: "var(--on-surf)",
  border: "1px solid var(--ghost-border)",
};

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1">
      <label
        className="text-xs uppercase tracking-wider font-medium"
        style={{ color: "var(--on-surf-var)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function KpiCard({
  label,
  value,
  icon,
  iconBg,
  iconColor,
  mono,
  valueColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
  mono?: boolean;
  valueColor?: string;
}): React.JSX.Element {
  return (
    <div
      className="rounded-2xl px-4 py-3 flex items-center gap-3"
      style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
    >
      <div
        className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div className="min-w-0">
        <p
          className="text-xs uppercase tracking-wider font-medium truncate"
          style={{ color: "var(--on-surf-var)" }}
        >
          {label}
        </p>
        <p
          className="text-lg font-bold mt-0.5 truncate"
          style={{
            fontFamily: mono ? "var(--font-mono, monospace)" : "var(--font-display)",
            color: valueColor ?? "var(--on-surf)",
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function DiferenciaBadge({ val }: { val: number | null }): React.JSX.Element {
  if (val === null) {
    return <span style={{ color: "var(--on-surf-var)" }}>—</span>;
  }
  if (Math.abs(val) <= 0.01) {
    return (
      <span
        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium"
        style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
      >
        Sin diferencia
      </span>
    );
  }
  const sobrante = val > 0;
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium font-mono"
      style={{
        background: sobrante ? "var(--sec-container)" : "var(--ter-container)",
        color: sobrante ? "var(--on-sec-container)" : "var(--on-ter-container)",
      }}
    >
      {sobrante ? "+" : ""}
      {fmtCurrency(val)}
    </span>
  );
}

function AutorizadorBadge({ name }: { name: string | null }): React.JSX.Element {
  if (!name) {
    return <span style={{ color: "var(--on-surf-var)" }}>—</span>;
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: "var(--p-container)", color: "var(--on-p-container)" }}
    >
      <ShieldCheck size={10} />
      {name}
    </span>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}): React.JSX.Element {
  return (
    <th
      className="px-4 py-3 text-xs font-medium uppercase tracking-wider"
      style={{ color: "var(--on-surf-var)", textAlign: align }}
    >
      {children}
    </th>
  );
}
