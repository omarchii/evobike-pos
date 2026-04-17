"use client";

import { useEffect, useState, useCallback } from "react";
import { useForm, useWatch, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { X, Plus, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import type { BranchOption } from "./shared-tokens";
import {
  CLOSE_BUTTON_STYLE,
  DESCRIPTION_STYLE,
  ERROR_STYLE,
  INPUT_STYLE,
  LABEL_STYLE,
  MODAL_STYLE_LG,
  PRIMARY_BUTTON_STYLE,
  SECONDARY_BUTTON_STYLE,
  SELECT_STYLE,
  TEXTAREA_STYLE,
  TITLE_STYLE,
} from "./shared-tokens";

// ── Types ─────────────────────────────────────────────────────────────────────

const ITEM_TIPOS = ["variante", "simple", "bateria", "bici"] as const;
type ItemTipo = (typeof ITEM_TIPOS)[number];

const TIPO_LABELS: Record<ItemTipo, string> = {
  variante: "Vehículo",
  simple: "Accesorio/Refacción",
  bateria: "Batería (serial)",
  bici: "Bici en piso",
};

interface AvailableItems {
  productVariants: { id: string; label: string; stock: number }[];
  simpleProducts: { id: string; label: string; stock: number; nombre: string }[];
  batteries: { id: string; serialNumber: string }[];
  customerBikes: { id: string; serialNumber: string; brand: string; model: string; color: string | null }[];
}

// ── Form Schema ───────────────────────────────────────────────────────────────

const itemSchema = z
  .object({
    _tipo: z.enum(ITEM_TIPOS),
    _productVariantId: z.string().optional(),
    _simpleProductId: z.string().optional(),
    _batteryId: z.string().optional(),
    _customerBikeId: z.string().optional(),
    cantidadEnviada: z
      .number({ message: "Ingresa una cantidad válida" })
      .int()
      .positive("La cantidad debe ser mayor a 0"),
  })
  .superRefine((d, ctx) => {
    if (d._tipo === "variante" && !d._productVariantId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["_productVariantId"], message: "Selecciona un vehículo" });
    }
    if (d._tipo === "simple" && !d._simpleProductId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["_simpleProductId"], message: "Selecciona un accesorio" });
    }
    if (d._tipo === "bateria") {
      if (!d._batteryId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["_batteryId"], message: "Selecciona una batería" });
      if (d.cantidadEnviada !== 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cantidadEnviada"], message: "Solo cantidad 1" });
    }
    if (d._tipo === "bici") {
      if (!d._customerBikeId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["_customerBikeId"], message: "Selecciona una bicicleta" });
      if (d.cantidadEnviada !== 1) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["cantidadEnviada"], message: "Solo cantidad 1" });
    }
  });

const formSchema = z
  .object({
    fromBranchId: z.string().min(1, "Sucursal de origen requerida"),
    toBranchId: z.string().min(1, "Sucursal de destino requerida"),
    notas: z.string().trim().optional(),
    items: z.array(itemSchema).min(1, "Agrega al menos un ítem"),
  })
  .superRefine((d, ctx) => {
    if (d.fromBranchId && d.toBranchId && d.fromBranchId === d.toBranchId) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["toBranchId"], message: "Origen y destino deben ser distintos" });
    }
  });

type FormValues = z.infer<typeof formSchema>;

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branches: BranchOption[];
  userRole: string;
  userBranchId: string;
  canCreateBorrador: boolean;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function NuevaTransferenciaDialog({
  open,
  onOpenChange,
  branches,
  userRole,
  userBranchId,
  canCreateBorrador,
}: Props) {
  const router = useRouter();
  // fetchedFor tracks which branchId was last fetched to derive loading state without synchronous setState
  const [fetchedFor, setFetchedFor] = useState<string | null>(null);
  const [availableItems, setAvailableItems] = useState<AvailableItems | null>(null);
  const [pendingAction, setPendingAction] = useState<"borrador" | "enviar" | null>(null);

  const defaultFrom = userRole === "MANAGER" ? userBranchId : "";
  const defaultTo = userRole === "SELLER" ? userBranchId : "";

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      fromBranchId: defaultFrom,
      toBranchId: defaultTo,
      notas: "",
      items: [{ _tipo: "variante", _productVariantId: "", cantidadEnviada: 1 }],
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const fromBranchId = useWatch({ control: form.control, name: "fromBranchId" });

  // Derive loading state from fetchedFor vs fromBranchId (no synchronous setState needed)
  const loadingItems = !!fromBranchId && fetchedFor !== fromBranchId;

  // Fetch available items when fromBranchId changes — only call setState in async callbacks
  useEffect(() => {
    if (!fromBranchId) return;
    let cancelled = false;
    fetch(`/api/transferencias/items-disponibles?branchId=${encodeURIComponent(fromBranchId)}`)
      .then((r) => r.json())
      .then((data: { success: boolean; data?: AvailableItems }) => {
        if (cancelled) return;
        setFetchedFor(fromBranchId);
        setAvailableItems(data.success && data.data ? data.data : null);
      })
      .catch(() => {
        if (!cancelled) setFetchedFor(fromBranchId);
      });
    return () => { cancelled = true; };
  }, [fromBranchId]);

  const handleOpenChange = useCallback(
    (next: boolean) => {
      if (!next) {
        form.reset({
          fromBranchId: defaultFrom,
          toBranchId: defaultTo,
          notas: "",
          items: [{ _tipo: "variante", _productVariantId: "", cantidadEnviada: 1 }],
        });
        setFetchedFor(null);
        setAvailableItems(null);
        setPendingAction(null);
        onOpenChange(false);
      } else {
        onOpenChange(true);
      }
    },
    [onOpenChange, form, defaultFrom, defaultTo],
  );

  const onSubmit = async (values: FormValues, enviarAhora: boolean): Promise<void> => {
    setPendingAction(enviarAhora ? "enviar" : "borrador");
    const toastId = "transfer-create";
    toast.loading(enviarAhora ? "Creando y despachando…" : "Guardando borrador…", { id: toastId });

    const body = {
      fromBranchId: values.fromBranchId,
      toBranchId: values.toBranchId,
      notas: values.notas?.trim() || null,
      enviarAhora,
      items: values.items.map((item) => ({
        productVariantId: item._tipo === "variante" ? (item._productVariantId || null) : null,
        simpleProductId: item._tipo === "simple" ? (item._simpleProductId || null) : null,
        batteryId: item._tipo === "bateria" ? (item._batteryId || null) : null,
        customerBikeId: item._tipo === "bici" ? (item._customerBikeId || null) : null,
        cantidadEnviada: item.cantidadEnviada,
      })),
    };

    try {
      const res = await fetch("/api/transferencias", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = (await res.json()) as { success: boolean; error?: string; data?: { folio: string } };

      if (!json.success) {
        toast.error(json.error ?? "Error al crear la transferencia", { id: toastId });
        setPendingAction(null);
        return;
      }

      toast.success(`Transferencia ${json.data?.folio ?? ""} creada`, { id: toastId });
      handleOpenChange(false);
      router.refresh();
    } catch {
      toast.error("Error de red. Intenta de nuevo.", { id: toastId });
      setPendingAction(null);
    }
  };

  const handleBorrador = form.handleSubmit((values) => onSubmit(values, false));
  const handleEnviar = form.handleSubmit((values) => onSubmit(values, true));

  const isSubmitting = !!pendingAction;

  const otherBranches = branches.filter((b) => b.id !== userBranchId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col"
        style={MODAL_STYLE_LG}
      >
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle style={TITLE_STYLE}>Nueva transferencia</DialogTitle>
            <button
              type="button"
              onClick={() => handleOpenChange(false)}
              style={CLOSE_BUTTON_STYLE}
              aria-label="Cerrar"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <DialogDescription style={DESCRIPTION_STYLE}>
            {userRole === "SELLER"
              ? "Solicita el envío de stock desde otra sucursal hacia la tuya."
              : "Crea un borrador o despáchalo inmediatamente."}
          </DialogDescription>
        </DialogHeader>

        <div className="overflow-y-auto flex-1">
          <form noValidate>
            <div className="px-6 space-y-5 pb-2">
              {/* Branches row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label style={LABEL_STYLE}>Sucursal de origen</label>
                  {userRole === "MANAGER" ? (
                    <input
                      readOnly
                      value={branches.find((b) => b.id === userBranchId)?.name ?? "—"}
                      style={{ ...INPUT_STYLE, opacity: 0.7, cursor: "default" }}
                    />
                  ) : (
                    <select
                      style={SELECT_STYLE}
                      {...form.register("fromBranchId")}
                    >
                      <option value="">Seleccionar origen…</option>
                      {(userRole === "SELLER" ? otherBranches : branches).map((b) => (
                        <option key={b.id} value={b.id}>{b.name}</option>
                      ))}
                    </select>
                  )}
                  {form.formState.errors.fromBranchId && (
                    <p style={ERROR_STYLE}>{form.formState.errors.fromBranchId.message}</p>
                  )}
                </div>
                <div>
                  <label style={LABEL_STYLE}>Sucursal de destino</label>
                  {userRole === "SELLER" ? (
                    <input
                      readOnly
                      value={branches.find((b) => b.id === userBranchId)?.name ?? "—"}
                      style={{ ...INPUT_STYLE, opacity: 0.7, cursor: "default" }}
                    />
                  ) : (
                    <select
                      style={SELECT_STYLE}
                      {...form.register("toBranchId")}
                    >
                      <option value="">Seleccionar destino…</option>
                      {branches
                        .filter((b) => b.id !== (userRole === "MANAGER" ? userBranchId : undefined))
                        .map((b) => (
                          <option key={b.id} value={b.id}>{b.name}</option>
                        ))}
                    </select>
                  )}
                  {form.formState.errors.toBranchId && (
                    <p style={ERROR_STYLE}>{form.formState.errors.toBranchId.message}</p>
                  )}
                </div>
              </div>

              {/* Notes */}
              <div>
                <label style={LABEL_STYLE}>Notas (opcional)</label>
                <textarea
                  style={TEXTAREA_STYLE}
                  placeholder="Observaciones para esta transferencia…"
                  {...form.register("notas")}
                />
              </div>

              {/* Items */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <label style={{ ...LABEL_STYLE, marginBottom: 0 }}>
                    Ítems {loadingItems && <span style={{ fontWeight: 400, textTransform: "none" }}>(cargando…)</span>}
                  </label>
                  <button
                    type="button"
                    onClick={() => append({ _tipo: "variante", _productVariantId: "", cantidadEnviada: 1 })}
                    className="flex items-center gap-1.5 text-xs font-medium rounded-full px-3 py-1 transition-opacity hover:opacity-80"
                    style={{
                      background: "var(--surf-high)",
                      color: "var(--p)",
                      border: "none",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Agregar ítem
                  </button>
                </div>

                {form.formState.errors.items?.root && (
                  <p style={ERROR_STYLE}>{form.formState.errors.items.root.message}</p>
                )}
                {form.formState.errors.items?.message && (
                  <p style={ERROR_STYLE}>{form.formState.errors.items.message}</p>
                )}

                <div className="space-y-3">
                  {fields.map((field, idx) => (
                    <ItemCard
                      key={field.id}
                      idx={idx}
                      form={form}
                      availableItems={availableItems}
                      onRemove={() => remove(idx)}
                      canRemove={fields.length > 1}
                    />
                  ))}
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="px-6 pt-4 pb-6 flex gap-3 justify-end shrink-0">
              <button
                type="button"
                onClick={() => handleOpenChange(false)}
                style={{ ...SECONDARY_BUTTON_STYLE, opacity: isSubmitting ? 0.5 : 1 }}
                disabled={isSubmitting}
              >
                Cancelar
              </button>
              {canCreateBorrador && (
                <button
                  type="button"
                  onClick={handleBorrador}
                  disabled={isSubmitting}
                  style={{
                    ...SECONDARY_BUTTON_STYLE,
                    opacity: isSubmitting ? 0.5 : 1,
                    cursor: isSubmitting ? "not-allowed" : "pointer",
                    color: "var(--p)",
                  }}
                >
                  {pendingAction === "borrador" ? "Guardando…" : "Guardar borrador"}
                </button>
              )}
              <button
                type="button"
                onClick={handleEnviar}
                disabled={isSubmitting}
                style={{
                  ...PRIMARY_BUTTON_STYLE,
                  opacity: isSubmitting ? 0.6 : 1,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                }}
              >
                {pendingAction === "enviar"
                  ? "Enviando…"
                  : userRole === "SELLER"
                    ? "Enviar solicitud"
                    : "Crear y enviar ahora"}
              </button>
            </div>
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Item Card ─────────────────────────────────────────────────────────────────

function ItemCard({
  idx,
  form,
  availableItems,
  onRemove,
  canRemove,
}: {
  idx: number;
  form: ReturnType<typeof useForm<FormValues>>;
  availableItems: AvailableItems | null;
  onRemove: () => void;
  canRemove: boolean;
}) {
  const tipo = useWatch({ control: form.control, name: `items.${idx}._tipo` as const });
  const isSingle = tipo === "bateria" || tipo === "bici";

  // Auto-set cantidad to 1 when type is battery/bike
  useEffect(() => {
    if (isSingle) {
      form.setValue(`items.${idx}.cantidadEnviada`, 1);
    }
  }, [isSingle, idx, form]);

  const errors = form.formState.errors.items?.[idx];

  return (
    <div
      className="rounded-xl p-4 space-y-3"
      style={{ background: "var(--surf-low)", border: "none" }}
    >
      {/* Type selector */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex gap-1 flex-wrap">
          {ITEM_TIPOS.map((t) => {
            const active = tipo === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => {
                  form.setValue(`items.${idx}._tipo`, t);
                  form.setValue(`items.${idx}._productVariantId`, "");
                  form.setValue(`items.${idx}._simpleProductId`, "");
                  form.setValue(`items.${idx}._batteryId`, "");
                  form.setValue(`items.${idx}._customerBikeId`, "");
                  if (t === "bateria" || t === "bici") form.setValue(`items.${idx}.cantidadEnviada`, 1);
                }}
                className="text-[0.625rem] font-medium rounded-full px-2.5 py-0.5 uppercase tracking-[0.04em] transition-colors"
                style={{
                  background: active ? "var(--p-container)" : "var(--surf-highest)",
                  color: active ? "var(--on-p-container)" : "var(--on-surf-var)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                {TIPO_LABELS[t]}
              </button>
            );
          })}
        </div>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="shrink-0 flex items-center justify-center w-7 h-7 rounded-full transition-opacity hover:opacity-80"
            style={{ background: "var(--ter-container)", color: "var(--ter)", border: "none", cursor: "pointer" }}
            aria-label="Eliminar ítem"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {/* Selector + quantity */}
      <div className="grid grid-cols-[1fr_100px] gap-3">
        <div>
          {tipo === "variante" && (
            <>
              <select style={SELECT_STYLE} {...form.register(`items.${idx}._productVariantId`)}>
                <option value="">
                  {availableItems ? "Seleccionar vehículo…" : "Selecciona sucursal de origen primero"}
                </option>
                {availableItems?.productVariants.map((pv) => (
                  <option key={pv.id} value={pv.id}>{pv.label}</option>
                ))}
              </select>
              {errors?._productVariantId && <p style={ERROR_STYLE}>{errors._productVariantId.message}</p>}
            </>
          )}
          {tipo === "simple" && (
            <>
              <select style={SELECT_STYLE} {...form.register(`items.${idx}._simpleProductId`)}>
                <option value="">
                  {availableItems ? "Seleccionar accesorio…" : "Selecciona sucursal de origen primero"}
                </option>
                {availableItems?.simpleProducts.map((sp) => (
                  <option key={sp.id} value={sp.id}>{sp.label}</option>
                ))}
              </select>
              {errors?._simpleProductId && <p style={ERROR_STYLE}>{errors._simpleProductId.message}</p>}
            </>
          )}
          {tipo === "bateria" && (
            <>
              <select style={SELECT_STYLE} {...form.register(`items.${idx}._batteryId`)}>
                <option value="">
                  {availableItems ? "Seleccionar batería…" : "Selecciona sucursal de origen primero"}
                </option>
                {availableItems?.batteries.map((b) => (
                  <option key={b.id} value={b.id}>S/N: {b.serialNumber}</option>
                ))}
              </select>
              {errors?._batteryId && <p style={ERROR_STYLE}>{errors._batteryId.message}</p>}
            </>
          )}
          {tipo === "bici" && (
            <>
              <select style={SELECT_STYLE} {...form.register(`items.${idx}._customerBikeId`)}>
                <option value="">
                  {availableItems ? "Seleccionar bicicleta…" : "Selecciona sucursal de origen primero"}
                </option>
                {availableItems?.customerBikes.map((cb) => (
                  <option key={cb.id} value={cb.id}>
                    {cb.brand} {cb.model}{cb.color ? ` (${cb.color})` : ""} — S/N: {cb.serialNumber}
                  </option>
                ))}
              </select>
              {errors?._customerBikeId && <p style={ERROR_STYLE}>{errors._customerBikeId.message}</p>}
            </>
          )}
        </div>
        <div>
          <label style={{ ...LABEL_STYLE, marginBottom: "0.25rem" }}>Cantidad</label>
          <input
            type="number"
            min={1}
            disabled={isSingle}
            style={{
              ...INPUT_STYLE,
              opacity: isSingle ? 0.6 : 1,
              cursor: isSingle ? "default" : "text",
            }}
            {...form.register(`items.${idx}.cantidadEnviada`, { valueAsNumber: true })}
          />
          {errors?.cantidadEnviada && <p style={ERROR_STYLE}>{errors.cantidadEnviada.message}</p>}
        </div>
      </div>
    </div>
  );
}
