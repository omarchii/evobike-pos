"use client";

// Modal "Editar límite de crédito" (BRIEF §8 — Sub-fase H). MANAGER+ only.
// Envía PUT /api/customers/[id] con creditLimit + reason.
// El endpoint audita el cambio en CustomerEditLog con field="creditLimit".

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";
import { formatMXN } from "@/lib/format";

interface Props {
  customerId: string;
  currentLimit: number;
}

export function EditCreditLimitDialog({
  customerId,
  currentLimit,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(String(currentLimit));
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    const numeric = Number(value);
    if (!Number.isFinite(numeric) || numeric < 0) {
      toast.error("Monto inválido");
      return;
    }
    if (reason.trim().length === 0) {
      toast.error("El motivo es obligatorio");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ creditLimit: numeric, reason: reason.trim() }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Límite actualizado");
        setOpen(false);
        router.refresh();
      } else {
        toast.error(json.error ?? "No se pudo actualizar");
      }
    } catch {
      toast.error("Error de red");
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
        }}
      >
        <Icon name="commission" size={13} />
        Editar límite
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
                Editar límite de crédito
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

            <div
              className="flex items-center justify-between rounded-[var(--r-md)] px-4 py-3"
              style={{ background: "var(--surf-low)" }}
            >
              <span
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Límite actual
              </span>
              <span
                className="font-bold tabular-nums"
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1.25rem",
                  color: "var(--on-surf)",
                }}
              >
                {formatMXN(currentLimit)}
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Nuevo límite
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="0.01"
                min={0}
                value={value}
                onChange={(e) => setValue(e.target.value)}
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
                Motivo (obligatorio)
              </label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. autorización directa del cliente, ajuste por historial de pago…"
                rows={3}
                className="w-full px-3 py-2.5 outline-none text-sm resize-none"
                style={{
                  background: "var(--surf-lowest)",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--ghost-border)",
                  color: "var(--on-surf)",
                }}
              />
              <span
                className="text-[0.6875rem]"
                style={{ color: "var(--on-surf-var)" }}
              >
                El motivo queda registrado en el historial del cliente.
              </span>
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
                  background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
                  color: "var(--on-p)",
                  fontFamily: "var(--font-display)",
                  border: "none",
                }}
              >
                {loading ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
