"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface ApprovalActionsProps {
  approvalId: string;
  token: string;
  expiresAt: Date;
}

type Decision = "APPROVED" | "REJECTED";

// Formatea ms restantes como "Xh Ym". Para <1h muestra "Xmin".
// Si negativo retorna null (el caller pinta estado expirado).
function formatRemaining(ms: number): string | null {
  if (ms <= 0) return null;
  const totalMinutes = Math.floor(ms / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  if (hours === 0) return `${Math.max(mins, 1)} min`;
  return `${hours} h ${mins} min`;
}

export default function ApprovalActions({
  approvalId,
  token,
  expiresAt,
}: ApprovalActionsProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState<Decision | null>(null);
  const [now, setNow] = useState<number>(() => Date.now());

  // Ticker cada 60s — granularidad minutos es suficiente para una expiración
  // de 48h. Cuando el countdown cruza cero, el siguiente tick renderiza el
  // estado expirado (sin necesidad de router.refresh explícito acá — el
  // backend ya marcará el approval como EXPIRED en el próximo respond o
  // lazy-check).
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, []);

  const remainingMs = expiresAt.getTime() - now;
  const remainingLabel = formatRemaining(remainingMs);
  const isExpired = remainingLabel === null;

  async function submit(decision: Decision) {
    if (submitting !== null || isExpired) return;
    setSubmitting(decision);
    try {
      const res = await fetch(
        `/api/service-orders/public/${token}/approvals/${approvalId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision }),
        },
      );

      const data = (await res.json().catch(() => ({}))) as {
        success?: boolean;
        code?: string;
        error?: string;
      };

      if (res.ok && data.success) {
        toast.success(
          decision === "APPROVED"
            ? "¡Gracias! Registramos tu aprobación."
            : "Registramos tu respuesta.",
        );
      } else if (res.status === 410 || data.code === "APPROVAL_EXPIRED") {
        toast.error("Esta solicitud expiró.");
      } else if (res.status === 409) {
        toast.message("Esta solicitud ya fue respondida.");
      } else if (res.status === 422) {
        toast.warning(data.error ?? "Esta orden ya no admite cambios.");
      } else {
        toast.error(
          data.error ?? "No pudimos procesar tu respuesta. Intenta de nuevo.",
        );
      }

      router.refresh();
    } catch {
      toast.error("No pudimos procesar tu respuesta. Intenta de nuevo.");
    } finally {
      setSubmitting(null);
    }
  }

  const anySubmitting = submitting !== null;
  const disabled = anySubmitting || isExpired;

  return (
    <div style={{ marginTop: "1rem" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "0.5rem",
        }}
      >
        <button
          type="button"
          onClick={() => submit("REJECTED")}
          disabled={disabled}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.625rem",
            border: "1px solid rgba(178, 204, 192, 0.6)",
            background: "#ffffff",
            color: "#b91c1c",
            fontWeight: 600,
            fontSize: "0.875rem",
            fontFamily: "inherit",
            cursor: disabled ? "not-allowed" : "pointer",
            opacity: disabled ? 0.55 : 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.4rem",
            transition: "opacity 0.15s",
          }}
        >
          {submitting === "REJECTED" && (
            <Loader2
              size={16}
              style={{ animation: "spin 0.8s linear infinite" }}
              aria-hidden="true"
            />
          )}
          Rechazar
        </button>
        <button
          type="button"
          onClick={() => submit("APPROVED")}
          disabled={disabled}
          style={{
            padding: "0.75rem 1rem",
            borderRadius: "0.625rem",
            border: "none",
            background: disabled ? "#9fc7b3" : "#1b4332",
            color: "#ffffff",
            fontWeight: 600,
            fontSize: "0.875rem",
            fontFamily: "inherit",
            cursor: disabled ? "not-allowed" : "pointer",
            boxShadow: disabled
              ? "none"
              : "0 4px 12px rgba(27, 67, 50, 0.2)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "0.4rem",
            transition: "background 0.15s, box-shadow 0.15s",
          }}
        >
          {submitting === "APPROVED" && (
            <Loader2
              size={16}
              style={{ animation: "spin 0.8s linear infinite" }}
              aria-hidden="true"
            />
          )}
          Aprobar
        </button>
      </div>

      <p
        style={{
          marginTop: "0.75rem",
          fontSize: "0.75rem",
          color: isExpired ? "#b91c1c" : "#b7791f",
          background: isExpired ? "#fdecea" : "#fef9e7",
          padding: "0.5rem 0.75rem",
          borderRadius: "0.5rem",
          textAlign: "center" as const,
          fontWeight: 500,
        }}
      >
        {isExpired ? "Esta solicitud expiró" : `Expira en ${remainingLabel}`}
      </p>

      {/* `@keyframes spin` inline — el portal vive fuera del stack Tailwind
          del POS, no podemos confiar en `animate-spin`. */}
      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
