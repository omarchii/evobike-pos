"use client";

import { useReducer, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ArrowLeft,
  Package,
  PackagePlus,
  Search,
  Trash2,
  Zap,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SimpleCatalogItem, VariantCatalogItem } from "./page";

// ── Design tokens ──────────────────────────────────────────────────────────────

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

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
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
  minHeight: 72,
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "0.625rem",
  fontWeight: 500,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--on-surf-var)",
  marginBottom: "0.35rem",
  fontFamily: "var(--font-body)",
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function formatMXN(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

const PRECIO_REGEX = /^\d+(\.\d{1,2})?$/;

// ── Lines reducer ─────────────────────────────────────────────────────────────

type LineKind = "variant" | "simple";

interface Line {
  lineId: string;
  kind: LineKind;
  entityId: string;
  label: string;
  subLabel: string;
  quantity: number;
  precioUnitarioPagado: string;
}

type LinesAction =
  | {
      type: "ADD";
      kind: LineKind;
      entityId: string;
      label: string;
      subLabel: string;
      suggestedPrice: number;
    }
  | { type: "REMOVE"; lineId: string }
  | { type: "UPDATE_QTY"; lineId: string; value: number }
  | { type: "UPDATE_PRECIO"; lineId: string; value: string }
  | { type: "RESET" };

function linesReducer(state: Line[], action: LinesAction): Line[] {
  switch (action.type) {
    case "ADD": {
      const existing = state.find((l) => l.entityId === action.entityId);
      if (existing) {
        return state.map((l) =>
          l.lineId === existing.lineId
            ? { ...l, quantity: l.quantity + 1 }
            : l,
        );
      }
      return [
        ...state,
        {
          lineId: crypto.randomUUID(),
          kind: action.kind,
          entityId: action.entityId,
          label: action.label,
          subLabel: action.subLabel,
          quantity: 1,
          precioUnitarioPagado:
            action.suggestedPrice > 0
              ? action.suggestedPrice.toFixed(2)
              : "",
        },
      ];
    }
    case "REMOVE":
      return state.filter((l) => l.lineId !== action.lineId);
    case "UPDATE_QTY":
      return state.map((l) =>
        l.lineId === action.lineId
          ? { ...l, quantity: Math.max(1, action.value) }
          : l,
      );
    case "UPDATE_PRECIO":
      return state.map((l) =>
        l.lineId === action.lineId
          ? { ...l, precioUnitarioPagado: action.value }
          : l,
      );
    case "RESET":
      return [];
  }
}

// ── Header schema (individual field rules only; cross-field in submit) ─────────

const headerSchema = z.object({
  proveedor: z.string().min(1, "Proveedor requerido"),
  folioFacturaProveedor: z.string().optional(),
  formaPagoProveedor: z.enum(["CONTADO", "CREDITO", "TRANSFERENCIA"]),
  estadoPago: z.enum(["PAGADA", "PENDIENTE", "CREDITO"]),
  fechaVencimiento: z.string().optional(),
  notas: z.string().optional(),
});

type HeaderValues = z.infer<typeof headerSchema>;

// ── Component props ───────────────────────────────────────────────────────────

interface RecepcionFormProps {
  variants: VariantCatalogItem[];
  simples: SimpleCatalogItem[];
  proveedores: string[];
  preselectedVariantId: string | null;
  preselectedSimpleId: string | null;
}

// ── Catalog card ──────────────────────────────────────────────────────────────

function CatalogCard({
  label,
  subLabel,
  stock,
  isAdded,
  onClick,
}: {
  label: string;
  subLabel: string;
  stock: number;
  isAdded: boolean;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      style={{
        background: isAdded ? "var(--surf-high)" : "var(--surf-lowest)",
        borderRadius: "var(--r-lg)",
        padding: "0.75rem",
        cursor: "pointer",
        transition: "background 0.1s, box-shadow 0.1s",
        boxShadow: isAdded ? "none" : "var(--shadow)",
        outline: isAdded
          ? "2px solid var(--p-bright)"
          : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (!isAdded)
          e.currentTarget.style.background = "var(--surf-high)";
      }}
      onMouseLeave={(e) => {
        if (!isAdded)
          e.currentTarget.style.background = "var(--surf-lowest)";
      }}
    >
      <div
        style={{
          fontSize: "0.75rem",
          fontWeight: 600,
          color: "var(--on-surf)",
          fontFamily: "var(--font-body)",
          marginBottom: "0.2rem",
          lineHeight: 1.3,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: "0.625rem",
          color: "var(--on-surf-var)",
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          letterSpacing: "0.03em",
        }}
      >
        {subLabel}
      </div>
      <div
        style={{
          fontSize: "0.625rem",
          color: stock > 0 ? "var(--sec)" : "var(--ter)",
          fontFamily: "var(--font-body)",
          fontWeight: 500,
          marginTop: "0.35rem",
        }}
      >
        Stock: {stock}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function RecepcionForm({
  variants,
  simples,
  proveedores,
  preselectedVariantId,
  preselectedSimpleId,
}: RecepcionFormProps) {
  const router = useRouter();

  // Build initial lines from preselected IDs
  function buildInitialLines(): Line[] {
    if (preselectedVariantId) {
      const v = variants.find((x) => x.id === preselectedVariantId);
      if (v) {
        return [
          {
            lineId: crypto.randomUUID(),
            kind: "variant",
            entityId: v.id,
            label: v.label,
            subLabel: v.sku,
            quantity: 1,
            precioUnitarioPagado: v.costo > 0 ? v.costo.toFixed(2) : "",
          },
        ];
      }
    }
    if (preselectedSimpleId) {
      const s = simples.find((x) => x.id === preselectedSimpleId);
      if (s) {
        return [
          {
            lineId: crypto.randomUUID(),
            kind: "simple",
            entityId: s.id,
            label: s.nombre,
            subLabel: s.codigo,
            quantity: 1,
            precioUnitarioPagado:
              s.precioMayorista > 0 ? s.precioMayorista.toFixed(2) : "",
          },
        ];
      }
    }
    return [];
  }

  const [lines, dispatch] = useReducer(linesReducer, undefined, buildInitialLines);
  const [submitting, setSubmitting] = useState(false);
  const [searchVehicle, setSearchVehicle] = useState("");
  const [searchSimple, setSearchSimple] = useState("");
  const [searchBattery, setSearchBattery] = useState("");

  const {
    register,
    handleSubmit,
    watch,
    setError,
    formState: { errors },
  } = useForm<HeaderValues>({
    resolver: zodResolver(headerSchema),
    defaultValues: {
      proveedor: "",
      folioFacturaProveedor: "",
      formaPagoProveedor: "CONTADO",
      estadoPago: "PAGADA",
      fechaVencimiento: "",
      notas: "",
    },
  });

  const estadoPago = watch("estadoPago");
  const isCredito = estadoPago === "CREDITO";

  // Derived catalog splits
  const vehicles = variants.filter((v) => !v.esBateria);
  const batteries = variants.filter((v) => v.esBateria);

  const filteredVehicles = vehicles.filter((v) => {
    const q = searchVehicle.toLowerCase();
    return (
      v.label.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q)
    );
  });
  const filteredSimples = simples.filter((s) => {
    const q = searchSimple.toLowerCase();
    return (
      s.nombre.toLowerCase().includes(q) ||
      s.codigo.toLowerCase().includes(q) ||
      s.categoria.toLowerCase().includes(q)
    );
  });
  const filteredBatteries = batteries.filter((v) => {
    const q = searchBattery.toLowerCase();
    return (
      v.label.toLowerCase().includes(q) || v.sku.toLowerCase().includes(q)
    );
  });

  const addedIds = new Set(lines.map((l) => l.entityId));

  const totalDisplay = lines.reduce((acc, l) => {
    const precio = parseFloat(l.precioUnitarioPagado || "0");
    return acc + (isNaN(precio) ? 0 : precio * l.quantity);
  }, 0);

  // ── Submit ─────────────────────────────────────────────────────────────────

  const onSubmit = async (header: HeaderValues): Promise<void> => {
    // 1. Lines presence
    if (lines.length === 0) {
      toast.error("Agrega al menos un producto al carrito");
      return;
    }

    // 2. Line prices validation
    for (const line of lines) {
      if (!line.precioUnitarioPagado) {
        toast.error(`Falta el precio en: "${line.label}"`);
        return;
      }
      if (!PRECIO_REGEX.test(line.precioUnitarioPagado)) {
        toast.error(
          `Precio inválido en "${line.label}" — usa máx. 2 decimales`,
        );
        return;
      }
      if (parseFloat(line.precioUnitarioPagado) <= 0) {
        toast.error(`El precio de "${line.label}" debe ser mayor a 0`);
        return;
      }
    }

    // 3. Cross-field validation
    if (isCredito && !header.fechaVencimiento) {
      setError("fechaVencimiento", {
        message: "Requerida cuando el estado es CRÉDITO",
      });
      toast.error("Indica la fecha de vencimiento del crédito");
      return;
    }
    if (
      header.formaPagoProveedor === "CONTADO" &&
      header.estadoPago === "CREDITO"
    ) {
      setError("estadoPago", {
        message: "Inconsistente: contado no puede quedar a crédito",
      });
      toast.error("Inconsistente: contado no puede quedar a crédito");
      return;
    }
    if (header.estadoPago === "PAGADA" && header.fechaVencimiento) {
      setError("fechaVencimiento", {
        message: "Una recepción PAGADA no lleva fecha de vencimiento",
      });
      toast.error("Una recepción PAGADA no lleva fecha de vencimiento");
      return;
    }

    // 4. Build payload
    const payload = {
      proveedor: header.proveedor,
      ...(header.folioFacturaProveedor?.trim()
        ? { folioFacturaProveedor: header.folioFacturaProveedor.trim() }
        : {}),
      formaPagoProveedor: header.formaPagoProveedor,
      estadoPago: header.estadoPago,
      ...(header.fechaVencimiento
        ? { fechaVencimiento: header.fechaVencimiento }
        : {}),
      ...(header.notas?.trim() ? { notas: header.notas.trim() } : {}),
      items: lines.map((l) => ({
        kind: l.kind,
        ...(l.kind === "variant"
          ? { productVariantId: l.entityId }
          : { simpleProductId: l.entityId }),
        quantity: l.quantity,
        precioUnitarioPagado: parseFloat(l.precioUnitarioPagado),
      })),
    };

    setSubmitting(true);
    toast.loading("Registrando recepción…", { id: "receipt-submit" });

    try {
      const res = await fetch("/api/inventory/receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      type ApiResponse =
        | { success: true; data: { id: string; totalPagado: string } }
        | { success: false; error: string };

      const json = (await res.json()) as ApiResponse;

      if (res.status === 409) {
        toast.error(
          "Ya existe una recepción con esa combinación de proveedor + folio en esta sucursal",
          { id: "receipt-submit" },
        );
        return;
      }

      if (!res.ok || !json.success) {
        const msg = json.success === false ? json.error : "Error al registrar";
        toast.error(msg, { id: "receipt-submit" });
        console.error("[recepcion-form] 422 detail:", json);
        return;
      }

      if (json.success) {
        toast.success("Recepción registrada correctamente", {
          id: "receipt-submit",
        });
        dispatch({ type: "RESET" });
        router.push(`/inventario/recepciones/${json.data.id}`);
      }
    } catch (err) {
      toast.error("Error de red al registrar", { id: "receipt-submit" });
      console.error("[recepcion-form] network error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-12 gap-5"
    >
      {/* ── LEFT: Catalog ─────────────────────────────────────────────────── */}
      <div
        className="lg:col-span-6 xl:col-span-7 flex flex-col min-h-0"
        style={{
          background: "var(--surf-lowest)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow)",
          overflow: "hidden",
        }}
      >
        <Tabs defaultValue="vehicles" className="flex flex-col h-full">
          <div className="px-4 pt-4 pb-0 shrink-0">
            <TabsList className="w-full mb-3">
              <TabsTrigger value="vehicles" className="flex-1 gap-1.5">
                <Package className="h-3.5 w-3.5" />
                Vehículos ({vehicles.length})
              </TabsTrigger>
              <TabsTrigger value="simples" className="flex-1 gap-1.5">
                <PackagePlus className="h-3.5 w-3.5" />
                Simples ({simples.length})
              </TabsTrigger>
              <TabsTrigger value="batteries" className="flex-1 gap-1.5">
                <Zap className="h-3.5 w-3.5" />
                Baterías ({batteries.length})
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Vehicles tab */}
          <TabsContent value="vehicles" className="flex flex-col flex-1 min-h-0 mt-0 px-4 pb-4">
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: "var(--on-surf-var)" }} />
              <input
                type="text"
                placeholder="Buscar vehículo…"
                value={searchVehicle}
                onChange={(e) => setSearchVehicle(e.target.value)}
                style={{ ...INPUT_STYLE, paddingLeft: "2.25rem", height: 40 }}
              />
            </div>
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-2 pr-2">
                {filteredVehicles.length === 0 && (
                  <p className="col-span-2 text-center py-8" style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>
                    Sin resultados
                  </p>
                )}
                {filteredVehicles.map((v) => (
                  <CatalogCard
                    key={v.id}
                    label={v.label}
                    subLabel={v.sku}
                    stock={v.currentStock}
                    isAdded={addedIds.has(v.id)}
                    onClick={() =>
                      dispatch({
                        type: "ADD",
                        kind: "variant",
                        entityId: v.id,
                        label: v.label,
                        subLabel: v.sku,
                        suggestedPrice: v.costo,
                      })
                    }
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Simples tab */}
          <TabsContent value="simples" className="flex flex-col flex-1 min-h-0 mt-0 px-4 pb-4">
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: "var(--on-surf-var)" }} />
              <input
                type="text"
                placeholder="Buscar producto simple…"
                value={searchSimple}
                onChange={(e) => setSearchSimple(e.target.value)}
                style={{ ...INPUT_STYLE, paddingLeft: "2.25rem", height: 40 }}
              />
            </div>
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-2 pr-2">
                {filteredSimples.length === 0 && (
                  <p className="col-span-2 text-center py-8" style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>
                    Sin resultados
                  </p>
                )}
                {filteredSimples.map((s) => (
                  <CatalogCard
                    key={s.id}
                    label={s.nombre}
                    subLabel={`${s.codigo} · ${s.categoria}`}
                    stock={s.currentStock}
                    isAdded={addedIds.has(s.id)}
                    onClick={() =>
                      dispatch({
                        type: "ADD",
                        kind: "simple",
                        entityId: s.id,
                        label: s.nombre,
                        subLabel: s.codigo,
                        suggestedPrice: s.precioMayorista,
                      })
                    }
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>

          {/* Batteries tab */}
          <TabsContent value="batteries" className="flex flex-col flex-1 min-h-0 mt-0 px-4 pb-4">
            <div className="relative mb-3 shrink-0">
              <Search className="absolute left-3 top-3 h-4 w-4" style={{ color: "var(--on-surf-var)" }} />
              <input
                type="text"
                placeholder="Buscar batería…"
                value={searchBattery}
                onChange={(e) => setSearchBattery(e.target.value)}
                style={{ ...INPUT_STYLE, paddingLeft: "2.25rem", height: 40 }}
              />
            </div>
            <ScrollArea className="flex-1">
              <div className="grid grid-cols-2 gap-2 pr-2">
                {filteredBatteries.length === 0 && (
                  <p className="col-span-2 text-center py-8" style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>
                    Sin baterías en catálogo
                  </p>
                )}
                {filteredBatteries.map((v) => (
                  <CatalogCard
                    key={v.id}
                    label={v.label}
                    subLabel={v.sku}
                    stock={v.currentStock}
                    isAdded={addedIds.has(v.id)}
                    onClick={() =>
                      dispatch({
                        type: "ADD",
                        kind: "variant",
                        entityId: v.id,
                        label: v.label,
                        subLabel: v.sku,
                        suggestedPrice: v.costo,
                      })
                    }
                  />
                ))}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </div>

      {/* ── RIGHT: Header + Lines ──────────────────────────────────────────── */}
      <div className="lg:col-span-6 xl:col-span-5 flex flex-col min-h-0">
        {/* Header fields */}
        <div
          className="shrink-0 p-4 space-y-3 mb-4"
          style={{
            background: "var(--surf-lowest)",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--shadow)",
          }}
        >
          <p
            style={{
              fontSize: "0.625rem",
              fontWeight: 500,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--on-surf-var)",
              fontFamily: "var(--font-body)",
            }}
          >
            Datos de la recepción
          </p>

          {/* Proveedor — datalist para autocompletar + entrada libre */}
          <div>
            <label style={LABEL_STYLE}>Proveedor *</label>
            <input
              {...register("proveedor")}
              list="proveedores-list"
              placeholder="Nombre del proveedor"
              style={INPUT_STYLE}
              autoComplete="off"
            />
            <datalist id="proveedores-list">
              {proveedores.map((p) => (
                <option key={p} value={p} />
              ))}
            </datalist>
            {errors.proveedor && (
              <p style={{ fontSize: "0.7rem", color: "var(--ter)", marginTop: "0.25rem" }}>
                {errors.proveedor.message}
              </p>
            )}
          </div>

          {/* Folio + Forma de pago */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={LABEL_STYLE}>Folio de factura</label>
              <input
                {...register("folioFacturaProveedor")}
                placeholder="Ej. FAC-001"
                style={INPUT_STYLE}
              />
            </div>
            <div>
              <label style={LABEL_STYLE}>Forma de pago</label>
              <select {...register("formaPagoProveedor")} style={SELECT_STYLE}>
                <option value="CONTADO">Contado</option>
                <option value="TRANSFERENCIA">Transferencia</option>
                <option value="CREDITO">Crédito</option>
              </select>
            </div>
          </div>

          {/* Estado de pago + Fecha vencimiento */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label style={LABEL_STYLE}>Estado de pago</label>
              <select {...register("estadoPago")} style={SELECT_STYLE}>
                <option value="PAGADA">Pagada</option>
                <option value="PENDIENTE">Pendiente</option>
                <option value="CREDITO">Crédito</option>
              </select>
              {errors.estadoPago && (
                <p style={{ fontSize: "0.7rem", color: "var(--ter)", marginTop: "0.25rem" }}>
                  {errors.estadoPago.message}
                </p>
              )}
            </div>
            <div
              style={{
                opacity: isCredito ? 1 : 0.4,
                pointerEvents: isCredito ? "auto" : "none",
              }}
            >
              <label style={LABEL_STYLE}>
                Fecha vencimiento {isCredito && "*"}
              </label>
              <input
                {...register("fechaVencimiento")}
                type="date"
                style={INPUT_STYLE}
                tabIndex={isCredito ? 0 : -1}
              />
              {errors.fechaVencimiento && (
                <p style={{ fontSize: "0.7rem", color: "var(--ter)", marginTop: "0.25rem" }}>
                  {errors.fechaVencimiento.message}
                </p>
              )}
            </div>
          </div>

          {/* Notas */}
          <div>
            <label style={LABEL_STYLE}>Notas (opcional)</label>
            <textarea
              {...register("notas")}
              placeholder="Observaciones internas sobre esta compra…"
              style={TEXTAREA_STYLE}
              rows={2}
            />
          </div>
        </div>

        {/* Lines table */}
        <div
          className="flex-1 min-h-0 flex flex-col"
          style={{
            background: "var(--surf-lowest)",
            borderRadius: "var(--r-xl)",
            boxShadow: "var(--shadow)",
            overflow: "hidden",
          }}
        >
          <div
            className="px-4 py-3 shrink-0 flex items-center justify-between"
            style={{ borderBottom: "1px solid rgba(178, 204, 192, 0.15)" }}
          >
            <span
              style={{
                fontSize: "0.625rem",
                fontWeight: 500,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                color: "var(--on-surf-var)",
                fontFamily: "var(--font-body)",
              }}
            >
              Líneas de recepción ({lines.length})
            </span>
            {lines.length > 0 && (
              <button
                type="button"
                onClick={() => dispatch({ type: "RESET" })}
                style={{
                  fontSize: "0.7rem",
                  color: "var(--ter)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                Limpiar todo
              </button>
            )}
          </div>

          <ScrollArea className="flex-1">
            {lines.length === 0 ? (
              <div
                className="flex flex-col items-center justify-center py-12"
                style={{ color: "var(--on-surf-var)" }}
              >
                <PackagePlus className="h-10 w-10 opacity-20 mb-3" />
                <p style={{ fontSize: "0.75rem" }}>
                  Selecciona productos del catálogo
                </p>
              </div>
            ) : (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    {["Producto", "Cant.", "Precio unitario", "Subtotal", ""].map((h) => (
                      <th
                        key={h}
                        style={{
                          fontSize: "0.6rem",
                          fontWeight: 500,
                          letterSpacing: "0.05em",
                          textTransform: "uppercase",
                          color: "var(--on-surf-var)",
                          padding: "0.5rem 0.5rem",
                          borderBottom: "1px solid rgba(178, 204, 192, 0.15)",
                          textAlign: h === "Subtotal" ? "right" : "left",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {lines.map((line) => {
                    const precioNum = parseFloat(line.precioUnitarioPagado || "0");
                    const subtotal = isNaN(precioNum) ? 0 : precioNum * line.quantity;
                    const precioInvalid =
                      line.precioUnitarioPagado !== "" &&
                      !PRECIO_REGEX.test(line.precioUnitarioPagado);

                    return (
                      <tr
                        key={line.lineId}
                        style={{ borderBottom: "1px solid rgba(178, 204, 192, 0.08)" }}
                      >
                        <td style={{ padding: "0.5rem", maxWidth: "140px" }}>
                          <div
                            style={{
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              color: "var(--on-surf)",
                              fontFamily: "var(--font-body)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {line.label}
                          </div>
                          <div
                            style={{
                              fontSize: "0.6rem",
                              color: "var(--on-surf-var)",
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            {line.subLabel}
                          </div>
                        </td>
                        <td style={{ padding: "0.5rem", width: 60 }}>
                          <input
                            type="number"
                            min={1}
                            value={line.quantity}
                            onChange={(e) =>
                              dispatch({
                                type: "UPDATE_QTY",
                                lineId: line.lineId,
                                value: parseInt(e.target.value) || 1,
                              })
                            }
                            style={{
                              ...INPUT_STYLE,
                              height: 32,
                              width: 52,
                              padding: "0 0.4rem",
                              textAlign: "center",
                              fontSize: "0.75rem",
                            }}
                          />
                        </td>
                        <td style={{ padding: "0.5rem", width: 110 }}>
                          <div className="flex items-center gap-1">
                            <span style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>$</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              value={line.precioUnitarioPagado}
                              onChange={(e) =>
                                dispatch({
                                  type: "UPDATE_PRECIO",
                                  lineId: line.lineId,
                                  value: e.target.value,
                                })
                              }
                              placeholder="0.00"
                              style={{
                                ...INPUT_STYLE,
                                height: 32,
                                width: 90,
                                padding: "0 0.4rem",
                                textAlign: "right",
                                fontSize: "0.75rem",
                                outline: precioInvalid
                                  ? "2px solid var(--ter)"
                                  : "none",
                              }}
                            />
                          </div>
                        </td>
                        <td
                          style={{
                            padding: "0.5rem",
                            textAlign: "right",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            color: "var(--on-surf)",
                            fontFamily: "var(--font-display)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {formatMXN(subtotal)}
                        </td>
                        <td style={{ padding: "0.5rem", width: 32 }}>
                          <button
                            type="button"
                            onClick={() =>
                              dispatch({ type: "REMOVE", lineId: line.lineId })
                            }
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--ter)",
                              padding: "0.25rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                            }}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </ScrollArea>

          {/* Footer: total + actions */}
          <div
            className="shrink-0 px-4 py-3 space-y-3"
            style={{ borderTop: "1px solid rgba(178, 204, 192, 0.15)" }}
          >
            {lines.length > 0 && (
              <div className="flex items-end justify-between">
                <div>
                  <p
                    style={{
                      fontSize: "0.625rem",
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      color: "var(--on-surf-var)",
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    Total estimado
                  </p>
                  <p
                    style={{
                      fontSize: "1.25rem",
                      fontWeight: 700,
                      color: "var(--on-surf)",
                      fontFamily: "var(--font-display)",
                      lineHeight: 1.1,
                    }}
                  >
                    {formatMXN(totalDisplay)}
                  </p>
                  <p style={{ fontSize: "0.6rem", color: "var(--on-surf-var)", fontFamily: "var(--font-body)" }}>
                    El total se recalcula server-side
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => router.push("/inventario/recepciones")}
                className="flex items-center gap-1.5 px-4 py-2.5 rounded-full text-sm font-medium"
                style={{
                  background: "var(--surf-high)",
                  color: "var(--on-surf-var)",
                  border: "none",
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-full text-sm font-semibold"
                style={{
                  background: submitting
                    ? "var(--surf-high)"
                    : "linear-gradient(135deg, #1b4332, #2ecc71)",
                  color: submitting ? "var(--on-surf-var)" : "#ffffff",
                  border: "none",
                  cursor: submitting ? "not-allowed" : "pointer",
                  fontFamily: "var(--font-body)",
                  opacity: submitting ? 0.7 : 1,
                }}
              >
                {submitting ? "Registrando…" : "Confirmar Recepción"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </form>
  );
}
