"use client";

// Modal "Nueva nota / interacción" (BRIEF §8 — Sub-fase E).
// Crea entrada en CustomerNote vía POST /api/customers/[id]/notes.
// MANAGER+ puede pinear desde el form (server lo ignora si no tiene rol).

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";

type NoteKind = "NOTE" | "PHONE_CALL" | "WHATSAPP_SENT" | "EMAIL_SENT";

const KINDS: Array<{ key: NoteKind; label: string }> = [
  { key: "NOTE", label: "Nota interna" },
  { key: "PHONE_CALL", label: "Llamada" },
  { key: "WHATSAPP_SENT", label: "WhatsApp" },
  { key: "EMAIL_SENT", label: "Email" },
];

interface Props {
  customerId: string;
  canPin: boolean;
  /** Llamado tras crear con éxito para refrescar timeline / sidebar. */
  onCreated?: () => void;
  trigger?: React.ReactNode;
}

export function AddNoteDialog({
  customerId,
  canPin,
  onCreated,
  trigger,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<NoteKind>("NOTE");
  const [body, setBody] = useState("");
  const [pinned, setPinned] = useState(false);
  const [loading, setLoading] = useState(false);

  const reset = (): void => {
    setKind("NOTE");
    setBody("");
    setPinned(false);
  };

  const submit = async (): Promise<void> => {
    const text = body.trim();
    if (text.length === 0) {
      toast.error("Escribe el contenido de la nota");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, body: text, pinned }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Nota guardada");
        setOpen(false);
        reset();
        onCreated?.();
        router.refresh();
      } else {
        toast.error(json.error ?? "No se pudo guardar");
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
        {trigger ?? (
          <button
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            style={{
              borderRadius: "var(--r-full)",
              background: "var(--p-container)",
              color: "var(--on-p-container)",
              fontFamily: "var(--font-display)",
            }}
          >
            <Icon name="plus" size={13} />
            Nueva nota / interacción
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
                Nueva nota o interacción
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

            <div className="flex flex-col gap-2">
              <label
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Categoría
              </label>
              <div className="flex flex-wrap gap-1.5">
                {KINDS.map((k) => {
                  const active = k.key === kind;
                  return (
                    <button
                      key={k.key}
                      type="button"
                      onClick={() => setKind(k.key)}
                      className="rounded-[var(--r-full)] px-3 py-1.5 text-xs"
                      style={{
                        background: active ? "var(--p-container)" : "var(--surf-low)",
                        color: active ? "var(--on-p-container)" : "var(--on-surf-var)",
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      {k.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label
                className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Contenido
              </label>
              <textarea
                rows={5}
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Resumen breve de la conversación, acuerdo, recordatorio…"
                className="w-full px-3 py-2.5 outline-none text-sm resize-none"
                style={{
                  background: "var(--surf-lowest)",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--ghost-border)",
                  color: "var(--on-surf)",
                  fontFamily: "var(--font-body)",
                }}
              />
            </div>

            {canPin && (
              <label
                className="flex items-center gap-2 text-xs cursor-pointer"
                style={{ color: "var(--on-surf-var)" }}
              >
                <input
                  type="checkbox"
                  checked={pinned}
                  onChange={(e) => setPinned(e.target.checked)}
                />
                Pinear como nota crítica (visible en sidebar)
              </label>
            )}

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
