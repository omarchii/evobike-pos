"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Banknote } from "lucide-react";
import { PaymentMethodList } from "@/components/pos/payment/payment-method-list";
import type { PaymentMethodEntry } from "@/lib/validators/payment";

interface ChargeModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  total: number;
  customerId?: string | null;
}

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

export function ChargeModal({ open, onOpenChange, orderId, total, customerId }: ChargeModalProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState<PaymentMethodEntry[]>([
    { method: "CASH", amount: total },
  ]);
  const [customerCreditBalance, setCustomerCreditBalance] = useState<number | null>(null);

  // Reset entries cuando cambia total (vuelve a abrir el modal)
  useEffect(() => {
    if (open) {
      setEntries([{ method: "CASH", amount: total }]);
    }
  }, [open, total]);

  // Lazy fetch saldo a favor (Pack E.7)
  useEffect(() => {
    if (!customerId || !open) {
      setCustomerCreditBalance(null);
      return;
    }
    let cancelled = false;
    fetch(`/api/customers/${customerId}/balance`)
      .then((r) => r.json() as Promise<{ success: boolean; balance?: number }>)
      .then((d) => {
        if (cancelled) return;
        setCustomerCreditBalance(typeof d.balance === "number" ? d.balance : null);
      })
      .catch(() => {
        if (!cancelled) setCustomerCreditBalance(null);
      });
    return () => {
      cancelled = true;
    };
  }, [customerId, open]);

  const sumEntries = entries.reduce(
    (s, e) => s + (Number.isFinite(e.amount) ? e.amount : 0),
    0,
  );
  const balanced = Math.abs(sumEntries - total) < 0.005;

  const handleSubmit = async () => {
    if (!balanced) {
      toast.error("Los montos no suman el total");
      return;
    }

    setLoading(true);
    toast.loading("Registrando cobro...", { id: "charge" });

    try {
      const res = await fetch(`/api/service-orders/${orderId}/charge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentMethods: entries.filter((e) => e.amount > 0),
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

        {/* Payment list (Pack E.7) */}
        <div className="px-6 pb-6 space-y-4">
          <PaymentMethodList
            value={entries}
            onChange={setEntries}
            total={total}
            customerCreditBalance={customerCreditBalance}
          />

          <button
            onClick={handleSubmit}
            disabled={loading || !balanced}
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
