"use client";

import { useForm, useFieldArray, useWatch, FormProvider, useFormContext } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  ChevronDown,
  Loader2,
  User,
  Users,
  UserX,
  AlertTriangle,
  X,
} from "lucide-react";
import { useState } from "react";
import { formatMXN } from "@/lib/quotations";

// ── Design tokens ────────────────────────────────────────────────────────────

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  fontSize: "0.875rem",
  height: 44,
  width: "100%",
  padding: "0 0.75rem",
  outline: "none",
};

const TEXTAREA_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  fontSize: "0.875rem",
  padding: "0.65rem 0.75rem",
  resize: "none",
  width: "100%",
  outline: "none",
  minHeight: 80,
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
};

// ── Zod schema (espejo exacto del API) ───────────────────────────────────────

const itemSchema = z
  .object({
    productVariantId: z.string().optional(),
    description: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    isFreeForm: z.boolean(),
    // UI helpers — never sent to API (empty string = not selected)
    _modeloId: z.string().optional(),
    _voltajeId: z.string().optional(),
  })
  .superRefine((item, ctx) => {
    if (item.isFreeForm) {
      if (!item.description?.trim() || item.description.trim().length < 3) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Descripción requerida (mínimo 3 caracteres)",
          path: ["description"],
        });
      }
      if (!item.unitPrice || item.unitPrice <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Precio requerido",
          path: ["unitPrice"],
        });
      }
    } else {
      if (!item.productVariantId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecciona un producto del catálogo",
          path: ["productVariantId"],
        });
      }
    }
  });

const quotationFormSchema = z
  .object({
    customerMode: z.enum(["existing", "anonymous", "none"]),
    customerId: z.string().optional(),
    anonymousCustomerName: z.string().optional(),
    anonymousCustomerPhone: z.string().optional(),
    items: z.array(itemSchema).min(1, "Agrega al menos un artículo"),
    discountEnabled: z.boolean(),
    discountAmount: z.number().nonnegative(),
    discountAuthorizedById: z.string().optional(),
    internalNote: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.discountEnabled && data.discountAmount > 0) {
      if (!data.discountAuthorizedById) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Selecciona un gerente autorizador",
          path: ["discountAuthorizedById"],
        });
      }
    }
  });

type FormValues = z.infer<typeof quotationFormSchema>;

// ── Prop types ───────────────────────────────────────────────────────────────

export interface ModeloOption {
  id: string;
  nombre: string;
  voltajes: {
    id: string;
    label: string;
    colores: {
      id: string;
      nombre: string;
      variantId: string;
      precio: number;
    }[];
  }[];
}

export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
}

export interface ManagerOption {
  id: string;
  name: string;
}

export interface QuotationInitialData {
  id: string;
  customerId: string | null;
  anonymousCustomerName: string | null;
  anonymousCustomerPhone: string | null;
  discountAmount: number;
  discountAuthorizedById: string | null;
  internalNote: string | null;
  validUntil: string;
  items: {
    productVariantId: string | null;
    description: string;
    quantity: number;
    unitPrice: number;
    isFreeForm: boolean;
  }[];
}

interface Props {
  mode: "create" | "edit";
  quotationId?: string;
  initialData?: QuotationInitialData;
  modelos: ModeloOption[];
  customers: CustomerOption[];
  managers: ManagerOption[];
}

// ── Item card (module-level to satisfy React Compiler) ───────────────────────

interface ItemCardProps {
  index: number;
  fieldId: string;
  modelos: ModeloOption[];
  onRemove: (index: number) => void;
}

function ItemCard({ index, modelos, onRemove }: ItemCardProps) {
  const form = useFormContext<FormValues>();

  // useWatch (hook) — properly subscribes this component to field changes and triggers re-renders.
  // form.watch() (imperative API) does NOT subscribe children reliably; never use it here.
  const isFree = useWatch({ control: form.control, name: `items.${index}.isFreeForm` });
  const modeloId = useWatch({ control: form.control, name: `items.${index}._modeloId` });
  const voltajeId = useWatch({ control: form.control, name: `items.${index}._voltajeId` });
  const qty = useWatch({ control: form.control, name: `items.${index}.quantity` }) ?? 1;
  const price = useWatch({ control: form.control, name: `items.${index}.unitPrice` }) ?? 0;
  const productVariantId = useWatch({ control: form.control, name: `items.${index}.productVariantId` });
  const lineTotal = qty * price;

  const selectedModelo = modelos.find((m) => m.id === modeloId);
  const selectedVoltaje = selectedModelo?.voltajes.find((v) => v.id === voltajeId);

  return (
    // Issue 1 fix: card uses --surf-high so inputs (--surf-low) appear recessed — proper contrast
    <div className="rounded-xl p-4 relative" style={{ background: "var(--surf-high)" }}>
      <div className="flex items-start justify-between mb-3">
        {isFree && (
          <span
            className="text-[0.625rem] font-medium px-2 py-0.5 rounded-full"
            style={{ background: "var(--p-container)", color: "var(--on-p-container)" }}
          >
            Línea libre
          </span>
        )}
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="ml-auto p-1 rounded-lg transition-colors hover:bg-[var(--surf-highest)]"
          style={{ color: "var(--on-surf-var)" }}
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>

      {isFree ? (
        <div className="space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
              Descripción *
            </label>
            <textarea
              {...form.register(`items.${index}.description`)}
              placeholder="Ej. Instalación especial, accesorio bajo pedido..."
              style={TEXTAREA_STYLE}
              rows={2}
            />
            {form.formState.errors.items?.[index]?.description && (
              <p className="text-[0.625rem] text-[var(--ter)] mt-1">
                {form.formState.errors.items[index]?.description?.message}
              </p>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3 items-end">
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
                Precio unitario *
              </label>
              <input
                type="number"
                min={0}
                step={0.01}
                {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                style={INPUT_STYLE}
                placeholder="0.00"
              />
            </div>
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
                Cantidad
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const cur = form.getValues(`items.${index}.quantity`);
                    if (cur > 1) form.setValue(`items.${index}.quantity`, cur - 1);
                  }}
                  className="h-8 w-8 rounded-lg text-sm font-bold transition-colors hover:bg-[var(--surf-highest)] flex items-center justify-center"
                  style={{ background: "var(--surf-lowest)", color: "var(--on-surf)" }}
                >
                  −
                </button>
                <span className="text-sm font-semibold min-w-[2rem] text-center" style={{ color: "var(--on-surf)" }}>
                  {qty}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    const cur = form.getValues(`items.${index}.quantity`);
                    form.setValue(`items.${index}.quantity`, cur + 1);
                  }}
                  className="h-8 w-8 rounded-lg text-sm font-bold transition-colors hover:bg-[var(--surf-highest)] flex items-center justify-center"
                  style={{ background: "var(--surf-lowest)", color: "var(--on-surf)" }}
                >
                  +
                </button>
                <span className="ml-auto text-base font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}>
                  {formatMXN(lineTotal)}
                </span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {/* Modelo */}
          <div>
            <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
              Modelo
            </label>
            <div className="relative">
              <select
                value={modeloId ?? ""}
                onChange={(e) => {
                  form.setValue(`items.${index}._modeloId`, e.target.value, { shouldDirty: true });
                  form.setValue(`items.${index}._voltajeId`, "");
                  form.setValue(`items.${index}.productVariantId`, "");
                  form.setValue(`items.${index}.unitPrice`, 0);
                  form.setValue(`items.${index}.description`, "");
                }}
                style={SELECT_STYLE}
              >
                <option value="">Selecciona un modelo...</option>
                {modelos.map((m) => (
                  <option key={m.id} value={m.id}>{m.nombre}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--on-surf-var)" }} />
            </div>
          </div>

          {/* Voltaje */}
          {selectedModelo && (
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
                Voltaje
              </label>
              <div className="relative">
                <select
                  value={voltajeId ?? ""}
                  onChange={(e) => {
                    form.setValue(`items.${index}._voltajeId`, e.target.value, { shouldDirty: true });
                    form.setValue(`items.${index}.productVariantId`, "");
                    form.setValue(`items.${index}.unitPrice`, 0);
                    form.setValue(`items.${index}.description`, "");
                  }}
                  style={SELECT_STYLE}
                >
                  <option value="">Selecciona voltaje...</option>
                  {selectedModelo.voltajes.map((v) => (
                    <option key={v.id} value={v.id}>{v.label}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--on-surf-var)" }} />
              </div>
            </div>
          )}

          {/* Color */}
          {selectedVoltaje && (
            <div>
              <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
                Color
              </label>
              <div className="relative">
                <select
                  value={productVariantId ?? ""}
                  onChange={(e) => {
                    const variantId = e.target.value;
                    const colorOpt = selectedVoltaje.colores.find((c) => c.variantId === variantId);
                    form.setValue(`items.${index}.productVariantId`, variantId, { shouldDirty: true });
                    if (colorOpt) {
                      form.setValue(`items.${index}.unitPrice`, colorOpt.precio);
                      const modelo = modelos.find((m) => m.id === modeloId);
                      const voltaje = modelo?.voltajes.find((v) => v.id === voltajeId);
                      form.setValue(
                        `items.${index}.description`,
                        `${modelo?.nombre ?? ""} ${colorOpt.nombre} ${voltaje?.label ?? ""}`
                      );
                    }
                  }}
                  style={SELECT_STYLE}
                >
                  <option value="">Selecciona color...</option>
                  {selectedVoltaje.colores.map((c) => (
                    <option key={c.variantId} value={c.variantId}>{c.nombre}</option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none" style={{ color: "var(--on-surf-var)" }} />
              </div>
            </div>
          )}

          {/* Price + qty */}
          {productVariantId && (
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
                  Precio unitario
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                  style={INPUT_STYLE}
                />
              </div>
              <div>
                <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
                  Cantidad
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      const cur = form.getValues(`items.${index}.quantity`);
                      if (cur > 1) form.setValue(`items.${index}.quantity`, cur - 1);
                    }}
                    className="h-8 w-8 rounded-lg text-sm font-bold flex items-center justify-center hover:bg-[var(--surf-highest)]"
                    style={{ background: "var(--surf-lowest)", color: "var(--on-surf)" }}
                  >
                    −
                  </button>
                  <span className="text-sm font-semibold min-w-[2rem] text-center" style={{ color: "var(--on-surf)" }}>
                    {qty}
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      const cur = form.getValues(`items.${index}.quantity`);
                      form.setValue(`items.${index}.quantity`, cur + 1);
                    }}
                    className="h-8 w-8 rounded-lg text-sm font-bold flex items-center justify-center hover:bg-[var(--surf-highest)]"
                    style={{ background: "var(--surf-lowest)", color: "var(--on-surf)" }}
                  >
                    +
                  </button>
                  <span className="ml-auto text-base font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}>
                    {formatMXN(lineTotal)}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Label helper ─────────────────────────────────────────────────────────────

function sectionCard(children: React.ReactNode, title: string) {
  return (
    <div
      className="rounded-2xl p-5"
      style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
    >
      <h3
        className="text-xs font-semibold tracking-widest uppercase mb-4"
        style={{ color: "var(--on-surf-var)" }}
      >
        {title}
      </h3>
      {children}
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

export default function QuotationForm({
  mode,
  quotationId,
  initialData,
  modelos,
  customers,
  managers,
}: Props) {
  const router = useRouter();
  const [customerSearch, setCustomerSearch] = useState("");
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerOption | null>(
    initialData?.customerId
      ? customers.find((c) => c.id === initialData.customerId) ?? null
      : null
  );

  // Build default items from initialData
  function buildDefaultItems(): FormValues["items"] {
    if (!initialData?.items.length) return [];
    return initialData.items.map((item) => ({
      productVariantId: item.productVariantId ?? "",
      description: item.description,
      quantity: item.quantity,
      unitPrice: item.unitPrice,
      isFreeForm: item.isFreeForm,
      _modeloId: "",
      _voltajeId: "",
    }));
  }

  function detectInitialCustomerMode(): FormValues["customerMode"] {
    if (!initialData) return "none";
    if (initialData.customerId) return "existing";
    if (initialData.anonymousCustomerName) return "anonymous";
    return "none";
  }

  const form = useForm<FormValues>({
    resolver: zodResolver(quotationFormSchema),
    defaultValues: {
      customerMode: detectInitialCustomerMode(),
      customerId: initialData?.customerId ?? undefined,
      anonymousCustomerName: initialData?.anonymousCustomerName ?? "",
      anonymousCustomerPhone: initialData?.anonymousCustomerPhone ?? "",
      items: buildDefaultItems(),
      discountEnabled: (initialData?.discountAmount ?? 0) > 0,
      discountAmount: initialData?.discountAmount ?? 0,
      discountAuthorizedById: initialData?.discountAuthorizedById ?? undefined,
      internalNote: initialData?.internalNote ?? "",
    },
  });

  const { fields, append, remove } = useFieldArray({ control: form.control, name: "items" });

  const watchedItems = useWatch({ control: form.control, name: "items" }) ?? [];
  const watchedDiscount = useWatch({ control: form.control, name: "discountAmount" }) ?? 0;
  const watchedDiscountEnabled = useWatch({ control: form.control, name: "discountEnabled" });
  const watchedCustomerMode = useWatch({ control: form.control, name: "customerMode" });

  const subtotal = watchedItems.reduce(
    (acc, item) => acc + (item.unitPrice ?? 0) * (item.quantity ?? 1),
    0
  );
  const discount = watchedDiscountEnabled ? (watchedDiscount ?? 0) : 0;
  const total = subtotal - discount;

  // Vigencia display
  const validUntilDisplay = (() => {
    if (mode === "edit" && initialData?.validUntil) {
      return new Date(initialData.validUntil).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "long",
        year: "numeric",
      });
    }
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
  })();

  const isSubmitting = form.formState.isSubmitting;

  async function onSubmit(values: FormValues) {
    // Build API payload
    const payload = {
      customerId: values.customerMode === "existing" ? values.customerId : undefined,
      anonymousCustomerName:
        values.customerMode === "anonymous" ? values.anonymousCustomerName : undefined,
      anonymousCustomerPhone:
        values.customerMode === "anonymous" ? values.anonymousCustomerPhone : undefined,
      items: values.items.map((item) => ({
        productVariantId: item.isFreeForm ? undefined : item.productVariantId,
        description: item.description,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        isFreeForm: item.isFreeForm,
      })),
      discountAmount: values.discountEnabled ? (values.discountAmount ?? 0) : 0,
      discountAuthorizedById:
        values.discountEnabled && (values.discountAmount ?? 0) > 0
          ? values.discountAuthorizedById
          : undefined,
      internalNote: values.internalNote || undefined,
    };

    const url =
      mode === "create"
        ? "/api/cotizaciones"
        : `/api/cotizaciones/${quotationId}`;
    const method = mode === "create" ? "POST" : "PATCH";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data: { success: boolean; data?: { id: string }; error?: string } = await res.json();

    if (!data.success || !data.data) {
      toast.error(data.error ?? "Error al guardar la cotización");
      return;
    }

    toast.success(
      mode === "create" ? "Cotización creada correctamente" : "Cotización actualizada"
    );
    router.push(`/cotizaciones/${data.data.id}`);
  }

  // ── Inline customer data ──────────────────────────────────────────────────

  const filteredCustomers = customerSearch.trim()
    ? customers.filter(
        (c) =>
          c.name.toLowerCase().includes(customerSearch.toLowerCase()) ||
          (c.phone?.includes(customerSearch) ?? false)
      )
    : customers.slice(0, 20);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <FormProvider {...form}>
    <form onSubmit={form.handleSubmit(onSubmit)}>
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-6">
        {/* Left column */}
        <div className="space-y-5">
          {/* Customer section — inlined to avoid nested component */}
          {sectionCard(
            <>
              {/* Mode tabs */}
              <div className="flex gap-2 mb-4">
                {(
                  [
                    { value: "existing", label: "Cliente existente", icon: Users },
                    { value: "anonymous", label: "Anónimo", icon: User },
                    { value: "none", label: "Sin cliente", icon: UserX },
                  ] as const
                ).map(({ value, label, icon: Icon }) => {
                  const active = watchedCustomerMode === value;
                  return (
                    <button
                      key={value}
                      type="button"
                      onClick={() => {
                        form.setValue("customerMode", value);
                        form.setValue("customerId", undefined);
                        form.setValue("anonymousCustomerName", "");
                        form.setValue("anonymousCustomerPhone", "");
                        setSelectedCustomer(null);
                        setCustomerSearch("");
                      }}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
                      style={
                        active
                          ? { background: "var(--p-container)", color: "var(--on-p-container)" }
                          : { background: "var(--surf-low)", color: "var(--on-surf-var)" }
                      }
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  );
                })}
              </div>

              {/* Existing customer */}
              {watchedCustomerMode === "existing" && (
                <>
                  {selectedCustomer ? (
                    <div
                      className="flex items-center justify-between px-3 py-2.5 rounded-xl"
                      style={{ background: "var(--surf-low)" }}
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                          {selectedCustomer.name}
                        </p>
                        {selectedCustomer.phone && (
                          <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                            {selectedCustomer.phone}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedCustomer(null);
                          form.setValue("customerId", undefined);
                          setCustomerSearch("");
                        }}
                        style={{ color: "var(--on-surf-var)" }}
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  ) : (
                    <div className="relative">
                      <input
                        placeholder="Buscar cliente por nombre o teléfono..."
                        value={customerSearch}
                        onChange={(e) => setCustomerSearch(e.target.value)}
                        style={INPUT_STYLE}
                        className="focus:ring-0"
                      />
                      {customerSearch && (
                        <div
                          className="absolute z-10 left-0 right-0 top-full mt-1 rounded-xl overflow-y-auto max-h-48"
                          style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
                        >
                          {filteredCustomers.length === 0 ? (
                            <div className="px-3 py-2 text-xs" style={{ color: "var(--on-surf-var)" }}>
                              Sin resultados
                            </div>
                          ) : (
                            filteredCustomers.map((c) => (
                              <button
                                key={c.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCustomer(c);
                                  form.setValue("customerId", c.id);
                                  setCustomerSearch("");
                                }}
                                className="w-full text-left px-3 py-2.5 hover:bg-[var(--surf-high)] transition-colors"
                              >
                                <p className="text-xs font-medium" style={{ color: "var(--on-surf)" }}>
                                  {c.name}
                                </p>
                                {c.phone && (
                                  <p className="text-[0.625rem]" style={{ color: "var(--on-surf-var)" }}>
                                    {c.phone}
                                  </p>
                                )}
                              </button>
                            ))
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* Anonymous */}
              {watchedCustomerMode === "anonymous" && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
                      Nombre
                    </label>
                    <input
                      {...form.register("anonymousCustomerName")}
                      placeholder="Nombre del cliente"
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
                      Teléfono
                    </label>
                    <input
                      {...form.register("anonymousCustomerPhone")}
                      placeholder="Teléfono"
                      style={INPUT_STYLE}
                    />
                  </div>
                </div>
              )}

              {watchedCustomerMode === "none" && (
                <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                  La cotización se guardará sin datos de cliente.
                </p>
              )}
            </>,
            "Cliente"
          )}

          {/* Products */}
          {sectionCard(
            <>
              <div className="flex gap-2 mb-4">
                <button
                  type="button"
                  onClick={() =>
                    append({
                      isFreeForm: false,
                      quantity: 1,
                      unitPrice: 0,
                      description: "",
                      productVariantId: "",
                      _modeloId: "",
                      _voltajeId: "",
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-semibold text-white transition-opacity hover:opacity-90"
                  style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Agregar del catálogo
                </button>
                <button
                  type="button"
                  onClick={() =>
                    append({
                      isFreeForm: true,
                      quantity: 1,
                      unitPrice: 0,
                      description: "",
                    })
                  }
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium transition-colors hover:bg-[var(--surf-high)]"
                  style={{
                    color: "var(--p)",
                    border: "1.5px solid var(--p-mid)",
                    borderRadius: "var(--r-full)",
                    background: "transparent",
                  }}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Línea libre
                </button>
              </div>

              {fields.length === 0 && (
                <p className="text-xs py-4 text-center" style={{ color: "var(--on-surf-var)" }}>
                  Agrega artículos del catálogo o líneas libres (instalación especial, accesorios, etc.)
                </p>
              )}

              <div className="space-y-3">
                {fields.map((_, index) => (
                  <ItemCard key={fields[index].id} index={index} fieldId={fields[index].id} modelos={modelos} onRemove={remove} />
                ))}
              </div>

              {form.formState.errors.items?.root && (
                <p className="text-xs text-[var(--ter)] mt-2">
                  {form.formState.errors.items.root.message}
                </p>
              )}
              {typeof form.formState.errors.items?.message === "string" && (
                <p className="text-xs text-[var(--ter)] mt-2">
                  {form.formState.errors.items.message}
                </p>
              )}
            </>,
            "Productos"
          )}

          {/* Discount */}
          {sectionCard(
            <>
              <div className="flex items-center gap-3 mb-4">
                <input
                  type="checkbox"
                  id="discountEnabled"
                  {...form.register("discountEnabled")}
                  className="rounded"
                />
                <label
                  htmlFor="discountEnabled"
                  className="text-sm font-medium cursor-pointer"
                  style={{ color: "var(--on-surf)" }}
                >
                  Aplicar descuento fijo
                </label>
              </div>

              {watchedDiscountEnabled && (
                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
                      Monto de descuento
                    </label>
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      {...form.register("discountAmount", { valueAsNumber: true })}
                      style={INPUT_STYLE}
                      placeholder="0.00"
                    />
                  </div>

                  <div
                    className="flex items-start gap-2 rounded-xl p-3"
                    style={{ background: "var(--warn-container)" }}
                  >
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" style={{ color: "var(--warn)" }} />
                    <p className="text-xs" style={{ color: "var(--warn)" }}>
                      Los descuentos fijos requieren autorización de un gerente.
                    </p>
                  </div>

                  <div>
                    <label className="text-xs font-medium mb-1 block" style={{ color: "var(--on-surf-var)" }}>
                      Autorizado por *
                    </label>
                    <div className="relative">
                      <select
                        {...form.register("discountAuthorizedById")}
                        style={SELECT_STYLE}
                      >
                        <option value="">Selecciona un gerente...</option>
                        {managers.map((m) => (
                          <option key={m.id} value={m.id}>
                            {m.name}
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 pointer-events-none"
                        style={{ color: "var(--on-surf-var)" }}
                      />
                    </div>
                    {form.formState.errors.discountAuthorizedById && (
                      <p className="text-[0.625rem] text-[var(--ter)] mt-1">
                        {form.formState.errors.discountAuthorizedById.message}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </>,
            "Descuento"
          )}

          {/* Internal note */}
          {sectionCard(
            <textarea
              {...form.register("internalNote")}
              placeholder="Visible solo para el equipo..."
              style={TEXTAREA_STYLE}
              rows={3}
            />,
            "Nota interna"
          )}
        </div>

        {/* Right column — sticky summary */}
        <div className="lg:sticky lg:top-6 h-fit">
          <div
            className="rounded-2xl p-5"
            style={{
              background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
              boxShadow: "var(--shadow)",
              borderRadius: "var(--r-xl)",
            }}
          >
            <h3
              className="text-base font-bold mb-5"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              Resumen
            </h3>

            <div className="space-y-2 mb-5">
              <div className="flex justify-between items-center">
                <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                  Subtotal
                </span>
                <span className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                  {formatMXN(subtotal)}
                </span>
              </div>

              {watchedDiscountEnabled && discount > 0 && (
                <div className="flex justify-between items-center">
                  <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                    Descuento
                  </span>
                  <span className="text-sm font-medium" style={{ color: "var(--ter)" }}>
                    −{formatMXN(discount)}
                  </span>
                </div>
              )}

              <div
                className="pt-2 mt-2"
                style={{ borderTop: "1px solid rgba(178,204,192,0.2)" }}
              >
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold" style={{ color: "var(--on-surf)" }}>
                    Total
                  </span>
                  <span
                    className="text-2xl font-bold"
                    style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
                  >
                    {formatMXN(total)}
                  </span>
                </div>
              </div>
            </div>

            <div
              className="flex items-center gap-2 rounded-lg px-3 py-2 mb-5"
              style={{ background: "var(--surf-low)" }}
            >
              <span className="text-[0.625rem]" style={{ color: "var(--on-surf-var)" }}>
                Válida hasta:
              </span>
              <span className="text-xs font-medium" style={{ color: "var(--on-surf)" }}>
                {validUntilDisplay}
              </span>
            </div>

            <div className="space-y-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full py-3 rounded-full text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}
              >
                {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                {mode === "create" ? "Guardar cotización" : "Guardar cambios"}
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                className="w-full py-2.5 rounded-full text-sm font-medium transition-colors hover:bg-[var(--surf-high)]"
                style={{ color: "var(--on-surf-var)", background: "transparent" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
    </FormProvider>
  );
}
