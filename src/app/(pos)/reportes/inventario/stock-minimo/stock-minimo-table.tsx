"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Package,
  MapPin,
  FileDown,
  PackagePlus,
  Boxes,
} from "lucide-react";
import Link from "next/link";
import { downloadCSV } from "@/lib/reportes/csv";
import type { StockAlertRow, StockMinimoKpis, SucursalOption } from "./page";

// ── Helpers ──────────────────────────────────────────────────────────────────

function severity(r: StockAlertRow): "critical" | "warning" {
  return r.quantity <= r.stockMinimo / 2 ? "critical" : "warning";
}

const CATEGORIA_LABELS: Record<string, string> = {
  ACCESORIO: "Accesorio",
  CARGADOR: "Cargador",
  REFACCION: "Refacción",
  BATERIA_STANDALONE: "Batería",
};

function tipoLabel(r: StockAlertRow): string {
  if (r.kind === "variant") return "Vehículo";
  return CATEGORIA_LABELS[r.categoria ?? ""] ?? r.categoria ?? "Producto";
}

function productoLabel(r: StockAlertRow): string {
  if (r.kind === "variant") {
    return `${r.modelo ?? "—"} · ${r.color ?? "—"} · ${r.voltaje ?? "—"}`;
  }
  return r.nombre ?? "—";
}

function skuLabel(r: StockAlertRow): string {
  if (r.kind === "variant") return r.sku ?? "—";
  return r.codigo ?? "—";
}

function recepcionHref(r: StockAlertRow): string {
  if (r.kind === "variant" && r.variantId) {
    return `/inventario/recepciones/nuevo?variantId=${r.variantId}`;
  }
  if (r.simpleId) {
    return `/inventario/recepciones/nuevo?simpleProductId=${r.simpleId}`;
  }
  return "/inventario/recepciones/nuevo";
}

// ── Props ────────────────────────────────────────────────────────────────────

interface CurrentFilters {
  branchId: string;
  kind: string;
  severity: string;
  q: string;
}

interface Props {
  rows: StockAlertRow[];
  kpis: StockMinimoKpis;
  sucursales: SucursalOption[];
  isAdmin: boolean;
  currentFilters: CurrentFilters;
}

const KIND_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "variant", label: "Vehículos" },
  { value: "simple", label: "Productos simples" },
] as const;

const SEVERITY_OPTIONS = [
  { value: "all", label: "Todas" },
  { value: "critical", label: "Crítico" },
  { value: "warning", label: "Advertencia" },
] as const;

// ── Main Component ──────────────────────────────────────────────────────────

export function StockMinimoTable({
  rows,
  kpis,
  sucursales,
  isAdmin,
  currentFilters,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [filterBranchId, setFilterBranchId] = useState(currentFilters.branchId);
  const [filterKind, setFilterKind] = useState(currentFilters.kind);
  const [filterSeverity, setFilterSeverity] = useState(currentFilters.severity);
  const [filterQ, setFilterQ] = useState(currentFilters.q);

  function applyFilters(): void {
    const p = new URLSearchParams();
    if (filterBranchId && isAdmin) p.set("branchId", filterBranchId);
    if (filterKind && filterKind !== "all") p.set("kind", filterKind);
    if (filterSeverity && filterSeverity !== "all") p.set("severity", filterSeverity);
    if (filterQ.trim()) p.set("q", filterQ.trim());
    startTransition(() => {
      router.replace(`/reportes/inventario/stock-minimo?${p.toString()}`);
    });
  }

  // Aplicar filtros client-side a las filas recibidas del server
  const filteredRows = rows.filter((r) => {
    if (filterKind !== "all" && r.kind !== filterKind) return false;
    if (filterSeverity !== "all" && severity(r) !== filterSeverity) return false;
    if (filterQ.trim()) {
      const q = filterQ.trim().toLowerCase();
      const haystack = [
        r.kind === "variant" ? r.sku : r.codigo,
        r.kind === "variant" ? `${r.modelo} ${r.color} ${r.voltaje}` : r.nombre,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  function handleExportCSV(): void {
    downloadCSV(
      filteredRows.map((r) => ({
        Severidad: severity(r) === "critical" ? "Crítico" : "Advertencia",
        Tipo: tipoLabel(r),
        Producto: productoLabel(r),
        "SKU / Código": skuLabel(r),
        Sucursal: r.branchName,
        "Stock Actual": r.quantity,
        "Stock Mínimo": r.stockMinimo,
        Faltante: r.faltante,
      })),
      `stock-minimo-${new Date().toISOString().slice(0, 10)}`,
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: "var(--ter-container)" }}
          >
            <AlertTriangle size={20} style={{ color: "var(--on-ter-container)" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              Reporte de Stock Mínimo
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
              Snapshot actual · productos por debajo del mínimo configurado
            </p>
          </div>
        </div>
        <button
          onClick={handleExportCSV}
          disabled={filteredRows.length === 0}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
          style={{
            background: "var(--surf-high)",
            color: "var(--on-surf)",
            opacity: filteredRows.length === 0 ? 0.5 : 1,
          }}
        >
          <FileDown size={15} />
          Exportar CSV
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
        <KpiCard
          label="En alerta"
          value={String(kpis.totalAlertas)}
          icon={<Package size={17} />}
          iconBg="var(--warn-container)"
          iconColor="var(--warn)"
        />
        <KpiCard
          label="Críticos"
          value={String(kpis.criticas)}
          icon={<AlertTriangle size={17} />}
          iconBg="var(--ter-container)"
          iconColor="var(--on-ter-container)"
          valueColor={kpis.criticas > 0 ? "var(--on-ter-container)" : undefined}
        />
        <KpiCard
          label="Advertencias"
          value={String(kpis.warnings)}
          icon={<AlertTriangle size={17} />}
          iconBg="var(--warn-container)"
          iconColor="var(--warn)"
          valueColor={kpis.warnings > 0 ? "var(--warn)" : undefined}
        />
        <KpiCard
          label="Unidades faltantes"
          value={String(kpis.unidadesFaltantes)}
          icon={<Boxes size={17} />}
          iconBg="var(--surf-high)"
          iconColor="var(--on-surf-var)"
        />
        <KpiCard
          label="Sucursales afectadas"
          value={String(kpis.sucursalesConAlertas)}
          icon={<MapPin size={17} />}
          iconBg="var(--sec-container)"
          iconColor="var(--on-sec-container)"
        />
      </div>

      {/* Filters */}
      <div
        className="rounded-2xl p-4 mb-5 flex flex-wrap gap-3 items-end"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
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
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </FilterField>
        )}
        <FilterField label="Tipo">
          <select
            value={filterKind}
            onChange={(e) => setFilterKind(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={inputStyle}
          >
            {KIND_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Severidad">
          <select
            value={filterSeverity}
            onChange={(e) => setFilterSeverity(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={inputStyle}
          >
            {SEVERITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Buscar">
          <input
            type="text"
            value={filterQ}
            onChange={(e) => setFilterQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            placeholder="SKU, código, nombre…"
            className="px-3 py-2 rounded-xl text-sm w-52"
            style={inputStyle}
          />
        </FilterField>
        <button
          onClick={applyFilters}
          className="px-4 py-2 rounded-full text-sm font-semibold transition-all"
          style={{
            background: "var(--velocity-gradient)",
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
        {filteredRows.length === 0 ? (
          <div className="px-5 py-16 text-center" style={{ color: "var(--on-surf-var)" }}>
            <Package size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              {rows.length === 0
                ? "No hay productos por debajo del stock mínimo."
                : "No hay resultados para los filtros aplicados."}
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                  <Th>Severidad</Th>
                  <Th>Tipo</Th>
                  <Th>Producto</Th>
                  <Th>SKU / Código</Th>
                  {isAdmin && <Th>Sucursal</Th>}
                  <Th align="right">Stock actual</Th>
                  <Th align="right">Mínimo</Th>
                  <Th align="right">Faltante</Th>
                  <Th align="right">Acción</Th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => {
                  const sev = severity(row);
                  return (
                    <tr
                      key={row.stockId}
                      style={{ borderBottom: "1px solid var(--ghost-border-soft)" }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.background = "var(--surf-high)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.background = "transparent";
                      }}
                    >
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                          style={{
                            background:
                              sev === "critical"
                                ? "var(--ter-container)"
                                : "var(--warn-container)",
                            color:
                              sev === "critical"
                                ? "var(--on-ter-container)"
                                : "var(--warn)",
                          }}
                        >
                          <AlertTriangle size={10} />
                          {sev === "critical" ? "Crítico" : "Advertencia"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                          style={{
                            background: "var(--surf-high)",
                            color: "var(--on-surf-var)",
                          }}
                        >
                          {tipoLabel(row)}
                        </span>
                      </td>
                      <td className="px-4 py-3" style={{ color: "var(--on-surf)" }}>
                        <div className="font-medium">{productoLabel(row)}</div>
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="font-mono text-xs px-2 py-1 rounded-lg"
                          style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
                        >
                          {skuLabel(row)}
                        </span>
                      </td>
                      {isAdmin && (
                        <td className="px-4 py-3 text-xs" style={{ color: "var(--on-surf-var)" }}>
                          {row.branchCode} — {row.branchName}
                        </td>
                      )}
                      <td className="px-4 py-3 text-right">
                        <span
                          className="text-sm font-bold"
                          style={{
                            fontFamily: "var(--font-display)",
                            color:
                              sev === "critical"
                                ? "var(--on-ter-container)"
                                : "var(--warn)",
                          }}
                        >
                          {row.quantity}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-right text-sm"
                        style={{ color: "var(--on-surf-var)" }}
                      >
                        {row.stockMinimo}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span
                          className="text-sm font-semibold"
                          style={{ color: "var(--on-ter-container)" }}
                        >
                          -{row.faltante}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <Link
                          href={recepcionHref(row)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all hover:opacity-90"
                          style={{ background: "var(--p)", color: "#ffffff" }}
                        >
                          <PackagePlus size={13} />
                          Crear recepción
                        </Link>
                      </td>
                    </tr>
                  );
                })}
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
  valueColor,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
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
            fontFamily: "var(--font-display)",
            color: valueColor ?? "var(--on-surf)",
          }}
        >
          {value}
        </p>
      </div>
    </div>
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
