"use client";

import { useState, useSyncExternalStore } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { useAuthorizationPolling } from "./use-authorization-polling";

export interface DiscountAuthorizationResult {
  authorizationId: string;
  approverName: string;
}

export type AuthorizationPanelTipo = "DESCUENTO" | "CIERRE_DIFERENCIA";

/**
 * Panel inline para autorizar descuentos en el POS y cierres con diferencia en Caja.
 *
 * Dos modos:
 * - PRESENCIAL: manager teclea PIN → respuesta inmediata.
 * - REMOTA: crea solicitud PENDING y hace polling cada 3s hasta terminal.
 *
 * Estados visuales:
 * - idle: input PIN + botón OK + link "solicitar remoto"
 * - presencial-verifying: loader en el botón OK
 * - remote-pending: "Esperando aprobación" + countdown + botón cancelar
 * - rejected/expired: mensaje de error con botón reintentar
 */
export function DiscountAuthorizationPanel({
  amount,
  reason,
  tipo = "DESCUENTO",
  onAuthorized,
  onRejected,
  onExpired,
  onCancel,
}: {
  branchId?: string;
  amount: number;
  reason: string;
  tipo?: AuthorizationPanelTipo;
  onAuthorized: (result: DiscountAuthorizationResult) => void;
  /**
   * Se dispara cuando el polling detecta REJECTED. Si está definido, el panel
   * delega al parent y deja su estado interno en idle (el parent suele cambiar
   * de step/desmontar el panel). Si es undefined, el panel muestra el UI inline
   * de "Rechazado" con botón Reintentar (backward-compat).
   */
  onRejected?: (rejectReason: string | null) => void;
  /** Idem onRejected pero para EXPIRED (timeout del polling remoto de 5 min). */
  onExpired?: () => void;
  /**
   * Se dispara cuando el usuario cancela una solicitud REMOTA en curso (botón X
   * sobre el estado "Esperando aprobación"). Opcional — el panel siempre resetea
   * su estado interno; este callback solo permite al parent reaccionar.
   */
  onCancel?: () => void;
}) {
  const [pin, setPin] = useState("");
  const [pinError, setPinError] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);

  const { state, start, reset } = useAuthorizationPolling({
    onTerminal: (s) => {
      if (s.kind === "approved") {
        onAuthorized({
          authorizationId: s.id,
          approverName: s.approverName ?? "Gerente",
        });
      } else if (s.kind === "rejected" && onRejected) {
        onRejected(s.rejectReason);
        reset();
      } else if (s.kind === "expired" && onExpired) {
        onExpired();
        reset();
      }
      // Si no hay callback (DESCUENTO legacy), el panel queda en el estado
      // terminal y renderiza el UI inline de Rechazado/Expirado con Reintentar.
    },
  });

  const handleCancelPending = (): void => {
    reset();
    onCancel?.();
  };

  const handlePresencial = async (): Promise<void> => {
    if (!pin) return;
    setVerifying(true);
    setPinError(null);
    try {
      const res = await fetch("/api/auth-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          mode: "PRESENCIAL",
          pin,
          monto: amount,
          motivo: reason || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setPinError(json.error ?? "PIN incorrecto");
        setPin("");
        return;
      }
      setPin("");
      onAuthorized({
        authorizationId: json.data.id,
        approverName: json.data.approverName ?? "Gerente",
      });
      const successLabel =
        tipo === "CIERRE_DIFERENCIA" ? "Diferencia" : "Descuento";
      toast.success(`${successLabel} autorizado por ${json.data.approverName}`);
    } catch {
      setPinError("Error de red");
    } finally {
      setVerifying(false);
    }
  };

  const handleSolicitarRemoto = async (): Promise<void> => {
    if (amount <= 0) return;
    setPinError(null);
    try {
      const res = await fetch("/api/auth-requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tipo,
          mode: "REMOTA",
          monto: amount,
          motivo: reason || undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo solicitar autorización");
        return;
      }
      const expiresAt = json.data.expiresAt ? new Date(json.data.expiresAt) : null;
      start(json.data.id, expiresAt);
      toast.success("Solicitud enviada a gerencia");
    } catch {
      toast.error("Error de red");
    }
  };

  // Terminal aprobado — el parent ya recibió el callback y ocultará este panel
  // (discountAuthorized != null). Retornamos null para no renderizar nada.
  if (state.kind === "approved") return null;

  // Estado pendiente remoto
  if (state.kind === "pending") {
    return (
      <div
        className="flex items-center gap-2 px-2 py-1.5 rounded-lg"
        style={{
          background: "var(--surf-low)",
          border: "1px solid rgba(178,204,192,0.2)",
        }}
      >
        <Loader2 className="w-3 h-3 animate-spin" style={{ color: "var(--p)" }} />
        <div className="flex-1">
          <p className="text-[9px] font-medium" style={{ color: "var(--on-surf)" }}>
            Esperando aprobación…
          </p>
          <p className="text-[8px]" style={{ color: "var(--on-surf-var)" }}>
            <CountdownLabel expiresAt={state.expiresAt} />
          </p>
        </div>
        <button
          onClick={handleCancelPending}
          className="p-1 rounded"
          title="Cancelar solicitud"
          style={{ color: "var(--on-surf-var)" }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    );
  }

  // Estado terminal negativo
  if (state.kind === "rejected" || state.kind === "expired" || state.kind === "error") {
    const label =
      state.kind === "rejected"
        ? state.rejectReason
          ? `Rechazado: ${state.rejectReason}`
          : `Rechazado por ${state.approverName ?? "gerencia"}`
        : state.kind === "expired"
          ? "Solicitud expirada"
          : state.message;
    return (
      <div
        className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg"
        style={{
          background: "rgba(220,38,38,0.08)",
          border: "1px solid rgba(220,38,38,0.25)",
        }}
      >
        <p className="flex-1 text-[9px] font-medium" style={{ color: "#dc2626" }}>
          {label}
        </p>
        <button
          onClick={reset}
          className="px-1.5 py-1 rounded text-[9px] font-medium"
          style={{ background: "#dc2626", color: "#fff" }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  // idle
  return (
    <div className="space-y-1.5">
      <div className="flex gap-1.5">
        <input
          type="password"
          inputMode="numeric"
          pattern="\d*"
          maxLength={6}
          className={`flex-1 px-2 py-1.5 text-[10px] rounded-lg focus:outline-none ${pinError ? "animate-pulse" : ""}`}
          style={{
            background: "var(--surf-low)",
            border: pinError
              ? "1px solid var(--ter)"
              : "1px solid rgba(178,204,192,0.2)",
            color: "var(--on-surf)",
          }}
          placeholder="PIN Manager…"
          value={pin}
          onChange={(e) => {
            setPin(e.target.value.replace(/\D/g, ""));
            setPinError(null);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void handlePresencial();
          }}
        />
        <button
          onClick={() => void handlePresencial()}
          disabled={verifying || !pin}
          className="px-2 py-1.5 rounded-lg text-[9px] font-medium"
          style={{
            background: "linear-gradient(135deg, #1B4332, #2ECC71)",
            color: "var(--on-primary)",
            opacity: verifying || !pin ? 0.6 : 1,
          }}
        >
          {verifying ? <Loader2 className="w-3 h-3 animate-spin" /> : "OK"}
        </button>
      </div>
      {pinError && (
        <p className="text-[9px]" style={{ color: "var(--ter)" }}>
          {pinError}
        </p>
      )}
      <button
        type="button"
        onClick={() => void handleSolicitarRemoto()}
        className="w-full text-[9px] underline"
        style={{ color: "var(--on-surf-var)" }}
      >
        O solicitar autorización remota
      </button>
    </div>
  );
}

// Reloj compartido — un solo setInterval mientras haya ≥1 suscriptor.
// useSyncExternalStore evita la regla `react-hooks/purity` sobre `Date.now()`.
let nowSnapshot: number | null = null;
const nowListeners = new Set<() => void>();
let nowIntervalId: ReturnType<typeof setInterval> | null = null;

function subscribeNow(callback: () => void): () => void {
  nowListeners.add(callback);
  if (nowIntervalId === null) {
    nowSnapshot = Date.now();
    nowIntervalId = setInterval(() => {
      nowSnapshot = Date.now();
      nowListeners.forEach((cb) => cb());
    }, 1000);
  }
  return () => {
    nowListeners.delete(callback);
    if (nowListeners.size === 0 && nowIntervalId !== null) {
      clearInterval(nowIntervalId);
      nowIntervalId = null;
      nowSnapshot = null;
    }
  };
}
const getNowSnapshot = (): number | null => nowSnapshot;
const getNowServerSnapshot = (): number | null => null;

function CountdownLabel({ expiresAt }: { expiresAt: Date | null }) {
  const now = useSyncExternalStore(subscribeNow, getNowSnapshot, getNowServerSnapshot);
  if (!expiresAt) return <>sin límite</>;
  if (now === null) return <>…</>;
  const remainingMs = expiresAt.getTime() - now;
  if (remainingMs <= 0) return <>expirando…</>;
  const seconds = Math.ceil(remainingMs / 1000);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return (
    <>
      expira en {mins}:{secs.toString().padStart(2, "0")}
    </>
  );
}
