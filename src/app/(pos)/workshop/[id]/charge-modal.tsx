"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Wifi, SplitSquareVertical } from "lucide-react";

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

const METHOD_OPTIONS: { value: PaymentMethod; label: string; icon: React.ElementType }[] = [
  { value: "CASH", label: "Efectivo", icon: Banknote },
  { value: "CARD", label: "Tarjeta", icon: CreditCard },
  { value: "TRANSFER", label: "Transferencia", icon: Wifi },
  { value: "ATRATO", label: "Atrato", icon: SplitSquareVertical },
];

interface ChargeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  total: number;
}

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

export function ChargeModal({ open, onOpenChange, orderId, total }: ChargeModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [isSplit, setIsSplit] = useState(false);
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [amount, setAmount] = useState(String(total.toFixed(2)));
  const [secondaryMethod, setSecondaryMethod] = useState<PaymentMethod>("CARD");
  const [secondaryAmount, setSecondaryAmount] = useState("0.00");

  const handleSubmit = async () => {
    const primaryAmt = parseFloat(amount);
    const secondaryAmt = isSplit ? parseFloat(secondaryAmount) : 0;

    if (isNaN(primaryAmt) || primaryAmt <= 0) {
      toast.error("Ingresa un monto válido");
      return;
    }
    if (isSplit && (isNaN(secondaryAmt) || secondaryAmt < 0)) {
      toast.error("Monto secundario inválido");
      return;
    }

    setLoading(true);
    toast.loading("Registrando cobro...", { id: "charge" });

    try {
      const res = await fetch(`/api/service-orders/${orderId}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethod: method,
          amount: primaryAmt,
          ...(isSplit && secondaryAmt > 0
            ? { secondaryPaymentMethod: secondaryMethod, secondaryAmount: secondaryAmt }
            : {}),
        }),
      });

      const data = (await res.json()) as {
        success: boolean;
        data?: { folio: string };
        error?: string;
      };

      if (data.success) {
        toast.success(`Cobro registrado — ${data.data?.folio ?? ""}`, { id: "charge" });
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(data.error ?? "Error al registrar cobro", { id: "charge" });
      }
    } catch {
      toast.error("Error de conexión", { id: "charge" });
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
            Cobrar ahora
          </DialogTitle>
          <p style={{ color: "var(--on-surf-var)", fontSize: "0.75rem" }}>
            El pago se registra en caja. El stock se descuenta al entregar.
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
            Total de la orden
          </span>
        </div>

        {/* Payment form */}
        <div className="px-6 pb-6 space-y-4">
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
                  placeholder="0.00"
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
                  placeholder="0.00"
                />
              </div>
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 font-semibold text-sm transition-opacity disabled:opacity-50"
            style={{
              background: "var(--velocity-gradient)",
              color: "#ffffff",
              borderRadius: "var(--r-full)",
              border: "none",
              height: 48,
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <Banknote className="h-4 w-4" />
            {loading ? "Procesando..." : "Confirmar cobro"}
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
