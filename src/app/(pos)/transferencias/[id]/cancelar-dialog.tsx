"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { XCircle, X, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { cancelarTransferSchema, type CancelarTransferInput } from "@/lib/validators/transferencias";
import {
  CLOSE_BUTTON_STYLE,
  DANGER_BUTTON_STYLE,
  DESCRIPTION_STYLE,
  ERROR_STYLE,
  LABEL_STYLE,
  MODAL_STYLE,
  SECONDARY_BUTTON_STYLE,
  TEXTAREA_STYLE,
  TITLE_STYLE,
} from "../shared-tokens";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferId: string;
  folio: string;
  wasEnTransito: boolean;
}

export function CancelarDialog({ open, onOpenChange, transferId, folio, wasEnTransito }: Props) {
  const router = useRouter();

  const form = useForm<CancelarTransferInput>({
    resolver: zodResolver(cancelarTransferSchema),
    defaultValues: { motivo: "" },
  });

  useEffect(() => {
    if (!open) form.reset({ motivo: "" });
  }, [open, form]);

  const onSubmit = async (values: CancelarTransferInput) => {
    const toastId = "cancelar";
    toast.loading("Cancelando transferencia…", { id: toastId });

    try {
      const res = await fetch(`/api/transferencias/${transferId}/cancelar`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ motivo: values.motivo }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };

      if (!json.success) {
        toast.error(json.error ?? "Error al cancelar", { id: toastId });
        return;
      }

      toast.success(`${folio} cancelada`, { id: toastId });
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Error de red. Intenta de nuevo.", { id: toastId });
    }
  };

  const isSubmitting = form.formState.isSubmitting;

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!isSubmitting) onOpenChange(next); }}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden"
        style={MODAL_STYLE}
      >
        <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
          <DialogHeader className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div
                  className="shrink-0 flex items-center justify-center"
                  style={{
                    width: 40,
                    height: 40,
                    borderRadius: "var(--r-full)",
                    background: "var(--ter-container)",
                    color: "var(--ter)",
                  }}
                >
                  <XCircle className="h-5 w-5" />
                </div>
                <DialogTitle style={TITLE_STYLE}>Cancelar {folio}</DialogTitle>
              </div>
              <button
                type="button"
                onClick={() => !isSubmitting && onOpenChange(false)}
                style={CLOSE_BUTTON_STYLE}
                aria-label="Cerrar"
                disabled={isSubmitting}
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <DialogDescription style={DESCRIPTION_STYLE}>
              Esta acción no puede revertirse.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 pb-2 space-y-4">
            {wasEnTransito && (
              <div
                className="flex items-start gap-3 rounded-xl p-4"
                style={{ background: "var(--warn-container)" }}
              >
                <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--warn)" }} />
                <p className="text-xs leading-relaxed" style={{ color: "var(--warn)", fontFamily: "var(--font-body)" }}>
                  La transferencia estaba en tránsito. Se revertirá el stock a la sucursal de origen.
                </p>
              </div>
            )}

            <div>
              <label style={LABEL_STYLE}>Motivo de cancelación</label>
              <textarea
                style={TEXTAREA_STYLE}
                placeholder="Explica brevemente el motivo…"
                {...form.register("motivo")}
              />
              {form.formState.errors.motivo && (
                <p style={ERROR_STYLE}>{form.formState.errors.motivo.message}</p>
              )}
            </div>
          </div>

          <div className="px-6 pt-4 pb-6 flex gap-3 justify-end">
            <button
              type="button"
              onClick={() => !isSubmitting && onOpenChange(false)}
              disabled={isSubmitting}
              style={{ ...SECONDARY_BUTTON_STYLE, opacity: isSubmitting ? 0.5 : 1 }}
            >
              Volver
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              style={{
                ...DANGER_BUTTON_STYLE,
                opacity: isSubmitting ? 0.6 : 1,
                cursor: isSubmitting ? "not-allowed" : "pointer",
              }}
            >
              {isSubmitting ? "Cancelando…" : "Confirmar cancelación"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
