"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, ShieldCheck } from "lucide-react";

type QaPanelProps = {
  orderId: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED" | "DELIVERED" | "CANCELLED";
  qaPassedAt: string | null;
  qaPassedByName: string | null;
  qaNotes: string | null;
  userRole: string;
};

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function QaPanel({
  orderId,
  status,
  qaPassedAt,
  qaPassedByName,
  qaNotes,
  userRole,
}: QaPanelProps) {
  const router = useRouter();
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Solo visible cuando la orden ya está completada (o entregada para mostrar
  // el badge histórico). En el resto de estados QA no aplica todavía.
  if (status !== "COMPLETED" && status !== "DELIVERED") return null;

  // Badge histórico cuando ya se registró QA.
  if (qaPassedAt) {
    return (
      <div
        className="rounded-2xl p-5 space-y-3"
        style={{
          background: "var(--surf-lowest)",
          boxShadow: "var(--shadow)",
        }}
      >
        <h2
          style={{
            fontFamily: "var(--font-body)",
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.05em",
            textTransform: "uppercase",
            color: "var(--on-surf-var)",
          }}
        >
          Control de calidad
        </h2>
        <div
          className="rounded-xl px-4 py-3 space-y-1.5"
          style={{ background: "var(--sec-container)" }}
        >
          <div className="flex items-center gap-2">
            <ShieldCheck
              className="h-4 w-4"
              style={{ color: "var(--sec)" }}
            />
            <span
              style={{
                fontSize: "0.8125rem",
                fontWeight: 600,
                color: "var(--on-sec-container)",
              }}
            >
              QA aprobado
            </span>
          </div>
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--on-sec-container)",
              opacity: 0.85,
            }}
          >
            {qaPassedByName ?? "Usuario desconocido"} · {formatDate(qaPassedAt)}
          </p>
          {qaNotes && (
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--on-sec-container)",
                opacity: 0.85,
                marginTop: "0.25rem",
                fontStyle: "italic",
              }}
            >
              “{qaNotes}”
            </p>
          )}
        </div>
      </div>
    );
  }

  // Acción pendiente: solo MANAGER/ADMIN/TECHNICIAN pueden registrar QA
  // (el endpoint /qa rechaza SELLER con 403).
  if (userRole === "SELLER") return null;

  // status === "DELIVERED" sin qaPassedAt es estado inválido (orden COURTESY
  // entregada). No mostrar UI de acción.
  if (status === "DELIVERED") return null;

  const handleApprove = async () => {
    setSaving(true);
    toast.loading("Registrando QA…", { id: "qa-approve" });
    try {
      const res = await fetch(`/api/service-orders/${orderId}/qa`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          qaPassed: true,
          qaNotes: notes.trim() || undefined,
        }),
      });
      const data = (await res.json()) as { success: boolean; error?: string };
      if (data.success) {
        toast.success("QA registrado", { id: "qa-approve" });
        router.refresh();
      } else {
        toast.error(data.error ?? "No se pudo registrar el QA", { id: "qa-approve" });
      }
    } catch {
      toast.error("Error de red al registrar el QA", { id: "qa-approve" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      className="rounded-2xl p-5 space-y-4"
      style={{
        background: "var(--surf-lowest)",
        boxShadow: "var(--shadow)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--on-surf-var)",
        }}
      >
        Control de calidad
      </h2>

      <div
        className="rounded-xl px-4 py-3"
        style={{ background: "var(--warn-container)" }}
      >
        <p
          style={{
            fontSize: "0.8125rem",
            fontWeight: 500,
            color: "var(--warn)",
          }}
        >
          QA pendiente. Sin aprobar, la orden no puede entregarse
          (excepto cortesía).
        </p>
      </div>

      <div className="space-y-2">
        <label
          htmlFor="qa-notes"
          style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            color: "var(--on-surf-var)",
          }}
        >
          Notas (opcional)
        </label>
        <textarea
          id="qa-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          maxLength={1000}
          rows={3}
          placeholder="Observaciones de la revisión final…"
          disabled={saving}
          className="w-full resize-none rounded-lg px-3 py-2 outline-none transition-colors"
          style={{
            background: "var(--surf-low)",
            color: "var(--on-surf)",
            border: "1px solid var(--ghost-border)",
            fontSize: "0.8125rem",
          }}
        />
      </div>

      <button
        onClick={handleApprove}
        disabled={saving}
        className="w-full flex items-center justify-center gap-2 font-semibold text-sm transition-opacity disabled:opacity-50"
        style={{
          background: "linear-gradient(135deg, #1b4332, #2ecc71)",
          color: "#ffffff",
          borderRadius: "var(--r-full)",
          border: "none",
          height: 44,
          cursor: saving ? "not-allowed" : "pointer",
        }}
      >
        <CheckCircle2 className="h-4 w-4" />
        {saving ? "Registrando…" : "Marcar QA aprobado"}
      </button>
    </div>
  );
}
