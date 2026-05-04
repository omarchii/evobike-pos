"use client";

import { useState } from "react";
import { Banknote, CreditCard, ArrowLeftRight, Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatMXN } from "@/lib/format";

type PaymentMethod = "CASH" | "CARD" | "TRANSFER";

interface Props {
  open: boolean;
  onClose: () => void;
  folio: string;
  total: number;
  loading: boolean;
  onConfirm: (method: PaymentMethod, reference: string | null) => void;
}

const METHODS: Array<{ value: PaymentMethod; label: string; icon: React.ElementType }> = [
  { value: "CASH", label: "Efectivo", icon: Banknote },
  { value: "CARD", label: "Tarjeta", icon: CreditCard },
  { value: "TRANSFER", label: "Transferencia", icon: ArrowLeftRight },
];

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  fontSize: "0.875rem",
  padding: "0.65rem 0.75rem",
  width: "100%",
  outline: "none",
};

export default function RegisterPaymentDialog({
  open,
  onClose,
  folio,
  total,
  loading,
  onConfirm,
}: Props) {
  const [method, setMethod] = useState<PaymentMethod>("CASH");
  const [reference, setReference] = useState("");

  function handleSubmit() {
    const trimmed = reference.trim();
    onConfirm(method, trimmed.length > 0 ? trimmed : null);
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o && !loading) onClose();
      }}
    >
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "var(--shadow)",
          borderRadius: "var(--r-xl)",
          maxWidth: 480,
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}>
            Registrar pago
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-5">
          {/* Resumen */}
          <div
            className="rounded-xl px-4 py-3 flex items-center justify-between"
            style={{ background: "var(--surf-low)" }}
          >
            <div>
              <div className="text-[0.625rem] uppercase tracking-wide" style={{ color: "var(--on-surf-var)" }}>
                Cotización
              </div>
              <div className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                {folio}
              </div>
            </div>
            <div className="text-right">
              <div className="text-[0.625rem] uppercase tracking-wide" style={{ color: "var(--on-surf-var)" }}>
                Total
              </div>
              <div className="text-base font-semibold" style={{ color: "var(--on-surf)" }}>
                {formatMXN(total, { decimals: 2 })}
              </div>
            </div>
          </div>

          {/* Método */}
          <div>
            <label className="text-xs font-medium mb-2 block" style={{ color: "var(--on-surf-var)" }}>
              Método de pago
            </label>
            <div className="grid grid-cols-3 gap-2">
              {METHODS.map(({ value, label, icon: Icon }) => {
                const active = method === value;
                return (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setMethod(value)}
                    disabled={loading}
                    className="rounded-xl py-3 flex flex-col items-center gap-1.5 transition-colors disabled:opacity-60"
                    style={{
                      background: active ? "var(--pri-container)" : "var(--surf-low)",
                      color: active ? "var(--on-pri-container)" : "var(--on-surf)",
                      border: active ? "1px solid var(--pri)" : "1px solid transparent",
                    }}
                  >
                    <Icon className="h-4 w-4" />
                    <span className="text-xs font-medium">{label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Referencia */}
          <div>
            <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--on-surf-var)" }}>
              Referencia <span style={{ color: "var(--on-surf-var)" }}>(opcional)</span>
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder={
                method === "CASH"
                  ? "Ej. recibo #123"
                  : method === "CARD"
                  ? "Últimos 4 / autorización"
                  : "Folio o nombre de transferencia"
              }
              maxLength={120}
              disabled={loading}
              style={INPUT_STYLE}
            />
          </div>

          {/* Acciones */}
          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="flex-1 py-2.5 rounded-full text-sm font-medium transition-colors hover:bg-[var(--surf-high)] disabled:opacity-60"
              style={{ color: "var(--on-surf-var)", background: "var(--surf-low)" }}
            >
              Volver
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={loading}
              className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
              style={{ background: "var(--pri)" }}
            >
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Confirmar pago
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
