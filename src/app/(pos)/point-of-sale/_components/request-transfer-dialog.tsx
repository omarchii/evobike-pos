"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { X, AlertTriangle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { RemoteStockEntry } from "./remote-stock-popover";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface VariantOption {
  id: string;
  label: string;
  remoteStock: RemoteStockEntry[];
}

export type TransferProduct =
  | { kind: "simple"; id: string; name: string; remoteStock: RemoteStockEntry[] }
  | { kind: "variant"; id: string; name: string; remoteStock: RemoteStockEntry[] }
  | { kind: "modelo"; id: string; name: string; variantOptions: VariantOption[] };

interface ActiveTransfer {
  folio: string;
  status: string;
  cantidadPendiente: number;
  fromBranchName: string;
}

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  product: TransferProduct;
  myBranchId: string;
  myBranchName: string;
}

// ── Styles (aligned with shared-tokens) ──────────────────────────────────────

const LABEL_STYLE: React.CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.6875rem",
  fontWeight: 500,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--on-surf-var)",
  marginBottom: "0.375rem",
  display: "block",
};

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  fontSize: "0.9375rem",
  height: 44,
  width: "100%",
  padding: "0 0.75rem",
  outline: "none",
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233d5247' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.9rem center",
  paddingRight: "2.5rem",
};

const ERROR_STYLE: React.CSSProperties = {
  color: "var(--ter)",
  fontSize: "0.75rem",
  marginTop: "0.25rem",
};

// ── Component ─────────────────────────────────────────────────────────────────

export function RequestTransferDialog({
  open,
  onOpenChange,
  product,
  myBranchId,
  myBranchName,
}: Props) {
  const [activeTransfer, setActiveTransfer] = useState<ActiveTransfer | null>(null);
  const [dismissedWarning, setDismissedWarning] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Dynamic schema: variantId required for modelo kind
  const schema = useMemo(() => {
    const base = z.object({
      fromBranchId: z.string().min(1, "Selecciona una sucursal de origen"),
      cantidad: z
        .number()
        .int()
        .min(1, "Mínimo 1 unidad"),
      notas: z.string().optional(),
    });
    if (product.kind === "modelo") {
      return base.extend({ variantId: z.string().min(1, "Selecciona una variante") });
    }
    return base.extend({ variantId: z.string().optional() });
  }, [product.kind]);

  type FormValues = z.infer<typeof schema>;

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      variantId: "",
      fromBranchId: "",
      cantidad: 1,
      notas: "",
    },
  });

  const watchedVariantId = useWatch({ control: form.control, name: "variantId" as keyof FormValues }) as string | undefined;
  const watchedFromBranchId = useWatch({ control: form.control, name: "fromBranchId" });

  // Derive the remote stock entries to use for the fromBranchId selector
  const effectiveRemoteStock: RemoteStockEntry[] = useMemo(() => {
    if (product.kind === "modelo") {
      if (!watchedVariantId) return [];
      return product.variantOptions.find((v) => v.id === watchedVariantId)?.remoteStock ?? [];
    }
    return product.remoteStock;
  }, [product, watchedVariantId]);

  // Max quantity based on selected branch
  const maxCantidad = useMemo(() => {
    if (!watchedFromBranchId) return 999;
    return effectiveRemoteStock.find((e) => e.branchId === watchedFromBranchId)?.quantity ?? 999;
  }, [effectiveRemoteStock, watchedFromBranchId]);

  // Pre-select fromBranchId when there's only one option
  useEffect(() => {
    if (effectiveRemoteStock.length === 1) {
      form.setValue("fromBranchId", effectiveRemoteStock[0].branchId);
    } else if (effectiveRemoteStock.length === 0) {
      form.setValue("fromBranchId", "");
    }
  }, [effectiveRemoteStock, form]);

  // Fetch active transfer on open / when variant changes
  useEffect(() => {
    if (!open) return;

    let productVariantId: string | null = null;
    let simpleProductId: string | null = null;

    if (product.kind === "variant") productVariantId = product.id;
    else if (product.kind === "simple") simpleProductId = product.id;
    else if (product.kind === "modelo") productVariantId = watchedVariantId ?? null;

    if (!productVariantId && !simpleProductId) {
      setActiveTransfer(null);
      return;
    }

    const params = new URLSearchParams();
    if (productVariantId) params.set("productVariantId", productVariantId);
    else if (simpleProductId) params.set("simpleProductId", simpleProductId);

    let cancelled = false;
    fetch(`/api/transferencias/solicitudes-activas?${params}`)
      .then((r) => r.json())
      .then((data: { success: boolean; data: ActiveTransfer | null }) => {
        if (!cancelled && data.success) setActiveTransfer(data.data);
      })
      .catch(() => {});

    return () => { cancelled = true; };
  }, [open, product, watchedVariantId]);

  // Reset on close
  useEffect(() => {
    if (!open) {
      form.reset({ variantId: "", fromBranchId: "", cantidad: 1, notas: "" });
      setActiveTransfer(null);
      setDismissedWarning(false);
    }
  }, [open, form]);

  const handleOpenChange = (next: boolean) => {
    if (!isSubmitting) onOpenChange(next);
  };

  const onSubmit = form.handleSubmit(async (values: FormValues) => {
    const variantId = (values as { variantId?: string }).variantId;
    const productVariantId =
      product.kind === "variant"
        ? product.id
        : product.kind === "modelo"
          ? (variantId ?? null)
          : null;
    const simpleProductId = product.kind === "simple" ? product.id : null;

    setIsSubmitting(true);
    const toastId = "request-transfer";
    toast.loading("Creando solicitud…", { id: toastId });

    try {
      const res = await fetch("/api/transferencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fromBranchId: values.fromBranchId,
          toBranchId: myBranchId,
          items: [
            {
              productVariantId: productVariantId ?? null,
              simpleProductId: simpleProductId ?? null,
              batteryId: null,
              customerBikeId: null,
              cantidadEnviada: values.cantidad,
            },
          ],
          notas: values.notas?.trim() || null,
          enviarAhora: false,
        }),
      });

      const json = (await res.json()) as {
        success: boolean;
        error?: string;
        data?: { folio: string };
      };

      if (!json.success) {
        if (res.status === 409 || res.status === 422) {
          toast.error(json.error ?? "Error al crear la solicitud", { id: toastId });
        } else {
          toast.error(json.error ?? "Error al crear la solicitud", { id: toastId });
        }
        return;
      }

      toast.success(`Solicitud ${json.data?.folio ?? ""} creada`, { id: toastId });
      onOpenChange(false);
    } catch {
      toast.error("Error de red. Intenta de nuevo.", { id: toastId });
    } finally {
      setIsSubmitting(false);
    }
  });

  const productDisplayName =
    product.kind === "modelo" && watchedVariantId
      ? `${product.name} · ${product.variantOptions.find((v) => v.id === watchedVariantId)?.label ?? ""}`
      : product.name;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
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
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.25rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--on-surf)",
              }}
            >
              Solicitar transferencia
            </DialogTitle>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              style={{
                width: 32, height: 32, display: "flex", alignItems: "center",
                justifyContent: "center", borderRadius: "var(--r-full)",
                background: "var(--surf-high)", color: "var(--on-surf-var)",
                border: "none", cursor: "pointer", flexShrink: 0,
              }}
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <DialogDescription
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              color: "var(--on-surf-var)",
            }}
          >
            {productDisplayName} → {myBranchName}
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Active transfer warning */}
          {activeTransfer && !dismissedWarning && (
            <div
              className="flex items-start gap-2 rounded-xl p-3"
              style={{ background: "var(--warn-container)", border: "1px solid var(--warn)" }}
            >
              <AlertTriangle
                className="shrink-0 mt-0.5"
                style={{ width: 14, height: 14, color: "var(--warn)" }}
              />
              <div className="flex-1 min-w-0">
                <p style={{ fontSize: 12, fontWeight: 600, color: "var(--warn)", fontFamily: "var(--font-body)" }}>
                  Solicitud activa: {activeTransfer.folio} ({activeTransfer.cantidadPendiente} uds pendientes)
                </p>
                <p style={{ fontSize: 11, color: "var(--warn)", fontFamily: "var(--font-body)", marginTop: 2, opacity: 0.8 }}>
                  Estado: {activeTransfer.status} · Desde {activeTransfer.fromBranchName}
                </p>
                <p style={{ fontSize: 11, color: "var(--warn)", fontFamily: "var(--font-body)", marginTop: 2 }}>
                  ¿Continuar con nueva solicitud?
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDismissedWarning(true)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--warn)", padding: 2 }}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} noValidate className="space-y-4">
            {/* Variant selector — only for modelo kind */}
            {product.kind === "modelo" && (
              <div>
                <label style={LABEL_STYLE}>Variante</label>
                <select
                  style={SELECT_STYLE}
                  {...form.register("variantId" as keyof FormValues)}
                >
                  <option value="">Seleccionar variante…</option>
                  {product.variantOptions.map((opt) => {
                    const totalRemote = opt.remoteStock.reduce((s, e) => s + e.quantity, 0);
                    return (
                      <option key={opt.id} value={opt.id}>
                        {opt.label} ({totalRemote} disponibles en otras suc.)
                      </option>
                    );
                  })}
                </select>
                {(form.formState.errors as Record<string, { message?: string }>).variantId && (
                  <p style={ERROR_STYLE}>
                    {(form.formState.errors as Record<string, { message?: string }>).variantId?.message}
                  </p>
                )}
              </div>
            )}

            {/* From branch selector */}
            <div>
              <label style={LABEL_STYLE}>Sucursal de origen</label>
              {effectiveRemoteStock.length === 1 ? (
                <input
                  readOnly
                  value={`${effectiveRemoteStock[0].branchName} (${effectiveRemoteStock[0].quantity} disponibles)`}
                  style={{ ...INPUT_STYLE, opacity: 0.75, cursor: "default" }}
                />
              ) : (
                <select
                  style={SELECT_STYLE}
                  {...form.register("fromBranchId")}
                  disabled={product.kind === "modelo" && !watchedVariantId}
                >
                  <option value="">Seleccionar sucursal…</option>
                  {effectiveRemoteStock.map((entry) => (
                    <option key={entry.branchId} value={entry.branchId}>
                      {entry.branchName} ({entry.quantity} disponibles)
                    </option>
                  ))}
                </select>
              )}
              {form.formState.errors.fromBranchId && (
                <p style={ERROR_STYLE}>{form.formState.errors.fromBranchId.message}</p>
              )}
            </div>

            {/* Quantity */}
            <div>
              <label style={LABEL_STYLE}>Cantidad</label>
              <input
                type="number"
                min={1}
                max={maxCantidad}
                style={INPUT_STYLE}
                {...form.register("cantidad", { valueAsNumber: true })}
              />
              {form.formState.errors.cantidad && (
                <p style={ERROR_STYLE}>{form.formState.errors.cantidad.message}</p>
              )}
              {watchedFromBranchId && maxCantidad < 999 && (
                <p style={{ fontSize: 11, color: "var(--on-surf-var)", marginTop: 4, fontFamily: "var(--font-body)" }}>
                  Máximo disponible: {maxCantidad}
                </p>
              )}
            </div>

            {/* Notes */}
            <div>
              <label style={LABEL_STYLE}>Notas (opcional)</label>
              <textarea
                rows={2}
                style={{
                  ...INPUT_STYLE,
                  height: "auto",
                  padding: "0.5rem 0.75rem",
                  resize: "vertical",
                  minHeight: 60,
                }}
                placeholder="Motivo de la solicitud…"
                {...form.register("notas")}
              />
            </div>

            {/* Actions */}
            <div className="flex gap-3 justify-end pt-2">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                disabled={isSubmitting}
                style={{
                  background: "var(--surf-high)",
                  color: "var(--on-surf-var)",
                  borderRadius: "var(--r-full)",
                  border: "none",
                  fontFamily: "var(--font-body)",
                  fontWeight: 500,
                  fontSize: "0.875rem",
                  height: 44,
                  paddingInline: "1.5rem",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  opacity: isSubmitting ? 0.5 : 1,
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
                  color: "#FFFFFF",
                  borderRadius: "var(--r-full)",
                  border: "none",
                  fontFamily: "var(--font-body)",
                  fontWeight: 600,
                  fontSize: "0.875rem",
                  height: 44,
                  paddingInline: "1.75rem",
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  opacity: isSubmitting ? 0.6 : 1,
                }}
              >
                {isSubmitting ? "Enviando…" : "Enviar solicitud"}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
