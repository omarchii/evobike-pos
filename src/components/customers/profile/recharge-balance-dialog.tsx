"use client";

// Modal "Recargar saldo a favor" — reemplazo de add-balance-dialog
// con tokens, glassmorphism oficial y formatMXN (BRIEF §8).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";
import { formatMXN } from "@/lib/format";

type Method = "CASH" | "CARD" | "TRANSFER";

const METHODS: Array<{ key: Method; label: string; icon: "cash" | "invoice" | "share" }> = [
  { key: "CASH", label: "Efectivo", icon: "cash" },
  { key: "CARD", label: "Tarjeta", icon: "invoice" },
  { key: "TRANSFER", label: "Transf.", icon: "share" },
];

interface Props {
  customerId: string;
  customerName: string;
  currentBalance: number;
  trigger?: React.ReactNode;
}

export function RechargeBalanceDialog({
  customerId,
  customerName,
  currentBalance,
  trigger,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState<Method>("CASH");
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    const parsed = parseFloat(amount);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      toast.error("Monto inválido");
      return;
    }
    setLoading(true);
    toast.loading("Procesando recarga…", { id: "topup" });
    try {
      const res = await fetch(`/api/customers/${customerId}/balance`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: parsed, method }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Saldo recargado", { id: "topup" });
        setOpen(false);
        setAmount("");
        router.refresh();
      } else {
        toast.error(json.error ?? "No se pudo procesar", { id: "topup" });
      }
    } catch {
      toast.error("Error de red", { id: "topup" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger ?? (
          <button
            className="inline-flex items-center justify-center gap-1.5 px-4 py-2 text-xs font-semibold w-full"
            style={{
              borderRadius: "var(--r-full)",
              background: "var(--velocity-gradient)",
              color: "var(--on-p)",
              fontFamily: "var(--font-display)",
            }}
          >
            <Icon name="plus" size={13} />
            Recargar saldo
          </button>
        )}
      </span>

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
                Recargar saldo a favor
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
              <span className="font-semibold" style={{ color: "var(--on-surf)" }}>
                {customerName}
              </span>{" "}
              depositará dinero por anticipado en su cuenta.
            </p>

            <div
              className="flex items-center justify-between rounded-[var(--r-md)] px-4 py-3"
              style={{ background: "var(--surf-low)" }}
            >
              <span
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Saldo actual
              </span>
              <span
                className="font-bold tabular-nums"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.25rem",
                  color: "var(--on-surf)",
                }}
              >
                {formatMXN(currentBalance)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Monto a recargar
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="Ej. 1500"
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
                Método de pago
              </label>
              <div className="grid grid-cols-3 gap-2">
                {METHODS.map((m) => {
                  const active = m.key === method;
                  return (
                    <button
                      key={m.key}
                      type="button"
                      onClick={() => setMethod(m.key)}
                      className="flex flex-col items-center gap-1 py-3 transition-colors"
                      style={{
                        borderRadius: "var(--r-md)",
                        background: active ? "var(--p-container)" : "var(--surf-low)",
                        color: active ? "var(--on-p-container)" : "var(--on-surf-var)",
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      <Icon name={m.icon} size={16} />
                      <span className="text-[0.6875rem]">{m.label}</span>
                    </button>
                  );
                })}
              </div>
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
                {loading ? "Procesando…" : "Confirmar recepción"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
