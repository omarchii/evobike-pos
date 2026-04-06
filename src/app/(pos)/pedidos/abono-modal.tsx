"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Banknote, CreditCard, ArrowUpRight } from "lucide-react";

export type PaymentMethodOption = "CASH" | "CARD" | "TRANSFER";

const METHOD_LABELS: Record<PaymentMethodOption, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

const METHOD_ICONS: Record<PaymentMethodOption, React.ReactNode> = {
  CASH: <Banknote className="w-4 h-4" />,
  CARD: <CreditCard className="w-4 h-4" />,
  TRANSFER: <ArrowUpRight className="w-4 h-4" />,
};

function formatMXN(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

export interface AbonoModalProps {
  pedidoId: string;
  folio: string;
  total: number;
  totalPaid: number;
  onClose: () => void;
  onSuccess: () => void;
}

export function AbonoModal({
  pedidoId,
  folio,
  total,
  totalPaid,
  onClose,
  onSuccess,
}: AbonoModalProps) {
  const pending = total - totalPaid;
  const [amount, setAmount] = useState(pending.toFixed(2));
  const [method, setMethod] = useState<PaymentMethodOption>("CASH");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0 || amt > pending) {
      toast.error("Monto inválido. Verifica el abono.");
      return;
    }

    setLoading(true);
    toast.loading("Registrando abono...", { id: "abono" });

    try {
      const res = await fetch(`/api/pedidos/${pedidoId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: amt, paymentMethod: method }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };

      if (json.success) {
        toast.success("Abono registrado", { id: "abono" });
        onSuccess();
      } else {
        toast.error(json.error ?? "Error al registrar el abono", { id: "abono" });
      }
    } catch {
      toast.error("Error de red. Intenta de nuevo.", { id: "abono" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-[var(--r-xl)] p-6 shadow-2xl"
        style={{
          background: "var(--surf-bright)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="mb-5">
          <p className="text-xs font-medium mb-0.5" style={{ color: "var(--on-surf-var)" }}>
            Registrar abono
          </p>
          <h2
            className="text-xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
          >
            {folio}
          </h2>
        </div>

        {/* Balance summary */}
        <div
          className="flex justify-between items-center rounded-[var(--r-lg)] p-4 mb-5"
          style={{ background: "var(--surf-high)" }}
        >
          <div>
            <p className="text-xs mb-0.5" style={{ color: "var(--on-surf-var)" }}>
              Saldo restante
            </p>
            <p
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              {formatMXN(pending)}
            </p>
          </div>
          <div className="text-right">
            <p className="text-xs mb-0.5" style={{ color: "var(--on-surf-var)" }}>
              Total pedido
            </p>
            <p className="text-sm font-semibold" style={{ color: "var(--on-surf-var)" }}>
              {formatMXN(total)}
            </p>
          </div>
        </div>

        {/* Amount input */}
        <div className="mb-4">
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: "var(--on-surf)" }}
          >
            Monto a abonar
          </label>
          <input
            type="number"
            min="0.01"
            step="0.01"
            max={pending}
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            className="w-full text-xl font-semibold px-4 py-3 rounded-[var(--r-lg)] outline-none transition-shadow focus:shadow-[0_0_0_2px_var(--p-bright)]"
            style={{
              fontFamily: "var(--font-display)",
              background: "var(--surf-lowest)",
              color: "var(--on-surf)",
            }}
          />
        </div>

        {/* Method selector */}
        <div className="mb-6">
          <label
            className="block text-sm font-medium mb-2"
            style={{ color: "var(--on-surf)" }}
          >
            Método de pago
          </label>
          <div className="grid grid-cols-3 gap-2">
            {(["CASH", "CARD", "TRANSFER"] as PaymentMethodOption[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMethod(m)}
                className="flex flex-col items-center gap-1 py-3 px-2 rounded-[var(--r-lg)] text-xs font-semibold transition-all"
                style={
                  method === m
                    ? {
                        background:
                          "linear-gradient(135deg, var(--p-mid) 0%, var(--p-bright) 100%)",
                        color: "var(--on-p)",
                      }
                    : {
                        background: "var(--surf-high)",
                        color: "var(--on-surf-var)",
                      }
                }
              >
                {METHOD_ICONS[m]}
                {METHOD_LABELS[m]}
              </button>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-full text-sm font-semibold transition-colors"
            style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={loading}
            className="flex-1 py-3 rounded-full text-sm font-bold transition-opacity disabled:opacity-60"
            style={{
              background: "linear-gradient(135deg, var(--p-mid) 0%, var(--p-bright) 100%)",
              color: "var(--on-p)",
            }}
          >
            {loading ? "Procesando..." : "Confirmar abono"}
          </button>
        </div>
      </div>
    </div>
  );
}
