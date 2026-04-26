"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  CheckCircle,
  CircleDollarSign,
  Clock,
  XCircle,
  Settings,
  ChevronDown,
  ChevronUp,
  CheckSquare,
  Square,
  Percent,
  DollarSign,
} from "lucide-react";
import Link from "next/link";
import type { CommissionRow, CommissionKpis, UserOption } from "./page";

// ── Types ────────────────────────────────────────────────────────────────────

interface CurrentFilters {
  from: string;
  to: string;
  status: string;
  userId: string;
}

interface CommissionsTableProps {
  initialRows: CommissionRow[];
  kpis: CommissionKpis;
  userOptions: UserOption[];
  userRole: string;
  currentFilters: CurrentFilters;
}

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  string,
  { label: string; bg: string; color: string }
> = {
  PENDING: { label: "Pendiente", bg: "var(--warn-container)", color: "var(--warn)" },
  APPROVED: { label: "Aprobada", bg: "var(--sec-container)", color: "var(--on-sec-container)" },
  PAID: { label: "Pagada", bg: "var(--p-container)", color: "var(--on-p-container)" },
  CANCELLED: { label: "Cancelada", bg: "var(--surf-high)", color: "var(--on-surf-var)" },
};

const ROLE_LABELS: Record<string, string> = {
  SELLER: "Vendedor",
  TECHNICIAN: "Técnico",
  MANAGER: "Gerente",
  ADMIN: "Admin",
};

const STATUS_OPTIONS = [
  { value: "PENDING", label: "Pendiente" },
  { value: "APPROVED", label: "Aprobada" },
  { value: "PAID", label: "Pagada" },
  { value: "CANCELLED", label: "Cancelada" },
];

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Main Component ──────────────────────────────────────────────────────────

export function CommissionsTable({
  initialRows,
  kpis,
  userOptions,
  userRole,
  currentFilters,
}: CommissionsTableProps): React.JSX.Element {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [rows, setRows] = useState<CommissionRow[]>(initialRows);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchLoading, setBatchLoading] = useState(false);

  // Filters local state
  const [filterFrom, setFilterFrom] = useState(currentFilters.from);
  const [filterTo, setFilterTo] = useState(currentFilters.to);
  const [filterStatus, setFilterStatus] = useState(currentFilters.status);
  const [filterUserId, setFilterUserId] = useState(currentFilters.userId);

  // Collapse KPIs on mobile
  const [kpisCollapsed, setKpisCollapsed] = useState(false);

  const canApprove = userRole === "MANAGER" || userRole === "ADMIN";
  const canPay = userRole === "ADMIN";

  // Selectable rows: only PENDING (for approve) or APPROVED (for pay)
  const pendingRows = rows.filter((r) => r.status === "PENDING");
  const approvedRows = rows.filter((r) => r.status === "APPROVED");

  // What can be selected depends on context
  const selectableIds = canPay
    ? [...pendingRows, ...approvedRows].map((r) => r.id)
    : pendingRows.map((r) => r.id);

  function toggleSelect(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll(): void {
    if (selected.size === selectableIds.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(selectableIds));
    }
  }

  // Determine batch action from selection
  const selectedRows = rows.filter((r) => selected.has(r.id));
  const allSelectedPending = selectedRows.every((r) => r.status === "PENDING");
  const allSelectedApproved = selectedRows.every((r) => r.status === "APPROVED");
  const batchActionStatus =
    selected.size > 0 && allSelectedPending
      ? "APPROVED"
      : selected.size > 0 && allSelectedApproved && canPay
      ? "PAID"
      : null;

  async function handleBatch(): Promise<void> {
    if (!batchActionStatus || selected.size === 0) return;

    setBatchLoading(true);
    setBatchError(null);

    try {
      const res = await fetch("/api/comisiones", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: Array.from(selected), status: batchActionStatus }),
      });

      const json = await res.json();
      if (!json.success) {
        setBatchError(json.error ?? "Error al actualizar");
        return;
      }

      // Optimistic update
      const newStatus = batchActionStatus;
      setRows((prev) =>
        prev.map((r) =>
          selected.has(r.id) ? { ...r, status: newStatus as CommissionRow["status"] } : r,
        ),
      );
      setSelected(new Set());
      startTransition(() => router.refresh());
    } catch {
      setBatchError("Error de conexión");
    } finally {
      setBatchLoading(false);
    }
  }

  function applyFilters(): void {
    const params = new URLSearchParams();
    if (filterFrom) params.set("from", filterFrom);
    if (filterTo) params.set("to", filterTo);
    if (filterStatus) params.set("status", filterStatus);
    if (filterUserId) params.set("userId", filterUserId);
    router.push(`/reportes/comisiones?${params.toString()}`);
  }

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
          >
            Comisiones
          </h1>
          <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
            {userRole === "SELLER"
              ? "Tus comisiones generadas por ventas"
              : "Comisiones del equipo — aprueba y gestiona pagos"}
          </p>
        </div>
        {(userRole === "MANAGER" || userRole === "ADMIN") && (
          <Link
            href="/reportes/comisiones/reglas"
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-all"
            style={{
              background: "var(--surf-high)",
              color: "var(--on-surf)",
            }}
          >
            <Settings size={15} />
            Reglas
          </Link>
        )}
      </div>

      {/* KPI Cards */}
      <div className="mb-6">
        <button
          onClick={() => setKpisCollapsed((v) => !v)}
          className="flex items-center gap-1.5 text-xs mb-3"
          style={{ color: "var(--on-surf-var)" }}
        >
          {kpisCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
          <span className="uppercase tracking-wider font-medium">Resumen del período</span>
        </button>
        {!kpisCollapsed && (
          <div className="grid grid-cols-3 gap-4">
            <KpiCard
              label="Pendiente"
              value={fmt(kpis.totalPending)}
              icon={<Clock size={16} />}
              iconBg="var(--warn-container)"
              iconColor="var(--warn)"
            />
            <KpiCard
              label="Aprobada"
              value={fmt(kpis.totalApproved)}
              icon={<CheckCircle size={16} />}
              iconBg="var(--sec-container)"
              iconColor="var(--on-sec-container)"
            />
            <KpiCard
              label="Pagada"
              value={fmt(kpis.totalPaid)}
              icon={<CircleDollarSign size={16} />}
              iconBg="var(--p-container)"
              iconColor="var(--on-p-container)"
            />
          </div>
        )}
      </div>

      {/* Filters */}
      <div
        className="rounded-2xl p-4 mb-5 flex flex-wrap gap-3 items-end"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--on-surf-var)" }}>
            Desde
          </label>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{
              background: "var(--surf-high)",
              color: "var(--on-surf)",
              border: "1px solid var(--ghost-border)",
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--on-surf-var)" }}>
            Hasta
          </label>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{
              background: "var(--surf-high)",
              color: "var(--on-surf)",
              border: "1px solid var(--ghost-border)",
            }}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--on-surf-var)" }}>
            Estado
          </label>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 rounded-xl text-sm"
            style={{
              background: "var(--surf-high)",
              color: "var(--on-surf)",
              border: "1px solid var(--ghost-border)",
            }}
          >
            <option value="">Todos</option>
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        {userOptions.length > 0 && (
          <div className="flex flex-col gap-1">
            <label className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--on-surf-var)" }}>
              Vendedor
            </label>
            <select
              value={filterUserId}
              onChange={(e) => setFilterUserId(e.target.value)}
              className="px-3 py-2 rounded-xl text-sm"
              style={{
                background: "var(--surf-high)",
                color: "var(--on-surf)",
                border: "1px solid var(--ghost-border)",
              }}
            >
              <option value="">Todos</option>
              {userOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name}
                </option>
              ))}
            </select>
          </div>
        )}
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

      {/* Batch action bar */}
      {canApprove && selected.size > 0 && (
        <div
          className="rounded-2xl px-4 py-3 mb-4 flex items-center justify-between"
          style={{ background: "var(--p-container)" }}
        >
          <span className="text-sm font-medium" style={{ color: "var(--on-p-container)" }}>
            {selected.size} seleccionada{selected.size !== 1 ? "s" : ""}
          </span>
          <div className="flex items-center gap-3">
            {batchError && (
              <span className="text-xs" style={{ color: "var(--ter)" }}>
                {batchError}
              </span>
            )}
            <button
              onClick={() => setSelected(new Set())}
              className="text-xs px-3 py-1.5 rounded-full"
              style={{ background: "rgba(0,0,0,0.15)", color: "var(--on-p-container)" }}
            >
              Cancelar
            </button>
            {batchActionStatus && (
              <button
                onClick={handleBatch}
                disabled={batchLoading}
                className="text-sm font-semibold px-4 py-1.5 rounded-full transition-all"
                style={{
                  background: "var(--velocity-gradient)",
                  color: "#fff",
                  opacity: batchLoading ? 0.6 : 1,
                }}
              >
                {batchLoading
                  ? "Actualizando..."
                  : batchActionStatus === "APPROVED"
                  ? "Aprobar seleccionadas"
                  : "Marcar como pagadas"}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Table */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {rows.length === 0 ? (
          <div className="px-5 py-12 text-center" style={{ color: "var(--on-surf-var)" }}>
            <CircleDollarSign size={32} className="mx-auto mb-3 opacity-40" />
            <p className="text-sm">No hay comisiones en este período.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                  {canApprove && (
                    <th className="px-4 py-3 w-10">
                      <button
                        onClick={toggleAll}
                        className="flex items-center justify-center"
                        style={{ color: "var(--on-surf-var)" }}
                      >
                        {selected.size === selectableIds.length && selectableIds.length > 0 ? (
                          <CheckSquare size={16} style={{ color: "var(--p)" }} />
                        ) : (
                          <Square size={16} />
                        )}
                      </button>
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Venta
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Fecha
                  </th>
                  {userRole !== "SELLER" && (
                    <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                      Vendedor
                    </th>
                  )}
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Regla
                  </th>
                  <th className="text-right px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Monto
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Estado
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const isSelectable = selectableIds.includes(row.id);
                  const isSelected = selected.has(row.id);
                  const statusCfg = STATUS_CONFIG[row.status] ?? STATUS_CONFIG.PENDING;

                  return (
                    <tr
                      key={row.id}
                      className="transition-colors"
                      style={{
                        borderBottom: "1px solid var(--ghost-border-soft)",
                        background: isSelected ? "var(--surf-high)" : "transparent",
                      }}
                      onMouseEnter={(e) => {
                        if (!isSelected)
                          e.currentTarget.style.background = "var(--surf-high)";
                      }}
                      onMouseLeave={(e) => {
                        if (!isSelected)
                          e.currentTarget.style.background = "transparent";
                      }}
                    >
                      {canApprove && (
                        <td className="px-4 py-3 w-10">
                          {isSelectable && (
                            <button
                              onClick={() => toggleSelect(row.id)}
                              className="flex items-center justify-center"
                              style={{ color: isSelected ? "var(--p)" : "var(--on-surf-var)" }}
                            >
                              {isSelected ? (
                                <CheckSquare size={16} />
                              ) : (
                                <Square size={16} />
                              )}
                            </button>
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <Link
                          href={`/ventas/${row.saleId}`}
                          className="text-sm font-medium hover:underline"
                          style={{ color: "var(--p)" }}
                        >
                          {row.saleFolio}
                        </Link>
                        <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                          Venta: {fmt(row.saleTotal)}
                        </p>
                      </td>
                      <td
                        className="px-4 py-3 text-xs"
                        style={{ color: "var(--on-surf-var)" }}
                      >
                        {fmtDate(row.createdAt)}
                      </td>
                      {userRole !== "SELLER" && (
                        <td className="px-4 py-3">
                          <span className="text-sm" style={{ color: "var(--on-surf)" }}>
                            {row.userName}
                          </span>
                          <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                            {ROLE_LABELS[row.userRole] ?? row.userRole}
                          </p>
                        </td>
                      )}
                      <td className="px-4 py-3">
                        <span
                          className="flex items-center gap-1 text-xs"
                          style={{ color: "var(--on-surf)" }}
                        >
                          {row.commissionType === "PERCENTAGE" ? (
                            <Percent size={11} style={{ color: "var(--sec)" }} />
                          ) : (
                            <DollarSign size={11} style={{ color: "var(--sec)" }} />
                          )}
                          {row.commissionType === "PERCENTAGE"
                            ? `${row.ruleValue}%`
                            : fmt(row.ruleValue)}
                        </span>
                      </td>
                      <td
                        className="px-4 py-3 text-right text-sm font-bold"
                        style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
                      >
                        {fmt(row.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium"
                          style={{ background: statusCfg.bg, color: statusCfg.color }}
                        >
                          <StatusIcon status={row.status} />
                          {statusCfg.label}
                        </span>
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
      className="rounded-2xl px-5 py-4 flex items-center gap-4"
      style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
    >
      <div
        className="flex items-center justify-center w-10 h-10 rounded-xl shrink-0"
        style={{ background: iconBg, color: iconColor }}
      >
        {icon}
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider font-medium" style={{ color: "var(--on-surf-var)" }}>
          {label}
        </p>
        <p
          className="text-xl font-bold mt-0.5"
          style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

function StatusIcon({ status }: { status: string }): React.JSX.Element {
  switch (status) {
    case "PENDING":
      return <Clock size={11} />;
    case "APPROVED":
      return <CheckCircle size={11} />;
    case "PAID":
      return <CircleDollarSign size={11} />;
    case "CANCELLED":
      return <XCircle size={11} />;
    default:
      return <Clock size={11} />;
  }
}
