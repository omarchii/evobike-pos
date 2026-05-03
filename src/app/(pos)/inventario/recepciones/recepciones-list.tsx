"use client";

import { useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  PackageSearch,
  Plus,
  RotateCcw,
  Search,
} from "lucide-react";
import { ReceiptStatusBadge, daysUntil } from "@/components/inventario/receipt-status-badge";
import { formatMXN } from "@/lib/format";
import { parseLocalDate } from "@/lib/reportes/date-range";
import type { SerializedReceiptListItem, ReceiptFilters } from "./types";

// ── Helpers ───────────────────────────────────────────────────────────────────

const fmtMXN = (v: number) => formatMXN(v, { decimals: 2 });

function formatDate(value: string): string {
  const d = parseLocalDate(value, false) ?? new Date(value);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Chips ─────────────────────────────────────────────────────────────────────
// EstadoChip extraído a ReceiptStatusBadge (compartido con detalle)

function VencimientoCell({ iso }: { iso: string }) {
  const days = daysUntil(iso);
  let color: string;
  if (days < 0) color = "var(--ter)";
  else if (days <= 7) color = "var(--warn)";
  else color = "var(--on-surf-var)";

  return (
    <span style={{ fontSize: "0.75rem", color, fontFamily: "var(--font-body)", whiteSpace: "nowrap" }}>
      {formatDate(iso)}
      {days < 0 && (
        <span style={{ marginLeft: "0.35rem", fontSize: "0.6rem", fontWeight: 600 }}>
          ({Math.abs(days)}d vencida)
        </span>
      )}
      {days >= 0 && days <= 7 && (
        <span style={{ marginLeft: "0.35rem", fontSize: "0.6rem", fontWeight: 600 }}>
          ({days}d)
        </span>
      )}
    </span>
  );
}

// ── Shared input styles ───────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "1px solid var(--ghost-border)",
  borderRadius: "var(--r-md)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontSize: "0.75rem",
  padding: "0.5rem 0.75rem",
  outline: "none",
  width: "100%",
  transition: "border-color 0.15s",
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  appearance: "none",
  cursor: "pointer",
  paddingRight: "2rem",
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: "0.625rem",
  fontWeight: 500,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--on-surf-var)",
  marginBottom: "0.35rem",
  display: "block",
  fontFamily: "var(--font-body)",
};

// ── Main component ────────────────────────────────────────────────────────────

interface RecepcionesListProps {
  rows: SerializedReceiptListItem[];
  total: number;
  totalPages: number;
  proveedores: string[];
  currentFilters: ReceiptFilters;
}

export function RecepcionesList({
  rows,
  total,
  totalPages,
  proveedores,
  currentFilters,
}: RecepcionesListProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  function pushFilters(overrides: Partial<ReceiptFilters>): void {
    const next: ReceiptFilters = { ...currentFilters, ...overrides, page: 1 };

    if (overrides.estadoPago !== undefined && overrides.estadoPago !== "CREDITO") {
      next.vencimientoDesde = "";
      next.vencimientoHasta = "";
    }

    const params = new URLSearchParams(searchParams.toString());
    const setOrDelete = (key: string, val: string) => {
      if (val) params.set(key, val);
      else params.delete(key);
    };

    setOrDelete("search", next.search);
    setOrDelete("estadoPago", next.estadoPago);
    setOrDelete("proveedor", next.proveedor);
    setOrDelete("vencimientoDesde", next.vencimientoDesde);
    setOrDelete("vencimientoHasta", next.vencimientoHasta);
    params.delete("page");

    startTransition(() => {
      router.replace(`/inventario/recepciones?${params.toString()}`);
    });
  }

  function pushPage(newPage: number): void {
    const params = new URLSearchParams(searchParams.toString());
    if (newPage <= 1) params.delete("page");
    else params.set("page", String(newPage));
    startTransition(() => {
      router.replace(`/inventario/recepciones?${params.toString()}`);
    });
  }

  function clearFilters(): void {
    startTransition(() => {
      router.replace("/inventario/recepciones");
    });
  }

  const isCredito = currentFilters.estadoPago === "CREDITO";

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
            Recepciones de Inventario
          </h1>
          <p style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", marginTop: "0.25rem" }}>
            {total === 1 ? "1 recepción" : `${total.toLocaleString("es-MX")} recepciones`}
            {total > 0 && ` · página ${currentFilters.page} de ${totalPages}`}
          </p>
        </div>
        <Link
          href="/inventario/recepciones/nuevo"
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold shrink-0"
          style={{
            background: "var(--velocity-gradient)",
            color: "#ffffff",
            fontFamily: "var(--font-body)",
            textDecoration: "none",
          }}
        >
          <Plus className="w-4 h-4" />
          Nueva recepción
        </Link>
      </div>

      {/* Search + Filter card */}
      <div
        className="mb-5 p-5"
        style={{ background: "var(--surf-lowest)", borderRadius: "var(--r-lg)", boxShadow: "var(--shadow)" }}
      >
        <div className="relative mb-4">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4"
            style={{ color: "var(--on-surf-var)" }}
          />
          <input
            type="text"
            placeholder="Buscar por folio o proveedor…"
            defaultValue={currentFilters.search}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                pushFilters({ search: (e.target as HTMLInputElement).value });
              }
            }}
            onBlur={(e) => {
              if (e.target.value !== currentFilters.search) {
                pushFilters({ search: e.target.value });
              }
            }}
            style={{ ...INPUT_STYLE, paddingLeft: "2.25rem" }}
          />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
          {/* Estado */}
          <div>
            <label style={LABEL_STYLE}>Estado de pago</label>
            <div className="relative">
              <select
                value={currentFilters.estadoPago}
                onChange={(e) => pushFilters({ estadoPago: e.target.value })}
                style={SELECT_STYLE}
              >
                <option value="">Todos</option>
                <option value="PAGADA">Pagada</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="CREDITO">Crédito</option>
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                style={{ color: "var(--on-surf-var)" }}
              />
            </div>
          </div>

          {/* Proveedor */}
          <div>
            <label style={LABEL_STYLE}>Proveedor</label>
            <div className="relative">
              <select
                value={currentFilters.proveedor}
                onChange={(e) => pushFilters({ proveedor: e.target.value })}
                style={SELECT_STYLE}
              >
                <option value="">Todos</option>
                {proveedores.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
                style={{ color: "var(--on-surf-var)" }}
              />
            </div>
          </div>

          {/* Vencimiento desde — solo visible en CREDITO */}
          <div style={{ opacity: isCredito ? 1 : 0.35, pointerEvents: isCredito ? "auto" : "none" }}>
            <label style={LABEL_STYLE}>Vence desde</label>
            <input
              type="date"
              value={currentFilters.vencimientoDesde}
              onChange={(e) => pushFilters({ vencimientoDesde: e.target.value })}
              style={INPUT_STYLE}
              tabIndex={isCredito ? 0 : -1}
            />
          </div>

          {/* Vencimiento hasta */}
          <div style={{ opacity: isCredito ? 1 : 0.35, pointerEvents: isCredito ? "auto" : "none" }}>
            <label style={LABEL_STYLE}>Vence hasta</label>
            <input
              type="date"
              value={currentFilters.vencimientoHasta}
              onChange={(e) => pushFilters({ vencimientoHasta: e.target.value })}
              style={INPUT_STYLE}
              tabIndex={isCredito ? 0 : -1}
            />
          </div>
        </div>

        {/* Clear */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={clearFilters}
            className="flex items-center gap-1.5 text-xs font-medium transition-opacity hover:opacity-70"
            style={{ color: "var(--on-surf-var)", background: "none", border: "none", cursor: "pointer" }}
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
        {/* Loading bar */}
        {isPending && (
          <div
            className="h-0.5 w-full"
            style={{
              background: "linear-gradient(135deg, var(--p) 0%, var(--p-bright) 100%)",
              opacity: 0.7,
            }}
          />
        )}

        {rows.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 px-6">
            <div
              className="w-12 h-12 rounded-[var(--r-lg)] flex items-center justify-center mb-3"
              style={{ background: "var(--surf-high)" }}
            >
              <PackageSearch className="w-5 h-5" style={{ color: "var(--on-surf-var)" }} />
            </div>
            <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
              Sin recepciones registradas
            </p>
            <p className="text-xs mt-1" style={{ color: "var(--on-surf-var)" }}>
              Prueba ajustando los filtros o registra una nueva recepción
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Folio proveedor", "Proveedor", "Fecha", "Líneas", "Total", "Estado", "Vencimiento", ""].map(
                    (h) => (
                      <th
                        key={h}
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 500,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "var(--on-surf-var)",
                          padding: "0.5rem 0.75rem",
                          borderBottom: "1px solid var(--ghost-border)",
                          textAlign: h === "Total" ? "right" : "left",
                          whiteSpace: "nowrap",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <ReceiptRow key={r.id} row={r} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div
            className="flex items-center justify-between px-4 py-3"
            style={{ borderTop: "1px solid var(--ghost-border)" }}
          >
            <span style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>
              Página {currentFilters.page} de {totalPages}
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => pushPage(currentFilters.page - 1)}
                disabled={currentFilters.page <= 1}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-opacity disabled:opacity-40"
                style={{
                  background: "var(--surf-high)",
                  color: "var(--p)",
                  border: "none",
                  cursor: currentFilters.page <= 1 ? "not-allowed" : "pointer",
                }}
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                Anterior
              </button>
              <button
                type="button"
                onClick={() => pushPage(currentFilters.page + 1)}
                disabled={currentFilters.page >= totalPages}
                className="flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-medium transition-opacity disabled:opacity-40"
                style={{
                  background: "var(--surf-high)",
                  color: "var(--p)",
                  border: "none",
                  cursor: currentFilters.page >= totalPages ? "not-allowed" : "pointer",
                }}
              >
                Siguiente
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Receipt row ───────────────────────────────────────────────────────────────

function ReceiptRow({ row }: { row: SerializedReceiptListItem }) {
  const router = useRouter();
  const TD: React.CSSProperties = {
    fontSize: "0.75rem",
    color: "var(--on-surf)",
    padding: "0.5625rem 0.75rem",
    whiteSpace: "nowrap",
    fontFamily: "var(--font-body)",
  };
  const TD_VAR: React.CSSProperties = { ...TD, color: "var(--on-surf-var)" };

  const totalLineas = row.totalLineas + row.totalLotes;

  return (
    <tr
      onClick={() => router.push(`/inventario/recepciones/${row.id}`)}
      className="group"
      style={{ cursor: "pointer", transition: "background 0.1s" }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--surf-high)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <td style={{ ...TD, fontWeight: 600, fontFamily: "var(--font-display)" }}>
        {row.folioFacturaProveedor ?? (
          <span style={{ color: "var(--on-surf-var)" }}>—</span>
        )}
      </td>
      <td
        style={{
          ...TD,
          maxWidth: "200px",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {row.proveedor}
      </td>
      <td style={TD_VAR}>{formatDate(row.createdAt)}</td>
      <td style={TD_VAR}>
        {totalLineas === 1 ? "1 línea" : `${totalLineas} líneas`}
      </td>
      <td
        style={{
          ...TD,
          fontWeight: 600,
          textAlign: "right",
          fontFamily: "var(--font-display)",
        }}
      >
        {fmtMXN(row.totalPagado)}
      </td>
      <td style={{ padding: "0.5625rem 0.75rem" }}>
        <ReceiptStatusBadge
          estadoPago={row.estadoPago}
          fechaVencimiento={row.fechaVencimiento}
        />
      </td>
      <td style={{ padding: "0.5625rem 0.75rem" }}>
        {row.fechaVencimiento ? (
          <VencimientoCell iso={row.fechaVencimiento} />
        ) : (
          <span style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>—</span>
        )}
      </td>
      <td style={{ padding: "0.5625rem 0.75rem" }}>
        <span
          style={{
            fontSize: "0.7rem",
            fontWeight: 500,
            color: "var(--p-mid)",
            whiteSpace: "nowrap",
          }}
        >
          Ver →
        </span>
      </td>
    </tr>
  );
}
