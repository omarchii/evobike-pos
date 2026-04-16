"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export interface AuthorizationRow {
  id: string;
  branchId: string;
  branchCode: string | null;
  branchName: string | null;
  tipo: "CANCELACION" | "DESCUENTO" | "CIERRE_DIFERENCIA";
  status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
  mode: "PRESENCIAL" | "REMOTA";
  saleId: string | null;
  saleFolio: string | null;
  monto: number | null;
  motivo: string | null;
  rejectReason: string | null;
  createdAt: string;
  resolvedAt: string | null;
  expiresAt: string | null;
  requesterName: string | null;
  approverName: string | null;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
}

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body, 'Inter')",
  fontSize: "0.875rem",
  height: 40,
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  outline: "none",
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  appearance: "none",
  WebkitAppearance: "none",
  cursor: "pointer",
};

const STATUS_STYLES: Record<AuthorizationRow["status"], { bg: string; color: string; label: string }> = {
  PENDING: { bg: "color-mix(in srgb, var(--warn) 12%, transparent)", color: "var(--warn)", label: "Pendiente" },
  APPROVED: { bg: "color-mix(in srgb, var(--p) 12%, transparent)", color: "var(--p)", label: "Aprobada" },
  REJECTED: { bg: "rgba(220,38,38,0.12)", color: "#dc2626", label: "Rechazada" },
  EXPIRED: { bg: "var(--surf-high)", color: "var(--on-surf-var)", label: "Expirada" },
};

export function AuthorizationsHistory({
  rows,
  branches,
  canFilterBranch,
  initialFilters,
}: {
  rows: AuthorizationRow[];
  branches: BranchOption[];
  canFilterBranch: boolean;
  initialFilters: {
    tipo: string;
    status: string;
    branchId: string;
    fromDate: string;
    toDate: string;
  };
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [tipo, setTipo] = useState(initialFilters.tipo);
  const [status, setStatus] = useState(initialFilters.status);
  const [branchId, setBranchId] = useState(initialFilters.branchId);
  const [fromDate, setFromDate] = useState(initialFilters.fromDate);
  const [toDate, setToDate] = useState(initialFilters.toDate);

  const applyFilters = (): void => {
    const params = new URLSearchParams();
    if (tipo) params.set("tipo", tipo);
    if (status) params.set("status", status);
    if (canFilterBranch && branchId) params.set("branchId", branchId);
    if (fromDate) params.set("fromDate", fromDate);
    if (toDate) params.set("toDate", toDate);
    startTransition(() => {
      router.push(`/autorizaciones${params.toString() ? `?${params.toString()}` : ""}`);
    });
  };

  const resetFilters = (): void => {
    setTipo("");
    setStatus("");
    setBranchId("");
    setFromDate("");
    setToDate("");
    startTransition(() => {
      router.push("/autorizaciones");
    });
  };

  return (
    <>
      {/* Filtros */}
      <div
        className="rounded-[var(--r-lg)] p-4 flex flex-wrap items-end gap-3"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <FilterField label="Tipo">
          <select value={tipo} onChange={(e) => setTipo(e.target.value)} style={SELECT_STYLE}>
            <option value="">Todos</option>
            <option value="CANCELACION">Cancelación</option>
            <option value="DESCUENTO">Descuento</option>
            <option value="CIERRE_DIFERENCIA">Cierre con diferencia</option>
          </select>
        </FilterField>
        <FilterField label="Estado">
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={SELECT_STYLE}>
            <option value="">Todos</option>
            <option value="PENDING">Pendiente</option>
            <option value="APPROVED">Aprobada</option>
            <option value="REJECTED">Rechazada</option>
            <option value="EXPIRED">Expirada</option>
          </select>
        </FilterField>
        {canFilterBranch && (
          <FilterField label="Sucursal">
            <select value={branchId} onChange={(e) => setBranchId(e.target.value)} style={SELECT_STYLE}>
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
          </FilterField>
        )}
        <FilterField label="Desde">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            style={INPUT_STYLE}
          />
        </FilterField>
        <FilterField label="Hasta">
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            style={INPUT_STYLE}
          />
        </FilterField>
        <div className="flex gap-2 ml-auto">
          <button
            onClick={resetFilters}
            disabled={pending}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
          >
            Limpiar
          </button>
          <button
            onClick={applyFilters}
            disabled={pending}
            className="px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--p)", color: "#fff", opacity: pending ? 0.5 : 1 }}
          >
            {pending ? "Cargando…" : "Aplicar"}
          </button>
        </div>
      </div>

      {/* Tabla */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {rows.length === 0 ? (
          <div className="px-5 py-10 text-center text-sm" style={{ color: "var(--on-surf-var)" }}>
            Sin resultados para los filtros seleccionados.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                  <Th>Fecha</Th>
                  <Th>Tipo</Th>
                  <Th>Monto</Th>
                  <Th>Venta</Th>
                  <Th>Solicita</Th>
                  <Th>Resuelve</Th>
                  <Th>Estado</Th>
                  {canFilterBranch && <Th>Sucursal</Th>}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const s = STATUS_STYLES[r.status];
                  return (
                    <tr key={r.id} style={{ borderBottom: "1px solid rgba(178,204,192,0.08)" }}>
                      <td className="px-5 py-3" style={{ color: "var(--on-surf-var)" }}>
                        {formatDate(r.createdAt)}
                      </td>
                      <td className="px-5 py-3" style={{ color: "var(--on-surf)" }}>
                        {r.tipo === "CANCELACION"
                          ? "Cancelación"
                          : r.tipo === "CIERRE_DIFERENCIA"
                            ? "Cierre con diferencia"
                            : "Descuento"}
                        <span className="ml-1.5 text-xs" style={{ color: "var(--on-surf-var)" }}>
                          · {r.mode === "PRESENCIAL" ? "presencial" : "remota"}
                        </span>
                      </td>
                      <td className="px-5 py-3" style={{ color: "var(--on-surf)" }}>
                        {r.monto != null
                          ? `$${r.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`
                          : "—"}
                      </td>
                      <td className="px-5 py-3">
                        {r.saleFolio && r.saleId ? (
                          <Link
                            href={`/ventas/${r.saleId}`}
                            className="underline"
                            style={{ color: "var(--p)" }}
                          >
                            {r.saleFolio}
                          </Link>
                        ) : (
                          <span style={{ color: "var(--on-surf-var)" }}>—</span>
                        )}
                      </td>
                      <td className="px-5 py-3" style={{ color: "var(--on-surf-var)" }}>
                        {r.requesterName ?? "—"}
                      </td>
                      <td className="px-5 py-3" style={{ color: "var(--on-surf-var)" }}>
                        {r.approverName ?? (r.status === "EXPIRED" ? "— (expirada)" : "—")}
                      </td>
                      <td className="px-5 py-3">
                        <span
                          className="inline-block px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: s.bg, color: s.color }}
                        >
                          {s.label}
                        </span>
                        {r.rejectReason && (
                          <p className="text-xs italic mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                            {r.rejectReason}
                          </p>
                        )}
                      </td>
                      {canFilterBranch && (
                        <td className="px-5 py-3" style={{ color: "var(--on-surf-var)" }}>
                          {r.branchCode ?? "—"}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span
        className="text-[10px] font-medium uppercase tracking-wide"
        style={{ color: "var(--on-surf-var)" }}
      >
        {label}
      </span>
      {children}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th
      className="px-5 py-3 text-xs font-medium uppercase tracking-widest text-left"
      style={{ color: "var(--on-surf-var)" }}
    >
      {children}
    </th>
  );
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
