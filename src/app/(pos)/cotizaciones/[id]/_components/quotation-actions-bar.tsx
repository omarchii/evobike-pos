"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Edit,
  Send,
  RotateCw,
  Ban,
  Loader2,
  AlertTriangle,
  RefreshCw,
  Link2,
  FileText,
  Truck,
  Bell,
  Banknote,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { CONVERTIBLE_STATUSES, type EffectiveStatus } from "@/lib/quotations";
import WhatsAppShareButton from "./whatsapp-share-button";
import RegisterPaymentDialog from "./register-payment-dialog";
import { openPDFInNewTab } from "@/lib/pdf-client";

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

interface QuotationForActions {
  id: string;
  folio: string;
  publicShareToken: string;
  validUntil: Date | string;
  total: number;
  customerId: string | null;
  customerName: string | null;
  customerPhone: string | null;
  anonymousCustomerName: string | null;
  anonymousCustomerPhone: string | null;
}

interface Props {
  quotationId: string;
  effectiveStatus: EffectiveStatus;
  quotation: QuotationForActions;
}

export default function QuotationActionsBar({
  quotationId,
  effectiveStatus,
  quotation,
}: Props) {
  const router = useRouter();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState("");
  const [loading, setLoading] = useState<string | null>(null);

  async function handleShareLink() {
    const url = `${window.location.origin}/cotizaciones/public/${quotation.publicShareToken}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado al portapapeles");
    } catch {
      toast.error("No se pudo copiar el link");
    }
  }

  const isDraft = effectiveStatus === "DRAFT";
  const isEnEsperaCliente = effectiveStatus === "EN_ESPERA_CLIENTE";
  const isEnEsperaFabrica = effectiveStatus === "EN_ESPERA_FABRICA";
  const isAceptada = effectiveStatus === "ACEPTADA";
  const isPagada = effectiveStatus === "PAGADA";
  const isExpired = effectiveStatus === "EXPIRED";

  const canEdit = isDraft || isEnEsperaCliente;
  const canSend = isDraft;
  const canEnviarFabrica = isEnEsperaCliente;
  const canNotificarCliente = isEnEsperaFabrica;
  // Q.3 + Q.10 mod4 — DRAFT (cobro presencial) y ACEPTADA (cliente aceptó vía portal) incluidos.
  const canRegistrarPago = isDraft || isEnEsperaCliente || isEnEsperaFabrica || isAceptada;
  // Q.12 mod4 — convert handoff a POS desde cualquier CONVERTIBLE_STATUS.
  // Path A (PAGADA): POS muestra "ya pagado" y re-vincula CashTransaction.
  // Path B (DRAFT/EN_ESPERA_*/ACEPTADA): POS abre selector de pago normal.
  const canConvert =
    effectiveStatus !== "EXPIRED" &&
    CONVERTIBLE_STATUSES.includes(effectiveStatus as never);
  // Q.10 mod4 — ACEPTADA cancelable (cliente puede arrepentirse antes de pagar).
  // PAGADA NO cancelable v1 (terminal hasta convert; ADMIN void manual escala JIT).
  const canCancel = isDraft || isEnEsperaCliente || isEnEsperaFabrica || isAceptada;
  const canShare = isDraft || isEnEsperaCliente || isAceptada || isExpired;
  // Q.8 mod4 — Renovar reemplaza a Duplicar; solo desde EXPIRED. Crea nueva DRAFT con renewedFromId.
  const canRenew = isExpired;

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

  async function handleStatusTransition(action: "ENVIAR_A_FABRICA" | "NOTIFICAR_CLIENTE") {
    const labels: Record<typeof action, string> = {
      ENVIAR_A_FABRICA: "En espera de fábrica",
      NOTIFICAR_CLIENTE: "En espera del cliente",
    };
    setLoading(action);
    try {
      const res = await fetch(`/api/cotizaciones/${quotationId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data: { success: boolean; error?: string } = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success(`Cotización marcada como ${labels[action]}`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al cambiar estado");
    } finally {
      setLoading(null);
    }
  }

  async function handleRegistrarPago(
    method: "CASH" | "CARD" | "TRANSFER",
    reference: string | null,
  ) {
    setLoading("REGISTRAR_PAGO");
    try {
      const res = await fetch(`/api/cotizaciones/${quotationId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "REGISTRAR_PAGO", method, reference }),
      });
      const data: { success: boolean; error?: string } = await res.json();
      if (!data.success) throw new Error(data.error);
      toast.success("Pago registrado, cotización marcada como pagada");
      setPaymentOpen(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrar pago");
    } finally {
      setLoading(null);
    }
  }

  async function handleDownloadPDF() {
    await openPDFInNewTab(`/api/cotizaciones/${quotationId}/pdf`);
  }

  async function handleRenew() {
    setLoading("renew");
    try {
      const res = await fetch(`/api/cotizaciones/${quotationId}/renew`, { method: "POST" });
      const data: { success: boolean; data?: { id: string }; error?: string } = await res.json();
      if (!data.success || !data.data) throw new Error(data.error);
      toast.success("Cotización renovada con precios actualizados");
      router.push(`/cotizaciones/${data.data.id}/edit`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al renovar");
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
          border: "1px solid var(--ghost-border)",
        }}
      >
        {/* Edit — DRAFT o EN_ESPERA_CLIENTE */}
        {canEdit && (
          <ActionBtn
            href={`/cotizaciones/${quotationId}/edit`}
            icon={Edit}
            label="Editar"
          />
        )}

        {/* Marcar enviada — solo DRAFT */}
        {canSend && (
          <ActionBtn
            icon={Send}
            label="Marcar enviada"
            loading={loading === "send"}
            onClick={handleSend}
          />
        )}

        {/* Enviar a fábrica — EN_ESPERA_CLIENTE */}
        {canEnviarFabrica && (
          <ActionBtn
            icon={Truck}
            label="Enviar a fábrica"
            loading={loading === "ENVIAR_A_FABRICA"}
            onClick={() => handleStatusTransition("ENVIAR_A_FABRICA")}
          />
        )}

        {/* Notificar al cliente — EN_ESPERA_FABRICA */}
        {canNotificarCliente && (
          <ActionBtn
            icon={Bell}
            label="Notificar cliente"
            loading={loading === "NOTIFICAR_CLIENTE"}
            onClick={() => handleStatusTransition("NOTIFICAR_CLIENTE")}
          />
        )}

        {/* Registrar pago — DRAFT, EN_ESPERA_CLIENTE o EN_ESPERA_FABRICA (Q.3 mod4) */}
        {canRegistrarPago && (
          <ActionBtn
            icon={Banknote}
            label="Registrar pago"
            loading={loading === "REGISTRAR_PAGO"}
            onClick={() => setPaymentOpen(true)}
          />
        )}

        {/* Convertir — handoff a POS (Q.12 mod4). Cualquier CONVERTIBLE_STATUS.
            POS lee ?quotationId=X, prefilea cart+cliente y, si PAGADA, omite el
            paso de pago (Path A). */}
        {canConvert && (
          <ActionBtn
            icon={RefreshCw}
            label={isPagada ? "Convertir a venta" : "Convertir"}
            onClick={() => router.push(`/point-of-sale?quotationId=${quotationId}`)}
          />
        )}

        {/* Share link */}
        {canShare && (
          <ActionBtn
            icon={Link2}
            label="Compartir link"
            onClick={handleShareLink}
          />
        )}

        {/* WhatsApp */}
        {canShare && (
          <WhatsAppShareButton
            quotation={{
              folio: quotation.folio,
              total: quotation.total,
              validUntil: quotation.validUntil,
              publicShareToken: quotation.publicShareToken,
              customerId: quotation.customerId,
              customer:
                quotation.customerId && quotation.customerName
                  ? { name: quotation.customerName, phone: quotation.customerPhone }
                  : null,
              anonymousCustomerName: quotation.anonymousCustomerName,
              anonymousCustomerPhone: quotation.anonymousCustomerPhone,
            }}
          />
        )}

        {/* Renovar — solo EXPIRED (Q.8 mod4) */}
        {canRenew && (
          <ActionBtn
            icon={RotateCw}
            label="Renovar"
            loading={loading === "renew"}
            onClick={handleRenew}
          />
        )}

        {/* PDF — siempre */}
        <ActionBtn
          icon={FileText}
          label="Descargar PDF"
          onClick={handleDownloadPDF}
        />

        {/* Cancel */}
        {canCancel && (
          <ActionBtn
            icon={Ban}
            label="Cancelar"
            variant="danger"
            onClick={() => setCancelOpen(true)}
          />
        )}
      </div>

      {/* Register payment dialog (Q.3 mod4) */}
      <RegisterPaymentDialog
        open={paymentOpen}
        onClose={() => setPaymentOpen(false)}
        folio={quotation.folio}
        total={quotation.total}
        loading={loading === "REGISTRAR_PAGO"}
        onConfirm={handleRegistrarPago}
      />

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
