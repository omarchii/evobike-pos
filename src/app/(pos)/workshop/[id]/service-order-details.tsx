"use client";

import { useMemo, useState } from "react";
import type { ServiceOrderStatus, ServiceOrderType, PaymentMethod } from "@prisma/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Bike,
  Wrench,
  User as UserIcon,
  Calendar,
  ArrowRight,
  CheckCircle2,
  ArrowUpRight,
  MessageSquare,
  Download,
} from "lucide-react";
import { openPDFInNewTab } from "@/lib/pdf-client";
import { ChargeModal } from "./charge-modal";
import { DeliverModal } from "./deliver-modal";
import { QaPanel } from "./qa-panel";
import { PrepaidCard } from "./prepaid-card";
import { ApprovalsList, type SerializedApproval } from "./approvals-list";
import { ApprovalDrawer } from "./approval-drawer";
import { AddItemForm } from "./add-item-form";
import { ItemsTable } from "./items-table";
import { useStockAvailability } from "@/hooks/use-stock-availability";

// ── Types ─────────────────────────────────────────────────────────────────────
export type SerializedProduct = {
  id: string;
  sku: string;
  name: string;
  price: number;
};

export type SerializedOrderItem = {
  id: string;
  serviceOrderId: string;
  productVariantId: string | null;
  inventoryMovementId: string | null;
  description: string;
  quantity: number;
  price: number;
  productVariant: SerializedProduct | null;
};

export type SerializedSale = {
  id: string;
  folio: string;
  total: number;
  status: string;
};

export type FullSerializedOrder = {
  id: string;
  folio: string;
  status: ServiceOrderStatus;
  type: ServiceOrderType;
  customerId: string;
  bikeInfo: string | null;
  diagnosis: string | null;
  subtotal: number;
  total: number;
  prepaid: boolean;
  prepaidAt: string | null;
  prepaidAmount: number | null;
  prepaidMethod: PaymentMethod | null;
  qaPassedAt: string | null;
  qaPassedByName: string | null;
  qaNotes: string | null;
  createdAt: Date;
  customer: { name: string; phone: string | null };
  user: { name: string };
  customerBike: {
    serialNumber: string;
    voltaje: string | null;
    brand: string | null;
    model: string | null;
    color: string | null;
  } | null;
  items: SerializedOrderItem[];
  sale: SerializedSale | null;
};

// ── Design helpers ─────────────────────────────────────────────────────────────
function StatusChip({ status }: { status: ServiceOrderStatus }) {
  const configs: Record<ServiceOrderStatus, { label: string; bg: string; color: string }> = {
    PENDING:     { label: "En espera",   bg: "var(--warn-container)",  color: "var(--warn)" },
    IN_PROGRESS: { label: "En proceso",  bg: "var(--warn-container)",  color: "var(--warn)" },
    COMPLETED:   { label: "Completado",  bg: "var(--sec-container)",   color: "var(--on-sec-container)" },
    DELIVERED:   { label: "Entregado",   bg: "var(--sec-container)",   color: "var(--on-sec-container)" },
    CANCELLED:   { label: "Cancelado",   bg: "var(--ter-container)",   color: "var(--on-ter-container)" },
  };
  const cfg = configs[status];
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        borderRadius: 9999,
        padding: "0.2rem 0.65rem",
        fontSize: "0.625rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase" as const,
        fontFamily: "var(--font-body)",
      }}
    >
      {cfg.label}
    </span>
  );
}

function PrepaidChip() {
  return (
    <span
      style={{
        background: "var(--p-container)",
        color: "var(--on-p-container)",
        borderRadius: 9999,
        padding: "0.2rem 0.65rem",
        fontSize: "0.625rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase" as const,
        fontFamily: "var(--font-body)",
      }}
    >
      Pre-pagado
    </span>
  );
}

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(d: Date) {
  return new Date(d).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ── Main component ─────────────────────────────────────────────────────────────
export function ServiceOrderDetailsView({
  order,
  catalogProducts,
  approvals,
  hasCashSession,
  userRole,
}: {
  order: FullSerializedOrder;
  catalogProducts: SerializedProduct[];
  approvals: SerializedApproval[];
  hasCashSession: boolean;
  userRole: string;
}) {
  const router = useRouter();
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);
  const [approvalOpen, setApprovalOpen] = useState(false);

  const isClosed = order.status === "DELIVERED" || order.status === "CANCELLED";
  const isManager = userRole === "MANAGER" || userRole === "ADMIN";
  // Única rama que requiere caja abierta + form de pago. WARRANTY/COURTESY/
  // POLICY_MAINTENANCE entregan sin cobro; PAID prepaid reusa la Sale existente.
  const needsCashFlow = order.type === "PAID" && !order.prepaid;
  // Gate PDF (E.4): mismo criterio en endpoint y UI.
  const canDownloadPdf =
    order.status === "DELIVERED" ||
    (order.status === "COMPLETED" && order.prepaid);
  const handleDownloadPDF = () =>
    openPDFInNewTab(`/api/service-orders/${order.id}/pdf`);

  // ── Stock polling (D.3a) ──
  // Una sola invocación del hook compartida entre AddItemForm e ItemsTable
  // (el hook deduplica internamente por key=ids ordenados, así que invocarlo
  // dos veces con la misma lista no duplicaría requests, pero pasarlo por
  // props es más explícito y deja un único punto de control).
  const stockIds = useMemo(() => {
    const fromItems = order.items
      .map((i) => i.productVariantId)
      .filter((x): x is string => !!x);
    return Array.from(new Set(fromItems));
  }, [order.items]);
  const stockMap = useStockAvailability(stockIds);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAdvanceStatus = async () => {
    setIsAdvancing(true);
    const result = await fetch(`/api/workshop/orders/${order.id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentStatus: order.status }),
    }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);
    if (result.success) {
      toast.success("Estado actualizado");
      router.refresh();
    } else {
      toast.error(result.error ?? "Error al actualizar");
    }
    setIsAdvancing(false);
  };

  const handleCancel = async () => {
    const motivo = prompt("Motivo de cancelación (obligatorio):");
    if (!motivo?.trim()) return;
    toast.loading("Cancelando...", { id: "cancel" });
    const res = await fetch(`/api/service-orders/${order.id}/cancel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ motivo }),
    });
    const data = (await res.json()) as { success: boolean; error?: string };
    if (data.success) {
      toast.success("Orden cancelada", { id: "cancel" });
      router.refresh();
    } else {
      toast.error(data.error ?? "Error al cancelar", { id: "cancel" });
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────────
  return (
    <>
      {/* ── Header ── */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-3 flex-wrap">
            <span
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.75rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--on-surf)",
              }}
            >
              {order.folio}
            </span>
            <StatusChip status={order.status} />
            {order.prepaid && <PrepaidChip />}
          </div>
          <div
            className="flex items-center gap-4 flex-wrap"
            style={{ fontSize: "0.8125rem", color: "var(--on-surf-var)" }}
          >
            <span className="flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5" />
              {order.customer.name}
            </span>
            {order.customerBike && (
              <span className="flex items-center gap-1.5">
                <Bike className="h-3.5 w-3.5" />
                {order.bikeInfo ??
                  (() => {
                    const parts = [
                      order.customerBike.brand,
                      order.customerBike.model,
                      order.customerBike.color,
                    ]
                      .map((p) => p?.trim())
                      .filter((p): p is string => !!p);
                    const vin = order.customerBike.serialNumber?.trim();
                    const base = parts.join(" ");
                    if (base && vin) return `${base} — VIN: ${vin}`;
                    if (vin) return `VIN: ${vin}`;
                    return base || "Bicicleta sin datos";
                  })()}
              </span>
            )}
          </div>
        </div>

        {/* Header actions */}
        <div className="flex items-center gap-2 flex-wrap">
          {!isClosed && isManager && (
            <button
              onClick={handleCancel}
              className="text-xs font-medium px-4 py-2 transition-colors"
              style={{
                background: "var(--ter-container)",
                color: "var(--on-ter-container)",
                borderRadius: "var(--r-full)",
                border: "none",
                cursor: "pointer",
              }}
            >
              Cancelar orden
            </button>
          )}
        </div>
      </div>

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mt-2">
        {/* Left 8/12: Items + add form */}
        <div className="lg:col-span-8 space-y-6">
          {/* Items section */}
          <div
            className="rounded-2xl"
            style={{
              background: "var(--surf-lowest)",
              boxShadow: "var(--shadow)",
            }}
          >
            {/* Section header */}
            <div className="px-6 pt-5 pb-4">
              <h2
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--on-surf-var)",
                }}
              >
                Servicios y refacciones
              </h2>
            </div>

            {/* Add item form (D.3a — extraído) */}
            {!isClosed && (
              <AddItemForm
                orderId={order.id}
                catalogProducts={catalogProducts}
                stockMap={stockMap}
              />
            )}

            {/* Items table (D.3a — extraído) */}
            <ItemsTable
              orderId={order.id}
              items={order.items}
              subtotal={order.subtotal}
              total={order.total}
              stockMap={stockMap}
              isClosed={isClosed}
            />

          </div>
        </div>

        {/* Right 4/12: Action panel + info */}
        <div className="lg:col-span-4 space-y-4">
          {/* ── Action panel ── */}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: "var(--surf-lowest)",
              boxShadow: "var(--shadow)",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--on-surf-var)",
              }}
            >
              Estado de pago
            </h2>

            {/* PENDING | IN_PROGRESS: advance status button */}
            {(order.status === "PENDING" || order.status === "IN_PROGRESS") && (
              <>
                <p style={{ fontSize: "0.8125rem", color: "var(--on-surf-var)" }}>
                  {order.status === "PENDING"
                    ? "La orden está en espera de iniciar."
                    : "El técnico está trabajando en la reparación."}
                </p>
                <button
                  onClick={handleAdvanceStatus}
                  disabled={isAdvancing}
                  className="w-full flex items-center justify-center gap-2 font-semibold text-sm transition-opacity disabled:opacity-50"
                  style={{
                    background: "var(--velocity-gradient)",
                    color: "#ffffff",
                    borderRadius: "var(--r-full)",
                    border: "none",
                    height: 44,
                    cursor: isAdvancing ? "not-allowed" : "pointer",
                  }}
                >
                  {order.status === "PENDING" ? (
                    <>
                      <Wrench className="h-4 w-4" />
                      {isAdvancing ? "Actualizando..." : "Iniciar reparación"}
                    </>
                  ) : (
                    <>
                      <CheckCircle2 className="h-4 w-4" />
                      {isAdvancing ? "Actualizando..." : "Marcar como completado"}
                    </>
                  )}
                </button>
              </>
            )}

            {/* COMPLETED: charge / deliver buttons */}
            {order.status === "COMPLETED" && (
              <>
                {/* Pre-pago info: ahora vive en <PrepaidCard /> abajo. */}

                {needsCashFlow && !hasCashSession && (
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--warn)",
                      background: "var(--warn-container)",
                      borderRadius: "var(--r-md)",
                      padding: "0.5rem 0.75rem",
                    }}
                  >
                    Abre una caja para poder cobrar.
                  </p>
                )}

                {/* Cobrar ahora — sólo PAID no prepaid con caja abierta.
                    Blindaje UI complementado por guard server-side en /charge. */}
                {needsCashFlow && (
                  <button
                    onClick={() => setChargeOpen(true)}
                    disabled={!hasCashSession}
                    title={!hasCashSession ? "Abre una caja primero" : undefined}
                    className="w-full flex items-center justify-center gap-2 font-semibold text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                    style={{
                      background: "var(--surf-high)",
                      color: "var(--p)",
                      borderRadius: "var(--r-full)",
                      border: "none",
                      height: 44,
                      cursor: hasCashSession ? "pointer" : "not-allowed",
                    }}
                  >
                    Cobrar ahora
                  </button>
                )}

                {/* Entregar (y cobrar). Sólo PAID !prepaid requiere caja. */}
                <button
                  onClick={() => setDeliverOpen(true)}
                  disabled={needsCashFlow && !hasCashSession}
                  title={
                    needsCashFlow && !hasCashSession
                      ? "Abre una caja primero"
                      : undefined
                  }
                  className="w-full flex items-center justify-center gap-2 font-semibold text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background:
                      needsCashFlow && !hasCashSession
                        ? "var(--surf-high)"
                        : "var(--velocity-gradient)",
                    color:
                      needsCashFlow && !hasCashSession ? "var(--p)" : "#ffffff",
                    borderRadius: "var(--r-full)",
                    border: "none",
                    height: 44,
                    cursor:
                      needsCashFlow && !hasCashSession ? "not-allowed" : "pointer",
                  }}
                >
                  <ArrowRight className="h-4 w-4" />
                  {needsCashFlow ? "Entregar y cobrar" : "Entregar"}
                </button>
              </>
            )}

            {/* DELIVERED */}
            {order.status === "DELIVERED" && order.sale && (
              <div
                className="rounded-xl px-4 py-3 space-y-2"
                style={{ background: "var(--sec-container)" }}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2
                    className="h-4 w-4"
                    style={{ color: "var(--sec)" }}
                  />
                  <span
                    style={{
                      fontSize: "0.8125rem",
                      fontWeight: 600,
                      color: "var(--on-sec-container)",
                    }}
                  >
                    Entregado · {formatMXN(order.total)}
                  </span>
                </div>
                <a
                  href={`/ventas/${order.sale.id}`}
                  className="flex items-center gap-1 text-xs font-medium transition-opacity hover:opacity-70"
                  style={{ color: "var(--on-sec-container)" }}
                >
                  Ver venta {order.sale.folio}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            )}

            {/* CANCELLED */}
            {order.status === "CANCELLED" && (
              <div
                className="rounded-xl px-4 py-3"
                style={{ background: "var(--ter-container)" }}
              >
                <p
                  style={{
                    fontSize: "0.8125rem",
                    fontWeight: 600,
                    color: "var(--on-ter-container)",
                  }}
                >
                  Orden cancelada
                </p>
              </div>
            )}

            {/* PDF download (E.4) — gate unificado con el endpoint:
                DELIVERED → "Descargar comprobante"
                COMPLETED && prepaid → "Descargar recibo de pre-pago" */}
            {canDownloadPdf && (
              <button
                onClick={handleDownloadPDF}
                className="w-full flex items-center justify-center gap-2 font-medium text-sm transition-opacity hover:opacity-80"
                style={{
                  background: "var(--surf-high)",
                  color: "var(--p)",
                  borderRadius: "var(--r-full)",
                  border: "1px solid var(--ghost-border)",
                  height: 40,
                  cursor: "pointer",
                }}
              >
                <Download className="h-4 w-4" />
                {order.status === "DELIVERED"
                  ? "Descargar comprobante"
                  : "Descargar recibo de pre-pago"}
              </button>
            )}
          </div>

          {/* ── QA panel (D.1) ── */}
          <QaPanel
            orderId={order.id}
            status={order.status}
            qaPassedAt={order.qaPassedAt}
            qaPassedByName={order.qaPassedByName}
            qaNotes={order.qaNotes}
            userRole={userRole}
          />

          {/* ── Pre-pago card (D.1) ── */}
          <PrepaidCard
            prepaid={order.prepaid}
            prepaidAt={order.prepaidAt}
            prepaidAmount={order.prepaidAmount}
            prepaidMethod={order.prepaidMethod}
          />

          {/* ── Solicitar aprobación (D.2) ──
              Solo en órdenes activas (PENDING/IN_PROGRESS) y para roles con
              permiso (no SELLER, igual que el endpoint POST /approvals). */}
          {!isClosed && order.status !== "COMPLETED" && userRole !== "SELLER" && (
            <button
              onClick={() => setApprovalOpen(true)}
              className="w-full flex items-center justify-center gap-2 rounded-2xl py-3 transition-opacity hover:opacity-90"
              style={{
                background: "var(--surf-lowest)",
                color: "var(--p)",
                boxShadow: "var(--shadow)",
                border: "1px solid var(--ghost-border)",
                fontSize: "0.8125rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <MessageSquare className="h-4 w-4" /> Solicitar aprobación
            </button>
          )}

          {/* ── Lista de aprobaciones (D.2) ── */}
          <ApprovalsList
            orderId={order.id}
            approvals={approvals}
            isClosed={isClosed}
          />

          {/* ── Order info panel ── */}
          <div
            className="rounded-2xl p-5 space-y-4"
            style={{
              background: "var(--surf-lowest)",
              boxShadow: "var(--shadow)",
            }}
          >
            <h2
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--on-surf-var)",
              }}
            >
              Detalles
            </h2>

            <InfoRow icon={<UserIcon className="h-3.5 w-3.5" />} label="Cliente">
              <span style={{ fontSize: "0.8125rem", color: "var(--on-surf)", fontWeight: 500 }}>
                {order.customer.name}
              </span>
              {order.customer.phone && (
                <span style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>
                  {order.customer.phone}
                </span>
              )}
            </InfoRow>

            {order.customerBike && (
              <InfoRow icon={<Bike className="h-3.5 w-3.5" />} label="Vehículo">
                <span style={{ fontSize: "0.8125rem", color: "var(--on-surf)", fontWeight: 500 }}>
                  {order.bikeInfo ?? "Sin especificar"}
                </span>
                {order.customerBike.voltaje && (
                  <span style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>
                    {order.customerBike.voltaje}V · VIN: {order.customerBike.serialNumber}
                  </span>
                )}
              </InfoRow>
            )}

            {order.diagnosis && (
              <InfoRow icon={<Wrench className="h-3.5 w-3.5" />} label="Diagnóstico">
                <span style={{ fontSize: "0.8125rem", color: "var(--on-surf)", fontStyle: "italic" }}>
                  {order.diagnosis}
                </span>
              </InfoRow>
            )}

            <InfoRow icon={<Calendar className="h-3.5 w-3.5" />} label="Ingreso">
              <span style={{ fontSize: "0.8125rem", color: "var(--on-surf)" }}>
                {formatDate(order.createdAt)}
              </span>
              <span style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>
                Atendido por: {order.user.name}
              </span>
            </InfoRow>
          </div>
        </div>
      </div>

      {/* ── Modals ── */}
      <ChargeModal
        open={chargeOpen}
        onOpenChange={setChargeOpen}
        orderId={order.id}
        total={order.total}
      />
      <DeliverModal
        open={deliverOpen}
        onOpenChange={setDeliverOpen}
        orderId={order.id}
        total={order.total}
        prepaid={order.prepaid}
        type={order.type}
      />
      <ApprovalDrawer
        open={approvalOpen}
        onOpenChange={setApprovalOpen}
        orderId={order.id}
        customerName={order.customer.name}
        customerHasPhone={!!order.customer.phone}
      />
    </>
  );
}

// ── Tiny helper ────────────────────────────────────────────────────────────────
function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3">
      <span className="mt-0.5 shrink-0" style={{ color: "var(--on-surf-var)" }}>
        {icon}
      </span>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span
          style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--on-surf-var)",
          }}
        >
          {label}
        </span>
        {children}
      </div>
    </div>
  );
}
