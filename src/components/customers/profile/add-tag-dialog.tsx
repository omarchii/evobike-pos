"use client";

// Modal "Agregar tag" (BRIEF §8 — Sub-fase I). MANAGER+.
// Escribe vía PATCH /api/customers/[id]/tags.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";

interface Props {
  customerId: string;
  existingTags: string[];
}

export function AddTagDialog({
  customerId,
  existingTags,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tag, setTag] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    const trimmed = tag.trim();
    if (trimmed.length === 0) {
      toast.error("El tag no puede estar vacío");
      return;
    }
    if (trimmed.length > 32) {
      toast.error("Máximo 32 caracteres");
      return;
    }
    if (existingTags.includes(trimmed)) {
      toast.error("Ese tag ya existe");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ add: [trimmed] }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Tag agregado");
        setOpen(false);
        setTag("");
        router.refresh();
      } else {
        toast.error(json.error ?? "No se pudo agregar");
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
        className="inline-flex items-center gap-1 px-2 py-0.5 text-[0.625rem] font-medium tracking-[0.04em] uppercase"
        style={{
          borderRadius: "var(--r-full)",
          background: "var(--surf-high)",
          color: "var(--on-surf)",
        }}
      >
        <Icon name="plus" size={10} />
        Agregar tag
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
            className="w-full max-w-sm p-6 flex flex-col gap-5"
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
                Agregar tag
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
                Nombre del tag
              </label>
              <input
                type="text"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
                maxLength={32}
                placeholder="Ej. VIP, Mayoreo, Preferente"
                className="w-full px-3 py-2.5 outline-none text-sm"
                autoFocus
                style={{
                  background: "var(--surf-lowest)",
                  borderRadius: "var(--r-md)",
                  border: "1px solid var(--ghost-border)",
                  color: "var(--on-surf)",
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void submit();
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
                  background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
                  color: "var(--on-p)",
                  fontFamily: "var(--font-display)",
                  border: "none",
                }}
              >
                {loading ? "Guardando…" : "Agregar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
