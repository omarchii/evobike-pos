"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatPhoneDisplay } from "@/lib/customers/phone";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

// ── Types ────────────────────────────────────────────────────────────────────

export interface OutboxRow {
  id: string;
  templateKey: string;
  templateDescription: string;
  customerName: string | null;
  customerId: string | null;
  currentCustomerPhone: string | null;
  recipientPhone: string;
  renderedBody: string;
  status: string;
  errorMessage: string | null;
  cancelReason: string | null;
  scheduledAt: string;
  expiresAt: string | null;
  openedAt: string | null;
  openedByName: string | null;
}

// ── Status styles ────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<string, { bg: string; color: string; label: string }> = {
  PENDING: {
    bg: "color-mix(in srgb, var(--warn) 12%, transparent)",
    color: "var(--warn)",
    label: "Pendiente",
  },
  OPENED_IN_WAME: {
    bg: "color-mix(in srgb, var(--p) 12%, transparent)",
    color: "var(--p)",
    label: "Abierto en WhatsApp",
  },
  EXPIRED: {
    bg: "var(--surf-high)",
    color: "var(--on-surf-var)",
    label: "Expirado",
  },
  CANCELLED: {
    bg: "var(--surf-high)",
    color: "var(--on-surf-var)",
    label: "Cancelado",
  },
  ERROR: {
    bg: "rgba(220,38,38,0.12)",
    color: "#dc2626",
    label: "Error",
  },
};

const TEMPLATE_LABELS: Record<string, string> = {
  WARRANTY_ALERT_120D: "Alerta garantía 120 días",
  WARRANTY_ALERT_173D: "Alerta garantía 173 días",
  CREDIT_BALANCE_90D: "Saldo a favor 90 días",
  LAYAWAY_NO_PAYMENT_30D: "Apartado sin abono 30 días",
  QUOTATION_SHARE: "Compartir cotización",
  WORKSHOP_READY_PICKUP: "Taller listo para recoger",
  WORKSHOP_AWAITING_FACTORY_PART_UPDATE: "Esperando pieza de fábrica",
};

// ── Component ────────────────────────────────────────────────────────────────

export function OutboxList({
  rows,
  pendingCount,
}: {
  rows: OutboxRow[];
  pendingCount: number;
}) {
  const router = useRouter();
  const [sending, setSending] = useState<string | null>(null);
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [cancelError, setCancelError] = useState("");
  const [cancelling, setCancelling] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [previewBody, setPreviewBody] = useState<string | null>(null);

  const active = rows.filter(
    (r) => r.status === "PENDING" || r.status === "ERROR",
  );
  const archived = rows.filter(
    (r) => r.status === "OPENED_IN_WAME" || r.status === "EXPIRED" || r.status === "CANCELLED",
  );

  async function handleOpenWhatsApp(row: OutboxRow) {
    setSending(row.id);
    try {
      const res = await fetch(`/api/whatsapp/messages/${row.id}/mark-opened`, {
        method: "POST",
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error ?? "Error al marcar mensaje");
        return;
      }

      if (data.phoneChanged) {
        const proceed = confirm(
          `El teléfono del cliente cambió desde que se generó este mensaje.\n\n` +
            `Original: ${formatPhoneDisplay(row.recipientPhone)}\n` +
            `Actual: ${formatPhoneDisplay(data.currentPhone)}\n\n` +
            `¿Abrir WhatsApp con el número original?`,
        );
        if (!proceed) {
          router.refresh();
          return;
        }
      }

      if (data.waUrl) {
        window.open(data.waUrl, "_blank", "noopener,noreferrer");
      }
      router.refresh();
    } finally {
      setSending(null);
    }
  }

  async function handleCancel() {
    if (!cancelId) return;
    if (!cancelReason.trim()) {
      setCancelError("Ingresa un motivo.");
      return;
    }
    setCancelling(true);
    try {
      const res = await fetch(`/api/whatsapp/messages/${cancelId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason.trim() }),
      });
      if (!res.ok) {
        const data = await res.json();
        setCancelError(data.error ?? "Error al cancelar");
        return;
      }
      setCancelId(null);
      setCancelReason("");
      setCancelError("");
      router.refresh();
    } finally {
      setCancelling(false);
    }
  }

  return (
    <>
      {/* Advisory sucursal */}
      <div
        className="rounded-xl px-4 py-3 text-sm"
        style={{
          background: "color-mix(in srgb, var(--warn) 8%, transparent)",
          color: "var(--on-surf-var)",
        }}
      >
        Asegúrate de estar enviando desde el WhatsApp de tu sucursal.
      </div>

      {/* Active messages */}
      <div className="space-y-3">
        {active.length === 0 ? (
          <div
            className="rounded-2xl px-5 py-10 text-center text-sm"
            style={{ background: "var(--surf-lowest)", color: "var(--on-surf-var)", boxShadow: "var(--shadow)" }}
          >
            No hay mensajes pendientes.
          </div>
        ) : (
          active.map((row) => (
            <MessageCard
              key={row.id}
              row={row}
              sending={sending === row.id}
              onOpen={() => handleOpenWhatsApp(row)}
              onCancel={() => {
                setCancelId(row.id);
                setCancelReason("");
                setCancelError("");
              }}
              onPreview={() => setPreviewBody(row.renderedBody)}
            />
          ))
        )}
      </div>

      {/* Archived toggle */}
      {archived.length > 0 && (
        <div>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            className="text-sm font-medium px-1"
            style={{ color: "var(--on-surf-var)" }}
          >
            {showArchived ? "▾" : "▸"} Historial ({archived.length})
          </button>

          {showArchived && (
            <div className="space-y-3 mt-3">
              {archived.map((row) => (
                <MessageCard
                  key={row.id}
                  row={row}
                  sending={false}
                  onPreview={() => setPreviewBody(row.renderedBody)}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Cancel dialog */}
      <Dialog
        open={cancelId !== null}
        onOpenChange={(open) => { if (!open) setCancelId(null); }}
      >
        <DialogContent
          className="p-0 gap-0 overflow-hidden"
          style={{
            background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "var(--shadow)",
            borderRadius: "var(--r-xl)",
            maxWidth: 440,
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}>
              Cancelar mensaje
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6 space-y-4">
            <p className="text-sm" style={{ color: "var(--on-surf-var)" }}>
              ¿Por qué no se enviará este mensaje?
            </p>
            <div>
              <textarea
                value={cancelReason}
                onChange={(e) => { setCancelReason(e.target.value); setCancelError(""); }}
                placeholder="Motivo de cancelación"
                rows={3}
                style={{
                  background: "var(--surf-low)",
                  border: cancelError
                    ? "1.5px solid var(--ter)"
                    : "1px solid var(--ghost-border)",
                  borderRadius: "var(--r-md)",
                  color: "var(--on-surf)",
                  fontFamily: "var(--font-body)",
                  fontSize: "0.875rem",
                  padding: "0.65rem 0.75rem",
                  width: "100%",
                  outline: "none",
                  resize: "vertical",
                }}
              />
              {cancelError && (
                <p className="text-xs mt-1.5" style={{ color: "var(--ter)" }}>
                  {cancelError}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCancelId(null)}
                className="flex-1 py-2.5 rounded-full text-sm font-medium transition-colors hover:bg-[var(--surf-high)]"
                style={{ color: "var(--on-surf-var)", background: "var(--surf-low)" }}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={cancelling}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ background: "rgba(220,38,38,0.9)", color: "#fff" }}
              >
                {cancelling ? "Cancelando…" : "Cancelar mensaje"}
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Preview dialog */}
      <Dialog
        open={previewBody !== null}
        onOpenChange={(open) => { if (!open) setPreviewBody(null); }}
      >
        <DialogContent
          className="p-0 gap-0 overflow-hidden"
          style={{
            background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "var(--shadow)",
            borderRadius: "var(--r-xl)",
            maxWidth: 480,
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-4">
            <DialogTitle style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}>
              Vista previa del mensaje
            </DialogTitle>
          </DialogHeader>
          <div className="px-6 pb-6">
            <div
              className="rounded-xl p-4 text-sm whitespace-pre-wrap"
              style={{ background: "var(--surf-low)", color: "var(--on-surf)" }}
            >
              {previewBody}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── MessageCard ──────────────────────────────────────────────────────────────

function MessageCard({
  row,
  sending,
  onOpen,
  onCancel,
  onPreview,
}: {
  row: OutboxRow;
  sending: boolean;
  onOpen?: () => void;
  onCancel?: () => void;
  onPreview?: () => void;
}) {
  const s = STATUS_STYLES[row.status] ?? STATUS_STYLES.PENDING;
  const phoneChanged =
    row.currentCustomerPhone != null &&
    row.currentCustomerPhone !== row.recipientPhone;

  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="inline-block px-2.5 py-1 rounded-full text-xs font-medium shrink-0"
            style={{ background: s.bg, color: s.color }}
          >
            {s.label}
          </span>
          <span className="text-sm font-medium truncate" style={{ color: "var(--on-surf)" }}>
            {TEMPLATE_LABELS[row.templateKey] ?? row.templateDescription}
          </span>
        </div>
        <span className="text-xs shrink-0" style={{ color: "var(--on-surf-var)" }}>
          {formatDate(row.scheduledAt)}
        </span>
      </div>

      {/* Recipient */}
      <div className="flex items-center gap-4 text-sm">
        <div>
          <span style={{ color: "var(--on-surf-var)" }}>Para: </span>
          <span style={{ color: "var(--on-surf)" }}>
            {row.customerName ?? "Sin cliente"}
          </span>
        </div>
        <div>
          <span style={{ color: "var(--on-surf-var)" }}>Tel: </span>
          <span style={{ color: "var(--on-surf)" }}>
            {formatPhoneDisplay(row.recipientPhone)}
          </span>
          {phoneChanged && (
            <span
              className="ml-1.5 text-xs font-medium"
              style={{ color: "var(--warn)" }}
            >
              (cambió)
            </span>
          )}
        </div>
      </div>

      {/* Error detail */}
      {row.status === "ERROR" && row.errorMessage && (
        <div
          className="rounded-lg px-3 py-2 text-xs"
          style={{ background: "rgba(220,38,38,0.08)", color: "#dc2626" }}
        >
          {row.errorMessage}
        </div>
      )}

      {/* Cancel reason */}
      {row.status === "CANCELLED" && row.cancelReason && (
        <div className="text-xs italic" style={{ color: "var(--on-surf-var)" }}>
          Cancelado: {row.cancelReason}
        </div>
      )}

      {/* Opened info */}
      {row.status === "OPENED_IN_WAME" && (
        <div className="text-xs" style={{ color: "var(--on-surf-var)" }}>
          Abierto por {row.openedByName ?? "—"} el{" "}
          {row.openedAt ? formatDate(row.openedAt) : "—"}
        </div>
      )}

      {/* Preview (truncated) + Actions */}
      <div className="flex items-end justify-between gap-3">
        <button
          type="button"
          onClick={onPreview}
          className="text-xs underline"
          style={{ color: "var(--on-surf-var)" }}
        >
          Ver mensaje completo
        </button>

        {row.status === "PENDING" && (
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--surf-high)]"
              style={{ color: "var(--on-surf-var)" }}
            >
              No enviar
            </button>
            <button
              type="button"
              onClick={onOpen}
              disabled={sending}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ background: "#25D366", color: "#fff" }}
            >
              {sending ? "Abriendo…" : "Abrir WhatsApp"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
