"use client";

import { useEffect, useState } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuthorizationPolling } from "./use-authorization-polling";

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body, 'Inter')",
  fontSize: "0.875rem",
  height: 44,
  width: "100%",
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  outline: "none",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--on-surf-var)",
  marginBottom: "0.375rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

function modalStyle(): React.CSSProperties {
  return {
    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
  };
}

type AuthStep = "idle" | "verifying" | "waiting-remote" | "ready";

/**
 * Modal para cancelar una venta con autorización PIN/remota.
 *
 * Regla del server:
 * - MANAGER/ADMIN: puede cancelar sin autorización (se pasa authorizationId=undefined).
 * - SELLER: obligado a conseguir authorizationId APPROVED.
 *
 * Flujo UI:
 * 1. Usuario escribe motivo (obligatorio).
 * 2. Si es MANAGER/ADMIN → botón "Cancelar venta" envía directo.
 *    Si es SELLER → botón "Autorizar con PIN" o "Solicitar remoto" primero.
 * 3. Una vez aprobado, el botón final de confirmación envía el POST.
 */
export function CancelSaleModal({
  saleId,
  saleFolio,
  saleTotal,
  userRole,
  onCancelled,
  onClose,
}: {
  saleId: string;
  saleFolio: string;
  saleTotal: number;
  userRole: string;
  onCancelled: () => void;
  onClose: () => void;
}) {
  const isManager = userRole === "MANAGER" || userRole === "ADMIN";
  const [motivo, setMotivo] = useState("");
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [authId, setAuthId] = useState<string | null>(null);
  const [approverName, setApproverName] = useState<string | null>(null);
  const [step, setStep] = useState<AuthStep>(isManager ? "ready" : "idle");
  const [submitting, setSubmitting] = useState(false);

  const { state: pollState, start: startPolling, reset: resetPolling } =
    useAuthorizationPolling({
      onTerminal: (s) => {
        if (s.kind === "approved") {
          setAuthId(s.id);
          setApproverName(s.approverName);
          setStep("ready");
          toast.success(`Cancelación autorizada por ${s.approverName ?? "gerencia"}`);
        }
      },
    });

  // Limpiar polling al desmontar (el hook ya lo hace, pero somos explícitos).
  useEffect(() => {
    return () => resetPolling();
  }, [resetPolling]);

  const handlePresencial = async (): Promise<void> => {
    if (!motivo.trim()) {
      toast.error("El motivo de cancelación es obligatorio");
      return;
    }
    if (!pin) return;
    setStep("verifying");
    setPinError(null);
    try {
      const res = await fetch("/api/auth-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "CANCELACION",
          mode: "PRESENCIAL",
          pin,
          saleId,
          motivo,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPinError(json.error ?? "PIN incorrecto");
        setPin("");
        setStep("idle");
        return;
      }
      setAuthId(json.data.id);
      setApproverName(json.data.approverName ?? null);
      setPin("");
      setStep("ready");
      toast.success(`Autorizado por ${json.data.approverName}`);
    } catch {
      setPinError("Error de red");
      setStep("idle");
    }
  };

  const handleSolicitarRemoto = async (): Promise<void> => {
    if (!motivo.trim()) {
      toast.error("El motivo de cancelación es obligatorio");
      return;
    }
    try {
      const res = await fetch("/api/auth-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo: "CANCELACION",
          mode: "REMOTA",
          saleId,
          motivo,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo solicitar autorización");
        return;
      }
      const expiresAt = json.data.expiresAt ? new Date(json.data.expiresAt) : null;
      startPolling(json.data.id, expiresAt);
      setStep("waiting-remote");
      toast.success("Solicitud enviada a gerencia");
    } catch {
      toast.error("Error de red");
    }
  };

  const handleConfirmCancel = async (): Promise<void> => {
    if (!motivo.trim()) {
      toast.error("El motivo de cancelación es obligatorio");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch(`/api/sales/${saleId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          motivo,
          authorizationId: authId ?? undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo cancelar la venta");
        return;
      }
      toast.success("Venta cancelada");
      onCancelled();
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setSubmitting(false);
    }
  };

  const canSubmit =
    motivo.trim().length > 0 && (isManager || step === "ready");

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-md" style={modalStyle()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            Cancelar venta {saleFolio}
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          <div
            className="rounded-xl p-3"
            style={{ background: "rgba(220,38,38,0.08)", border: "1px solid rgba(220,38,38,0.2)" }}
          >
            <p className="text-sm" style={{ color: "var(--on-surf)" }}>
              Esta acción revertirá stock, comisiones y cobros. Total de la venta:{" "}
              <strong>${saleTotal.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</strong>.
            </p>
          </div>

          <div>
            <label style={LABEL_STYLE}>Motivo de la cancelación</label>
            <textarea
              rows={3}
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              style={{ ...INPUT_STYLE, height: "auto", paddingTop: 10, paddingBottom: 10, resize: "vertical" as const }}
              placeholder="Ej. cliente cambió de opinión"
              autoFocus
            />
          </div>

          {/* Panel de autorización solo para SELLER */}
          {!isManager && step === "idle" && (
            <div className="space-y-3">
              <div>
                <label style={LABEL_STYLE}>PIN del gerente (presencial)</label>
                <div className="flex gap-2">
                  <input
                    type="password"
                    inputMode="numeric"
                    pattern="\d*"
                    maxLength={6}
                    value={pin}
                    onChange={(e) => {
                      setPin(e.target.value.replace(/\D/g, ""));
                      setPinError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void handlePresencial();
                    }}
                    style={INPUT_STYLE}
                    placeholder="••••"
                  />
                  <button
                    type="button"
                    onClick={() => void handlePresencial()}
                    disabled={!pin || !motivo.trim()}
                    className="px-4 rounded-xl text-sm font-medium"
                    style={{
                      background: "var(--p)",
                      color: "#fff",
                      opacity: !pin || !motivo.trim() ? 0.5 : 1,
                    }}
                  >
                    Autorizar
                  </button>
                </div>
                {pinError && (
                  <p className="text-xs mt-1" style={{ color: "#dc2626" }}>
                    {pinError}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => void handleSolicitarRemoto()}
                disabled={!motivo.trim()}
                className="w-full text-sm underline"
                style={{
                  color: "var(--on-surf-var)",
                  opacity: !motivo.trim() ? 0.5 : 1,
                }}
              >
                O solicitar autorización remota
              </button>
            </div>
          )}

          {!isManager && step === "verifying" && (
            <div
              className="flex items-center gap-3 p-3 rounded-xl"
              style={{ background: "var(--surf-low)" }}
            >
              <Loader2 className="w-4 h-4 animate-spin" style={{ color: "var(--p)" }} />
              <p className="text-sm" style={{ color: "var(--on-surf)" }}>
                Verificando PIN…
              </p>
            </div>
          )}

          {!isManager && step === "waiting-remote" && (
            <div
              className="flex items-start gap-3 p-3 rounded-xl"
              style={{ background: "var(--surf-low)" }}
            >
              <Loader2 className="w-4 h-4 animate-spin mt-0.5" style={{ color: "var(--p)" }} />
              <div className="flex-1">
                <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                  Esperando aprobación del gerente…
                </p>
                {pollState.kind === "pending" && pollState.expiresAt && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                    Expira en{" "}
                    {Math.max(
                      0,
                      Math.ceil((pollState.expiresAt.getTime() - Date.now()) / 60000),
                    )}{" "}
                    min
                  </p>
                )}
                {(pollState.kind === "rejected" ||
                  pollState.kind === "expired" ||
                  pollState.kind === "error") && (
                  <p className="text-xs mt-1" style={{ color: "#dc2626" }}>
                    {pollState.kind === "rejected"
                      ? `Rechazado${pollState.rejectReason ? `: ${pollState.rejectReason}` : ""}`
                      : pollState.kind === "expired"
                        ? "Solicitud expirada"
                        : pollState.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  resetPolling();
                  setStep("idle");
                }}
                className="p-1 rounded"
                style={{ color: "var(--on-surf-var)" }}
                title="Cancelar solicitud"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === "ready" && !isManager && (
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{
                background: "color-mix(in srgb, var(--p) 10%, transparent)",
                border: "1px solid color-mix(in srgb, var(--p) 25%, transparent)",
              }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--p)" }}>
                ✓ Autorizado{approverName ? ` por ${approverName}` : ""}
              </p>
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{
                background: "var(--surf-high)",
                color: "var(--on-surf)",
                opacity: submitting ? 0.5 : 1,
              }}
            >
              Cerrar
            </button>
            <button
              type="button"
              onClick={() => void handleConfirmCancel()}
              disabled={!canSubmit || submitting}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{
                background: "#dc2626",
                color: "#fff",
                opacity: !canSubmit || submitting ? 0.5 : 1,
              }}
            >
              {submitting ? "Cancelando…" : "Cancelar venta"}
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
