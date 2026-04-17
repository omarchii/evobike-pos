"use client";

import { useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Package, X, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { TransferItemDetail } from "../shared-tokens";
import {
  CLOSE_BUTTON_STYLE,
  DESCRIPTION_STYLE,
  ERROR_STYLE,
  INPUT_STYLE,
  LABEL_STYLE,
  MODAL_STYLE_LG,
  PRIMARY_BUTTON_STYLE,
  SECONDARY_BUTTON_STYLE,
  TITLE_STYLE,
  itemDescription,
  itemTypeLabel,
} from "../shared-tokens";

const buildSchema = (items: TransferItemDetail[]) =>
  z.object({
    items: z.array(
      z.object({
        id: z.string(),
        cantidadRecibida: z
          .number({ message: "Ingresa una cantidad válida" })
          .int()
          .min(0, "No puede ser negativo"),
      }),
    ),
    notas: z.string().trim().optional(),
  }).superRefine((data, ctx) => {
    data.items.forEach((item, idx) => {
      const original = items[idx];
      if (original && item.cantidadRecibida > original.cantidadEnviada) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["items", idx, "cantidadRecibida"],
          message: `No puede superar ${original.cantidadEnviada}`,
        });
      }
    });
  });

type FormValues = {
  items: { id: string; cantidadRecibida: number }[];
  notas?: string;
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  transferId: string;
  folio: string;
  items: TransferItemDetail[];
}

export function RecibirDialog({ open, onOpenChange, transferId, folio, items }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const form = useForm<FormValues>({
    resolver: zodResolver(buildSchema(items)),
    defaultValues: {
      items: items.map((item) => ({
        id: item.id,
        cantidadRecibida: item.cantidadEnviada,
      })),
      notas: "",
    },
  });

  const watchedItems = useWatch({ control: form.control, name: "items" });

  const onSubmit = async (values: FormValues) => {
    setLoading(true);
    const toastId = "recibir";
    toast.loading("Registrando recepción…", { id: toastId });

    try {
      const res = await fetch(`/api/transferencias/${transferId}/recibir`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: values.items.map((i) => ({
            id: i.id,
            cantidadRecibida: i.cantidadRecibida,
          })),
        }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };

      if (!json.success) {
        toast.error(json.error ?? "Error al registrar recepción", { id: toastId });
        setLoading(false);
        return;
      }

      toast.success(`${folio} recibida correctamente`, { id: toastId });
      onOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Error de red. Intenta de nuevo.", { id: toastId });
      setLoading(false);
    }
  };

  const isSingle = (item: TransferItemDetail) => !!(item.batteryId || item.customerBikeId);

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!loading) onOpenChange(next); }}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col"
        style={MODAL_STYLE_LG}
      >
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-3">
              <div
                className="shrink-0 flex items-center justify-center"
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: "var(--r-full)",
                  background: "var(--sec-container)",
                  color: "var(--sec)",
                }}
              >
                <Package className="h-5 w-5" />
              </div>
              <DialogTitle style={TITLE_STYLE}>Recibir {folio}</DialogTitle>
            </div>
            <button
              type="button"
              onClick={() => !loading && onOpenChange(false)}
              style={CLOSE_BUTTON_STYLE}
              aria-label="Cerrar"
              disabled={loading}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <DialogDescription style={DESCRIPTION_STYLE}>
            Confirma las cantidades recibidas. Si hay diferencias, se registrarán como faltante.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={form.handleSubmit(onSubmit)} noValidate className="overflow-y-auto flex-1">
          <div className="px-6 space-y-3 pb-2">
            {items.map((item, idx) => {
              const received = watchedItems?.[idx]?.cantidadRecibida ?? item.cantidadEnviada;
              const diff = Number(received) - item.cantidadEnviada;
              const hasFaltante = diff < 0;
              const isFixed = isSingle(item);

              return (
                <div
                  key={item.id}
                  className="rounded-xl p-4 space-y-2"
                  style={{ background: "var(--surf-low)" }}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <span
                        className="text-[0.625rem] font-medium uppercase tracking-[0.04em]"
                        style={{ color: "var(--on-surf-var)", fontFamily: "var(--font-body)" }}
                      >
                        {itemTypeLabel(item)}
                      </span>
                      <p className="text-xs mt-0.5 font-medium" style={{ color: "var(--on-surf)" }}>
                        {itemDescription(item)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <label style={{ ...LABEL_STYLE, marginBottom: "0.25rem" }}>
                        Recibido / Enviado
                      </label>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          min={0}
                          max={item.cantidadEnviada}
                          disabled={isFixed}
                          style={{
                            ...INPUT_STYLE,
                            width: 72,
                            height: 36,
                            textAlign: "center",
                            opacity: isFixed ? 0.7 : 1,
                            cursor: isFixed ? "default" : "text",
                          }}
                          {...form.register(`items.${idx}.cantidadRecibida`, { valueAsNumber: true })}
                        />
                        <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                          / {item.cantidadEnviada}
                        </span>
                      </div>
                      {form.formState.errors.items?.[idx]?.cantidadRecibida && (
                        <p style={ERROR_STYLE}>
                          {form.formState.errors.items[idx]!.cantidadRecibida!.message}
                        </p>
                      )}
                    </div>
                  </div>
                  {hasFaltante && (
                    <div
                      className="flex items-center gap-2 rounded-lg px-3 py-2"
                      style={{ background: "var(--warn-container)" }}
                    >
                      <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--warn)" }} />
                      <p className="text-xs" style={{ color: "var(--warn)", fontFamily: "var(--font-body)" }}>
                        Faltante de {Math.abs(diff)} unidad{Math.abs(diff) !== 1 ? "es" : ""} quedará registrado en inventario
                      </p>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="px-6 pt-4 pb-6 flex gap-3 justify-end shrink-0">
            <button
              type="button"
              onClick={() => !loading && onOpenChange(false)}
              disabled={loading}
              style={{ ...SECONDARY_BUTTON_STYLE, opacity: loading ? 0.5 : 1 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                ...PRIMARY_BUTTON_STYLE,
                opacity: loading ? 0.6 : 1,
                cursor: loading ? "not-allowed" : "pointer",
              }}
            >
              {loading ? "Registrando…" : "Confirmar recepción"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
