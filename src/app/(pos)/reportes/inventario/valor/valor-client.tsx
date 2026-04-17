"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BarChart3, Bike, Package, MapPin, FileDown, Boxes } from "lucide-react";
import { downloadCSV } from "@/lib/reportes/csv";
import { formatMXN } from "@/lib/reportes/money";
import { cn } from "@/lib/utils";
import type { ValorInventarioRow, ValorInventarioKpis, SucursalOption } from "./page";

// ── Constantes locales (no importar enums de @prisma/client) ─────────────────

const KIND_OPTIONS = [
  { value: "all", label: "Todos" },
  { value: "variant", label: "Vehículos" },
  { value: "simple", label: "Prod. simples" },
] as const;

const COST_SOURCE_OPTIONS = [
  { value: "all", label: "Todas las fuentes" },
  { value: "RECEIPT", label: "Recepción" },
  { value: "CATALOG", label: "Catálogo" },
  { value: "NONE", label: "Sin costo" },
] as const;

// ── Helpers ───────────────────────────────────────────────────────────────────

function productoLabel(r: ValorInventarioRow): string {
  if (r.kind === "variant") {
    return [r.modelo, r.color, r.voltaje].filter(Boolean).join(" ");
  }
  return r.nombre ?? "—";
}

function codigoLabel(r: ValorInventarioRow): string {
  if (r.kind === "variant") return r.sku ?? "—";
  return r.codigo ?? "—";
}

// ── Props ─────────────────────────────────────────────────────────────────────

interface CurrentFilters {
  branchId: string;
  kind: string;
  costSource: string;
  q: string;
}

interface Props {
  rows: ValorInventarioRow[];
  kpis: ValorInventarioKpis;
  sucursales: SucursalOption[];
  isAdmin: boolean;
  currentFilters: CurrentFilters;
}

// ── Main Component ────────────────────────────────────────────────────────────

export function ValorInventarioClient({
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
  const [filterCostSource, setFilterCostSource] = useState(currentFilters.costSource);
  const [filterQ, setFilterQ] = useState(currentFilters.q);

  function applyFilters(): void {
    const p = new URLSearchParams();
    if (filterBranchId && isAdmin) p.set("branchId", filterBranchId);
    if (filterKind && filterKind !== "all") p.set("kind", filterKind);
    if (filterCostSource && filterCostSource !== "all") p.set("costSource", filterCostSource);
    if (filterQ.trim()) p.set("q", filterQ.trim());
    startTransition(() => {
      router.replace(`/reportes/inventario/valor?${p.toString()}`);
    });
  }

  // ── Filtros client-side ────────────────────────────────────────────────────
  const filteredRows = rows.filter((r) => {
    if (filterKind !== "all" && r.kind !== filterKind) return false;
    if (filterCostSource !== "all" && r.costSource !== filterCostSource) return false;
    if (filterQ.trim()) {
      const q = filterQ.trim().toLowerCase();
      const haystack = [codigoLabel(r), productoLabel(r)].join(" ").toLowerCase();
      if (!haystack.includes(q)) return false;
    }
    return true;
  });

  // ── CSV ────────────────────────────────────────────────────────────────────
  function handleExportCSV(): void {
    const sourceLabel: Record<string, string> = {
      RECEIPT: "Recepción",
      CATALOG: "Catálogo",
      NONE: "Sin costo",
    };
    downloadCSV(
      filteredRows.map((r) => ({
        Sucursal: `${r.branchCode} — ${r.branchName}`,
        Tipo: r.kind === "variant" ? "Vehículo" : "Prod. simple",
        Código: codigoLabel(r),
        Nombre: productoLabel(r),
        Stock: r.quantity,
        "Costo unitario": r.costoUnitario,
        "Fuente del costo": sourceLabel[r.costSource] ?? r.costSource,
        "Valor total": r.valorTotal,
      })),
      `valor-inventario`,
    );
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="flex items-center justify-center w-10 h-10 rounded-xl"
            style={{ background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)" }}
          >
            <BarChart3 size={20} style={{ color: "#ffffff" }} />
          </div>
          <div>
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              Valor de Inventario
            </h1>
            <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
              Snapshot actual · stock con cantidad &gt; 0
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
        {/* Primera card: Velocity Gradient */}
        <div
          className="rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{
            background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div
            className="flex items-center justify-center w-9 h-9 rounded-xl shrink-0"
            style={{ background: "rgba(255,255,255,0.15)" }}
          >
            <BarChart3 size={17} style={{ color: "#ffffff" }} />
          </div>
          <div className="min-w-0">
            <p
              className="text-xs uppercase tracking-wider font-medium truncate"
              style={{ color: "rgba(255,255,255,0.75)" }}
            >
              Valor total
            </p>
            <p
              className="text-lg font-bold mt-0.5 truncate"
              style={{ fontFamily: "var(--font-display)", color: "#ffffff" }}
            >
              {formatMXN(kpis.valorTotal)}
            </p>
          </div>
        </div>

        <KpiCard
          label="Valor vehículos"
          value={formatMXN(kpis.valorVariants)}
          icon={<Bike size={17} />}
          iconBg="var(--sec-container)"
          iconColor="var(--on-sec-container)"
        />
        <KpiCard
          label="Valor prod. simples"
          value={formatMXN(kpis.valorSimples)}
          icon={<Package size={17} />}
          iconBg="var(--surf-high)"
          iconColor="var(--on-surf-var)"
        />
        <KpiCard
          label="Productos distintos"
          value={String(kpis.productosDistintos)}
          icon={<Boxes size={17} />}
          iconBg="var(--surf-high)"
          iconColor="var(--on-surf-var)"
        />
        {isAdmin && (
          <KpiCard
            label="Sucursales con stock"
            value={String(kpis.sucursalesConStock)}
            icon={<MapPin size={17} />}
            iconBg="var(--sec-container)"
            iconColor="var(--on-sec-container)"
          />
        )}
      </div>

      {/* Filtros */}
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

        <FilterField label="Fuente del costo">
          <select
            value={filterCostSource}
            onChange={(e) => setFilterCostSource(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={inputStyle}
          >
            {COST_SOURCE_OPTIONS.map((o) => (
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
            background: "linear-gradient(135deg, #1b4332, #2ecc71)",
            color: "#fff",
          }}
        >
          Filtrar
        </button>
      </div>

      {/* Tabla */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {filteredRows.length === 0 ? (
          <div className="px-5 py-16 text-center" style={{ color: "var(--on-surf-var)" }}>
            <Package size={36} className="mx-auto mb-3 opacity-30" />
            <p className="text-sm">
              No hay stock que reportar con los filtros actuales.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                  {isAdmin && <Th>Sucursal</Th>}
                  <Th>Tipo</Th>
                  <Th>Código</Th>
                  <Th>Nombre</Th>
                  <Th align="right">Stock</Th>
                  <Th align="right">Costo unitario</Th>
                  <Th align="right">Valor total</Th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.map((row) => (
                  <tr
                    key={row.stockId}
                    style={{ borderBottom: "1px solid rgba(178,204,192,0.08)" }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.background = "var(--surf-high)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.background = "transparent";
                    }}
                  >
                    {isAdmin && (
                      <td
                        className="px-4 py-3"
                        style={{ color: "var(--on-surf-var)" }}
                      >
                        <span
                          className={cn(
                            "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium",
                          )}
                          style={{
                            background: "var(--surf-high)",
                            color: "var(--on-surf-var)",
                          }}
                        >
                          {row.branchCode} — {row.branchName}
                        </span>
                      </td>
                    )}
                    <td className="px-4 py-3">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-full text-xs"
                        style={{
                          background:
                            row.kind === "variant"
                              ? "var(--sec-container)"
                              : "var(--surf-high)",
                          color:
                            row.kind === "variant"
                              ? "var(--on-sec-container)"
                              : "var(--on-surf-var)",
                        }}
                      >
                        {row.kind === "variant" ? "Vehículo" : "Prod. simple"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className="font-mono text-xs px-2 py-1 rounded-lg"
                        style={{
                          background: "var(--surf-high)",
                          color: "var(--on-surf-var)",
                        }}
                      >
                        {codigoLabel(row)}
                      </span>
                    </td>
                    <td
                      className="px-4 py-3 font-medium"
                      style={{ color: "var(--on-surf)" }}
                    >
                      {productoLabel(row)}
                    </td>
                    <td
                      className="px-4 py-3 text-right tabular-nums"
                      style={{ color: "var(--on-surf)" }}
                    >
                      {row.quantity}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-1">
                        <span
                          className="tabular-nums"
                          style={{ color: "var(--on-surf)" }}
                        >
                          {formatMXN(row.costoUnitario)}
                        </span>
                        <CostSourceBadge source={row.costSource} />
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <span
                        className="font-bold tabular-nums"
                        style={{
                          fontFamily: "var(--font-display)",
                          color: "var(--on-surf)",
                        }}
                      >
                        {formatMXN(row.valorTotal)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr
                  style={{
                    borderTop: "1px solid var(--ghost-border)",
                    background: "var(--surf-low)",
                  }}
                >
                  {isAdmin && <td className="px-4 py-3" />}
                  <td className="px-4 py-3" colSpan={4} />
                  <td
                    className="px-4 py-3 text-right text-xs font-medium uppercase tracking-wider"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    Total
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span
                      className="font-bold tabular-nums"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: "var(--on-surf)",
                      }}
                    >
                      {formatMXN(
                        filteredRows.reduce((acc, r) => acc + r.valorTotal, 0),
                      )}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

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
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  iconBg: string;
  iconColor: string;
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
          style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function CostSourceBadge({
  source,
}: {
  source: "RECEIPT" | "CATALOG" | "NONE";
}): React.JSX.Element {
  if (source === "RECEIPT") {
    return (
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
        style={{
          background: "color-mix(in srgb, #2ecc71 20%, transparent)",
          color: "#2ecc71",
        }}
      >
        Recepción
      </span>
    );
  }
  if (source === "CATALOG") {
    return (
      <span
        className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
        style={{
          background: "color-mix(in srgb, #f59e0b 20%, transparent)",
          color: "#f59e0b",
        }}
      >
        Catálogo
      </span>
    );
  }
  // NONE
  return (
    <span
      className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium"
      style={{
        background: "var(--ter-container)",
        color: "var(--on-ter-container)",
      }}
    >
      Sin costo
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
