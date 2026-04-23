"use client";

import { useState } from "react";
import type { ServiceOrderType } from "@prisma/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { SplitSquareVertical, PackageCheck } from "lucide-react";

// ── Design tokens (AGENTS.md: inputs en modales SIEMPRE --surf-low) ──────────
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

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
};

type PaymentMethod = "CASH" | "CARD" | "TRANSFER" | "ATRATO";

const METHOD_OPTIONS: { value: PaymentMethod; label: string }[] = [
  { value: "CASH", label: "Efectivo" },
  { value: "CARD", label: "Tarjeta" },
  { value: "TRANSFER", label: "Transferencia" },
  { value: "ATRATO", label: "Atrato" },
];

// Labels para los tipos que no generan cobro. PAID se omite deliberadamente.
const NO_CHARGE_LABEL: Record<Exclude<ServiceOrderType, "PAID">, string> = {
  WARRANTY: "Garantía",
  COURTESY: "Cortesía",
  POLICY_MAINTENANCE: "Mantenimiento de póliza",
};

interface DeliverModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  total: number;
  /** Si prepaid=true, no se muestra formulario de pago */
  prepaid: boolean;
  /** ServiceOrder.type — determina si hay cobro. Backend ramifica en /deliver. */
  type: ServiceOrderType;
}

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

export function DeliverModal({
  open,
  onOpenChange,
  orderId,
  total,
  prepaid,
  type,
}: DeliverModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [stockError, setStockError] = useState<string | null>(null);
  const [isSplit, setIsSplit] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amount, setAmount] = useState(String(total.toFixed(2)));
  const [secondaryMethod, setSecondaryMethod] = useState<PaymentMethod>("CARD");
  const [secondaryAmount, setSecondaryAmount] = useState("0.00");

  // Rama por type + prepaid (backend ya ramifica en /deliver por order.type):
  //   PAID  !prepaid  → payment form; body con paymentMethod + amount
  //   PAID   prepaid  → sin form (Sale ya existe); body = {}
  //   no-PAID         → sin form (Sale con total=0); body = {}
  const requiresPaymentUI = type === "PAID" && !prepaid;
  const isNoCharge = type !== "PAID";
  const noChargeLabel = isNoCharge ? NO_CHARGE_LABEL[type] : null;

  const handleSubmit = async () => {
    setStockError(null);
    let body: Record<string, unknown> = {};

    if (requiresPaymentUI) {
      const primaryAmt = parseFloat(amount);
      const secondaryAmt = isSplit ? parseFloat(secondaryAmount) : 0;

      if (isNaN(primaryAmt) || primaryAmt <= 0) {
        toast.error("Ingresa un monto válido");
        return;
      }

      body = {
        paymentMethod: method,
        amount: primaryAmt,
        ...(isSplit && secondaryAmt > 0
          ? { secondaryPaymentMethod: secondaryMethod, secondaryAmount: secondaryAmt }
          : {}),
      };
    }

    setLoading(true);
    toast.loading("Procesando entrega...", { id: "deliver" });

    try {
      const res = await fetch(`/api/service-orders/${orderId}/deliver`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        success: boolean;
        data?: { folio: string };
        error?: string;
      };

      if (data.success) {
        toast.success(
          requiresPaymentUI
            ? `Cobrada y entregada — ${data.data?.folio ?? ""}`
            : "Orden entregada",
          { id: "deliver" }
        );
        onOpenChange(false);
        router.refresh();
      } else {
        // Show stock errors inline in modal, others as toast
        if (data.error?.includes("Stock insuficiente")) {
          toast.dismiss("deliver");
          setStockError(data.error);
        } else {
          toast.error(data.error ?? "Error al procesar la entrega", { id: "deliver" });
        }
      }
    } catch {
      toast.error("Error de conexión", { id: "deliver" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden sm:max-w-md"
        style={{
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "var(--shadow)",
          borderRadius: "var(--r-xl)",
          border: "none",
        }}
      >
        {/* Header */}
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--on-surf)",
            }}
          >
            {requiresPaymentUI ? "Entregar y cobrar" : "Entregar orden"}
          </DialogTitle>
          <p style={{ color: "var(--on-surf-var)", fontSize: "0.75rem" }}>
            {isNoCharge
              ? "Este servicio no genera cobro. Al confirmar se descuenta el stock de refacciones."
              : prepaid
              ? "El cobro ya fue registrado. Al confirmar se descuenta el stock de refacciones."
              : "Se registra el cobro y se descuenta el stock de refacciones simultáneamente."}
          </p>
        </DialogHeader>

        {/* Total display */}
        <div
          className="mx-6 mb-5 rounded-2xl flex flex-col items-center py-4"
          style={{ background: "var(--surf-low)" }}
        >
          <span
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2.25rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--on-surf)",
            }}
          >
            {formatMXN(total)}
          </span>
          <span
            style={{
              fontSize: "0.625rem",
              fontWeight: 500,
              letterSpacing: "0.05em",
              textTransform: "uppercase",
              color: "var(--on-surf-var)",
              marginTop: "0.25rem",
            }}
          >
            {isNoCharge
              ? `Sin cobro · ${noChargeLabel}`
              : prepaid
              ? "Ya cobrado"
              : "Total a cobrar"}
          </span>
        </div>

        {/* Stock error */}
        {stockError && (
          <div
            className="mx-6 mb-4 rounded-xl px-4 py-3 text-sm"
            style={{
              background: "var(--ter-container)",
              color: "var(--on-ter-container)",
            }}
          >
            {stockError}
          </div>
        )}

        {/* Payment form (only when PAID && !prepaid) */}
        <div className="px-6 pb-6 space-y-4">
          {requiresPaymentUI && (
            <>
              {/* Split toggle */}
              <button
                onClick={() => {
                  setIsSplit(!isSplit);
                  if (!isSplit) {
                    const half = (total / 2).toFixed(2);
                    setAmount(half);
                    setSecondaryAmount(half);
                  } else {
                    setAmount(total.toFixed(2));
                  }
                }}
                className="flex items-center gap-2 text-xs font-medium transition-colors w-full"
                style={{ color: isSplit ? "var(--p)" : "var(--on-surf-var)" }}
              >
                <SplitSquareVertical className="h-3.5 w-3.5" />
                {isSplit ? "Pago único" : "Dividir en dos métodos"}
              </button>

              {/* Primary method */}
              <div className="space-y-2">
                <label style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", fontWeight: 500 }}>
                  {isSplit ? "Método principal" : "Método de pago"}
                </label>
                <div className="flex gap-2">
                  <div className="relative flex-1">
                    <select
                      value={method}
                      onChange={(e) => setMethod(e.target.value as PaymentMethod)}
                      style={{ ...SELECT_STYLE, paddingRight: "2rem" }}
                    >
                      {METHOD_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  {isSplit && (
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={amount}
                      onChange={(e) => setAmount(e.target.value)}
                      style={{ ...INPUT_STYLE, width: 120 }}
                    />
                  )}
                </div>
              </div>

              {/* Secondary method (split) */}
              {isSplit && (
                <div className="space-y-2">
                  <label style={{ fontSize: "0.75rem", color: "var(--on-surf-var)", fontWeight: 500 }}>
                    Método secundario
                  </label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <select
                        value={secondaryMethod}
                        onChange={(e) => setSecondaryMethod(e.target.value as PaymentMethod)}
                        style={{ ...SELECT_STYLE, paddingRight: "2rem" }}
                      >
                        {METHOD_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={secondaryAmount}
                      onChange={(e) => setSecondaryAmount(e.target.value)}
                      style={{ ...INPUT_STYLE, width: 120 }}
                    />
                  </div>
                </div>
              )}
            </>
          )}

          {/* Confirm button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 font-semibold text-sm transition-opacity disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, #1b4332, #2ecc71)",
              color: "#ffffff",
              borderRadius: "var(--r-full)",
              border: "none",
              height: 48,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <PackageCheck className="h-4 w-4" />
            {loading
              ? "Procesando..."
              : requiresPaymentUI
              ? "Entregar y cobrar"
              : "Confirmar entrega"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
