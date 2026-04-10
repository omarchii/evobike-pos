"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Edit,
  Send,
  Copy,
  Ban,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import type { EffectiveStatus } from "@/lib/quotations";

// ── Design tokens ────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  fontSize: "0.875rem",
  padding: "0.65rem 0.75rem",
  resize: "none" as const,
  width: "100%",
  outline: "none",
};

interface Props {
  quotationId: string;
  effectiveStatus: EffectiveStatus;
  dbStatus: string;
}

export default function QuotationActionsBar({ quotationId, effectiveStatus, dbStatus }: Props) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  const isActionable = effectiveStatus === "DRAFT" || effectiveStatus === "SENT";
  const canEdit = isActionable;
  const canSend = isActionable && dbStatus === "DRAFT";
  const canDuplicate = true;

  async function handleSend() {
    setLoading("send");
    try {
      const res = await fetch(`/api/cotizaciones/${quotationId}/send`, { method: "POST" });
      const data: { success: boolean; error?: string } = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Cotización marcada como enviada");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al marcar como enviada");
    } finally {
      setLoading(null);
    }
  }

  async function handleDuplicate() {
    setLoading("duplicate");
    try {
      const res = await fetch(`/api/cotizaciones/${quotationId}/duplicate`, { method: "POST" });
      const data: { success: boolean; data?: { id: string }; error?: string } = await res.json();
      if (!data.success || !data.data) throw new Error(data.error);
      toast.success("Cotización duplicada");
      router.push(`/cotizaciones/${data.data.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al duplicar");
    } finally {
      setLoading(null);
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) {
      toast.error("Ingresa el motivo de cancelación");
      return;
    }
    setLoading("cancel");
    try {
      const res = await fetch(`/api/cotizaciones/${quotationId}/cancel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: cancelReason }),
      });
      const data: { success: boolean; error?: string } = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Cotización cancelada");
      setCancelOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cancelar");
    } finally {
      setLoading(null);
    }
  }

  return (
    <>
      {/* Floating action bar */}
      <div
        className="fixed bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-2 px-4 py-3 rounded-2xl z-50"
        style={{
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "var(--shadow)",
          border: "1px solid rgba(178,204,192,0.15)",
        }}
      >
        {/* Edit */}
        {canEdit && (
          <ActionBtn
            href={`/cotizaciones/${quotationId}/edit`}
            icon={Edit}
            label="Editar"
          />
        )}

        {/* Mark as sent */}
        {canSend && (
          <ActionBtn
            icon={Send}
            label="Marcar enviada"
            loading={loading === "send"}
            onClick={handleSend}
          />
        )}

        {/* Convert — disabled until 3C */}
        {isActionable && (
          <ActionBtn
            icon={Send}
            label="Convertir"
            disabled
            tooltip="Disponible en Fase 3C"
          />
        )}

        {/* Share link — disabled until 3D */}
        {isActionable && (
          <ActionBtn
            icon={Send}
            label="Compartir link"
            disabled
            tooltip="Disponible en Fase 3D"
          />
        )}

        {/* Duplicate */}
        {canDuplicate && (
          <ActionBtn
            icon={Copy}
            label="Duplicar"
            loading={loading === "duplicate"}
            onClick={handleDuplicate}
          />
        )}

        {/* Cancel */}
        {isActionable && (
          <ActionBtn
            icon={Ban}
            label="Cancelar"
            variant="danger"
            onClick={() => setCancelOpen(true)}
          />
        )}
      </div>

      {/* Cancel modal */}
      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
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
              Cancelar cotización
            </DialogTitle>
          </DialogHeader>

          <div className="px-6 pb-6 space-y-4">
            <div
              className="flex items-start gap-2 rounded-xl p-3"
              style={{ background: "var(--ter-container)" }}
            >
              <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--ter)" }} />
              <p className="text-xs" style={{ color: "var(--on-ter-container)" }}>
                Esta acción es irreversible. La cotización quedará cancelada.
              </p>
            </div>

            <div>
              <label className="text-xs font-medium mb-1.5 block" style={{ color: "var(--on-surf-var)" }}>
                Motivo de cancelación *
              </label>
              <textarea
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="Ej. El cliente no procedió con la compra..."
                style={{ ...INPUT_STYLE, minHeight: 80 }}
                rows={3}
              />
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setCancelOpen(false)}
                className="flex-1 py-2.5 rounded-full text-sm font-medium transition-colors hover:bg-[var(--surf-high)]"
                style={{ color: "var(--on-surf-var)", background: "var(--surf-low)" }}
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={loading === "cancel" || !cancelReason.trim()}
                className="flex-1 py-2.5 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "var(--ter)" }}
              >
                {loading === "cancel" && <Loader2 className="h-4 w-4 animate-spin" />}
                Cancelar cotización
              </button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

// ── Shared action button ──────────────────────────────────────────────────────

interface ActionBtnProps {
  icon: React.ElementType;
  label: string;
  href?: string;
  onClick?: () => void;
  loading?: boolean;
  disabled?: boolean;
  tooltip?: string;
  variant?: "default" | "danger";
}

function ActionBtn({ icon: Icon, label, href, onClick, loading, disabled, tooltip, variant = "default" }: ActionBtnProps) {
  const isDanger = variant === "danger";
  const style: React.CSSProperties = {
    color: isDanger ? "var(--ter)" : "var(--on-surf)",
    background: "var(--surf-low)",
    borderRadius: "var(--r-lg)",
    opacity: disabled ? 0.4 : 1,
    cursor: disabled ? "not-allowed" : "pointer",
    position: "relative",
  };

  const content = (
    <span className="flex flex-col items-center gap-1 px-3 py-2 min-w-[64px]">
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <Icon className="h-4 w-4" />
      )}
      <span className="text-[0.625rem] font-medium">{label}</span>
      {tooltip && disabled && (
        <span
          className="absolute -top-8 left-1/2 -translate-x-1/2 whitespace-nowrap text-[0.625rem] px-2 py-1 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"
          style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
        >
          {tooltip}
        </span>
      )}
    </span>
  );

  if (href && !disabled) {
    return (
      <a href={href} style={style} className={cn("group transition-colors hover:bg-[var(--surf-high)] rounded-xl", disabled && "pointer-events-none")}>
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={!disabled ? onClick : undefined}
      disabled={disabled}
      title={tooltip}
      className={cn("group transition-colors hover:bg-[var(--surf-high)] rounded-xl", disabled && "pointer-events-none")}
      style={style}
    >
      {content}
    </button>
  );
}
