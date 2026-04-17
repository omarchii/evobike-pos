"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { CheckCircle, Send, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  CLOSE_BUTTON_STYLE,
  DESCRIPTION_STYLE,
  MODAL_STYLE,
  SECONDARY_BUTTON_STYLE,
  TITLE_STYLE,
} from "../shared-tokens";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferId: string;
  folio: string;
}

export function AutorizarDialog({ open, onOpenChange, transferId, folio }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleAutorizar = async (despacharInmediato: boolean) => {
    setLoading(true);
    const toastId = "autorizar";
    toast.loading(despacharInmediato ? "Autorizando y despachando…" : "Autorizando…", { id: toastId });

    try {
      const res = await fetch(`/api/transferencias/${transferId}/autorizar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ despacharInmediato }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };

      if (!json.success) {
        toast.error(json.error ?? "Error al autorizar", { id: toastId });
        setLoading(false);
        return;
      }

      toast.success(
        despacharInmediato
          ? `${folio} autorizada y despachada — ahora en tránsito`
          : `${folio} autorizada — quedó como borrador`,
        { id: toastId },
      );
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Error de red. Intenta de nuevo.", { id: toastId });
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden"
        style={MODAL_STYLE}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--r-full)",
                  background: "var(--p-container)",
                  color: "var(--on-p-container)",
                }}
              >
                <CheckCircle className="h-5 w-5" />
              </div>
              <DialogTitle style={TITLE_STYLE}>Autorizar {folio}</DialogTitle>
            </div>
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              style={CLOSE_BUTTON_STYLE}
              aria-label="Cerrar"
              disabled={loading}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <DialogDescription style={DESCRIPTION_STYLE}>
            Elige cómo quieres proceder con esta transferencia solicitada.
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-3">
          {/* Option 1: authorize only */}
          <button
            onClick={() => handleAutorizar(false)}
            disabled={loading}
            className="w-full text-left rounded-xl p-4 transition-colors hover:bg-[var(--surf-high)] disabled:opacity-50"
            style={{ background: "var(--surf-low)", border: "none", cursor: loading ? "not-allowed" : "pointer" }}
          >
            <p className="text-sm font-semibold" style={{ color: "var(--on-surf)", fontFamily: "var(--font-body)" }}>
              Autorizar para preparar después
            </p>
            <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
              La transferencia pasa a BORRADOR. El stock no se descuenta todavía.
            </p>
          </button>

          {/* Option 2: authorize + dispatch */}
          <button
            onClick={() => handleAutorizar(true)}
            disabled={loading}
            className="w-full text-left rounded-xl p-4 transition-colors disabled:opacity-50"
            style={{
              background: "var(--p-container)",
              border: "none",
              cursor: loading ? "not-allowed" : "pointer",
            }}
          >
            <div className="flex items-center gap-2 mb-1">
              <Send className="h-4 w-4 shrink-0" style={{ color: "var(--on-p-container)" }} />
              <p className="text-sm font-semibold" style={{ color: "var(--on-p-container)", fontFamily: "var(--font-body)" }}>
                Autorizar y despachar ahora
              </p>
            </div>
            <p className="text-xs" style={{ color: "var(--on-p-container)", opacity: 0.8 }}>
              El stock se descontará de tu sucursal inmediatamente y la transferencia quedará En tránsito.
            </p>
          </button>

          <div className="pt-2 flex justify-end">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              disabled={loading}
              style={{ ...SECONDARY_BUTTON_STYLE, opacity: loading ? 0.5 : 1 }}
            >
              Cancelar
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
