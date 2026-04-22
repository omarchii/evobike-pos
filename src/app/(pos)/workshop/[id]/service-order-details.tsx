"use client";

import { useState } from "react";
import type { ServiceOrderStatus, ServiceOrderType, PaymentMethod } from "@prisma/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
  Bike,
  Wrench,
  User as UserIcon,
  Calendar,
  Trash2,
  Plus,
  ArrowRight,
  CheckCircle2,
  Check,
  ChevronsUpDown,
  ArrowUpRight,
} from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ChargeModal } from "./charge-modal";
import { DeliverModal } from "./deliver-modal";
import { QaPanel } from "./qa-panel";
import { PrepaidCard } from "./prepaid-card";

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
  hasCashSession,
  userRole,
}: {
  order: FullSerializedOrder;
  catalogProducts: SerializedProduct[];
  hasCashSession: boolean;
  userRole: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isAdvancing, setIsAdvancing] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);
  const [chargeOpen, setChargeOpen] = useState(false);
  const [deliverOpen, setDeliverOpen] = useState(false);

  // Add item states
  const [manualDescription, setManualDescription] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productQty, setProductQty] = useState("1");

  const isClosed = order.status === "DELIVERED" || order.status === "CANCELLED";
  const isManager = userRole === "MANAGER" || userRole === "ADMIN";

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleAddManualService = async () => {
    if (!manualDescription || !manualPrice) return;
    setLoading(true);
    toast.loading("Agregando servicio...", { id: "add-item" });
    const result = await fetch(`/api/workshop/orders/${order.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: manualDescription,
        quantity: 1,
        price: parseFloat(manualPrice),
      }),
    }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);
    if (result.success) {
      toast.success("Servicio agregado", { id: "add-item" });
      setManualDescription("");
      setManualPrice("");
      router.refresh();
    } else {
      toast.error(result.error ?? "No se pudo agregar", { id: "add-item" });
    }
    setLoading(false);
  };

  const handleAddProduct = async () => {
    if (!selectedProductId) return;
    const prod = catalogProducts.find((p) => p.id === selectedProductId);
    if (!prod) return;
    setLoading(true);
    toast.loading("Agregando refacción...", { id: "add-item" });
    const result = await fetch(`/api/workshop/orders/${order.id}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productVariantId: prod.id,
        description: prod.name,
        quantity: parseInt(productQty) || 1,
        price: prod.price,
      }),
    }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);
    if (result.success) {
      toast.success("Refacción agregada", { id: "add-item" });
      setSelectedProductId("");
      setProductQty("1");
      router.refresh();
    } else {
      toast.error(result.error ?? "No se pudo agregar", { id: "add-item" });
    }
    setLoading(false);
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm("¿Eliminar este concepto?")) return;
    setLoading(true);
    toast.loading("Eliminando...", { id: "remove-item" });
    const result = await fetch(`/api/workshop/orders/${order.id}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);
    if (result.success) {
      toast.success("Concepto eliminado", { id: "remove-item" });
      router.refresh();
    } else {
      toast.error(result.error ?? "No se pudo eliminar", { id: "remove-item" });
    }
    setLoading(false);
  };

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

            {/* Add item form (only if not closed) */}
            {!isClosed && (
              <div
                className="mx-6 mb-5 p-4 rounded-xl space-y-4"
                style={{ background: "var(--surf-low)" }}
              >
                {/* Manual service */}
                <div>
                  <p
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 500,
                      color: "var(--on-surf-var)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Mano de obra / Servicio
                  </p>
                  <div className="flex gap-2">
                    <input
                      placeholder="Descripción del trabajo"
                      value={manualDescription}
                      onChange={(e) => setManualDescription(e.target.value)}
                      style={{
                        flex: 1,
                        background: "var(--surf-lowest)",
                        border: "none",
                        borderRadius: "var(--r-md)",
                        color: "var(--on-surf)",
                        fontFamily: "var(--font-body)",
                        fontSize: "0.8125rem",
                        height: 38,
                        paddingLeft: "0.75rem",
                        paddingRight: "0.75rem",
                        outline: "none",
                      }}
                    />
                    <input
                      type="number"
                      placeholder="$ Precio"
                      value={manualPrice}
                      onChange={(e) => setManualPrice(e.target.value)}
                      style={{
                        width: 110,
                        background: "var(--surf-lowest)",
                        border: "none",
                        borderRadius: "var(--r-md)",
                        color: "var(--on-surf)",
                        fontFamily: "var(--font-body)",
                        fontSize: "0.8125rem",
                        height: 38,
                        paddingLeft: "0.75rem",
                        paddingRight: "0.75rem",
                        outline: "none",
                      }}
                    />
                    <button
                      onClick={handleAddManualService}
                      disabled={loading}
                      className="flex items-center justify-center transition-opacity disabled:opacity-50"
                      style={{
                        background: "var(--surf-highest)",
                        color: "var(--p)",
                        border: "none",
                        borderRadius: "var(--r-md)",
                        width: 38,
                        height: 38,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>

                {/* Product from inventory */}
                <div>
                  <p
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 500,
                      color: "var(--on-surf-var)",
                      marginBottom: "0.5rem",
                    }}
                  >
                    Refacción de inventario
                  </p>
                  <div className="flex gap-2">
                    <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                      <PopoverTrigger asChild>
                        <button
                          className="flex items-center justify-between flex-1 text-sm transition-colors"
                          style={{
                            background: "var(--surf-lowest)",
                            border: "none",
                            borderRadius: "var(--r-md)",
                            color: selectedProductId ? "var(--on-surf)" : "var(--on-surf-var)",
                            fontFamily: "var(--font-body)",
                            height: 38,
                            paddingLeft: "0.75rem",
                            paddingRight: "0.75rem",
                            cursor: "pointer",
                          }}
                        >
                          <span className="text-left truncate text-sm">
                            {selectedProductId
                              ? catalogProducts.find((p) => p.id === selectedProductId)?.name
                              : "Elegir pieza..."}
                          </span>
                          <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
                        </button>
                      </PopoverTrigger>
                      <PopoverContent
                        className="w-[320px] p-0"
                        align="start"
                        style={{ borderRadius: "var(--r-lg)" }}
                      >
                        <Command>
                          <CommandInput placeholder="Buscar por nombre o SKU..." />
                          <CommandList>
                            <CommandEmpty>No se encontraron piezas.</CommandEmpty>
                            <CommandGroup>
                              {catalogProducts.map((p) => (
                                <CommandItem
                                  key={p.id}
                                  value={`${p.name} ${p.sku}`}
                                  onSelect={() => {
                                    setSelectedProductId(
                                      p.id === selectedProductId ? "" : p.id
                                    );
                                    setOpenCombobox(false);
                                  }}
                                >
                                  <Check
                                    className={cn(
                                      "mr-2 h-4 w-4",
                                      selectedProductId === p.id ? "opacity-100" : "opacity-0"
                                    )}
                                  />
                                  <div className="flex flex-col">
                                    <span className="text-sm">{p.name}</span>
                                    <span className="text-xs opacity-50 font-mono">
                                      {p.sku} · {formatMXN(p.price)}
                                    </span>
                                  </div>
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                    <input
                      type="number"
                      min="1"
                      placeholder="Cant."
                      value={productQty}
                      onChange={(e) => setProductQty(e.target.value)}
                      style={{
                        width: 70,
                        background: "var(--surf-lowest)",
                        border: "none",
                        borderRadius: "var(--r-md)",
                        color: "var(--on-surf)",
                        fontFamily: "var(--font-body)",
                        fontSize: "0.8125rem",
                        height: 38,
                        paddingLeft: "0.75rem",
                        paddingRight: "0.75rem",
                        outline: "none",
                        textAlign: "center",
                      }}
                    />
                    <button
                      onClick={handleAddProduct}
                      disabled={loading || !selectedProductId}
                      className="flex items-center justify-center transition-opacity disabled:opacity-50"
                      style={{
                        background: "var(--surf-highest)",
                        color: "var(--p)",
                        border: "none",
                        borderRadius: "var(--r-md)",
                        width: 38,
                        height: 38,
                        cursor: "pointer",
                        flexShrink: 0,
                      }}
                    >
                      <Plus className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items table (The Power Grid) */}
            <div className="px-6 pb-6">
              {/* Table header */}
              <div
                className="grid grid-cols-12 pb-2 mb-1"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--on-surf-var)",
                  borderBottom: "1px solid var(--ghost-border)",
                }}
              >
                <span className="col-span-6">Descripción</span>
                <span className="col-span-2 text-center">Cant.</span>
                <span className="col-span-2 text-right">P. Unit.</span>
                <span className="col-span-2 text-right">Importe</span>
              </div>

              {/* Rows */}
              {order.items.length === 0 ? (
                <p
                  className="py-8 text-center"
                  style={{ fontSize: "0.8125rem", color: "var(--on-surf-var)" }}
                >
                  No hay cargos registrados aún.
                </p>
              ) : (
                order.items.map((item) => (
                  <div
                    key={item.id}
                    className="grid grid-cols-12 items-center py-2.5 group rounded-lg transition-colors"
                    style={{ fontSize: "0.8125rem", color: "var(--on-surf)" }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "var(--surf-high)")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = "transparent")
                    }
                  >
                    <div className="col-span-6 flex items-center gap-2 pl-1 pr-2">
                      <span className="truncate">{item.description}</span>
                      {item.productVariant && (
                        <span
                          className="shrink-0"
                          style={{
                            fontSize: "0.5625rem",
                            fontWeight: 500,
                            letterSpacing: "0.04em",
                            textTransform: "uppercase",
                            color: "var(--on-surf-var)",
                            background: "var(--surf-high)",
                            borderRadius: "var(--r-sm)",
                            padding: "1px 6px",
                          }}
                        >
                          {item.productVariant.sku}
                        </span>
                      )}
                    </div>
                    <span className="col-span-2 text-center">{item.quantity}</span>
                    <span className="col-span-2 text-right">{formatMXN(item.price)}</span>
                    <div className="col-span-2 flex items-center justify-end gap-1">
                      <span className="font-medium">
                        {formatMXN(item.quantity * item.price)}
                      </span>
                      {!isClosed && (
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          disabled={loading}
                          className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--ter)",
                            cursor: "pointer",
                            padding: "2px",
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}

              {/* Total */}
              {order.items.length > 0 && (
                <div
                  className="flex justify-end mt-4 pt-4"
                  style={{ borderTop: "1px solid var(--ghost-border)" }}
                >
                  <div className="space-y-1 text-right">
                    <div
                      style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}
                    >
                      Subtotal:{" "}
                      <span style={{ color: "var(--on-surf)" }}>
                        {formatMXN(order.subtotal)}
                      </span>
                    </div>
                    <div
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "1.5rem",
                        fontWeight: 700,
                        color: "var(--on-surf)",
                        letterSpacing: "-0.01em",
                      }}
                    >
                      Total: {formatMXN(order.total)}
                    </div>
                  </div>
                </div>
              )}
            </div>
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
                    background: "linear-gradient(135deg, #1b4332, #2ecc71)",
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

                {!hasCashSession && !order.prepaid && (
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

                {/* Cobrar ahora — only when not prepaid and has cash session */}
                {!order.prepaid && (
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

                {/* Entregar (y cobrar) */}
                <button
                  onClick={() => setDeliverOpen(true)}
                  disabled={!order.prepaid && !hasCashSession}
                  title={
                    !order.prepaid && !hasCashSession
                      ? "Abre una caja primero"
                      : undefined
                  }
                  className="w-full flex items-center justify-center gap-2 font-semibold text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{
                    background:
                      !order.prepaid && !hasCashSession
                        ? "var(--surf-high)"
                        : "linear-gradient(135deg, #1b4332, #2ecc71)",
                    color:
                      !order.prepaid && !hasCashSession ? "var(--p)" : "#ffffff",
                    borderRadius: "var(--r-full)",
                    border: "none",
                    height: 44,
                    cursor:
                      !order.prepaid && !hasCashSession ? "not-allowed" : "pointer",
                  }}
                >
                  <ArrowRight className="h-4 w-4" />
                  {order.prepaid ? "Entregar" : "Entregar y cobrar"}
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
