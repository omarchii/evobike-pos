"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ShoppingBag,
  Bookmark,
  Truck,
  Info,
  Loader2,
  User,
  Check,
  SplitSquareVertical,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMXN } from "@/lib/quotations";
import PriceDriftAlert, { type DriftItem, type Manager } from "./price-drift-alert";
import CustomerSelectorModal from "@/app/(pos)/point-of-sale/customer-selector-modal";
import type { CustomerOption } from "@/app/(pos)/point-of-sale/customer-selector-modal";

// ── Design tokens ────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  fontSize: "0.875rem",
  height: 44,
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  width: "100%",
  outline: "none",
};

// ── Types ────────────────────────────────────────────────────────────────────

type TargetType = "SALE" | "LAYAWAY" | "BACKORDER";
type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE" | "ATRATO";

const PAYMENT_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  CREDIT_BALANCE: "Crédito",
  ATRATO: "ATRATO",
};

const ALL_METHODS: PaymentMethod[] = ["CASH", "CARD", "TRANSFER", "CREDIT_BALANCE", "ATRATO"];

interface QuotationSummary {
  id: string;
  folio: string;
  branchId: string;
  branchName: string;
  subtotal: number;
  discountAmount: number;
  total: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  customerEmail: string | null;
  anonymousCustomerName: string | null;
  anonymousCustomerPhone: string | null;
  itemCount: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  quotation: QuotationSummary;
  managers: Manager[];
  customers: CustomerOption[];
  currentUserBranchId: string;
  currentUserBranchName: string;
}

// ── Component ────────────────────────────────────────────────────────────────

export default function ConvertQuotationDialog({
  open,
  onClose,
  quotation,
  managers,
  customers,
  currentUserBranchId,
  currentUserBranchName,
}: Props) {
  const router = useRouter();

  // Price drift
  const [drifts, setDrifts] = useState<DriftItem[]>([]);
  const [driftsLoading, setDriftsLoading] = useState(true);
  const [useOriginalPrices, setUseOriginalPrices] = useState(false);
  const [priceOverrideAuthorizedById, setPriceOverrideAuthorizedById] = useState<string | null>(null);

  // Step 2 — modality
  const [targetType, setTargetType] = useState<TargetType | null>(null);

  // Step 3 — customer
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(null);
  const [customerSelectorOpen, setCustomerSelectorOpen] = useState(false);

  // Step 4 — payment
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [secondaryMethod, setSecondaryMethod] = useState<PaymentMethod>("CARD");
  const [secondaryAmount, setSecondaryAmount] = useState<string>("");

  // Submit
  const [submitting, setSubmitting] = useState(false);

  // Preload price-check when dialog opens
  useEffect(() => {
    if (!open) return;

    setDriftsLoading(true);
    setDrifts([]);
    setUseOriginalPrices(false);
    setPriceOverrideAuthorizedById(null);
    setTargetType(null);
    setSelectedCustomer(
      quotation.customerId
        ? {
            id: quotation.customerId,
            name: quotation.customerName ?? "",
            phone: quotation.customerPhone,
            phone2: null,
            email: quotation.customerEmail,
            balance: 0,
            creditLimit: 0,
          }
        : null
    );
    setPaymentAmount("");
    setIsSplitPayment(false);
    setSecondaryAmount("");

    fetch(`/api/cotizaciones/${quotation.id}/price-check`)
      .then((r) => r.json())
      .then((data: { success: boolean; data?: DriftItem[] }) => {
        if (data.success && data.data) {
          // Only keep items with actual drift
          const withDrift = data.data.filter((d) => d.drift !== "none");
          setDrifts(withDrift);
        }
      })
      .catch(() => {
        // Non-blocking: if price-check fails, proceed without drift info
      })
      .finally(() => setDriftsLoading(false));
  }, [open, quotation]);

  // Pre-fill payment amount with quotation total when modality changes
  useEffect(() => {
    if (targetType === "SALE") {
      setPaymentAmount(String(quotation.total));
    } else {
      setPaymentAmount("");
    }
    setIsSplitPayment(false);
    setSecondaryAmount("");
  }, [targetType, quotation.total]);

  // Cross-branch info
  const crossBranch = quotation.branchId !== currentUserBranchId;

  // Determine step numbers (step 1 is price drift, only shown if there are drifts)
  const hasDrift = drifts.length > 0;
  const step2Num = hasDrift ? 2 : 1;
  const step3Num = hasDrift ? 3 : 2;
  const step4Num = hasDrift ? 4 : 3;

  // Validation for footer
  const paymentAmountNum = parseFloat(paymentAmount) || 0;
  const secondaryAmountNum = parseFloat(secondaryAmount) || 0;
  const totalAmount = isSplitPayment ? paymentAmountNum + secondaryAmountNum : paymentAmountNum;

  const needsAuth =
    useOriginalPrices && drifts.some((d) => d.drift === "higher");

  const canSubmit =
    !submitting &&
    !driftsLoading &&
    targetType !== null &&
    selectedCustomer !== null &&
    paymentAmountNum > 0 &&
    (targetType === "SALE" ? totalAmount >= quotation.total : totalAmount > 0) &&
    (!needsAuth || !!priceOverrideAuthorizedById);

  async function handleSubmit() {
    if (!canSubmit || !targetType || !selectedCustomer) return;
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cotizaciones/${quotation.id}/convert`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          targetType,
          customerId: selectedCustomer.id,
          paymentMethod,
          paymentAmount: paymentAmountNum,
          isSplitPayment: isSplitPayment && secondaryAmountNum > 0,
          secondaryPaymentMethod: isSplitPayment ? secondaryMethod : undefined,
          secondaryPaymentAmount: isSplitPayment ? secondaryAmountNum : undefined,
          useOriginalPrices,
          priceOverrideAuthorizedById: priceOverrideAuthorizedById ?? undefined,
        }),
      });

      const data: {
        success: boolean;
        data?: { saleId: string; saleFolio: string; targetType: string };
        error?: string;
      } = await res.json();

      if (!data.success || !data.data) {
        throw new Error(data.error ?? "Error al convertir la cotización");
      }

      toast.success(`Cotización convertida exitosamente — Folio: ${data.data.saleFolio}`);
      onClose();

      // Redirect: pedidos have a detail page; for direct sales redirect to cotización (shows conversion info)
      if (data.data.targetType === "SALE") {
        router.push(`/cotizaciones/${quotation.id}`);
      } else {
        router.push(`/pedidos/${data.data.saleId}`);
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al convertir la cotización");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v && !submitting) onClose(); }}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden max-w-3xl max-h-[90vh] flex flex-col"
          style={{
            background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "var(--shadow)",
            borderRadius: "var(--r-xl)",
          }}
        >
          {/* Header — fijo */}
          <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
            <DialogTitle
              className="text-xl"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              Convertir Cotización
            </DialogTitle>
            <p className="text-xs mt-1" style={{ color: "var(--on-surf-var)" }}>
              {quotation.folio} · {quotation.itemCount} producto{quotation.itemCount !== 1 ? "s" : ""}
            </p>
          </DialogHeader>

          {/* Body — scrolleable */}
          <div className="flex-1 overflow-y-auto px-6 pb-4 space-y-8">
            {/* Loading state */}
            {driftsLoading && (
              <div className="flex items-center gap-2 py-4" style={{ color: "var(--on-surf-var)" }}>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Verificando precios...</span>
              </div>
            )}

            {/* STEP 1 — Price drift (only if there are drifts) */}
            {!driftsLoading && hasDrift && (
              <PriceDriftAlert
                drifts={drifts}
                useOriginalPrices={useOriginalPrices}
                onUseOriginalPricesChange={setUseOriginalPrices}
                authorizedById={priceOverrideAuthorizedById}
                onAuthorizedByIdChange={setPriceOverrideAuthorizedById}
                managers={managers}
              />
            )}

            {/* STEP 2 — Modality */}
            {!driftsLoading && (
              <div className="space-y-4">
                <StepHeader number={step2Num} title="Seleccionar Modalidad" />
                <div className="grid grid-cols-3 gap-3">
                  <ModalityCard
                    selected={targetType === "SALE"}
                    onSelect={() => setTargetType("SALE")}
                    icon={ShoppingBag}
                    title="Venta directa"
                    subtitle="Pago completo, entrega inmediata"
                  />
                  <ModalityCard
                    selected={targetType === "LAYAWAY"}
                    onSelect={() => setTargetType("LAYAWAY")}
                    icon={Bookmark}
                    title="Pedido Layaway"
                    subtitle="Anticipo + abonos posteriores"
                  />
                  <ModalityCard
                    selected={targetType === "BACKORDER"}
                    onSelect={() => setTargetType("BACKORDER")}
                    icon={Truck}
                    title="Pedido Backorder"
                    subtitle="Anticipo + espera de llegada"
                  />
                </div>
              </div>
            )}

            {/* STEP 3 — Customer + Branch */}
            {!driftsLoading && (
              <div className="space-y-4">
                <StepHeader number={step3Num} title="Cliente y Sucursal" />

                {/* Customer */}
                {selectedCustomer ? (
                  <div
                    className="flex items-center gap-3 rounded-2xl p-4"
                    style={{ background: "var(--surf-low)" }}
                  >
                    <CustomerAvatar name={selectedCustomer.name} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate" style={{ color: "var(--on-surf)" }}>
                        {selectedCustomer.name}
                      </p>
                      {selectedCustomer.phone && (
                        <p className="text-xs truncate" style={{ color: "var(--on-surf-var)" }}>
                          {selectedCustomer.phone}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomerSelectorOpen(true)}
                      className="text-xs px-3 py-1.5 rounded-full font-medium transition-colors hover:opacity-80"
                      style={{
                        background: "var(--p-container)",
                        color: "var(--on-p-container)",
                      }}
                    >
                      Cambiar
                    </button>
                  </div>
                ) : (
                  <div
                    className="rounded-2xl p-4 space-y-3"
                    style={{ background: "var(--warn-container)" }}
                  >
                    <div className="flex items-start gap-2">
                      <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
                      <p className="text-xs" style={{ color: "var(--on-surf)" }}>
                        Esta cotización no tiene cliente asignado. Debes seleccionar uno para continuar.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setCustomerSelectorOpen(true)}
                      className="flex items-center gap-2 text-sm px-4 py-2 rounded-full font-medium transition-colors hover:opacity-80"
                      style={{
                        background: "var(--primary)",
                        color: "var(--on-primary)",
                      }}
                    >
                      <User className="h-4 w-4" />
                      Seleccionar cliente
                    </button>
                  </div>
                )}

                {/* Cross-branch notice */}
                {crossBranch && (
                  <div
                    className="flex items-start gap-2 rounded-2xl px-4 py-3"
                    style={{ background: "var(--sec-container)" }}
                  >
                    <Info className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--on-sec-container)" }} />
                    <p className="text-xs" style={{ color: "var(--on-sec-container)" }}>
                      Esta cotización se generó en{" "}
                      <strong>{quotation.branchName}</strong>. Será convertida en{" "}
                      <strong>{currentUserBranchName}</strong> (tu sucursal actual).
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4 — Payment */}
            {!driftsLoading && (
              <div className="space-y-4">
                <StepHeader number={step4Num} title="Configuración de Pago" />

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Left — payment inputs */}
                  <div className="space-y-4">
                    {/* Primary method pills */}
                    <div>
                      <label
                        className="text-xs font-medium block mb-2"
                        style={{ color: "var(--on-surf-var)" }}
                      >
                        Método de pago
                      </label>
                      <div className="flex flex-wrap gap-2">
                        {ALL_METHODS.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => setPaymentMethod(m)}
                            className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                            style={{
                              background:
                                paymentMethod === m ? "var(--primary)" : "var(--surf-low)",
                              color:
                                paymentMethod === m ? "var(--on-primary)" : "var(--on-surf-var)",
                            }}
                          >
                            {PAYMENT_LABELS[m]}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Primary amount */}
                    <div>
                      <label
                        className="text-xs font-medium block mb-1.5"
                        style={{ color: "var(--on-surf-var)" }}
                      >
                        {targetType === "SALE" ? "Monto a pagar" : "Anticipo inicial"}
                      </label>
                      <div className="relative">
                        <span
                          className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
                          style={{ color: "var(--on-surf-var)", fontFamily: "var(--font-display)" }}
                        >
                          $
                        </span>
                        <input
                          type="number"
                          min={0}
                          step="0.01"
                          value={paymentAmount}
                          onChange={(e) => setPaymentAmount(e.target.value)}
                          placeholder="0.00"
                          style={{
                            ...INPUT_STYLE,
                            paddingLeft: "1.5rem",
                            fontFamily: "var(--font-display)",
                          }}
                        />
                      </div>
                    </div>

                    {/* Split payment toggle */}
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() => {
                          setIsSplitPayment(!isSplitPayment);
                          if (isSplitPayment) setSecondaryAmount("");
                        }}
                        className="flex items-center gap-2 text-xs font-medium transition-colors"
                        style={{ color: "var(--primary)" }}
                      >
                        <SplitSquareVertical className="h-4 w-4" />
                        {isSplitPayment ? "Quitar pago combinado" : "Pago combinado"}
                      </button>
                    </div>

                    {/* Secondary method + amount */}
                    {isSplitPayment && (
                      <div className="space-y-3 pl-4" style={{ borderLeft: "2px solid var(--surf-high)" }}>
                        <div>
                          <label
                            className="text-xs font-medium block mb-2"
                            style={{ color: "var(--on-surf-var)" }}
                          >
                            Segundo método
                          </label>
                          <div className="flex flex-wrap gap-2">
                            {ALL_METHODS.filter((m) => m !== paymentMethod).map((m) => (
                              <button
                                key={m}
                                type="button"
                                onClick={() => setSecondaryMethod(m)}
                                className="px-3 py-1.5 rounded-full text-xs font-medium transition-all"
                                style={{
                                  background:
                                    secondaryMethod === m ? "var(--primary)" : "var(--surf-low)",
                                  color:
                                    secondaryMethod === m
                                      ? "var(--on-primary)"
                                      : "var(--on-surf-var)",
                                }}
                              >
                                {PAYMENT_LABELS[m]}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div className="relative">
                          <span
                            className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium pointer-events-none"
                            style={{
                              color: "var(--on-surf-var)",
                              fontFamily: "var(--font-display)",
                            }}
                          >
                            $
                          </span>
                          <input
                            type="number"
                            min={0}
                            step="0.01"
                            value={secondaryAmount}
                            onChange={(e) => setSecondaryAmount(e.target.value)}
                            placeholder="0.00"
                            style={{
                              ...INPUT_STYLE,
                              paddingLeft: "1.5rem",
                              fontFamily: "var(--font-display)",
                            }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Right — order summary */}
                  <div
                    className="rounded-2xl p-4 space-y-3"
                    style={{ background: "var(--surf-low)" }}
                  >
                    <p
                      className="text-xs font-semibold tracking-widest uppercase"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      Resumen
                    </p>
                    <div className="space-y-2">
                      <SummaryRow label="Subtotal" value={formatMXN(quotation.subtotal)} />
                      {quotation.discountAmount > 0 && (
                        <SummaryRow
                          label="Descuento"
                          value={`−${formatMXN(quotation.discountAmount)}`}
                          valueColor="var(--ter)"
                        />
                      )}
                      <div
                        className="flex justify-between items-center pt-2"
                        style={{ borderTop: "1px solid var(--ghost-border-strong)" }}
                      >
                        <span
                          className="text-sm font-semibold"
                          style={{ color: "var(--on-surf)" }}
                        >
                          Total
                        </span>
                        <span
                          className="text-2xl font-bold"
                          style={{
                            fontFamily: "var(--font-display)",
                            color: "var(--on-surf)",
                          }}
                        >
                          {formatMXN(quotation.total)}
                        </span>
                      </div>
                    </div>

                    {targetType && targetType !== "SALE" && paymentAmountNum > 0 && (
                      <div
                        className="rounded-xl px-3 py-2 space-y-1"
                        style={{ background: "var(--surf-highest)" }}
                      >
                        <SummaryRow
                          label="Anticipo"
                          value={formatMXN(isSplitPayment ? totalAmount : paymentAmountNum)}
                          valueColor="var(--primary)"
                        />
                        <SummaryRow
                          label="Pendiente"
                          value={formatMXN(Math.max(0, quotation.total - totalAmount))}
                          valueColor="var(--on-surf-var)"
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer — fijo */}
          <div
            className="px-6 py-4 flex items-center justify-between gap-4 shrink-0"
            style={{ borderTop: "1px solid var(--ghost-border)" }}
          >
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="text-sm font-medium px-4 py-2 rounded-full transition-colors hover:bg-[var(--surf-high)]"
              style={{ color: "var(--on-surf-var)" }}
            >
              Cancelar
            </button>

            <div className="flex items-center gap-4">
              <span className="text-xs hidden sm:block" style={{ color: "var(--on-surf-var)" }}>
                {quotation.itemCount} producto{quotation.itemCount !== 1 ? "s" : ""} · Total:{" "}
                <strong style={{ color: "var(--on-surf)" }}>{formatMXN(quotation.total)}</strong>
              </span>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!canSubmit}
                className="flex items-center gap-2 px-6 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{
                  background: "var(--velocity-gradient)",
                  boxShadow: canSubmit ? "0 4px 12px rgba(46,204,113,0.3)" : "none",
                }}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Convirtiendo...
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4" />
                    Confirmar conversión
                  </>
                )}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer selector */}
      <CustomerSelectorModal
        open={customerSelectorOpen}
        onClose={() => setCustomerSelectorOpen(false)}
        customers={customers}
        onSelect={(c) => {
          setSelectedCustomer(c);
          setCustomerSelectorOpen(false);
        }}
        onCustomerCreated={(c) => {
          setSelectedCustomer(c);
          setCustomerSelectorOpen(false);
        }}
      />
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StepHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <div
        className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0"
        style={{
          background: "var(--primary)",
          color: "var(--on-primary)",
        }}
      >
        {number}
      </div>
      <h3
        className="text-sm font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
      >
        {title}
      </h3>
    </div>
  );
}

function ModalityCard({
  selected,
  onSelect,
  icon: Icon,
  title,
  subtitle,
}: {
  selected: boolean;
  onSelect: () => void;
  icon: React.ElementType;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="relative flex flex-col items-start gap-2 rounded-2xl p-4 text-left transition-all w-full"
      style={{
        background: selected ? "color-mix(in srgb, var(--primary) 10%, transparent)" : "var(--surf-low)",
        borderBottom: selected ? "2px solid var(--primary)" : "2px solid transparent",
        cursor: "pointer",
      }}
    >
      {selected && (
        <span
          className="absolute top-3 right-3 flex items-center justify-center w-5 h-5 rounded-full"
          style={{ background: "var(--primary)" }}
        >
          <Check className="h-3 w-3" style={{ color: "var(--on-primary)" }} />
        </span>
      )}
      <Icon
        className="h-5 w-5"
        style={{ color: selected ? "var(--primary)" : "var(--on-surf-var)" }}
      />
      <div>
        <p
          className="text-xs font-semibold"
          style={{ color: selected ? "var(--primary)" : "var(--on-surf)" }}
        >
          {title}
        </p>
        <p className="text-[0.625rem] mt-0.5" style={{ color: "var(--on-surf-var)" }}>
          {subtitle}
        </p>
      </div>
    </button>
  );
}

function CustomerAvatar({ name }: { name: string }) {
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div
      className="flex items-center justify-center w-10 h-10 rounded-full shrink-0 text-sm font-bold"
      style={{ background: "var(--primary)", color: "var(--on-primary)" }}
    >
      {initials || <User className="h-4 w-4" />}
    </div>
  );
}

function SummaryRow({
  label,
  value,
  valueColor,
}: {
  label: string;
  value: string;
  valueColor?: string;
}) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
        {label}
      </span>
      <span
        className="text-sm font-medium"
        style={{ color: valueColor ?? "var(--on-surf)", fontFamily: "var(--font-display)" }}
      >
        {value}
      </span>
    </div>
  );
}

