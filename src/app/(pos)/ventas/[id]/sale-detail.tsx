"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  User,
  Calendar,
  Tag,
  ShoppingBag,
  Phone,
  Mail,
  Zap,
  FileText,
  Printer,
  XCircle,
} from "lucide-react";
import type { SaleDetailData } from "./page";
import { CancelSaleModal } from "@/components/pos/authorization/cancel-sale-modal";

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMXN(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Badge components ──────────────────────────────────────────────────────────

function SaleStatusBadge({ status }: { status: SaleDetailData["status"] }) {
  const map = {
    COMPLETED: {
      label: "Completada",
      bg: "color-mix(in srgb, var(--p) 12%, transparent)",
      color: "var(--p)",
    },
    LAYAWAY: {
      label: "Apartado",
      bg: "color-mix(in srgb, var(--warn) 12%, transparent)",
      color: "var(--warn)",
    },
    CANCELLED: {
      label: "Cancelada",
      bg: "var(--surf-high)",
      color: "var(--on-surf-var)",
    },
  } as const;
  const s = map[status];
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase"
      style={{ background: s.bg, color: s.color, fontFamily: "var(--font-body)" }}
    >
      {s.label}
    </span>
  );
}

function OrderTypeBadge({ type }: { type: SaleDetailData["orderType"] }) {
  if (!type) return null;
  const map = {
    BACKORDER: { label: "Backorder", bg: "color-mix(in srgb, var(--ter) 12%, transparent)", color: "var(--ter)" },
    LAYAWAY: { label: "Apartado", bg: "color-mix(in srgb, var(--warn) 12%, transparent)", color: "var(--warn)" },
  } as const;
  const s = map[type];
  return (
    <span
      className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase"
      style={{ background: s.bg, color: s.color, fontFamily: "var(--font-body)" }}
    >
      {s.label}
    </span>
  );
}

function AssemblyStatusBadge({ status }: { status: SaleDetailData["assemblyOrders"][number]["status"] }) {
  const map = {
    PENDING: {
      label: "Reensamble pendiente",
      bg: "color-mix(in srgb, var(--ter) 15%, transparent)",
      color: "var(--ter)",
    },
    COMPLETED: {
      label: "Reensamble completado",
      bg: "color-mix(in srgb, var(--p) 12%, transparent)",
      color: "var(--p)",
    },
    CANCELLED: {
      label: "Cancelado",
      bg: "var(--surf-high)",
      color: "var(--on-surf-var)",
    },
  } as const;
  const s = map[status];
  return (
    <span
      className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium tracking-wide"
      style={{ background: s.bg, color: s.color, fontFamily: "var(--font-body)" }}
    >
      {s.label}
    </span>
  );
}

// ── MetaItem ──────────────────────────────────────────────────────────────────

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
      <span className="flex items-center gap-1 text-xs" style={{ color: "var(--on-surf-var)" }}>
        {icon}
        {label}
      </span>
      <span className="text-sm font-semibold truncate" style={{ color: "var(--on-surf)" }}>
        {value}
      </span>
    </div>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

interface SaleDetailProps {
  sale: SaleDetailData;
  userRole: string;
}

export function SaleDetail({ sale, userRole }: SaleDetailProps) {
  const router = useRouter();
  const [showCancelModal, setShowCancelModal] = useState(false);

  const reensambleOrders = sale.assemblyOrders.filter(
    (ao) => ao.voltageChangeLogId !== null
  );

  const handlePrintWarranty = () => {
    window.open(`/api/sales/${sale.id}/warranty-pdf`, "_blank");
  };

  const canCancel = sale.status !== "CANCELLED";

  return (
    <div className="max-w-3xl mx-auto pb-16">
      {/* Top bar */}
      <div className="flex items-center justify-between mb-6">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex items-center gap-2 text-sm font-medium transition-opacity hover:opacity-70"
          style={{ color: "var(--on-surf-var)" }}
        >
          <ArrowLeft className="w-4 h-4" />
          Volver
        </button>

        <div className="flex items-center gap-2">
          {canCancel && (
            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition-opacity hover:opacity-90"
              style={{
                background: "rgba(220,38,38,0.1)",
                color: "#dc2626",
              }}
            >
              <XCircle className="w-4 h-4" />
              Cancelar venta
            </button>
          )}
          {sale.warrantyDocReady && (
            <button
              type="button"
              onClick={handlePrintWarranty}
              className="flex items-center gap-2 px-5 py-2.5 rounded-full text-sm font-bold transition-opacity hover:opacity-90"
              style={{
                background: "linear-gradient(135deg, var(--p-mid) 0%, var(--p-bright) 100%)",
                color: "var(--on-p)",
              }}
            >
              <Printer className="w-4 h-4" />
              Imprimir póliza
            </button>
          )}
        </div>
      </div>

      {showCancelModal && (
        <CancelSaleModal
          saleId={sale.id}
          saleFolio={sale.folio}
          saleTotal={sale.total}
          userRole={userRole}
          onCancelled={() => router.refresh()}
          onClose={() => setShowCancelModal(false)}
        />
      )}

      {/* Header card */}
      <div
        className="rounded-[var(--r-xl)] p-6 mb-4"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {/* Folio + badges */}
        <div className="flex flex-wrap items-center gap-3 mb-4">
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.75rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--on-surf)",
            }}
          >
            {sale.folio}
          </h1>
          <SaleStatusBadge status={sale.status} />
          <OrderTypeBadge type={sale.orderType} />
        </div>

        {/* Meta row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <MetaItem
            icon={<Tag className="w-3.5 h-3.5" />}
            label="Vendedor"
            value={sale.seller}
          />
          <MetaItem
            icon={<Calendar className="w-3.5 h-3.5" />}
            label="Fecha"
            value={formatDate(sale.createdAt)}
          />
          {sale.customer && (
            <MetaItem
              icon={<User className="w-3.5 h-3.5" />}
              label="Cliente"
              value={sale.customer.name}
            />
          )}
        </div>

        {/* Warranty pending notice */}
        {!sale.warrantyDocReady && (
          <div
            className="flex items-center gap-2 mt-4 px-3 py-2 rounded-[var(--r-md)] text-sm font-medium w-fit"
            style={{
              background: "color-mix(in srgb, var(--warn) 12%, transparent)",
              color: "var(--warn)",
            }}
          >
            <FileText className="w-4 h-4 shrink-0" />
            Póliza pendiente de reensamble
          </div>
        )}
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
          Artículos ({sale.items.length})
        </h2>

        <div className="space-y-2">
          {sale.items.map((item) => {
            const name = item.isFreeForm
              ? (item.description ?? "Producto libre")
              : item.productVariant
              ? `${item.productVariant.modeloNombre} ${item.productVariant.colorNombre} ${item.productVariant.voltajeLabel}`
              : (item.description ?? "Producto");
            const subtotal = item.price * item.quantity;

            return (
              <div
                key={item.id}
                className="flex items-center justify-between px-4 py-3 rounded-[var(--r-lg)]"
                style={{ background: "var(--surf-low)" }}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate" style={{ color: "var(--on-surf)" }}>
                    {name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                    {item.quantity} × {formatMXN(item.price)}
                    {item.discount > 0 && (
                      <span style={{ color: "var(--ter)", marginLeft: "0.4rem" }}>
                        −{formatMXN(item.discount)}
                      </span>
                    )}
                  </p>
                </div>
                <p
                  className="text-sm font-bold ml-4 shrink-0"
                  style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
                >
                  {formatMXN(subtotal)}
                </p>
              </div>
            );
          })}
        </div>

        {/* Total */}
        <div
          className="flex items-center justify-between px-4 py-3 mt-3 rounded-[var(--r-lg)]"
          style={{ background: "var(--surf-high)" }}
        >
          <p className="text-sm font-semibold" style={{ color: "var(--on-surf-var)" }}>
            Total
          </p>
          <p
            className="text-lg font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
          >
            {formatMXN(sale.total)}
          </p>
        </div>
      </div>

      {/* Reensamble section — only if there are voltage-change assembly orders */}
      {reensambleOrders.length > 0 && (
        <div
          className="rounded-[var(--r-xl)] p-6 mb-4"
          style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
          <div className="flex items-center justify-between mb-4">
            <h2
              className="text-xs font-semibold uppercase tracking-widest flex items-center gap-1.5"
              style={{ color: "var(--on-surf-var)" }}
            >
              <Zap className="w-3.5 h-3.5" />
              Estado de reensamble ({reensambleOrders.length})
            </h2>
            <Link
              href="/assembly"
              className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
              style={{ color: "var(--p)" }}
            >
              Ver en montaje
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          <div className="space-y-2">
            {reensambleOrders.map((ao) => (
              <div
                key={ao.id}
                className="flex items-center justify-between px-4 py-3 rounded-[var(--r-lg)]"
                style={{ background: "var(--surf-low)" }}
              >
                <div>
                  <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                    {ao.customerBike?.serialNumber ?? "VIN no asignado"}
                  </p>
                  {ao.customerBike?.voltaje && (
                    <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                      Voltaje actual: {ao.customerBike.voltaje}
                    </p>
                  )}
                </div>
                <AssemblyStatusBadge status={ao.status} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Customer */}
      {sale.customer && (
        <div
          className="rounded-[var(--r-xl)] p-6"
          style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
          <h2
            className="text-xs font-semibold uppercase tracking-widest mb-4 flex items-center gap-1.5"
            style={{ color: "var(--on-surf-var)" }}
          >
            <User className="w-3.5 h-3.5" />
            Cliente
          </h2>

          <div className="space-y-2">
            <div
              className="px-4 py-3 rounded-[var(--r-lg)]"
              style={{ background: "var(--surf-low)" }}
            >
              <p className="text-sm font-semibold" style={{ color: "var(--on-surf)" }}>
                {sale.customer.name}
              </p>
            </div>

            {sale.customer.phone && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-[var(--r-lg)]"
                style={{ background: "var(--surf-low)" }}
              >
                <Phone className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--on-surf-var)" }} />
                <p className="text-sm" style={{ color: "var(--on-surf)" }}>
                  {sale.customer.phone}
                </p>
              </div>
            )}

            {sale.customer.email && (
              <div
                className="flex items-center gap-2 px-4 py-3 rounded-[var(--r-lg)]"
                style={{ background: "var(--surf-low)" }}
              >
                <Mail className="w-3.5 h-3.5 shrink-0" style={{ color: "var(--on-surf-var)" }} />
                <p className="text-sm" style={{ color: "var(--on-surf)" }}>
                  {sale.customer.email}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
