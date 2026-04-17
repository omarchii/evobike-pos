"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { ClipboardCopy, Download, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { downloadCSV } from "@/lib/reportes/csv";

export interface MantenimientoRow {
  bikeId: string;
  customerId: string | null;
  customerName: string;
  phone: string | null;
  modelo: string;
  serialNumber: string;
  fechaCompra: string;
  ultimoMantenimiento: string | null;
  proximoEstimado: string;
  diasRestantes: number;
  estado: "vencido" | "porVencer" | "alCorriente";
  branchCode: string;
  branchName: string;
}

interface Branch {
  id: string;
  code: string;
  name: string;
}

const DATE_FMT = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  return DATE_FMT.format(new Date(iso));
}

const ESTADO_LABELS: Record<MantenimientoRow["estado"], string> = {
  vencido: "Vencido",
  porVencer: "Por vencer",
  alCorriente: "Al corriente",
};

function EstadoBadge({ row }: { row: MantenimientoRow }) {
  const abs = Math.abs(row.diasRestantes);
  const suffix =
    row.estado === "vencido"
      ? ` (${abs}d)`
      : row.estado === "porVencer"
        ? ` (${abs}d)`
        : "";
  const label = ESTADO_LABELS[row.estado] + suffix;

  const styles: React.CSSProperties =
    row.estado === "vencido"
      ? { background: "var(--ter-container)", color: "var(--on-ter-container)" }
      : row.estado === "porVencer"
        ? { background: "var(--warn-container)", color: "var(--warn)" }
        : { background: "var(--sec-container)", color: "var(--on-sec-container)" };

  return (
    <span
      className="inline-block px-2.5 py-0.5 rounded-full text-[0.625rem] font-medium uppercase tracking-[0.04em] whitespace-nowrap"
      style={styles}
    >
      {label}
    </span>
  );
}

function KpiCard({
  label,
  value,
  featured,
  color,
}: {
  label: string;
  value: number;
  featured?: boolean;
  color?: React.CSSProperties;
}) {
  return (
    <div
      className="rounded-2xl p-5 flex flex-col gap-1 min-w-[120px]"
      style={{
        background: featured
          ? "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)"
          : "var(--surf-lowest)",
        boxShadow: "var(--shadow)",
        color: featured ? "#ffffff" : undefined,
        ...color,
      }}
    >
      <span
        className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
        style={{ color: featured ? "rgba(255,255,255,0.7)" : "var(--on-surf-var)" }}
      >
        {label}
      </span>
      <span
        className="text-3xl font-bold leading-none"
        style={{
          fontFamily: "var(--font-display, 'Space Grotesk')",
          color: featured ? "#ffffff" : "var(--on-surf)",
          letterSpacing: "-0.02em",
        }}
      >
        {value}
      </span>
    </div>
  );
}

export function MantenimientosTable({
  rows,
  role,
  branches,
  scopedBranchId,
}: {
  rows: MantenimientoRow[];
  role: string;
  branches: Branch[];
  scopedBranchId: string | null;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isAdmin = role === "ADMIN";

  const [branchFilter, setBranchFilter] = useState(
    searchParams.get("branchId") ?? "",
  );
  const [estadoFilter, setEstadoFilter] = useState(
    searchParams.get("estado") ?? "todos",
  );
  const [fromFilter, setFromFilter] = useState(searchParams.get("from") ?? "");
  const [toFilter, setToFilter] = useState(searchParams.get("to") ?? "");
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  const applyFilters = useCallback(() => {
    const p = new URLSearchParams();
    if (branchFilter) p.set("branchId", branchFilter);
    if (estadoFilter !== "todos") p.set("estado", estadoFilter);
    if (fromFilter) p.set("from", fromFilter);
    if (toFilter) p.set("to", toFilter);
    if (q) p.set("q", q);
    router.push(`/workshop/mantenimientos?${p.toString()}`);
  }, [branchFilter, estadoFilter, fromFilter, toFilter, q, router]);

  const clearFilters = useCallback(() => {
    setBranchFilter("");
    setEstadoFilter("todos");
    setFromFilter("");
    setToFilter("");
    setQ("");
    router.push("/workshop/mantenimientos");
  }, [router]);

  const filtered = useMemo(() => {
    let result = rows;

    if (isAdmin && branchFilter) {
      const branch = branches.find((b) => b.id === branchFilter);
      if (branch) result = result.filter((r) => r.branchCode === branch.code);
    }

    if (estadoFilter !== "todos") {
      result = result.filter((r) => r.estado === estadoFilter);
    }

    if (fromFilter) {
      const from = new Date(fromFilter);
      result = result.filter((r) => new Date(r.fechaCompra) >= from);
    }
    if (toFilter) {
      const to = new Date(toFilter);
      to.setHours(23, 59, 59, 999);
      result = result.filter((r) => new Date(r.fechaCompra) <= to);
    }

    if (q.trim()) {
      const lq = q.trim().toLowerCase();
      result = result.filter(
        (r) =>
          r.customerName.toLowerCase().includes(lq) ||
          r.serialNumber.toLowerCase().includes(lq) ||
          r.modelo.toLowerCase().includes(lq),
      );
    }

    return result;
  }, [rows, isAdmin, branchFilter, branches, estadoFilter, fromFilter, toFilter, q]);

  const counts = useMemo(
    () => ({
      total: filtered.length,
      vencido: filtered.filter((r) => r.estado === "vencido").length,
      porVencer: filtered.filter((r) => r.estado === "porVencer").length,
      alCorriente: filtered.filter((r) => r.estado === "alCorriente").length,
    }),
    [filtered],
  );

  function handleExport() {
    const selectedBranch = isAdmin
      ? (branches.find((b) => b.id === branchFilter)?.code ?? "all")
      : (scopedBranchId
          ? (branches.find((b) => b.id === scopedBranchId)?.code ?? "all")
          : "all");
    const dateStr = new Date().toISOString().slice(0, 10);
    const filename = `mantenimientos-${selectedBranch}-${dateStr}.csv`;

    const csvRows = filtered.map((r) => ({
      Cliente: r.customerName,
      Teléfono: r.phone ?? "—",
      ...(isAdmin ? { Sucursal: `${r.branchCode} – ${r.branchName}` } : {}),
      Modelo: r.modelo,
      VIN: r.serialNumber,
      "Fecha compra": fmtDate(r.fechaCompra),
      "Último mantenimiento": fmtDate(r.ultimoMantenimiento),
      "Próximo estimado": fmtDate(r.proximoEstimado),
      "Días restantes": r.diasRestantes,
      Estado: ESTADO_LABELS[r.estado],
    }));

    downloadCSV(csvRows, filename);
  }

  const INPUT_STYLE: React.CSSProperties = {
    background: "var(--surf-low)",
    border: "none",
    borderRadius: "var(--r-md)",
    color: "var(--on-surf)",
    fontFamily: "var(--font-body, 'Inter')",
    fontSize: "0.875rem",
    height: 36,
    paddingLeft: "0.75rem",
    paddingRight: "0.75rem",
    outline: "none",
  };

  return (
    <div className="space-y-5">
      {/* KPI Cards */}
      <div className="flex flex-wrap gap-3">
        <KpiCard label="Total unidades" value={counts.total} featured />
        <KpiCard label="Vencidos 🔴" value={counts.vencido} />
        <KpiCard label="Por vencer 🟡" value={counts.porVencer} />
        <KpiCard label="Al corriente 🟢" value={counts.alCorriente} />
      </div>

      {/* Filtros */}
      <div
        className="rounded-2xl p-4 flex flex-wrap gap-3 items-end"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {isAdmin && (
          <div className="flex flex-col gap-1">
            <span
              className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
              style={{ color: "var(--on-surf-var)" }}
            >
              Sucursal
            </span>
            <select
              value={branchFilter}
              onChange={(e) => setBranchFilter(e.target.value)}
              style={{ ...INPUT_STYLE, minWidth: 180 }}
            >
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="flex flex-col gap-1">
          <span
            className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--on-surf-var)" }}
          >
            Estado
          </span>
          <select
            value={estadoFilter}
            onChange={(e) => setEstadoFilter(e.target.value)}
            style={{ ...INPUT_STYLE, minWidth: 160 }}
          >
            <option value="todos">Todos</option>
            <option value="vencido">Vencidos</option>
            <option value="porVencer">Por vencer</option>
            <option value="alCorriente">Al corriente</option>
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <span
            className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--on-surf-var)" }}
          >
            Compra desde
          </span>
          <input
            type="date"
            value={fromFilter}
            onChange={(e) => setFromFilter(e.target.value)}
            style={INPUT_STYLE}
          />
        </div>

        <div className="flex flex-col gap-1">
          <span
            className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--on-surf-var)" }}
          >
            Compra hasta
          </span>
          <input
            type="date"
            value={toFilter}
            onChange={(e) => setToFilter(e.target.value)}
            style={INPUT_STYLE}
          />
        </div>

        <div className="flex flex-col gap-1 flex-1 min-w-[180px]">
          <span
            className="text-[0.625rem] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--on-surf-var)" }}
          >
            Buscar
          </span>
          <input
            type="search"
            placeholder="Cliente, VIN, modelo…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applyFilters()}
            style={INPUT_STYLE}
          />
        </div>

        <div className="flex gap-2 pb-0.5">
          <button
            onClick={applyFilters}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--p)", color: "#ffffff" }}
          >
            Aplicar
          </button>
          <button
            onClick={clearFilters}
            className="p-2 rounded-xl"
            style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
            title="Limpiar filtros"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
          <button
            onClick={handleExport}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
            title="Exportar CSV"
          >
            <Download className="h-4 w-4" />
            CSV
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm" style={{ color: "var(--on-surf-var)" }}>
            Sin resultados para los filtros aplicados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                  {[
                    "Cliente",
                    "Teléfono",
                    ...(isAdmin ? ["Sucursal"] : []),
                    "Modelo",
                    "VIN",
                    "Fecha compra",
                    "Último mantenimiento",
                    "Próximo estimado",
                    "Estado",
                    "Acciones",
                  ].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-[0.6875rem] font-medium uppercase tracking-widest whitespace-nowrap"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => (
                  <tr
                    key={r.bikeId}
                    style={{ borderBottom: "1px solid rgba(178,204,192,0.08)" }}
                    className="hover:bg-[var(--surf-high)] transition-colors"
                  >
                    <td className="px-4 py-3 font-medium" style={{ color: "var(--on-surf)" }}>
                      {r.customerId ? (
                        <Link
                          href={`/customers/${r.customerId}`}
                          className="hover:underline"
                          style={{ color: "var(--p)" }}
                        >
                          {r.customerName}
                        </Link>
                      ) : (
                        r.customerName
                      )}
                    </td>
                    <td
                      className="px-4 py-3"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {r.phone ?? "—"}
                    </td>
                    {isAdmin && (
                      <td
                        className="px-4 py-3 text-xs"
                        style={{ color: "var(--on-surf-var)" }}
                      >
                        {r.branchCode}
                      </td>
                    )}
                    <td className="px-4 py-3" style={{ color: "var(--on-surf)" }}>
                      {r.modelo}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => {
                          navigator.clipboard.writeText(r.serialNumber);
                          toast.success("VIN copiado");
                        }}
                        className="inline-flex items-center gap-1 font-mono text-xs"
                        style={{ color: "var(--on-surf-var)" }}
                        title="Copiar VIN"
                      >
                        {r.serialNumber}
                        <ClipboardCopy className="h-3 w-3 opacity-50" />
                      </button>
                    </td>
                    <td
                      className="px-4 py-3 whitespace-nowrap"
                      style={{ color: "var(--on-surf)" }}
                    >
                      {fmtDate(r.fechaCompra)}
                    </td>
                    <td
                      className="px-4 py-3 whitespace-nowrap"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {r.ultimoMantenimiento
                        ? fmtDate(r.ultimoMantenimiento)
                        : "Sin mantenimientos"}
                    </td>
                    <td
                      className="px-4 py-3 whitespace-nowrap"
                      style={{ color: "var(--on-surf)" }}
                    >
                      {fmtDate(r.proximoEstimado)}
                    </td>
                    <td className="px-4 py-3">
                      <EstadoBadge row={r} />
                    </td>
                    <td className="px-4 py-3">
                      {r.customerId ? (
                        <Link
                          href={`/customers/${r.customerId}`}
                          className="inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap"
                          style={{
                            background: "var(--surf-high)",
                            color: "var(--on-surf)",
                          }}
                          title="Ver cliente para crear orden de taller"
                        >
                          {/* TODO P11: pre-populate NewOrderDialog via URL param once dialog supports customerBikeId query param */}
                          Crear orden de taller
                        </Link>
                      ) : (
                        <span
                          className="text-xs"
                          style={{ color: "var(--on-surf-var)" }}
                        >
                          Sin cliente
                        </span>
                      )}
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
