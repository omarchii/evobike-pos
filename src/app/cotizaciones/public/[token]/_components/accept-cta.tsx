"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";

interface Props {
  token: string;
  alreadyAccepted: boolean;
}

type LocalState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "accepted" }
  | { kind: "error"; message: string };

export default function AcceptCTA({ token, alreadyAccepted }: Props) {
  const router = useRouter();
  const [state, setState] = useState<LocalState>(
    alreadyAccepted ? { kind: "accepted" } : { kind: "idle" }
  );
  const [, startTransition] = useTransition();

  async function handleAccept() {
    setState({ kind: "loading" });
    try {
      const res = await fetch(`/api/cotizaciones/public/${token}/accept`, {
        method: "POST",
      });
      const data: { success: boolean; error?: string } = await res.json();
      if (!data.success) throw new Error(data.error ?? "Error al aceptar");
      setState({ kind: "accepted" });
      // Refresh server data so banner state is consistent post-accept.
      startTransition(() => router.refresh());
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "Error al aceptar",
      });
    }
  }

  if (state.kind === "accepted") {
    return (
      <div
        className="no-print rounded-2xl px-5 py-4 flex items-center gap-3"
        style={{
          background: "#d8f3dc",
          color: "#1b4332",
          maxWidth: 480,
          margin: "1.5rem auto 0",
          boxShadow: "0px 12px 32px -4px rgba(19, 27, 46, 0.06)",
        }}
      >
        <CheckCircle2 className="h-5 w-5 shrink-0" style={{ color: "#2d6a4f" }} />
        <div>
          <p style={{ fontSize: "0.9375rem", fontWeight: 600, lineHeight: 1.3 }}>
            ¡Cotización aceptada!
          </p>
          <p style={{ fontSize: "0.8125rem", marginTop: "0.15rem", opacity: 0.85 }}>
            Tu vendedor ya fue notificado. Pronto se pondrá en contacto contigo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="no-print"
      style={{
        maxWidth: 480,
        margin: "1.5rem auto 0",
        textAlign: "center",
      }}
    >
      <button
        type="button"
        onClick={handleAccept}
        disabled={state.kind === "loading"}
        className="w-full inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full font-semibold transition-opacity hover:opacity-90 disabled:opacity-60"
        style={{
          background: "#2d6a4f",
          color: "#ffffff",
          fontSize: "0.9375rem",
          fontFamily: "Inter, -apple-system, sans-serif",
          boxShadow: "0px 8px 24px -4px rgba(45, 106, 79, 0.3)",
        }}
      >
        {state.kind === "loading" && <Loader2 className="h-4 w-4 animate-spin" />}
        {state.kind === "loading" ? "Aceptando..." : "Aceptar cotización"}
      </button>
      {state.kind === "error" && (
        <p
          style={{
            color: "#7b241c",
            fontSize: "0.8125rem",
            marginTop: "0.75rem",
          }}
        >
          {state.message}
        </p>
      )}
      <p
        style={{
          fontSize: "0.75rem",
          color: "#3d5247",
          marginTop: "0.625rem",
          opacity: 0.75,
        }}
      >
        Al aceptar, tu vendedor recibirá un aviso para coordinar el siguiente paso.
      </p>
    </div>
  );
}
