"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  PackageSearch,
  User,
  Calendar,
  ArrowRight,
  ArrowUpRight,
  ShoppingBag,
  Repeat2,
  Truck,
  Plus,
} from "lucide-react";
import { SerializedPedido, CustomerOption, VariantOption } from "./page";
import { AbonoModal } from "./abono-modal";
import { NuevoPedidoModal } from "./nuevo-pedido-modal";

// ── Types ────────────────────────────────────────────────────────────────────

type FilterType = "ALL" | "LAYAWAY" | "BACKORDER";

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatMXN(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OrderTypeBadge({ type }: { type: string | null }) {
  if (type === "BACKORDER") {
    return (
      <span
        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
        style={{
          background: "color-mix(in srgb, var(--ter) 15%, transparent)",
          color: "var(--ter)",
          fontFamily: "var(--font-display)",
        }}
      >
        <Truck className="w-3 h-3" />
        Backorder
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold"
      style={{
        background: "color-mix(in srgb, var(--p) 15%, transparent)",
        color: "var(--p-mid)",
        fontFamily: "var(--font-display)",
      }}
    >
      <Repeat2 className="w-3 h-3" />
      Apartado
    </span>
  );
}

function ProgressBar({ pct }: { pct: number }) {
  return (
    <div
      className="absolute top-0 left-0 right-0 h-1 rounded-t-[var(--r-xl)]"
      style={{ background: "var(--surf-high)" }}
    >
      <div
        className="h-full rounded-t-[var(--r-xl)] transition-all duration-700"
        style={{
          width: `${pct}%`,
          background: "linear-gradient(90deg, var(--p-mid) 0%, var(--p-bright) 100%)",
        }}
      />
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface PedidosListProps {
  pedidos: SerializedPedido[];
  customers: CustomerOption[];
  variants: VariantOption[];
}

const FILTER_LABELS: Record<FilterType, string> = {
  ALL: "Todos",
  LAYAWAY: "Apartados",
  BACKORDER: "Backorders",
};

export default function PedidosList({ pedidos, customers, variants }: PedidosListProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("ALL");
  const [abonoTarget, setAbonoTarget] = useState<SerializedPedido | null>(null);
  const [nuevoPedidoOpen, setNuevoPedidoOpen] = useState(false);

  const filtered = pedidos.filter((p) => {
    if (filter === "ALL") return true;
    return (p.orderType ?? "LAYAWAY") === filter;
  });

  const handleAbonoSuccess = () => {
    setAbonoTarget(null);
    router.refresh();
  };

  // ── Empty state ──
  if (pedidos.length === 0) {
    return (
      <>
        <div
          className="flex-1 flex flex-col items-center justify-center rounded-[var(--r-xl)] p-12"
          style={{ background: "var(--surf-low)" }}
        >
          <PackageSearch
            className="w-16 h-16 mb-4"
            style={{ color: "var(--on-surf-var)", opacity: 0.4 }}
          />
          <h3
            className="text-lg font-semibold mb-1"
            style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
          >
            Sin pedidos activos
          </h3>
          <p className="text-sm text-center max-w-xs mb-5" style={{ color: "var(--on-surf-var)" }}>
            No hay apartados ni backorders pendientes en esta sucursal.
          </p>
          <button
            onClick={() => setNuevoPedidoOpen(true)}
            className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold"
            style={{
              background: "var(--velocity-gradient)",
              color: "#fff",
            }}
          >
            <Plus className="w-4 h-4" />
            Nuevo Pedido
          </button>
        </div>
        <NuevoPedidoModal
          open={nuevoPedidoOpen}
          onOpenChange={setNuevoPedidoOpen}
          customers={customers}
          variants={variants}
        />
      </>
    );
  }

  return (
    <>
      {/* Header row: filtros + botón nuevo */}
      <div className="flex items-center justify-between mb-6 gap-4">
        {/* Filter tabs */}
        <div
          className="flex gap-1 p-1 rounded-full self-start"
          style={{ background: "var(--surf-high)" }}
        >
          {(["ALL", "LAYAWAY", "BACKORDER"] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-full text-sm font-semibold transition-all"
              style={
                filter === f
                  ? {
                      background:
                        "linear-gradient(135deg, var(--p-mid) 0%, var(--p-bright) 100%)",
                      color: "var(--on-p)",
                      fontFamily: "var(--font-display)",
                    }
                  : { color: "var(--on-surf-var)" }
              }
            >
              {FILTER_LABELS[f]}
            </button>
          ))}
        </div>

        {/* Botón Nuevo Pedido */}
        <button
          onClick={() => setNuevoPedidoOpen(true)}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold shrink-0"
          style={{
            background: "var(--velocity-gradient)",
            color: "#fff",
          }}
        >
          <Plus className="w-4 h-4" />
          Nuevo Pedido
        </button>
      </div>

      {/* Empty filtered state */}
      {filtered.length === 0 && (
        <div
          className="flex flex-col items-center justify-center rounded-[var(--r-xl)] p-10"
          style={{ background: "var(--surf-low)" }}
        >
          <PackageSearch
            className="w-10 h-10 mb-3"
            style={{ color: "var(--on-surf-var)", opacity: 0.4 }}
          />
          <p className="text-sm" style={{ color: "var(--on-surf-var)" }}>
            No hay {FILTER_LABELS[filter].toLowerCase()} en esta sucursal.
          </p>
        </div>
      )}

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 overflow-y-auto pb-4">
        {filtered.map((p) => {
          const pending = p.total - p.totalPaid;
          const pct = p.total > 0 ? Math.min(100, (p.totalPaid / p.total) * 100) : 0;

          return (
            <div
              key={p.id}
              className="relative flex flex-col rounded-[var(--r-xl)] overflow-hidden"
              style={{
                background: "var(--surf-lowest)",
                boxShadow: "var(--shadow)",
              }}
            >
              <ProgressBar pct={pct} />

              {/* Card header */}
              <div className="px-4 pt-5 pb-3">
                <div className="flex items-start justify-between gap-2 mb-3">
                  <span
                    className="text-sm font-bold tracking-tight"
                    style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
                  >
                    {p.folio}
                  </span>
                  <OrderTypeBadge type={p.orderType} />
                </div>

                <div
                  className="flex items-center gap-1.5 text-sm font-medium truncate"
                  style={{ color: "var(--on-surf)" }}
                >
                  <User className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--on-surf-var)" }} />
                  {p.customer?.name ?? "Cliente general"}
                </div>

                <div
                  className="flex items-center gap-1.5 text-xs mt-1"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  <Calendar className="w-3 h-3 shrink-0" />
                  {formatDate(p.createdAt)}
                </div>

                {p.orderType === "BACKORDER" && p.expectedDeliveryDate && (
                  <div
                    className="flex items-center gap-1.5 text-xs mt-1"
                    style={{ color: "var(--warn)" }}
                  >
                    <Truck className="w-3 h-3 shrink-0" />
                    Entrega est.: {formatDate(p.expectedDeliveryDate)}
                  </div>
                )}
              </div>

              {/* Balance section */}
              <div
                className="mx-4 mb-3 rounded-[var(--r-lg)] p-3 space-y-1.5"
                style={{ background: "var(--surf-low)" }}
              >
                <div className="flex justify-between text-xs" style={{ color: "var(--on-surf-var)" }}>
                  <span>Total</span>
                  <span style={{ fontFamily: "var(--font-display)" }}>{formatMXN(p.total)}</span>
                </div>
                <div
                  className="flex justify-between text-xs font-semibold"
                  style={{ color: "var(--p-mid)" }}
                >
                  <span>Abonado</span>
                  <span style={{ fontFamily: "var(--font-display)" }}>{formatMXN(p.totalPaid)}</span>
                </div>
                <div
                  className="flex justify-between text-sm font-bold pt-1.5"
                  style={{
                    color: "var(--on-surf)",
                    borderTop: "1px solid var(--outline-var)",
                  }}
                >
                  <span>Restante</span>
                  <span style={{ fontFamily: "var(--font-display)" }}>{formatMXN(pending)}</span>
                </div>
              </div>

              {/* Products */}
              <div className="px-4 mb-4">
                <p
                  className="text-xs font-semibold mb-1.5 flex items-center gap-1"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  <ShoppingBag className="w-3 h-3" />
                  Artículos ({p.items.length})
                </p>
                {p.items.slice(0, 2).map((item) => (
                  <p
                    key={item.id}
                    className="text-xs truncate"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    {item.quantity}× {item.productName}
                  </p>
                ))}
                {p.items.length > 2 && (
                  <p className="text-xs italic mt-0.5" style={{ color: "var(--on-surf-var)", opacity: 0.6 }}>
                    … y {p.items.length - 2} más
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="mt-auto px-4 pb-4 flex gap-2">
                <button
                  type="button"
                  onClick={() => router.push(`/pedidos/${p.id}`)}
                  className="flex-1 py-2 rounded-full text-xs font-semibold flex items-center justify-center gap-1 transition-colors"
                  style={{
                    background: "var(--surf-high)",
                    color: "var(--on-surf-var)",
                  }}
                >
                  Ver detalle
                  <ArrowRight className="w-3 h-3" />
                </button>
                <button
                  type="button"
                  onClick={() => setAbonoTarget(p)}
                  className="flex-1 py-2 rounded-full text-xs font-bold flex items-center justify-center gap-1 transition-opacity hover:opacity-90"
                  style={{
                    background:
                      "linear-gradient(135deg, var(--p-mid) 0%, var(--p-bright) 100%)",
                    color: "var(--on-p)",
                  }}
                >
                  Abonar
                  <ArrowUpRight className="w-3 h-3" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Abono modal */}
      {abonoTarget && (
        <AbonoModal
          pedidoId={abonoTarget.id}
          folio={abonoTarget.folio}
          total={abonoTarget.total}
          totalPaid={abonoTarget.totalPaid}
          onClose={() => setAbonoTarget(null)}
          onSuccess={handleAbonoSuccess}
        />
      )}

      {/* Nuevo Pedido modal */}
      <NuevoPedidoModal
        open={nuevoPedidoOpen}
        onOpenChange={setNuevoPedidoOpen}
        customers={customers}
        variants={variants}
      />
    </>
  );
}
