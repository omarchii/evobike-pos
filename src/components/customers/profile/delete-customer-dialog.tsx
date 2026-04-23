"use client";

// Modal "Eliminar cliente" — soft-delete (BRIEF §6.2 / §8). MANAGER+ only.
// Captura motivo enum (DUPLICATE | REQUEST | ERROR) y dispara DELETE.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";

type DeleteReason = "DUPLICATE" | "REQUEST" | "ERROR";

const REASONS: Array<{ key: DeleteReason; label: string; hint: string }> = [
  { key: "DUPLICATE", label: "Duplicado", hint: "Existe otro registro mejor mantenido." },
  { key: "REQUEST", label: "A petición del cliente", hint: "El cliente solicitó la baja." },
  { key: "ERROR", label: "Error de captura", hint: "Cliente registrado por equivocación." },
];

interface Props {
  customerId: string;
  customerName: string;
  trigger?: React.ReactNode;
  onClose?: () => void;
}

export function DeleteCustomerDialog({
  customerId,
  customerName,
  trigger,
  onClose,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<DeleteReason>("DUPLICATE");
  const [loading, setLoading] = useState(false);

  const close = (): void => {
    setOpen(false);
    onClose?.();
  };

  const submit = async (): Promise<void> => {
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Cliente eliminado");
        router.replace("/customers");
        router.refresh();
      } else {
        toast.error(json.error ?? "No se pudo eliminar");
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <span onClick={() => setOpen(true)} className="contents">
        {trigger}
      </span>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: "rgba(0,0,0,0.45)" }}
          onClick={close}
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
                Eliminar cliente
              </h2>
              <button
                onClick={close}
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
              quedará oculto del directorio. Sus ventas, órdenes y movimientos
              históricos siguen disponibles desde sus respectivos módulos. Un
              MANAGER+ puede restaurarlo desde &quot;Mostrar eliminados&quot; en
              el directorio.
            </p>

            <div className="flex flex-col gap-2">
              <span
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Motivo
              </span>
              <div className="flex flex-col gap-1.5">
                {REASONS.map((r) => {
                  const active = r.key === reason;
                  return (
                    <button
                      key={r.key}
                      type="button"
                      onClick={() => setReason(r.key)}
                      className="text-left px-3 py-2.5 rounded-[var(--r-md)] flex items-start gap-2"
                      style={{
                        background: active ? "var(--p-container)" : "var(--surf-low)",
                        color: active ? "var(--on-p-container)" : "var(--on-surf)",
                      }}
                    >
                      <span
                        className="h-3.5 w-3.5 rounded-full mt-0.5 shrink-0"
                        style={{
                          background: active ? "var(--p)" : "var(--surf-high)",
                          border: active ? "none" : "1px solid var(--ghost-border)",
                        }}
                      />
                      <span className="flex-1 min-w-0">
                        <div className="text-sm font-semibold">{r.label}</div>
                        <div
                          className="text-[0.6875rem] mt-0.5"
                          style={{ color: active ? "var(--on-p-container)" : "var(--on-surf-var)" }}
                        >
                          {r.hint}
                        </div>
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-1">
              <button
                onClick={close}
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
                className="px-5 py-2 text-sm font-semibold disabled:opacity-50"
                style={{
                  borderRadius: "var(--r-full)",
                  background: "var(--ter)",
                  color: "var(--on-p)",
                  fontFamily: "var(--font-display)",
                  border: "none",
                }}
              >
                {loading ? "Eliminando…" : "Eliminar cliente"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
