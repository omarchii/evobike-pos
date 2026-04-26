"use client";

// Modal "Editar odómetro" (BRIEF §8 — Sub-fase F).
// Escribe vía PATCH /api/customer-bikes/[id]; el endpoint registra la
// entrada en CustomerEditLog con field="odometerKm" + customerBikeId.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";

interface Props {
  bikeId: string;
  currentValue: number | null;
  trigger: React.ReactNode;
}

export function EditOdometerDialog({
  bikeId,
  currentValue,
  trigger,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState<string>(
    currentValue != null ? String(currentValue) : "",
  );
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    const numeric = value.trim() === "" ? null : Number(value);
    if (numeric !== null && (!Number.isInteger(numeric) || numeric < 0)) {
      toast.error("El odómetro debe ser un entero ≥ 0");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/customer-bikes/${bikeId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odometerKm: numeric,
          reason: reason.trim() || undefined,
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Odómetro actualizado");
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
      <span
        onClick={() => setOpen(true)}
        className="contents"
        role="button"
      >
        {trigger}
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
                style={{
                  fontFamily: "var(--font-display)",
                  color: "var(--on-surf)",
                }}
              >
                Editar odómetro
              </h2>
              <button
                onClick={() => setOpen(false)}
                className="h-8 w-8 rounded-full flex items-center justify-center"
                style={{
                  background: "var(--surf-high)",
                  color: "var(--on-surf-var)",
                }}
                aria-label="Cerrar"
              >
                <Icon name="close" size={14} />
              </button>
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Nuevo valor (km)
              </label>
              <input
                type="number"
                inputMode="numeric"
                min={0}
                step={1}
                value={value}
                onChange={(e) => setValue(e.target.value)}
                placeholder="0"
                className="w-full px-3 py-2.5 outline-none text-sm tabular-nums"
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
                Dejar vacío borra el valor registrado.
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Motivo (opcional)
              </label>
              <input
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="Ej. lectura en recepción, corrección manual…"
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
                {loading ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
