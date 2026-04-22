"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Trash2, X } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

// ── Schema ────────────────────────────────────────────────────────────────────
// Validación laxa mid-edit (cantidad/precio pueden ser inválidos mientras se
// teclea); el submit recalcula y revalida estricto.
const itemSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido").max(200),
  cantidad: z.coerce.number().int().positive("Cantidad inválida"),
  precio: z.coerce.number().nonnegative("Precio inválido"),
});

const formSchema = z.object({
  items: z.array(itemSchema).min(1, "Agrega al menos un ítem"),
  sendWhatsapp: z.boolean(),
});

type ApprovalFormValues = z.infer<typeof formSchema>;

// ── Helpers ───────────────────────────────────────────────────────────────────
const IVA_RATE = 0.16;

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

// ── Component ─────────────────────────────────────────────────────────────────
type ApprovalDrawerProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  customerName: string;
  customerHasPhone: boolean;
};

export function ApprovalDrawer({
  open,
  onOpenChange,
  orderId,
  customerName,
  customerHasPhone,
}: ApprovalDrawerProps) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<ApprovalFormValues>({
    resolver: zodResolver(formSchema) as Resolver<ApprovalFormValues>,
    defaultValues: {
      items: [{ nombre: "", cantidad: 1, precio: 0 }],
      sendWhatsapp: customerHasPhone,
    },
    mode: "onSubmit",
  });

  const { control, handleSubmit, register, watch, reset, formState } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "items" });

  // Totales en vivo (watch sobre items + sendWhatsapp para re-render).
  const watchedItems = watch("items");
  const sendWhatsapp = watch("sendWhatsapp");

  const { subtotal, iva, total } = useMemo(() => {
    const sub = (watchedItems ?? []).reduce((acc, it) => {
      const cant = Number(it?.cantidad) || 0;
      const precio = Number(it?.precio) || 0;
      return acc + cant * precio;
    }, 0);
    const ivaCalc = sub * IVA_RATE;
    return { subtotal: sub, iva: ivaCalc, total: sub + ivaCalc };
  }, [watchedItems]);

  const handleClose = () => {
    if (submitting) return;
    onOpenChange(false);
    // Reset diferido para que la animación de cierre no muestre el reset.
    setTimeout(() => {
      reset({
        items: [{ nombre: "", cantidad: 1, precio: 0 }],
        sendWhatsapp: customerHasPhone,
      });
    }, 250);
  };

  const onSubmit = async (values: ApprovalFormValues) => {
    setSubmitting(true);
    toast.loading("Creando aprobación…", { id: "approval-create" });

    // Construir payload server-side (incluye subtotal recalculado).
    const items = values.items.map((it) => {
      const cant = Number(it.cantidad);
      const precio = Number(it.precio);
      return {
        nombre: it.nombre.trim(),
        cantidad: cant,
        precio,
        subtotal: Number((cant * precio).toFixed(2)),
      };
    });

    try {
      const res = await fetch(`/api/service-orders/${orderId}/approvals`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items,
          channel: values.sendWhatsapp ? "WHATSAPP_PUBLIC" : undefined,
        }),
      });
      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: {
          approvalId: string;
          expiresAt: string;
          whatsappUrl: string | null;
          whatsappReason: string | null;
        };
      };

      if (!json.success || !json.data) {
        toast.error(json.error ?? "No se pudo crear la aprobación", {
          id: "approval-create",
        });
        return;
      }

      // Apertura de WhatsApp (si aplica + link armado).
      if (values.sendWhatsapp) {
        if (json.data.whatsappUrl) {
          window.open(json.data.whatsappUrl, "_blank", "noopener,noreferrer");
          toast.success(
            "Aprobación creada. Envía manualmente desde WhatsApp.",
            { id: "approval-create" },
          );
        } else if (json.data.whatsappReason === "CUSTOMER_HAS_NO_PHONE") {
          toast.warning(
            "Aprobación creada, pero el cliente no tiene teléfono registrado.",
            { id: "approval-create" },
          );
        } else if (json.data.whatsappReason === "TEMPLATE_NOT_CONFIGURED") {
          toast.warning(
            "Aprobación creada. La sucursal no tiene plantilla de WhatsApp configurada.",
            { id: "approval-create" },
          );
        } else {
          toast.success("Aprobación creada", { id: "approval-create" });
        }
      } else {
        toast.success("Aprobación creada", { id: "approval-create" });
      }

      onOpenChange(false);
      reset({
        items: [{ nombre: "", cantidad: 1, precio: 0 }],
        sendWhatsapp: customerHasPhone,
      });
      router.refresh();
    } catch {
      toast.error("Error de red al crear la aprobación", {
        id: "approval-create",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(o) => (!o ? handleClose() : onOpenChange(o))}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="sm:max-w-lg w-full p-0 border-l-0"
        style={{
          background:
            "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
        }}
      >
        <form
          onSubmit={handleSubmit(onSubmit)}
          className="flex flex-col h-full"
        >
          {/* Header */}
          <SheetHeader className="px-6 pt-6 pb-4 border-b border-[var(--ghost-border)]">
            <div className="flex items-start justify-between gap-3">
              <div className="space-y-1">
                <SheetTitle
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.25rem",
                    fontWeight: 700,
                    color: "var(--on-surf)",
                  }}
                >
                  Solicitar aprobación
                </SheetTitle>
                <SheetDescription style={{ color: "var(--on-surf-var)" }}>
                  Trabajo extra para {customerName}. Vence en 48h.
                </SheetDescription>
              </div>
              <button
                type="button"
                onClick={handleClose}
                disabled={submitting}
                className="rounded-md p-1 transition-opacity hover:opacity-70 disabled:opacity-30"
                style={{ color: "var(--on-surf-var)" }}
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </SheetHeader>

          {/* Items list */}
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
            {fields.map((field, index) => (
              <div
                key={field.id}
                className="rounded-xl p-3 space-y-2"
                style={{ background: "var(--surf-low)" }}
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    style={{
                      fontSize: "0.6875rem",
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "var(--on-surf-var)",
                    }}
                  >
                    Ítem {index + 1}
                  </span>
                  {fields.length > 1 && (
                    <button
                      type="button"
                      onClick={() => remove(index)}
                      disabled={submitting}
                      className="rounded p-1 transition-opacity hover:opacity-70 disabled:opacity-30"
                      style={{ color: "var(--ter)" }}
                      aria-label="Eliminar ítem"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <input
                  {...register(`items.${index}.nombre`)}
                  placeholder="Descripción del trabajo o refacción"
                  disabled={submitting}
                  className="w-full rounded-lg px-3 py-2 outline-none"
                  style={{
                    background: "var(--surf-bright)",
                    color: "var(--on-surf)",
                    border: "1px solid var(--ghost-border)",
                    fontSize: "0.8125rem",
                  }}
                />
                {formState.errors.items?.[index]?.nombre && (
                  <p style={{ fontSize: "0.6875rem", color: "var(--ter)" }}>
                    {formState.errors.items[index]?.nombre?.message}
                  </p>
                )}

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label
                      style={{
                        fontSize: "0.625rem",
                        color: "var(--on-surf-var)",
                        display: "block",
                        marginBottom: 2,
                      }}
                    >
                      Cantidad
                    </label>
                    <input
                      type="number"
                      min={1}
                      step={1}
                      {...register(`items.${index}.cantidad`)}
                      disabled={submitting}
                      className="w-full rounded-lg px-3 py-2 outline-none"
                      style={{
                        background: "var(--surf-bright)",
                        color: "var(--on-surf)",
                        border: "1px solid var(--ghost-border)",
                        fontSize: "0.8125rem",
                      }}
                    />
                  </div>
                  <div>
                    <label
                      style={{
                        fontSize: "0.625rem",
                        color: "var(--on-surf-var)",
                        display: "block",
                        marginBottom: 2,
                      }}
                    >
                      Precio unitario
                    </label>
                    <input
                      type="number"
                      min={0}
                      step="0.01"
                      {...register(`items.${index}.precio`)}
                      disabled={submitting}
                      className="w-full rounded-lg px-3 py-2 outline-none"
                      style={{
                        background: "var(--surf-bright)",
                        color: "var(--on-surf)",
                        border: "1px solid var(--ghost-border)",
                        fontSize: "0.8125rem",
                      }}
                    />
                  </div>
                </div>
              </div>
            ))}

            <button
              type="button"
              onClick={() => append({ nombre: "", cantidad: 1, precio: 0 })}
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 rounded-xl py-2.5 transition-opacity hover:opacity-80 disabled:opacity-50"
              style={{
                background: "var(--surf-low)",
                color: "var(--on-surf-var)",
                border: "1px dashed var(--ghost-border)",
                fontSize: "0.8125rem",
                fontWeight: 500,
              }}
            >
              <Plus className="h-4 w-4" /> Agregar ítem
            </button>

            {formState.errors.items?.message && (
              <p
                className="rounded-lg px-3 py-2"
                style={{
                  fontSize: "0.75rem",
                  background: "var(--ter-container)",
                  color: "var(--ter)",
                }}
              >
                {formState.errors.items.message}
              </p>
            )}
          </div>

          {/* Sticky footer: totals + actions */}
          <div
            className="border-t border-[var(--ghost-border)] px-6 py-4 space-y-4"
            style={{
              background:
                "color-mix(in srgb, var(--surf-bright) 92%, transparent)",
            }}
          >
            <div className="space-y-1.5">
              <div className="flex justify-between" style={{ fontSize: "0.8125rem" }}>
                <span style={{ color: "var(--on-surf-var)" }}>Subtotal</span>
                <span style={{ color: "var(--on-surf)", fontFamily: "var(--font-number)" }}>
                  {formatMXN(subtotal)}
                </span>
              </div>
              <div className="flex justify-between" style={{ fontSize: "0.8125rem" }}>
                <span style={{ color: "var(--on-surf-var)" }}>IVA (16%)</span>
                <span style={{ color: "var(--on-surf)", fontFamily: "var(--font-number)" }}>
                  {formatMXN(iva)}
                </span>
              </div>
              <div className="flex justify-between pt-1" style={{ fontSize: "0.9375rem" }}>
                <span style={{ color: "var(--on-surf)", fontWeight: 600 }}>Total</span>
                <span
                  style={{
                    color: "var(--on-surf)",
                    fontWeight: 700,
                    fontFamily: "var(--font-number)",
                  }}
                >
                  {formatMXN(total)}
                </span>
              </div>
            </div>

            <label
              className="flex items-center gap-2 cursor-pointer"
              title={
                customerHasPhone
                  ? undefined
                  : "El cliente no tiene teléfono registrado"
              }
            >
              <input
                type="checkbox"
                {...register("sendWhatsapp")}
                disabled={submitting || !customerHasPhone}
                style={{ accentColor: "var(--p-bright)" }}
              />
              <span
                style={{
                  fontSize: "0.8125rem",
                  color: customerHasPhone ? "var(--on-surf)" : "var(--on-surf-var)",
                }}
              >
                Abrir WhatsApp para enviar al cliente
                {!customerHasPhone && " (sin teléfono)"}
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="w-full flex items-center justify-center gap-2 font-semibold text-sm transition-opacity disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #1b4332, #2ecc71)",
                color: "#ffffff",
                borderRadius: "var(--r-full)",
                border: "none",
                height: 44,
                cursor: submitting ? "not-allowed" : "pointer",
              }}
            >
              {submitting
                ? "Creando…"
                : sendWhatsapp
                  ? "Crear y abrir WhatsApp"
                  : "Crear aprobación"}
            </button>
          </div>
        </form>
      </SheetContent>
    </Sheet>
  );
}
