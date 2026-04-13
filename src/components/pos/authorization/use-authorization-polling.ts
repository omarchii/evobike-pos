"use client";

import { useEffect, useRef, useState } from "react";

export type PollingState =
  | { kind: "idle" }
  | { kind: "pending"; id: string; expiresAt: Date | null }
  | {
      kind: "approved";
      id: string;
      approverName: string | null;
      resolvedAt: Date | null;
    }
  | {
      kind: "rejected";
      id: string;
      approverName: string | null;
      rejectReason: string | null;
    }
  | { kind: "expired"; id: string }
  | { kind: "error"; id: string | null; message: string };

interface PollOptions {
  /** Intervalo en ms. Default 3000 (POS), bajable en tests. */
  intervalMs?: number;
  /** Callback opcional al llegar a un estado terminal (approved/rejected/expired). */
  onTerminal?: (state: PollingState) => void;
}

/**
 * Polling de una AuthorizationRequest hasta que alcance un estado terminal.
 *
 * Contrato de limpieza (importante — fuga de polling es el bug clásico):
 * - `useEffect` retorna `clearInterval` para limpiar en unmount.
 * - Cambiar `requestId` vía `start(...)` dispara cleanup del interval anterior y arranca uno nuevo.
 * - Al recibir APPROVED/REJECTED/EXPIRED se limpia el interval explícitamente (no seguimos
 *   pegándole a la API una vez resuelto).
 * - Fetches con error consecutivos (> 3) → estado "error" y se detiene el polling.
 */
export function useAuthorizationPolling({
  intervalMs = 3000,
  onTerminal,
}: PollOptions = {}): {
  state: PollingState;
  start: (id: string, expiresAt: Date | null) => void;
  reset: () => void;
} {
  const [state, setState] = useState<PollingState>({ kind: "idle" });
  const onTerminalRef = useRef(onTerminal);
  // Mantenemos la referencia actualizada sin re-triggerear el efecto.
  onTerminalRef.current = onTerminal;

  const start = (id: string, expiresAt: Date | null): void => {
    setState({ kind: "pending", id, expiresAt });
  };

  const reset = (): void => {
    setState({ kind: "idle" });
  };

  const pendingId = state.kind === "pending" ? state.id : null;

  useEffect(() => {
    if (!pendingId) return;

    const id = pendingId;
    let cancelled = false;
    let errorCount = 0;
    let intervalId: ReturnType<typeof setInterval> | null = null;

    const poll = async (): Promise<void> => {
      try {
        const res = await fetch(`/api/auth-requests/${id}`, {
          cache: "no-store",
        });
        if (cancelled) return;
        const json = await res.json();
        if (!res.ok || !json.success) {
          errorCount += 1;
          if (errorCount >= 3) {
            setState({
              kind: "error",
              id,
              message: json.error ?? "No se pudo consultar la solicitud",
            });
          }
          return;
        }
        errorCount = 0;
        const s: string = json.data.status;
        if (s === "APPROVED") {
          const next: PollingState = {
            kind: "approved",
            id,
            approverName: json.data.approverName ?? null,
            resolvedAt: json.data.resolvedAt ? new Date(json.data.resolvedAt) : null,
          };
          setState(next);
          onTerminalRef.current?.(next);
        } else if (s === "REJECTED") {
          const next: PollingState = {
            kind: "rejected",
            id,
            approverName: json.data.approverName ?? null,
            rejectReason: json.data.rejectReason ?? null,
          };
          setState(next);
          onTerminalRef.current?.(next);
        } else if (s === "EXPIRED") {
          const next: PollingState = { kind: "expired", id };
          setState(next);
          onTerminalRef.current?.(next);
        }
        // PENDING → seguir esperando al próximo tick.
      } catch {
        if (cancelled) return;
        errorCount += 1;
        if (errorCount >= 3) {
          setState({ kind: "error", id, message: "Error de red consultando la solicitud" });
        }
      }
    };

    // Poll inmediato + interval.
    void poll();
    intervalId = setInterval(() => void poll(), intervalMs);

    return () => {
      cancelled = true;
      if (intervalId !== null) clearInterval(intervalId);
    };
  }, [pendingId, intervalMs]);

  return { state, start, reset };
}
