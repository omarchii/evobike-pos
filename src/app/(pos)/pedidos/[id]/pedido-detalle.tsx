"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  User,
  Calendar,
  Truck,
  ShoppingBag,
  Store,
  Tag,
  Repeat2,
  Banknote,
  CreditCard,
  ArrowRightLeft,
  Clock,
  PackageCheck,
  FileText,
} from "lucide-react";
import { PedidoDetalleData } from "./page";
import { AbonoModal } from "../abono-modal";
import { openPDFInNewTab } from "@/lib/pdf-client";

// ── Helpers ───────────────────────────────────────────────────────────────────

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

function formatDateTime(date: Date | string): string {
  return new Date(date).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Sub-components ────────────────────────────────────────────────────────────

function OrderTypeBadge({ type }: { type: string | null }) {
  if (type === "BACKORDER") {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold"
        style={{
          background: "color-mix(in srgb, var(--ter) 15%, transparent)",
          color: "var(--ter)",
          fontFamily: "var(--font-display)",
        }}
      >
        <Truck className="w-3.5 h-3.5" />
        Backorder
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold"
      style={{
        background: "color-mix(in srgb, var(--p) 15%, transparent)",
        color: "var(--p-mid)",
        fontFamily: "var(--font-display)",
      }}
    >
      <Repeat2 className="w-3.5 h-3.5" />
      Apartado
    </span>
  );
}

const METHOD_ICON: Record<string, React.ReactNode> = {
  CASH: <Banknote className="w-3.5 h-3.5" />,
  CARD: <CreditCard className="w-3.5 h-3.5" />,
  TRANSFER: <ArrowRightLeft className="w-3.5 h-3.5" />,
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

// ── Main Component ────────────────────────────────────────────────────────────

interface PedidoDetalleProps {
  pedido: PedidoDetalleData;
}

export default function PedidoDetalle({ pedido }: PedidoDetalleProps) {
  const router = useRouter();
  const [abonoOpen, setAbonoOpen] = useState(false);

  const pending = Math.max(0, pedido.total - pedido.totalPaid);
  const pct = pedido.total > 0 ? Math.min(100, (pedido.totalPaid / pedido.total) * 100) : 0;

  const handleAbonoSuccess = () => {
    setAbonoOpen(false);
    router.refresh();
  };

  const handleDescargarRecibo = async () => {
    await openPDFInNewTab(`/api/pedidos/${pedido.id}/pdf`);
  };

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => router.push("/pedidos")}
          className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--on-surf-var)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Volver a Pedidos
        </button>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDescargarRecibo}
            className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
            style={{
              background: "color-mix(in srgb, var(--p) 12%, transparent)",
              color: "var(--p)",
            }}
          >
            <FileText className="w-4 h-4" />
            Descargar Recibo
          </button>
          {pedido.status === "COMPLETED" ? (
            <Link
              href={`/ventas/${pedido.id}`}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, var(--p-mid) 0%, var(--p-bright) 100%)",
                color: "var(--on-p)",
              }}
            >
              Ver venta
              <ArrowUpRight className="w-4 h-4" />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setAbonoOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, var(--p-mid) 0%, var(--p-bright) 100%)",
                color: "var(--on-p)",
              }}
            >
              Registrar Abono
              <ArrowUpRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Header card */}
      <div
        className="relative rounded-[var(--r-xl)] overflow-hidden mb-4"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {/* Progress bar */}
        <div
          className="absolute top-0 left-0 right-0 h-1"
          style={{ background: "var(--surf-high)" }}
        >
          <div
            className="h-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, var(--p-mid) 0%, var(--p-bright) 100%)",
            }}
          />
        </div>

        <div className="px-6 pt-7 pb-6">
          {/* Folio + badge */}
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <h1
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              {pedido.folio}
            </h1>
            <OrderTypeBadge type={pedido.orderType} />
          </div>

          {/* Meta row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <MetaItem
              icon={<User className="w-3.5 h-3.5" />}
              label="Cliente"
              value={pedido.customer?.name ?? "General"}
            />
            <MetaItem
              icon={<Tag className="w-3.5 h-3.5" />}
              label="Vendedor"
              value={pedido.createdBy}
            />
            <MetaItem
              icon={<Store className="w-3.5 h-3.5" />}
              label="Sucursal"
              value={pedido.branchName}
            />
            <MetaItem
              icon={<Calendar className="w-3.5 h-3.5" />}
              label="Fecha"
              value={formatDate(pedido.createdAt)}
            />
          </div>

          {pedido.orderType === "BACKORDER" && pedido.expectedDeliveryDate && (
            <div
              className="flex items-center gap-2 mt-4 px-3 py-2 rounded-[var(--r-md)] text-sm font-medium self-start w-fit"
              style={{
                background: "color-mix(in srgb, var(--warn) 12%, transparent)",
                color: "var(--warn)",
              }}
            >
              <Truck className="w-4 h-4" />
              Entrega estimada: {formatDate(pedido.expectedDeliveryDate)}
            </div>
          )}
        </div>
      </div>

      {/* Balance panel */}
      <div
        className="rounded-[var(--r-xl)] p-6 mb-4"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-4"
          style={{ color: "var(--on-surf-var)" }}
        >
          Resumen de pago
        </h2>

        {/* Big progress bar */}
        <div
          className="h-3 rounded-full mb-4 overflow-hidden"
          style={{ background: "var(--surf-high)" }}
        >
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{
              width: `${pct}%`,
              background: "linear-gradient(90deg, var(--p-mid) 0%, var(--p-bright) 100%)",
            }}
          />
        </div>
        <p
          className="text-xs text-right mb-5"
          style={{ color: "var(--on-surf-var)" }}
        >
          {pct.toFixed(0)}% liquidado
        </p>

        <div className="grid grid-cols-3 gap-3">
          <BalanceCell label="Total pedido" value={formatMXN(pedido.total)} muted />
          <BalanceCell label="Abonado" value={formatMXN(pedido.totalPaid)} accent />
          <BalanceCell label="Restante" value={formatMXN(pending)} bold />
        </div>
      </div>

      {/* Items */}
      <div
        className="rounded-[var(--r-xl)] p-6 mb-4"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-1.5"
          style={{ color: "var(--on-surf-var)" }}
        >
          <ShoppingBag className="w-3.5 h-3.5" />
          Artículos ({pedido.items.length})
        </h2>

        <div className="space-y-2">
          {pedido.items.map((item) => (
            <div
              key={item.id}
              className="flex justify-between items-center px-4 py-3 rounded-[var(--r-lg)]"
              style={{ background: "var(--surf-low)" }}
            >
              <div>
                <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                  {item.productName}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                  Cantidad: {item.quantity}
                </p>
              </div>
              <p
                className="text-sm font-bold"
                style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
              >
                {formatMXN(item.price * item.quantity)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Estado de recepción — solo BACKORDER con vehículos ensamblables */}
      {pedido.orderType === "BACKORDER" &&
        pedido.items.some((i) => i.reception) && (
          <div
            className="rounded-[var(--r-xl)] p-6 mb-4"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
          >
            <h2
              className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-1.5"
              style={{ color: "var(--on-surf-var)" }}
            >
              <PackageCheck className="w-3.5 h-3.5" />
              Estado de recepción
            </h2>

            <div className="space-y-3">
              {pedido.items
                .filter((i) => i.reception)
                .map((item) => {
                  const r = item.reception!;
                  const vehiclePct =
                    r.vehiclesExpected > 0
                      ? Math.min(100, (r.vehiclesReceived / r.vehiclesExpected) * 100)
                      : 0;
                  const batteryPct =
                    r.batteriesExpected > 0
                      ? Math.min(100, (r.batteriesReceived / r.batteriesExpected) * 100)
                      : 0;

                  return (
                    <div
                      key={item.id}
                      className="px-4 py-3 rounded-[var(--r-lg)] space-y-2"
                      style={{ background: "var(--surf-low)" }}
                    >
                      <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                        {item.productName}
                      </p>

                      {/* Vehículos */}
                      <div className="space-y-1">
                        <div className="flex justify-between items-center">
                          <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                            Vehículos recibidos
                          </span>
                          <span
                            className="text-xs font-semibold"
                            style={{ color: "var(--on-surf)" }}
                          >
                            {r.vehiclesReceived}/{r.vehiclesExpected}
                            {r.vehiclesAssembled > 0 && (
                              <span style={{ color: "var(--sec)", marginLeft: "0.4rem" }}>
                                ({r.vehiclesAssembled} montados)
                              </span>
                            )}
                          </span>
                        </div>
                        <div
                          className="h-1.5 rounded-full overflow-hidden"
                          style={{ background: "var(--surf-high)" }}
                        >
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${vehiclePct}%`,
                              background:
                                vehiclePct >= 100
                                  ? "var(--sec)"
                                  : "linear-gradient(90deg, var(--p-mid) 0%, var(--p-bright) 100%)",
                            }}
                          />
                        </div>
                      </div>

                      {/* Baterías */}
                      {r.batteriesExpected > 0 && (
                        <div className="space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                              Baterías recibidas
                            </span>
                            <span
                              className="text-xs font-semibold"
                              style={{ color: "var(--on-surf)" }}
                            >
                              {r.batteriesReceived}/{r.batteriesExpected}
                            </span>
                          </div>
                          <div
                            className="h-1.5 rounded-full overflow-hidden"
                            style={{ background: "var(--surf-high)" }}
                          >
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${batteryPct}%`,
                                background:
                                  batteryPct >= 100
                                    ? "var(--sec)"
                                    : "color-mix(in srgb, var(--warn) 80%, transparent)",
                              }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
            </div>
          </div>
        )}

      {/* Payment timeline */}
      <div
        className="rounded-[var(--r-xl)] p-6"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <h2
          className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-1.5"
          style={{ color: "var(--on-surf-var)" }}
        >
          <Clock className="w-3.5 h-3.5" />
          Historial de abonos · {pedido.payments.length} {pedido.payments.length === 1 ? "exhibición realizada" : "exhibiciones realizadas"}
        </h2>

        {pedido.payments.length === 0 ? (
          <p className="text-sm text-center py-6" style={{ color: "var(--on-surf-var)" }}>
            No se han registrado abonos todavía.
          </p>
        ) : (
          <div className="relative">
            {/* Vertical line */}
            <div
              className="absolute left-[17px] top-2 bottom-2 w-px"
              style={{ background: "var(--surf-high)" }}
            />

            <div className="space-y-3">
              {pedido.payments.map((pay, idx) => (
                <div key={pay.id} className="flex gap-4 items-start">
                  {/* Dot */}
                  <div
                    className="relative z-10 w-9 h-9 rounded-full shrink-0 flex items-center justify-center"
                    style={{
                      background:
                        idx === pedido.payments.length - 1
                          ? "linear-gradient(135deg, var(--p-mid) 0%, var(--p-bright) 100%)"
                          : "var(--surf-high)",
                      color:
                        idx === pedido.payments.length - 1
                          ? "var(--on-p)"
                          : "var(--on-surf-var)",
                    }}
                  >
                    {METHOD_ICON[pay.method] ?? <Banknote className="w-3.5 h-3.5" />}
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 flex justify-between items-start px-4 py-3 rounded-[var(--r-lg)]"
                    style={{ background: "var(--surf-low)" }}
                  >
                    <div>
                      <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                        {METHOD_LABEL[pay.method] ?? pay.method}
                      </p>
                      <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                        {formatDateTime(pay.createdAt)} · Cobrado por {pay.collectedBy}
                      </p>
                    </div>
                    <div className="ml-4 shrink-0 flex flex-col items-end">
                      <p
                        className="text-sm font-bold"
                        style={{ fontFamily: "var(--font-display)", color: "var(--p-mid)" }}
                      >
                        {formatMXN(pay.amount)}
                      </p>
                      <p
                        className="text-[10px] mt-0.5"
                        style={{ color: "var(--on-surf-var)" }}
                      >
                        Restante tras este abono: {formatMXN(pay.remainingAfter)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Abono modal */}
      {abonoOpen && (
        <AbonoModal
          pedidoId={pedido.id}
          folio={pedido.folio}
          total={pedido.total}
          totalPaid={pedido.totalPaid}
          customerId={pedido.customer?.id ?? null}
          onClose={() => setAbonoOpen(false)}
          onSuccess={handleAbonoSuccess}
        />
      )}
    </div>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function MetaItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div
      className="flex flex-col gap-0.5 px-3 py-2.5 rounded-[var(--r-lg)]"
      style={{ background: "var(--surf-low)" }}
    >
      <span
        className="flex items-center gap-1 text-xs"
        style={{ color: "var(--on-surf-var)" }}
      >
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold truncate" style={{ color: "var(--on-surf)" }}>
        {value}
      </span>
    </div>
  );
}

function BalanceCell({
  label,
  value,
  muted,
  accent,
  bold,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
  bold?: boolean;
}) {
  const color = accent ? "var(--p-mid)" : muted ? "var(--on-surf-var)" : "var(--on-surf)";
  return (
    <div
      className="flex flex-col items-center py-3 rounded-[var(--r-lg)]"
      style={{ background: "var(--surf-low)" }}
    >
      <p className="text-xs mb-1" style={{ color: "var(--on-surf-var)" }}>
        {label}
      </p>
      <p
        className={bold ? "text-lg font-bold" : "text-base font-semibold"}
        style={{ fontFamily: "var(--font-display)", color }}
      >
        {value}
      </p>
    </div>
  );
}
