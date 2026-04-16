"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  Clock,
  ChevronDown,
  ChevronRight,
  ArrowUpRight,
  ArrowDownLeft,
  Wallet,
  CreditCard,
  ArrowLeftRight,
  CircleDollarSign,
  AlertCircle,
} from "lucide-react";
import type {
  SessionRow,
  PeriodSummary,
  MethodBreakdown,
  DayRow,
  TransactionRow,
  CashierOption,
  PaymentMethodKey,
} from "./page";

// ── Props ────────────────────────────────────────────────────────────────────

interface CurrentFilters {
  view: "sessions" | "period";
  from: string;
  to: string;
  userId: string;
}

interface CashReportProps {
  view: "sessions" | "period";
  sessionsData: SessionRow[] | null;
  periodData: {
    summary: PeriodSummary;
    byMethod: Record<PaymentMethodKey, MethodBreakdown>;
    byDay: DayRow[];
  } | null;
  cashiers: CashierOption[];
  currentFilters: CurrentFilters;
  role: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMXN(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDate(iso: string): string {
  return new Date(iso + "T12:00:00").toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
  });
}

const METHOD_LABELS: Record<PaymentMethodKey, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  CREDIT_BALANCE: "Crédito",
  ATRATO: "Atrato",
};

const METHOD_ICONS: Record<PaymentMethodKey, typeof Banknote> = {
  CASH: Banknote,
  CARD: CreditCard,
  TRANSFER: ArrowLeftRight,
  CREDIT_BALANCE: Wallet,
  ATRATO: CircleDollarSign,
};

const TX_TYPE_LABELS: Record<string, string> = {
  PAYMENT_IN: "Cobro",
  REFUND_OUT: "Devolución",
  EXPENSE_OUT: "Gasto",
  WITHDRAWAL: "Retiro",
};

// ── Styles ───────────────────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "1px solid var(--ghost-border)",
  borderRadius: "var(--r-md)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontSize: "0.75rem",
  padding: "0.5rem 0.75rem",
  outline: "none",
  width: "100%",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  appearance: "none",
  cursor: "pointer",
};

const labelStyle: React.CSSProperties = {
  fontSize: "0.625rem",
  fontWeight: 500,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--on-surf-var)",
  marginBottom: "0.35rem",
  display: "block",
  fontFamily: "var(--font-body)",
};

// ── Main component ───────────────────────────────────────────────────────────

export function CashReport({
  view,
  sessionsData,
  periodData,
  cashiers,
  currentFilters,
}: CashReportProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [fromDate, setFromDate] = useState(currentFilters.from);
  const [toDate, setToDate] = useState(currentFilters.to);
  const [selectedUserId, setSelectedUserId] = useState(currentFilters.userId);

  function applyFilters(overrides: Partial<CurrentFilters> = {}): void {
    const merged = {
      view: overrides.view ?? view,
      from: overrides.from ?? fromDate,
      to: overrides.to ?? toDate,
      userId: overrides.userId ?? selectedUserId,
    };

    const params = new URLSearchParams();
    params.set("view", merged.view);
    if (merged.from) params.set("from", merged.from);
    if (merged.to) params.set("to", merged.to);
    if (merged.userId) params.set("userId", merged.userId);

    startTransition(() => {
      router.push(`/reportes/caja?${params.toString()}`);
    });
  }

  return (
    <div style={{ color: "var(--on-surf)", fontFamily: "var(--font-body)" }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--on-surf)",
            }}
          >
            Reporte de Caja
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: "0.25rem" }}>
            {view === "sessions" ? "Desglose por turno" : "Agregado por período"}
          </p>
        </div>
      </div>

      {/* Filters card */}
      <div
        className="mb-5 p-5"
        style={{
          background: "var(--surf-lowest)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {/* View toggle */}
          <div>
            <label style={labelStyle}>Vista</label>
            <div className="flex gap-1">
              {(["sessions", "period"] as const).map((v) => (
                <button
                  key={v}
                  type="button"
                  onClick={() => applyFilters({ view: v })}
                  style={{
                    flex: 1,
                    padding: "0.5rem 0.75rem",
                    borderRadius: "var(--r-md)",
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    border: "none",
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    background: view === v ? "var(--p)" : "var(--surf-low)",
                    color: view === v ? "var(--on-p)" : "var(--on-surf-var)",
                    transition: "background 0.15s, color 0.15s",
                  }}
                >
                  {v === "sessions" ? "Por turno" : "Por período"}
                </button>
              ))}
            </div>
          </div>

          {/* From */}
          <div>
            <label style={labelStyle}>Desde</label>
            <input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              onBlur={() => applyFilters()}
              style={inputStyle}
            />
          </div>

          {/* To */}
          <div>
            <label style={labelStyle}>Hasta</label>
            <input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              onBlur={() => applyFilters()}
              style={inputStyle}
            />
          </div>

          {/* Cashier */}
          <div className="relative">
            <label style={labelStyle}>Cajero</label>
            <div className="relative">
              <select
                value={selectedUserId}
                onChange={(e) => {
                  setSelectedUserId(e.target.value);
                  applyFilters({ userId: e.target.value });
                }}
                style={selectStyle}
              >
                <option value="">Todos</option>
                {cashiers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                style={{ color: "var(--on-surf-var)" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Loading bar */}
      {isPending && (
        <div
          className="h-0.5 w-full mb-4 rounded-full"
          style={{
            background: "linear-gradient(135deg, var(--p) 0%, var(--p-bright) 100%)",
            opacity: 0.7,
          }}
        />
      )}

      {/* Content */}
      {view === "sessions" && sessionsData && (
        <SessionsView sessions={sessionsData} />
      )}
      {view === "period" && periodData && (
        <PeriodView data={periodData} />
      )}
    </div>
  );
}

// ── Sessions View ────────────────────────────────────────────────────────────

function SessionsView({ sessions }: { sessions: SessionRow[] }) {
  if (sessions.length === 0) {
    return (
      <EmptyState message="No se encontraron turnos en el rango seleccionado" />
    );
  }

  return (
    <div className="space-y-3">
      {sessions.map((s) => (
        <SessionCard key={s.id} session={s} />
      ))}
    </div>
  );
}

function SessionCard({ session: s }: { session: SessionRow }) {
  const [expanded, setExpanded] = useState(false);
  const isOpen = s.closedAt === null;

  return (
    <div
      style={{
        background: "var(--surf-lowest)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow)",
        overflow: "hidden",
      }}
    >
      {/* Header — clickable to expand */}
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left p-4 flex items-start gap-4 hover:bg-[var(--surf-high)] transition-colors"
        style={{ border: "none", background: "transparent", cursor: "pointer" }}
      >
        {/* Expand icon */}
        <div className="mt-0.5 shrink-0" style={{ color: "var(--on-surf-var)" }}>
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span
              style={{
                fontSize: "0.875rem",
                fontWeight: 600,
                color: "var(--on-surf)",
                fontFamily: "var(--font-body)",
              }}
            >
              {s.userName}
            </span>
            <span
              style={{
                borderRadius: "var(--r-full)",
                padding: "0.15rem 0.55rem",
                fontSize: "0.575rem",
                fontWeight: 500,
                letterSpacing: "0.04em",
                textTransform: "uppercase",
                fontFamily: "var(--font-body)",
                background: isOpen ? "var(--sec-container)" : "var(--surf-high)",
                color: isOpen ? "var(--on-sec-container)" : "var(--on-surf-var)",
              }}
            >
              {isOpen ? "Abierta" : "Cerrada"}
            </span>
          </div>
          <div className="flex items-center gap-3" style={{ fontSize: "0.7rem", color: "var(--on-surf-var)" }}>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {formatDateTime(s.openedAt)}
            </span>
            {s.closedAt && (
              <>
                <span>→</span>
                <span>{formatDateTime(s.closedAt)}</span>
              </>
            )}
            <span>•</span>
            <span>{s.transactionCount} transacciones</span>
          </div>
        </div>

        {/* KPIs */}
        <div className="flex items-center gap-5 shrink-0">
          <KpiMini label="Cobrado" value={s.totalCollected} />
          {s.totalPending > 0 && (
            <KpiMini label="Pendiente" value={s.totalPending} warn />
          )}
          <KpiMini label="Efectivo real" value={s.cashReal} />
          {s.difference !== null && (
            <DifferenceChip difference={s.difference} />
          )}
        </div>
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div
          className="px-4 pb-4"
          style={{ borderTop: "1px solid rgba(178, 204, 192, 0.1)" }}
        >
          {/* Method breakdown */}
          <div className="grid grid-cols-5 gap-3 py-4">
            {(Object.keys(s.byMethod) as PaymentMethodKey[]).map((method) => {
              const amount = s.byMethod[method];
              if (amount === 0) return null;
              const Icon = METHOD_ICONS[method];
              return (
                <div
                  key={method}
                  className="flex items-center gap-2 p-2 rounded-xl"
                  style={{ background: "var(--surf-low)" }}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--on-surf-var)" }} />
                  <div>
                    <div style={{ fontSize: "0.6rem", color: "var(--on-surf-var)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                      {METHOD_LABELS[method]}
                    </div>
                    <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--on-surf)", fontFamily: "var(--font-display)" }}>
                      {formatMXN(amount)}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Session amounts */}
          <div className="grid grid-cols-3 gap-3 mb-4">
            <InfoPill label="Monto apertura" value={formatMXN(s.openingAmt)} />
            {s.closingAmt !== null && (
              <InfoPill label="Monto cierre declarado" value={formatMXN(s.closingAmt)} />
            )}
            <InfoPill label="Efectivo real calculado" value={formatMXN(s.cashReal)} />
          </div>

          {/* Transaction table */}
          {s.transactions.length > 0 && (
            <div style={{ overflow: "hidden", borderRadius: "var(--r-md)" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Hora", "Tipo", "Método", "Monto", "Referencia", "Folio venta", "Estado"].map((h) => (
                      <th
                        key={h}
                        style={{
                          fontSize: "0.675rem",
                          fontWeight: 500,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "var(--on-surf-var)",
                          padding: "0.4rem 0.6rem",
                          borderBottom: "1px solid var(--ghost-border)",
                          textAlign: "left",
                          fontFamily: "var(--font-body)",
                          background: "var(--surf-high)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {s.transactions.map((tx) => (
                    <TransactionTableRow key={tx.id} tx={tx} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TransactionTableRow({ tx }: { tx: TransactionRow }) {
  const isIncome = tx.type === "PAYMENT_IN";
  const TxIcon = isIncome ? ArrowDownLeft : ArrowUpRight;
  const amountColor = isIncome ? "var(--sec)" : "var(--ter)";

  return (
    <tr>
      <td style={{ fontSize: "0.7rem", color: "var(--on-surf-var)", padding: "0.4rem 0.6rem", whiteSpace: "nowrap" }}>
        {new Date(tx.createdAt).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
      </td>
      <td style={{ fontSize: "0.7rem", padding: "0.4rem 0.6rem" }}>
        <span className="flex items-center gap-1" style={{ color: amountColor }}>
          <TxIcon className="h-3 w-3" />
          {TX_TYPE_LABELS[tx.type] ?? tx.type}
        </span>
      </td>
      <td style={{ fontSize: "0.7rem", color: "var(--on-surf)", padding: "0.4rem 0.6rem" }}>
        {METHOD_LABELS[tx.method as PaymentMethodKey] ?? tx.method}
      </td>
      <td
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: amountColor,
          padding: "0.4rem 0.6rem",
          fontFamily: "var(--font-display)",
          whiteSpace: "nowrap",
        }}
      >
        {isIncome ? "+" : "−"}{formatMXN(tx.amount)}
      </td>
      <td style={{ fontSize: "0.7rem", color: "var(--on-surf-var)", padding: "0.4rem 0.6rem", maxWidth: "120px", overflow: "hidden", textOverflow: "ellipsis" }}>
        {tx.reference ?? "—"}
      </td>
      <td style={{ fontSize: "0.7rem", color: "var(--on-surf)", padding: "0.4rem 0.6rem", fontWeight: 500 }}>
        {tx.saleFolio ?? "—"}
      </td>
      <td style={{ padding: "0.4rem 0.6rem" }}>
        <span
          style={{
            borderRadius: "var(--r-full)",
            padding: "0.15rem 0.5rem",
            fontSize: "0.575rem",
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            fontFamily: "var(--font-body)",
            background: tx.collectionStatus === "COLLECTED" ? "var(--sec-container)" : "var(--warn-container)",
            color: tx.collectionStatus === "COLLECTED" ? "var(--on-sec-container)" : "var(--warn)",
          }}
        >
          {tx.collectionStatus === "COLLECTED" ? "Cobrado" : "Pendiente"}
        </span>
      </td>
    </tr>
  );
}

// ── Period View ──────────────────────────────────────────────────────────────

function PeriodView({ data }: { data: { summary: PeriodSummary; byMethod: Record<PaymentMethodKey, MethodBreakdown>; byDay: DayRow[] } }) {
  const { summary, byMethod, byDay } = data;

  return (
    <div className="space-y-5">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label="Ingresos cobrados"
          value={formatMXN(summary.totalCollected)}
          gradient
        />
        <KpiCard
          label="Ingresos pendientes"
          value={formatMXN(summary.totalPending)}
          warn={summary.totalPending > 0}
        />
        <KpiCard
          label="Neto operativo"
          value={formatMXN(summary.netOperating)}
        />
      </div>

      {/* Outflows */}
      <div className="grid grid-cols-3 gap-4">
        <KpiCard label="Devoluciones" value={formatMXN(summary.totalRefunds)} small />
        <KpiCard label="Gastos" value={formatMXN(summary.totalExpenses)} small />
        <KpiCard label="Retiros" value={formatMXN(summary.totalWithdrawals)} small />
      </div>

      {/* By method breakdown */}
      <div
        className="p-5"
        style={{
          background: "var(--surf-lowest)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow)",
        }}
      >
        <h3
          style={{
            fontSize: "0.75rem",
            fontWeight: 500,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--on-surf-var)",
            marginBottom: "1rem",
          }}
        >
          Desglose por método de pago
        </h3>
        <div className="grid grid-cols-5 gap-3">
          {(Object.keys(byMethod) as PaymentMethodKey[]).map((method) => {
            const m = byMethod[method];
            const total = m.collected + m.pending;
            if (total === 0) return null;
            const Icon = METHOD_ICONS[method];
            return (
              <div
                key={method}
                className="p-3 rounded-xl"
                style={{ background: "var(--surf-low)" }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon className="h-4 w-4" style={{ color: "var(--on-surf-var)" }} />
                  <span style={{ fontSize: "0.7rem", fontWeight: 500, color: "var(--on-surf-var)", textTransform: "uppercase", letterSpacing: "0.04em" }}>
                    {METHOD_LABELS[method]}
                  </span>
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: "var(--on-surf)", fontFamily: "var(--font-display)" }}>
                  {formatMXN(total)}
                </div>
                {m.pending > 0 && (
                  <div className="flex items-center gap-1 mt-1" style={{ fontSize: "0.625rem", color: "var(--warn)" }}>
                    <AlertCircle className="h-3 w-3" />
                    {formatMXN(m.pending)} pendiente
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* By day chart (simple bar representation) */}
      {byDay.length > 0 && (
        <div
          className="p-5"
          style={{
            background: "var(--surf-lowest)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow)",
          }}
        >
          <h3
            style={{
              fontSize: "0.75rem",
              fontWeight: 500,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--on-surf-var)",
              marginBottom: "1rem",
            }}
          >
            Ingresos por día
          </h3>
          <div className="space-y-2">
            {byDay.map((day) => {
              const total = day.collected + day.pending;
              const maxTotal = Math.max(...byDay.map((d) => d.collected + d.pending));
              const pctCollected = maxTotal > 0 ? (day.collected / maxTotal) * 100 : 0;
              const pctPending = maxTotal > 0 ? (day.pending / maxTotal) * 100 : 0;

              return (
                <div key={day.date} className="flex items-center gap-3">
                  <span
                    className="shrink-0 w-16 text-right"
                    style={{ fontSize: "0.7rem", color: "var(--on-surf-var)", fontFamily: "var(--font-body)" }}
                  >
                    {formatDate(day.date)}
                  </span>
                  <div className="flex-1 flex h-5 rounded-md overflow-hidden" style={{ background: "var(--surf-low)" }}>
                    {pctCollected > 0 && (
                      <div
                        style={{
                          width: `${pctCollected}%`,
                          background: "var(--sec)",
                          transition: "width 0.3s",
                        }}
                      />
                    )}
                    {pctPending > 0 && (
                      <div
                        style={{
                          width: `${pctPending}%`,
                          background: "var(--warn)",
                          transition: "width 0.3s",
                        }}
                      />
                    )}
                  </div>
                  <span
                    className="shrink-0 w-24 text-right"
                    style={{
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      color: "var(--on-surf)",
                      fontFamily: "var(--font-display)",
                    }}
                  >
                    {formatMXN(total)}
                  </span>
                </div>
              );
            })}
          </div>
          {/* Legend */}
          <div className="flex items-center gap-4 mt-3">
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: "var(--sec)" }} />
              <span style={{ fontSize: "0.625rem", color: "var(--on-surf-var)" }}>Cobrado</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-3 rounded-sm" style={{ background: "var(--warn)" }} />
              <span style={{ fontSize: "0.625rem", color: "var(--on-surf-var)" }}>Pendiente</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ────────────────────────────────────────────────────

function KpiMini({ label, value, warn }: { label: string; value: number; warn?: boolean }) {
  return (
    <div className="text-right">
      <div style={{ fontSize: "0.575rem", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--on-surf-var)" }}>
        {label}
      </div>
      <div style={{ fontSize: "0.875rem", fontWeight: 700, fontFamily: "var(--font-display)", color: warn ? "var(--warn)" : "var(--on-surf)" }}>
        {formatMXN(value)}
      </div>
    </div>
  );
}

function DifferenceChip({ difference }: { difference: number }) {
  const isZero = Math.abs(difference) < 0.01;
  const isPositive = difference > 0;

  return (
    <div className="text-right">
      <div style={{ fontSize: "0.575rem", fontWeight: 500, letterSpacing: "0.04em", textTransform: "uppercase", color: "var(--on-surf-var)" }}>
        Diferencia
      </div>
      <div
        style={{
          fontSize: "0.875rem",
          fontWeight: 700,
          fontFamily: "var(--font-display)",
          color: isZero ? "var(--sec)" : "var(--ter)",
        }}
      >
        {isZero ? "$0.00" : `${isPositive ? "+" : ""}${formatMXN(difference)}`}
      </div>
    </div>
  );
}

function KpiCard({
  label,
  value,
  gradient,
  warn,
  small,
}: {
  label: string;
  value: string;
  gradient?: boolean;
  warn?: boolean;
  small?: boolean;
}) {
  return (
    <div
      className="p-5 rounded-2xl"
      style={{
        background: gradient
          ? "linear-gradient(135deg, #1b4332, #2ecc71)"
          : "var(--surf-lowest)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        style={{
          fontSize: "0.625rem",
          fontWeight: 500,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: gradient ? "rgba(255,255,255,0.7)" : "var(--on-surf-var)",
          marginBottom: "0.5rem",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontFamily: "var(--font-display)",
          fontSize: small ? "1.25rem" : "1.75rem",
          fontWeight: 700,
          letterSpacing: "-0.02em",
          color: gradient
            ? "#ffffff"
            : warn
              ? "var(--warn)"
              : "var(--on-surf)",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-2.5 rounded-xl" style={{ background: "var(--surf-low)" }}>
      <div style={{ fontSize: "0.6rem", color: "var(--on-surf-var)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: "0.2rem" }}>
        {label}
      </div>
      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--on-surf)", fontFamily: "var(--font-display)" }}>
        {value}
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="flex flex-col items-center justify-center py-20 px-6"
      style={{
        background: "var(--surf-lowest)",
        borderRadius: "var(--r-lg)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        className="w-12 h-12 rounded-[var(--r-lg)] flex items-center justify-center mb-3"
        style={{ background: "var(--surf-high)" }}
      >
        <Banknote className="w-5 h-5" style={{ color: "var(--on-surf-var)" }} />
      </div>
      <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
        {message}
      </p>
    </div>
  );
}
