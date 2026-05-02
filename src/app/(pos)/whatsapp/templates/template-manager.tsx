"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { extractPlaceholders } from "@/lib/whatsapp/render";

export interface TemplateRow {
  key: string;
  description: string;
  bodyTemplate: string;
  requiredVariables: string[];
  isActive: boolean;
  updatedAt: string;
  updatedByName: string | null;
}

export function TemplateManager({ rows }: { rows: TemplateRow[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<TemplateRow | null>(null);
  const [body, setBody] = useState("");
  const [description, setDescription] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function openEdit(row: TemplateRow) {
    setEditing(row);
    setBody(row.bodyTemplate);
    setDescription(row.description);
    setIsActive(row.isActive);
    setError("");
  }

  async function handleSave() {
    if (!editing) return;
    if (!body.trim() || !description.trim()) {
      setError("Descripción y cuerpo son requeridos.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/whatsapp/templates/${editing.key}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bodyTemplate: body, description, isActive }),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(typeof data.error === "string" ? data.error : "Error al guardar");
        return;
      }
      setEditing(null);
      router.refresh();
    } finally {
      setSaving(false);
    }
  }

  const previewVars = editing ? extractPlaceholders(body) : [];

  return (
    <>
      <div className="space-y-3">
        {rows.length === 0 ? (
          <div
            className="rounded-2xl px-5 py-10 text-center text-sm"
            style={{ background: "var(--surf-lowest)", color: "var(--on-surf-var)", boxShadow: "var(--shadow)" }}
          >
            No hay plantillas configuradas. Ejecuta el seed para crearlas.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={row.key}
              className="rounded-2xl p-5 flex items-center justify-between gap-4"
              style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span
                    className="text-sm font-medium"
                    style={{ color: "var(--on-surf)" }}
                  >
                    {row.description}
                  </span>
                  {!row.isActive && (
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium"
                      style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
                    >
                      Inactiva
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1">
                  <span className="text-xs font-mono" style={{ color: "var(--on-surf-var)" }}>
                    {row.key}
                  </span>
                  <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                    Variables: {row.requiredVariables.length > 0 ? row.requiredVariables.map((v) => `{{${v}}}`).join(", ") : "ninguna"}
                  </span>
                </div>
                {row.updatedByName && (
                  <p className="text-xs mt-1" style={{ color: "var(--on-surf-var)" }}>
                    Editada por {row.updatedByName} · {formatDate(row.updatedAt)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => openEdit(row)}
                className="px-4 py-2 rounded-xl text-sm font-medium shrink-0 transition-colors hover:bg-[var(--surf-high)]"
                style={{ color: "var(--p)" }}
              >
                Editar
              </button>
            </div>
          ))
        )}
      </div>

      {/* Edit dialog */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => { if (!open) setEditing(null); }}
      >
        <DialogContent
          className="p-0 gap-0 overflow-hidden"
          style={{
            background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "var(--shadow)",
            borderRadius: "var(--r-xl)",
            maxWidth: 560,
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}>
              Editar plantilla
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            {editing && (
              <p className="text-xs font-mono" style={{ color: "var(--on-surf-var)" }}>
                {editing.key}
              </p>
            )}

            <Field label="Descripción">
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                style={inputStyle(false)}
              />
            </Field>

            <Field label="Cuerpo del mensaje">
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={6}
                style={{
                  ...inputStyle(false),
                  resize: "vertical" as const,
                  fontFamily: "var(--font-body)",
                }}
              />
              <p className="text-xs mt-1" style={{ color: "var(--on-surf-var)" }}>
                Usa {"{{variable}}"} para insertar datos dinámicos.
              </p>
            </Field>

            {previewVars.length > 0 && (
              <div className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                Variables detectadas: {previewVars.map((v) => `{{${v}}}`).join(", ")}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: "var(--on-surf)" }}>
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Activa
            </label>

            {error && (
              <p className="text-xs" style={{ color: "var(--ter)" }}>{error}</p>
            )}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="flex-1 py-2.5 rounded-full text-sm font-medium transition-colors hover:bg-[var(--surf-high)]"
                style={{ color: "var(--on-surf-var)", background: "var(--surf-low)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "var(--velocity-gradient)", color: "#ffffff" }}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label
        className="text-xs font-medium mb-1.5 block"
        style={{ color: "var(--on-surf-var)" }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function inputStyle(hasError: boolean): React.CSSProperties {
  return {
    background: "var(--surf-low)",
    border: hasError ? "1.5px solid var(--ter)" : "1px solid var(--ghost-border)",
    borderRadius: "var(--r-md)",
    color: "var(--on-surf)",
    fontFamily: "var(--font-body)",
    fontSize: "0.875rem",
    padding: "0.65rem 0.75rem",
    width: "100%",
    outline: "none",
  };
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
