"use client";

import { useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { Search, RotateCcw, ChevronDown } from "lucide-react";
import type { SaleListItem, SellerOption } from "./page";

// ── Types ─────────────────────────────────────────────────────────────────────

interface CurrentFilters {
  from: string;
  to: string;
  userId: string;
  status: string;
  paymentMethod: string;
  folio: string;
  customer: string;
  branchId: string;
}

interface SalesHistoryTableProps {
  initialItems: SaleListItem[];
  initialNextCursor: string | null;
  totalCount: number;
  sellers: SellerOption[];
  currentFilters: CurrentFilters;
  role: string;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  });
}

// ── Status chip ───────────────────────────────────────────────────────────────

function StatusChip({ status }: { status: string }) {
  const map: Record<string, { label: string; bg: string; color: string }> = {
    COMPLETED: {
      label: "Completada",
      bg: "var(--sec-container)",
      color: "var(--on-sec-container)",
    },
    LAYAWAY: {
      label: "Apartado",
      bg: "var(--warn-container)",
      color: "var(--warn)",
    },
    CANCELLED: {
      label: "Cancelada",
      bg: "var(--ter-container)",
      color: "var(--on-ter-container)",
    },
  };
  const s = map[status] ?? { label: status, bg: "var(--surf-high)", color: "var(--on-surf-var)" };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: "var(--r-full)",
        padding: "0.2rem 0.65rem",
        fontSize: "0.625rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontFamily: "var(--font-body)",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ── Order type chip ───────────────────────────────────────────────────────────

function OrderTypeChip({ orderType }: { orderType: string | null }) {
  if (!orderType) return <span style={{ color: "var(--on-surf-var)" }}>—</span>;
  const map: Record<string, { label: string; bg: string; color: string }> = {
    LAYAWAY: {
      label: "Apartado",
      bg: "color-mix(in srgb, var(--warn) 12%, transparent)",
      color: "var(--warn)",
    },
    BACKORDER: {
      label: "Backorder",
      bg: "color-mix(in srgb, var(--ter) 12%, transparent)",
      color: "var(--ter)",
    },
  };
  const s = map[orderType] ?? { label: orderType, bg: "var(--surf-high)", color: "var(--on-surf-var)" };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: "var(--r-full)",
        padding: "0.2rem 0.65rem",
        fontSize: "0.625rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontFamily: "var(--font-body)",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ── Payment method chip ───────────────────────────────────────────────────────

function PaymentChip({ method }: { method: string | null }) {
  if (!method) return <span style={{ color: "var(--on-surf-var)" }}>—</span>;
  const map: Record<string, { label: string; bg: string; color: string }> = {
    CASH: { label: "Efectivo", bg: "var(--sec-container)", color: "var(--on-sec-container)" },
    CARD: {
      label: "Tarjeta",
      bg: "var(--p-container)",
      color: "var(--on-p-container)",
    },
    TRANSFER: {
      label: "Transferencia",
      bg: "color-mix(in srgb, var(--p) 10%, transparent)",
      color: "var(--p)",
    },
    CREDIT_BALANCE: {
      label: "Crédito",
      bg: "var(--warn-container)",
      color: "var(--warn)",
    },
    ATRATO: {
      label: "Atrato",
      bg: "var(--p-container)",
      color: "var(--on-p-container)",
    },
  };
  const s = map[method] ?? { label: method, bg: "var(--surf-high)", color: "var(--on-surf-var)" };
  return (
    <span
      style={{
        background: s.bg,
        color: s.color,
        borderRadius: "var(--r-full)",
        padding: "0.2rem 0.65rem",
        fontSize: "0.625rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontFamily: "var(--font-body)",
        whiteSpace: "nowrap",
      }}
    >
      {s.label}
    </span>
  );
}

// ── Status toggle chips ───────────────────────────────────────────────────────

const ALL_STATUSES = ["COMPLETED", "LAYAWAY", "CANCELLED"] as const;
type SaleStatus = (typeof ALL_STATUSES)[number];

const STATUS_LABELS: Record<SaleStatus, string> = {
  COMPLETED: "Completada",
  LAYAWAY: "Apartado",
  CANCELLED: "Cancelada",
};

// ── Main Component ────────────────────────────────────────────────────────────

export function SalesHistoryTable({
  initialItems,
  initialNextCursor,
  totalCount,
  sellers,
  currentFilters,
  role,
}: SalesHistoryTableProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  // Local state for "load more" appended items
  const [appendedItems, setAppendedItems] = useState<SaleListItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(initialNextCursor);
  const [loadingMore, setLoadingMore] = useState(false);

  // Derive displayed items
  const displayItems = [...initialItems, ...appendedItems];

  // Local filter state (synced with URL)
  const [folio, setFolio] = useState(currentFilters.folio);
  const [customer, setCustomer] = useState(currentFilters.customer);
  const [fromDate, setFromDate] = useState(currentFilters.from);
  const [toDate, setToDate] = useState(currentFilters.to);
  const [selectedUserId, setSelectedUserId] = useState(currentFilters.userId);
  const [selectedPayment, setSelectedPayment] = useState(currentFilters.paymentMethod);
  const [activeStatuses, setActiveStatuses] = useState<Set<SaleStatus>>(() => {
    if (!currentFilters.status) return new Set<SaleStatus>();
    return new Set(
      currentFilters.status.split(",").filter((s): s is SaleStatus =>
        (ALL_STATUSES as readonly string[]).includes(s)
      )
    );
  });

  // ── URL update helper ─────────────────────────────────────────────────────

  function applyFilters(overrides: Partial<CurrentFilters> = {}): void {
    const merged: CurrentFilters = {
      from: fromDate,
      to: toDate,
      userId: selectedUserId,
      status: [...activeStatuses].join(","),
      paymentMethod: selectedPayment,
      folio,
      customer,
      branchId: currentFilters.branchId,
      ...overrides,
    };

    const params = new URLSearchParams(searchParams.toString());

    // Reset cursor when filters change
    params.delete("cursor");

    // Set or delete each filter param
    const setOrDelete = (key: string, value: string) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    };

    setOrDelete("from", merged.from);
    setOrDelete("to", merged.to);
    setOrDelete("userId", merged.userId);
    setOrDelete("status", merged.status);
    setOrDelete("paymentMethod", merged.paymentMethod);
    setOrDelete("folio", merged.folio);
    setOrDelete("customer", merged.customer);
    if (role === "ADMIN") setOrDelete("branchId", merged.branchId);

    // Reset appended items on filter change
    setAppendedItems([]);
    setNextCursor(initialNextCursor);

    startTransition(() => {
      router.push(`/ventas?${params.toString()}`);
    });
  }

  function handleStatusToggle(status: SaleStatus): void {
    const next = new Set(activeStatuses);
    if (next.has(status)) {
      next.delete(status);
    } else {
      next.add(status);
    }
    setActiveStatuses(next);

    const merged: CurrentFilters = {
      from: fromDate,
      to: toDate,
      userId: selectedUserId,
      status: [...next].join(","),
      paymentMethod: selectedPayment,
      folio,
      customer,
      branchId: currentFilters.branchId,
    };

    const params = new URLSearchParams(searchParams.toString());
    params.delete("cursor");

    const setOrDelete = (key: string, value: string) => {
      if (value) params.set(key, value);
      else params.delete(key);
    };

    setOrDelete("from", merged.from);
    setOrDelete("to", merged.to);
    setOrDelete("userId", merged.userId);
    setOrDelete("status", merged.status);
    setOrDelete("paymentMethod", merged.paymentMethod);
    setOrDelete("folio", merged.folio);
    setOrDelete("customer", merged.customer);
    if (role === "ADMIN") setOrDelete("branchId", merged.branchId);

    setAppendedItems([]);
    setNextCursor(null);

    startTransition(() => {
      router.push(`/ventas?${params.toString()}`);
    });
  }

  function handleClearFilters(): void {
    const now = new Date();
    const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fromStr = defaultFrom.toISOString().substring(0, 10);
    const toStr = now.toISOString().substring(0, 10);

    setFolio("");
    setCustomer("");
    setFromDate(fromStr);
    setToDate(toStr);
    setSelectedUserId("");
    setSelectedPayment("");
    setActiveStatuses(new Set());
    setAppendedItems([]);
    setNextCursor(null);

    startTransition(() => {
      router.push(`/ventas?from=${fromStr}&to=${toStr}`);
    });
  }

  // ── Load more ─────────────────────────────────────────────────────────────

  async function handleLoadMore(): Promise<void> {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);

    try {
      const params = new URLSearchParams(searchParams.toString());
      params.set("cursor", nextCursor);

      const res = await fetch(`/api/ventas?${params.toString()}`);
      if (!res.ok) throw new Error("Error al cargar más ventas");

      type ApiResponse = {
        success: boolean;
        data?: {
          items: SaleListItem[];
          nextCursor: string | null;
          totalCount: number;
        };
        error?: string;
      };

      const json = (await res.json()) as ApiResponse;
      if (!json.success || !json.data) {
        toast.error(json.error ?? "Error al cargar más ventas");
        return;
      }

      setAppendedItems((prev) => [...prev, ...json.data!.items]);
      setNextCursor(json.data.nextCursor);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cargar más ventas");
    } finally {
      setLoadingMore(false);
    }
  }

  // ── Handle individual field apply (on Enter / blur) ───────────────────────

  function handleFieldEnter(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === "Enter") {
      applyFilters();
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const inputStyle: React.CSSProperties = {
    background: "var(--surf-low)",
    border: "1px solid rgba(178, 204, 192, 0.15)",
    borderRadius: "var(--r-md)",
    color: "var(--on-surf)",
    fontFamily: "var(--font-body)",
    fontSize: "0.75rem",
    padding: "0.5rem 0.75rem",
    outline: "none",
    width: "100%",
    transition: "border-color 0.15s",
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
              lineHeight: 1.2,
            }}
          >
            Historial de Ventas
          </h1>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--on-surf-var)",
              marginTop: "0.25rem",
            }}
          >
            {totalCount === 1 ? "1 venta encontrada" : `${totalCount.toLocaleString("es-MX")} ventas encontradas`}
          </p>
        </div>
      </div>

      {/* Filter card */}
      <div
        className="mb-5 p-5"
        style={{
          background: "var(--surf-lowest)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow)",
        }}
      >
        {/* Row 1: dates + user + payment */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
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
          {/* Seller */}
          {role !== "SELLER" && (
            <div className="relative">
              <label style={labelStyle}>Vendedor</label>
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
                  {sellers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                  style={{ color: "var(--on-surf-var)" }}
                />
              </div>
            </div>
          )}
          {/* Payment method */}
          <div className="relative">
            <label style={labelStyle}>Método de pago</label>
            <div className="relative">
              <select
                value={selectedPayment}
                onChange={(e) => {
                  setSelectedPayment(e.target.value);
                  applyFilters({ paymentMethod: e.target.value });
                }}
                style={selectStyle}
              >
                <option value="">Todos</option>
                <option value="CASH">Efectivo</option>
                <option value="CARD">Tarjeta</option>
                <option value="TRANSFER">Transferencia</option>
                <option value="CREDIT_BALANCE">Crédito</option>
                <option value="ATRATO">Atrato</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                style={{ color: "var(--on-surf-var)" }}
              />
            </div>
          </div>
        </div>

        {/* Row 2: search inputs */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
          {/* Folio search */}
          <div className="relative">
            <label style={labelStyle}>Folio</label>
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                style={{ color: "var(--on-surf-var)" }}
              />
              <input
                type="text"
                placeholder="Ej. LEO-0042"
                value={folio}
                onChange={(e) => setFolio(e.target.value)}
                onKeyDown={handleFieldEnter}
                onBlur={() => applyFilters()}
                style={{ ...inputStyle, paddingLeft: "2rem" }}
              />
            </div>
          </div>
          {/* Customer search */}
          <div className="relative">
            <label style={labelStyle}>Cliente</label>
            <div className="relative">
              <Search
                className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none"
                style={{ color: "var(--on-surf-var)" }}
              />
              <input
                type="text"
                placeholder="Nombre del cliente"
                value={customer}
                onChange={(e) => setCustomer(e.target.value)}
                onKeyDown={handleFieldEnter}
                onBlur={() => applyFilters()}
                style={{ ...inputStyle, paddingLeft: "2rem" }}
              />
            </div>
          </div>
        </div>

        {/* Row 3: status chips + clear button */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <span style={{ ...labelStyle, marginBottom: 0, alignSelf: "center" }}>Estado:</span>
            {ALL_STATUSES.map((st) => {
              const isActive = activeStatuses.has(st);
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => handleStatusToggle(st)}
                  style={{
                    borderRadius: "var(--r-full)",
                    padding: "0.3rem 0.85rem",
                    fontSize: "0.625rem",
                    fontWeight: 500,
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-body)",
                    cursor: "pointer",
                    border: "none",
                    transition: "background 0.15s, color 0.15s",
                    background: isActive
                      ? st === "COMPLETED"
                        ? "var(--sec-container)"
                        : st === "LAYAWAY"
                        ? "var(--warn-container)"
                        : "var(--ter-container)"
                      : "var(--surf-high)",
                    color: isActive
                      ? st === "COMPLETED"
                        ? "var(--on-sec-container)"
                        : st === "LAYAWAY"
                        ? "var(--warn)"
                        : "var(--on-ter-container)"
                      : "var(--on-surf-var)",
                  }}
                >
                  {STATUS_LABELS[st]}
                </button>
              );
            })}
          </div>

          {/* Clear filters button */}
          <button
            type="button"
            onClick={handleClearFilters}
            className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--on-surf-var)" }}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Limpiar filtros
          </button>
        </div>
      </div>

      {/* Table card */}
      <div
        style={{
          background: "var(--surf-lowest)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow)",
          overflow: "hidden",
        }}
      >
        {isPending && (
          <div
            className="h-0.5 w-full"
            style={{
              background: "linear-gradient(135deg, var(--p) 0%, var(--p-bright) 100%)",
              opacity: 0.7,
            }}
          />
        )}

        {displayItems.length === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div
              className="w-12 h-12 rounded-[var(--r-lg)] flex items-center justify-center mb-3"
              style={{ background: "var(--surf-high)" }}
            >
              <Search className="w-5 h-5" style={{ color: "var(--on-surf-var)" }} />
            </div>
            <p
              className="text-sm font-medium"
              style={{ color: "var(--on-surf)" }}
            >
              No se encontraron ventas
            </p>
            <p
              className="text-xs mt-1"
              style={{ color: "var(--on-surf-var)" }}
            >
              Prueba ajustando los filtros o el rango de fechas
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Folio", "Fecha", "Cliente", "Vendedor", "Tipo", "Método", "Total"].map((header) => (
                    <th
                      key={header}
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 500,
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        color: "var(--on-surf-var)",
                        padding: "0.5rem 0.75rem",
                        borderBottom: "1px solid rgba(178, 204, 192, 0.15)",
                        textAlign: "left",
                        whiteSpace: "nowrap",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {displayItems.map((sale) => (
                  <SaleRow key={sale.id} sale={sale} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Load more */}
        {nextCursor && displayItems.length > 0 && (
          <div
            className="flex justify-center py-4"
            style={{ borderTop: "1px solid rgba(178, 204, 192, 0.15)" }}
          >
            <button
              type="button"
              onClick={handleLoadMore}
              disabled={loadingMore}
              className="flex items-center gap-2 px-5 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                background: "var(--surf-high)",
                color: "var(--p)",
                border: "none",
                cursor: loadingMore ? "not-allowed" : "pointer",
              }}
            >
              {loadingMore ? "Cargando..." : "Cargar más"}
              {!loadingMore && <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sale row sub-component ────────────────────────────────────────────────────

function SaleRow({ sale }: { sale: SaleListItem }) {
  const router = useRouter();
  const [hovered, setHovered] = useState(false);

  return (
    <tr
      onClick={() => router.push(`/ventas/${sale.id}`)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        cursor: "pointer",
        background: hovered ? "var(--surf-high)" : "transparent",
        transition: "background 0.1s",
      }}
    >
      <td
        style={{
          fontSize: "0.75rem",
          color: "var(--on-surf)",
          padding: "0.5625rem 0.75rem",
          fontWeight: 600,
          whiteSpace: "nowrap",
          fontFamily: "var(--font-body)",
        }}
      >
        {sale.folio}
      </td>
      <td
        style={{
          fontSize: "0.75rem",
          color: "var(--on-surf-var)",
          padding: "0.5625rem 0.75rem",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-body)",
        }}
      >
        {formatDateTime(sale.createdAt)}
      </td>
      <td
        style={{
          fontSize: "0.75rem",
          color: "var(--on-surf)",
          padding: "0.5625rem 0.75rem",
          maxWidth: "180px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-body)",
        }}
      >
        {sale.customerName ?? <span style={{ color: "var(--on-surf-var)" }}>—</span>}
      </td>
      <td
        style={{
          fontSize: "0.75rem",
          color: "var(--on-surf-var)",
          padding: "0.5625rem 0.75rem",
          maxWidth: "140px",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          fontFamily: "var(--font-body)",
        }}
      >
        {sale.userName}
      </td>
      <td style={{ padding: "0.5625rem 0.75rem" }}>
        <OrderTypeChip orderType={sale.orderType} />
      </td>
      <td style={{ padding: "0.5625rem 0.75rem" }}>
        <PaymentChip method={sale.paymentMethod} />
      </td>
      <td
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--on-surf)",
          padding: "0.5625rem 0.75rem",
          whiteSpace: "nowrap",
          textAlign: "right",
          fontFamily: "var(--font-display)",
        }}
      >
        <div className="flex items-center justify-between gap-3">
          <StatusChip status={sale.status} />
          {formatMXN(sale.total)}
        </div>
      </td>
    </tr>
  );
}
