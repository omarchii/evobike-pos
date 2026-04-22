"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react";

export type SerializedApprovalItem = {
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
};

export type SerializedApproval = {
  id: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  channel: "WHATSAPP_PUBLIC" | "PHONE_CALL" | "IN_PERSON" | "OTHER" | null;
  totalEstimado: number;
  requestedAt: string;
  expiresAt: string;
  respondedAt: string | null;
  respondedNote: string | null;
  createdByName: string;
  items: SerializedApprovalItem[];
};

type Props = {
  orderId: string;
  approvals: SerializedApproval[];
  isClosed: boolean;
};

const STATUS_LABEL: Record<SerializedApproval["status"], string> = {
  PENDING: "Pendiente",
  APPROVED: "Aprobada",
  REJECTED: "Rechazada",
};

const CHANNEL_LABEL: Record<NonNullable<SerializedApproval["channel"]>, string> = {
  WHATSAPP_PUBLIC: "WhatsApp",
  PHONE_CALL: "Llamada",
  IN_PERSON: "Presencial",
  OTHER: "Otro",
};

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function expiryHint(expiresAtIso: string): {
  label: string;
  bg: string;
  color: string;
  expired: boolean;
} {
  const now = Date.now();
  const exp = new Date(expiresAtIso).getTime();
  const diffMs = exp - now;
  if (diffMs <= 0) {
    return {
      label: "Expirada",
      bg: "var(--ter-container)",
      color: "var(--ter)",
      expired: true,
    };
  }
  const hours = Math.floor(diffMs / 3600_000);
  if (hours < 6) {
    return {
      label: `Expira en ${hours}h`,
      bg: "var(--warn-container)",
      color: "var(--warn)",
      expired: false,
    };
  }
  return {
    label: `Expira en ${hours}h`,
    bg: "var(--surf-low)",
    color: "var(--on-surf-var)",
    expired: false,
  };
}

function statusChip(status: SerializedApproval["status"]) {
  const cfg =
    status === "APPROVED"
      ? { bg: "var(--sec-container)", color: "var(--on-sec-container)" }
      : status === "REJECTED"
        ? { bg: "var(--ter-container)", color: "var(--ter)" }
        : { bg: "var(--warn-container)", color: "var(--warn)" };
  return (
    <span
      style={{
        background: cfg.bg,
        color: cfg.color,
        borderRadius: 9999,
        padding: "0.15rem 0.55rem",
        fontSize: "0.625rem",
        fontWeight: 600,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
      }}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ApprovalsList({ orderId, approvals, isClosed }: Props) {
  const router = useRouter();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [respondingId, setRespondingId] = useState<string | null>(null);

  if (approvals.length === 0) return null;

  const handleManualRespond = async (
    approvalId: string,
    decision: "APPROVED" | "REJECTED",
  ) => {
    const channel = window.prompt(
      'Canal de la respuesta: escribe "PHONE_CALL", "IN_PERSON" u "OTHER"',
      "PHONE_CALL",
    );
    if (!channel) return;
    if (!["PHONE_CALL", "IN_PERSON", "OTHER"].includes(channel)) {
      toast.error("Canal inválido");
      return;
    }
    const note = window.prompt("Nota (opcional)") ?? undefined;

    setRespondingId(approvalId);
    toast.loading("Registrando respuesta…", { id: `respond-${approvalId}` });
    try {
      const res = await fetch(
        `/api/service-orders/${orderId}/approvals/${approvalId}/respond`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ decision, channel, note }),
        },
      );
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        code?: string;
      };
      if (json.success) {
        toast.success(
          decision === "APPROVED" ? "Aprobación registrada" : "Rechazo registrado",
          { id: `respond-${approvalId}` },
        );
        router.refresh();
      } else if (json.code === "APPROVAL_EXPIRED") {
        toast.error("La aprobación expiró antes de registrarse", {
          id: `respond-${approvalId}`,
        });
        router.refresh();
      } else {
        toast.error(json.error ?? "No se pudo registrar la respuesta", {
          id: `respond-${approvalId}`,
        });
      }
    } catch {
      toast.error("Error de red", { id: `respond-${approvalId}` });
    } finally {
      setRespondingId(null);
    }
  };

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
        Aprobaciones
      </h2>

      <div className="space-y-2">
        {approvals.map((a) => {
          const expanded = expandedId === a.id;
          const expiry = expiryHint(a.expiresAt);
          const isPending = a.status === "PENDING";
          const channelLabel = a.channel ? CHANNEL_LABEL[a.channel] : null;

          return (
            <div
              key={a.id}
              className="rounded-xl"
              style={{ background: "var(--surf-low)" }}
            >
              <button
                type="button"
                onClick={() => setExpandedId(expanded ? null : a.id)}
                className="w-full text-left px-4 py-3 flex items-start justify-between gap-3"
              >
                <div className="flex-1 min-w-0 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    {statusChip(a.status)}
                    {isPending && (
                      <span
                        style={{
                          background: expiry.bg,
                          color: expiry.color,
                          borderRadius: 9999,
                          padding: "0.15rem 0.55rem",
                          fontSize: "0.625rem",
                          fontWeight: 500,
                        }}
                      >
                        {expiry.label}
                      </span>
                    )}
                    {!isPending && channelLabel && (
                      <span
                        style={{
                          fontSize: "0.625rem",
                          color: "var(--on-surf-var)",
                        }}
                      >
                        · {channelLabel}
                      </span>
                    )}
                  </div>
                  <p
                    style={{
                      fontSize: "0.8125rem",
                      color: "var(--on-surf)",
                      fontFamily: "var(--font-number)",
                      fontWeight: 600,
                    }}
                  >
                    {formatMXN(a.totalEstimado)}
                  </p>
                  <p style={{ fontSize: "0.6875rem", color: "var(--on-surf-var)" }}>
                    {a.createdByName} · {formatDate(a.requestedAt)}
                  </p>
                </div>
                <span style={{ color: "var(--on-surf-var)" }}>
                  {expanded ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                </span>
              </button>

              {expanded && (
                <div className="px-4 pb-3 space-y-3">
                  <div
                    className="rounded-lg overflow-hidden"
                    style={{ border: "1px solid var(--ghost-border)" }}
                  >
                    <table className="w-full" style={{ fontSize: "0.75rem" }}>
                      <thead>
                        <tr style={{ background: "var(--surf)" }}>
                          <th
                            className="text-left px-3 py-1.5"
                            style={{ color: "var(--on-surf-var)", fontWeight: 500 }}
                          >
                            Concepto
                          </th>
                          <th
                            className="text-right px-3 py-1.5"
                            style={{ color: "var(--on-surf-var)", fontWeight: 500 }}
                          >
                            Cant
                          </th>
                          <th
                            className="text-right px-3 py-1.5"
                            style={{ color: "var(--on-surf-var)", fontWeight: 500 }}
                          >
                            Precio
                          </th>
                          <th
                            className="text-right px-3 py-1.5"
                            style={{ color: "var(--on-surf-var)", fontWeight: 500 }}
                          >
                            Subtotal
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {a.items.map((it, i) => (
                          <tr key={i}>
                            <td
                              className="px-3 py-1.5"
                              style={{ color: "var(--on-surf)" }}
                            >
                              {it.nombre}
                            </td>
                            <td
                              className="text-right px-3 py-1.5"
                              style={{ color: "var(--on-surf)" }}
                            >
                              {it.cantidad}
                            </td>
                            <td
                              className="text-right px-3 py-1.5"
                              style={{
                                color: "var(--on-surf)",
                                fontFamily: "var(--font-number)",
                              }}
                            >
                              {formatMXN(it.precio)}
                            </td>
                            <td
                              className="text-right px-3 py-1.5"
                              style={{
                                color: "var(--on-surf)",
                                fontFamily: "var(--font-number)",
                                fontWeight: 600,
                              }}
                            >
                              {formatMXN(it.subtotal)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {a.respondedNote && a.respondedNote !== "EXPIRED" && (
                    <p
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--on-surf-var)",
                        fontStyle: "italic",
                      }}
                    >
                      “{a.respondedNote}”
                    </p>
                  )}

                  {isPending && !isClosed && !expiry.expired && (
                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => handleManualRespond(a.id, "APPROVED")}
                        disabled={respondingId === a.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 transition-opacity disabled:opacity-50"
                        style={{
                          background: "var(--sec-container)",
                          color: "var(--on-sec-container)",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          border: "none",
                          cursor:
                            respondingId === a.id ? "not-allowed" : "pointer",
                        }}
                      >
                        <MessageCircle className="h-3 w-3" />
                        Registrar aprobación
                      </button>
                      <button
                        type="button"
                        onClick={() => handleManualRespond(a.id, "REJECTED")}
                        disabled={respondingId === a.id}
                        className="flex-1 flex items-center justify-center gap-1.5 rounded-full px-3 py-2 transition-opacity disabled:opacity-50"
                        style={{
                          background: "var(--ter-container)",
                          color: "var(--ter)",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          border: "none",
                          cursor:
                            respondingId === a.id ? "not-allowed" : "pointer",
                        }}
                      >
                        Registrar rechazo
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
