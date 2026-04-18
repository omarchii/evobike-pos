"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import { ShieldAlert, CheckCircle2, XCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PendingRequest {
  id: string;
  branchCode: string | null;
  branchName: string | null;
  tipo: "CANCELACION" | "DESCUENTO" | "CIERRE_DIFERENCIA";
  mode: "PRESENCIAL" | "REMOTA";
  saleId: string | null;
  saleFolio: string | null;
  saleTotal: number | null;
  requestedBy: string;
  requesterName: string | null;
  monto: number | null;
  motivo: string | null;
  expiresAt: string | null;
  createdAt: string;
}

function tipoLabel(tipo: PendingRequest["tipo"]): string {
  if (tipo === "CANCELACION") return "Cancelación";
  if (tipo === "CIERRE_DIFERENCIA") return "Cierre con diferencia";
  return "Descuento";
}

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

function modalStyle(): React.CSSProperties {
  return {
    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
  };
}

// Reloj compartido para todos los CountdownLabel — un solo setInterval activo
// mientras haya ≥1 suscriptor. useSyncExternalStore evita `set-state-in-effect`.
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

interface AuthorizationInboxProps {
  /** Título del panel. Por defecto "Autorizaciones pendientes". */
  title?: string;
  /**
   * Qué renderizar cuando no hay solicitudes. Por defecto `null` — el panel
   * se oculta. Para el módulo de Caja se pasa un empty state con ícono y
   * mensaje informativo.
   */
  emptyState?: React.ReactNode;
  /** Footer opcional (por ejemplo link a `/autorizaciones`). */
  footer?: React.ReactNode;
}

/**
 * Bandeja compartida de solicitudes de autorización pendientes. Polling cada 10s.
 *
 * Cleanup riguroso: setInterval limpiado en el return del useEffect, flag `cancelled`
 * via AbortController para que un fetch en vuelo no escriba state tras unmount.
 *
 * Consumido desde `/` (manager dashboard) y `/cash-register`.
 */
export function AuthorizationInbox({
  title = "Autorizaciones pendientes",
  emptyState = null,
  footer = null,
}: AuthorizationInboxProps = {}) {
  const [pending, setPending] = useState<PendingRequest[]>([]);
  const [resolving, setResolving] = useState<{
    request: PendingRequest;
    action: "APPROVE" | "REJECT";
  } | null>(null);

  const fetchPending = useCallback(async (signal?: AbortSignal): Promise<void> => {
    try {
      const res = await fetch("/api/auth-requests/pending", {
        cache: "no-store",
        signal,
      });
      const json = await res.json();
      if (!res.ok || !json.success) return;
      setPending(json.data);
    } catch {
      // Silencio en refresh automático; errores de red son transitorios.
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    // Defer inicial + interval: mantienen el setState fuera del cuerpo
    // síncrono del efecto (compiler-safe).
    const timeoutId = setTimeout(() => {
      void fetchPending(controller.signal);
    }, 0);
    const intervalId = setInterval(
      () => void fetchPending(controller.signal),
      10_000,
    );
    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
      controller.abort();
    };
  }, [fetchPending]);

  if (pending.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <>
      <div
        className="rounded-[var(--r-lg)] p-5"
        style={{
          background: "color-mix(in srgb, var(--warn) 6%, var(--surf-lowest))",
          border: "1px solid color-mix(in srgb, var(--warn) 25%, transparent)",
        }}
      >
        <div className="flex items-center gap-2 mb-3">
          <ShieldAlert className="h-4 w-4" style={{ color: "var(--warn)" }} />
          <h3
            className="text-xs font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--on-surf)" }}
          >
            {title} ({pending.length})
          </h3>
        </div>
        <div className="space-y-2">
          {pending.map((r) => (
            <div
              key={r.id}
              className="flex flex-wrap items-center justify-between gap-3 px-3 py-2.5 rounded-[var(--r-md)]"
              style={{ background: "var(--surf-lowest)" }}
            >
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2 text-xs font-medium mb-0.5">
                  <span style={{ color: "var(--on-surf)" }}>
                    {tipoLabel(r.tipo)}
                  </span>
                  {r.tipo !== "CANCELACION" && r.monto != null && (
                    <span style={{ color: "var(--warn)" }}>
                      ${r.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </span>
                  )}
                  {r.saleFolio && (
                    <span style={{ color: "var(--on-surf-var)" }}>· {r.saleFolio}</span>
                  )}
                  {r.branchCode && (
                    <span style={{ color: "var(--on-surf-var)" }}>· {r.branchCode}</span>
                  )}
                </div>
                <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                  {r.requesterName ?? "—"} ·{" "}
                  <CountdownLabel expiresAt={r.expiresAt} />
                </p>
                {r.motivo && (
                  <p className="text-xs italic mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                    {r.motivo}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => setResolving({ request: r, action: "REJECT" })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1"
                  style={{
                    background: "var(--ter-container)",
                    color: "var(--on-ter-container)",
                  }}
                >
                  <XCircle className="w-3 h-3" />
                  Rechazar
                </button>
                <button
                  onClick={() => setResolving({ request: r, action: "APPROVE" })}
                  className="px-3 py-1.5 rounded-lg text-xs font-medium inline-flex items-center gap-1"
                  style={{ background: "var(--p)", color: "#fff" }}
                >
                  <CheckCircle2 className="w-3 h-3" />
                  Aprobar
                </button>
              </div>
            </div>
          ))}
        </div>
        {footer && <div className="mt-3">{footer}</div>}
      </div>

      {resolving && (
        <ResolveDialog
          request={resolving.request}
          action={resolving.action}
          onClose={() => setResolving(null)}
          onResolved={() => {
            setPending((prev) => prev.filter((x) => x.id !== resolving.request.id));
            setResolving(null);
          }}
        />
      )}
    </>
  );
}

function ResolveDialog({
  request,
  action,
  onClose,
  onResolved,
}: {
  request: PendingRequest;
  action: "APPROVE" | "REJECT";
  onClose: () => void;
  onResolved: () => void;
}) {
  const [pin, setPin] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      setError("PIN inválido");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth-requests/${request.id}/resolve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          pin,
          rejectReason: action === "REJECT" ? rejectReason || undefined : undefined,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        setError(json.error ?? "No se pudo resolver");
        return;
      }
      toast.success(action === "APPROVE" ? "Solicitud aprobada" : "Solicitud rechazada");
      onResolved();
    } catch {
      setError("Error de red");
    } finally {
      setSubmitting(false);
    }
  };

  const title =
    action === "APPROVE"
      ? "Aprobar solicitud"
      : "Rechazar solicitud";

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-md" style={modalStyle()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            {title}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="px-6 pb-6 space-y-3">
          <div
            className="rounded-xl p-3 text-sm space-y-0.5"
            style={{ background: "var(--surf-low)" }}
          >
            <p style={{ color: "var(--on-surf)" }}>
              <strong>{tipoLabel(request.tipo)}</strong>
              {request.tipo !== "CANCELACION" && request.monto != null && (
                <> de ${request.monto.toLocaleString("es-MX", { minimumFractionDigits: 2 })}</>
              )}
              {request.saleFolio && <> en {request.saleFolio}</>}
            </p>
            <p style={{ color: "var(--on-surf-var)" }}>
              Solicitado por {request.requesterName ?? "—"}
            </p>
            {request.motivo && (
              <p className="italic" style={{ color: "var(--on-surf-var)" }}>
                &ldquo;{request.motivo}&rdquo;
              </p>
            )}
          </div>

          {action === "REJECT" && (
            <div>
              <label
                className="block text-xs font-medium uppercase tracking-wide mb-1.5"
                style={{ color: "var(--on-surf-var)" }}
              >
                Motivo del rechazo (opcional)
              </label>
              <input
                type="text"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                style={INPUT_STYLE}
                placeholder="Ej. descuento excesivo"
              />
            </div>
          )}

          <div>
            <label
              className="block text-xs font-medium uppercase tracking-wide mb-1.5"
              style={{ color: "var(--on-surf-var)" }}
            >
              Tu PIN (4–6 dígitos)
            </label>
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={pin}
              onChange={(e) => {
                setPin(e.target.value.replace(/\D/g, ""));
                setError(null);
              }}
              style={INPUT_STYLE}
              autoFocus
            />
            {error && (
              <p className="text-xs mt-1" style={{ color: "var(--ter)" }}>
                {error}
              </p>
            )}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={submitting || !pin}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{
                background: action === "APPROVE" ? "var(--p)" : "var(--ter)",
                color: "var(--on-p)",
                opacity: submitting || !pin ? 0.5 : 1,
              }}
            >
              {submitting ? "Procesando…" : action === "APPROVE" ? "Aprobar" : "Rechazar"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CountdownLabel({ expiresAt }: { expiresAt: string | null }) {
  // useSyncExternalStore mantiene el reloj fuera del ciclo de render
  // sin triggerear la regla `react-hooks/set-state-in-effect`. SSR snapshot = null.
  const now = useSyncExternalStore(subscribeNow, getNowSnapshot, getNowServerSnapshot);
  if (!expiresAt || now === null) {
    return (
      <span className="inline-flex items-center gap-1">
        <Clock className="w-3 h-3" />
        sin expiración
      </span>
    );
  }
  const ms = new Date(expiresAt).getTime() - now;
  if (ms <= 0) return <>expirando</>;
  const s = Math.ceil(ms / 1000);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return (
    <span className="inline-flex items-center gap-1">
      <Clock className="w-3 h-3" />
      expira en {m}:{r.toString().padStart(2, "0")}
    </span>
  );
}
