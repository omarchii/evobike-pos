"use client";

// Diálogo "Ajustar saldo a favor (MANAGER)" — Pack D.4.a.
// POST /api/customers/[id]/saldo/ajustar — siempre acredita (positivo).
// Negativo no soportado en este iter — ver comentario del endpoint.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";
import { formatMXN } from "@/lib/format";

interface Props {
  customerId: string;
  customerName: string;
  currentTotal: number;
}

export function AdjustSaldoDialog({
  customerId,
  customerName,
  currentTotal,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Monto inválido");
      return;
    }
    if (reason.trim().length < 3) {
      toast.error("Motivo es obligatorio (min 3 caracteres)");
      return;
    }
    setLoading(true);
    toast.loading("Aplicando ajuste…", { id: "ajuste-saldo" });
    try {
      const res = await fetch(`/api/customers/${customerId}/saldo/ajustar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, reason: reason.trim() }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Ajuste aplicado", { id: "ajuste-saldo" });
        setOpen(false);
        setAmount("");
        setReason("");
        router.refresh();
      } else {
        toast.error(json.error ?? "No se pudo procesar", { id: "ajuste-saldo" });
      }
    } catch {
      toast.error("Error de red", { id: "ajuste-saldo" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold w-full"
        style={{
          borderRadius: "var(--r-full)",
          background: "var(--surf-high)",
          color: "var(--on-surf)",
          fontFamily: "var(--font-display)",
          border: "1px solid var(--ghost-border)",
        }}
      >
        <Icon name="plus" size={13} />
        Ajustar saldo (MANAGER)
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-md p-6 flex flex-col gap-5"
            style={{
              background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              borderRadius: "var(--r-xl)",
              boxShadow: "var(--shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h2
                className="text-lg font-bold"
                style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
              >
                Ajustar saldo a favor
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
                aria-label="Cerrar"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <p className="text-sm" style={{ color: "var(--on-surf-var)" }}>
              Acredita saldo a favor de{" "}
              <span className="font-semibold" style={{ color: "var(--on-surf)" }}>
                {customerName}
              </span>{" "}
              sin movimiento de caja. Origen: <code>AJUSTE_MANAGER</code>. Vence en 365 días.
            </p>

            <div
              className="flex items-center justify-between rounded-[var(--r-md)] px-4 py-3"
              style={{ background: "var(--surf-low)" }}
            >
              <span
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Saldo activo actual
              </span>
              <span
                className="font-bold tabular-nums"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.25rem",
                  color: "var(--on-surf)",
                }}
              >
                {formatMXN(currentTotal)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Monto a acreditar
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej. 500"
                className="w-full px-3 py-2.5 outline-none text-base font-semibold tabular-nums"
                style={{
                  background: "var(--surf-lowest)",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--ghost-border)",
                  color: "var(--on-surf)",
                  fontFamily: "var(--font-display)",
                }}
              />
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Motivo (queda en notes del crédito)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. Cortesía promoción, error de captura folio 1234, conciliación anual…"
                rows={3}
                maxLength={500}
                className="w-full px-3 py-2.5 outline-none text-sm"
                style={{
                  background: "var(--surf-lowest)",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--ghost-border)",
                  color: "var(--on-surf)",
                }}
              />
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={() => setOpen(false)}
                className="px-4 py-2 text-sm font-semibold"
                style={{
                  borderRadius: "var(--r-full)",
                  border: "1.5px solid color-mix(in srgb, var(--p) 25%, transparent)",
                  background: "transparent",
                  color: "var(--p)",
                  fontFamily: "var(--font-display)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={() => void submit()}
                disabled={loading}
                className="px-5 py-2 text-sm font-semibold disabled:opacity-60"
                style={{
                  borderRadius: "var(--r-full)",
                  background: "var(--velocity-gradient)",
                  color: "var(--on-p)",
                  fontFamily: "var(--font-display)",
                  border: "none",
                }}
              >
                {loading ? "Aplicando…" : "Aplicar ajuste"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
