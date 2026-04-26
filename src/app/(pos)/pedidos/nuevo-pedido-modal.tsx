"use client";

import React, { useState, useMemo, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  ChevronDown,
  ChevronUp,
  Loader2,
  Plus,
  Repeat2,
  Search,
  Truck,
  UserPlus,
  Users,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { CustomerOption, VariantOption } from "./page";

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatMXN(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

// ── Design tokens — match customer-selector-modal.tsx pattern ─────────────────
//
// Rule: inputs always use --surf-low so they stand out from the glassmorphism
// modal background (--surf-bright) in BOTH light and dark modes:
//   Light  --surf-low #f0f7f4  vs  modal ≈ #fafffe  → subtle tinted field
//   Dark   --surf-low #1b1b1b  vs  --surf-bright #2b2b2b  → clearly recessed

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  fontSize: "0.875rem",
  height: 44,
};

// Native <select> variant — same visual as INPUT_STYLE
const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
  width: "100%",
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  appearance: "none",
  WebkitAppearance: "none",
};

// Textarea — same background, flexible height
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
};

// ── Types ──────────────────────────────────────────────────────────────────────

type OrderType = "LAYAWAY" | "BACKORDER";
type PaymentMethod = "CASH" | "CARD" | "TRANSFER";
type CustomerMode = "search" | "new";

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
};

const REGIMEN_OPTIONS = [
  { value: "601", label: "601 – General de Ley Personas Morales" },
  { value: "603", label: "603 – Personas Morales con Fines no Lucrativos" },
  { value: "605", label: "605 – Sueldos y Salarios e Ingresos Asimilados" },
  { value: "606", label: "606 – Arrendamiento" },
  { value: "608", label: "608 – Demás ingresos" },
  { value: "611", label: "611 – Ingresos por Dividendos" },
  { value: "612", label: "612 – Personas Físicas con Actividades Empresariales" },
  { value: "614", label: "614 – Ingresos por intereses" },
  { value: "616", label: "616 – Sin obligaciones fiscales" },
  { value: "621", label: "621 – Incorporación Fiscal" },
  { value: "625", label: "625 – Actividades con ingresos por Plataformas Tecnológicas" },
  { value: "626", label: "626 – Régimen Simplificado de Confianza" },
];

const USO_CFDI_OPTIONS = [
  { value: "G01", label: "G01 – Adquisición de mercancias" },
  { value: "G03", label: "G03 – Gastos en general" },
  { value: "I01", label: "I01 – Construcciones" },
  { value: "I02", label: "I02 – Mobilario y equipo de oficina" },
  { value: "I03", label: "I03 – Equipo de transporte" },
  { value: "I08", label: "I08 – Otra maquinaria y equipo" },
  { value: "P01", label: "P01 – Por definir" },
  { value: "S01", label: "S01 – Sin efectos fiscales" },
];

interface NewCustomerForm {
  name: string; phone: string; phone2: string; email: string;
  street: string; extNum: string; intNum: string; colonia: string;
  city: string; state: string; zip: string; refs: string;
  rfc: string; razonSocial: string; regimenFiscal: string;
  usoCFDI: string; emailFiscal: string; direccionFiscal: string;
}

const EMPTY_NC: NewCustomerForm = {
  name: "", phone: "", phone2: "", email: "",
  street: "", extNum: "", intNum: "", colonia: "", city: "", state: "", zip: "", refs: "",
  rfc: "", razonSocial: "", regimenFiscal: "", usoCFDI: "", emailFiscal: "", direccionFiscal: "",
};

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerOption[];
  variants: VariantOption[];
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <label
      style={{
        fontFamily: "var(--font-body)",
        fontSize: "0.75rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
        color: "var(--on-surf-var)",
        display: "block",
        marginBottom: 4,
      }}
    >
      {children}
      {required && <span style={{ color: "var(--p-bright)", marginLeft: 3 }}>*</span>}
    </label>
  );
}

function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={`flex flex-col gap-1 ${className ?? ""}`}>{children}</div>;
}

/** Collapsible section — mirrors customer-selector-modal.tsx pattern */
function CollapsibleSection({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderRadius: "var(--r-lg)", overflow: "hidden", background: "var(--surf-high)" }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ color: "var(--on-surf-var)" }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.7rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
          }}
        >
          {title}
        </span>
        {open ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>
      {open && (
        <div
          className="grid grid-cols-2 gap-3 p-4"
          style={{ background: "var(--surf-highest)" }}
        >
          {children}
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export function NuevoPedidoModal({ open, onOpenChange, customers, variants }: Props) {
  const router = useRouter();

  // ── Order type ─────────────────────────────────────────────────────────────
  const [orderType, setOrderType] = useState<OrderType>("BACKORDER");

  // ── Customer ───────────────────────────────────────────────────────────────
  const [customerMode, setCustomerMode] = useState<CustomerMode>("search");
  const [customerSearch, setCustomerSearch] = useState("");
  const [customerId, setCustomerId] = useState("");
  const [customerOpen, setCustomerOpen] = useState(false);
  const [newCustomer, setNewCustomer] = useState<NewCustomerForm>(EMPTY_NC);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [createdCustomerId, setCreatedCustomerId] = useState<string | null>(null);
  const [createdCustomerName, setCreatedCustomerName] = useState("");

  // ── Product — cascading selects ────────────────────────────────────────────
  const [modeloId, setModeloId] = useState("");
  const [voltajeId, setVoltajeId] = useState("");
  const [colorId, setColorId] = useState("");

  // ── Pricing ────────────────────────────────────────────────────────────────
  const [quantity, setQuantity] = useState(1);
  const [unitPrice, setUnitPrice] = useState(0);

  // ── Payment ────────────────────────────────────────────────────────────────
  const [deposit, setDeposit] = useState(0);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("CASH");
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [primaryAmount, setPrimaryAmount] = useState(0);
  const [primaryMethod, setPrimaryMethod] = useState<PaymentMethod>("CASH");
  const [secondaryMethod, setSecondaryMethod] = useState<PaymentMethod>("TRANSFER");

  // ── Other ──────────────────────────────────────────────────────────────────
  const [deliveryDate, setDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // ── Cascading select derived data ──────────────────────────────────────────
  const modelos = useMemo(() => {
    const seen = new Set<string>();
    return variants
      .filter((v) => !seen.has(v.modeloId) && seen.add(v.modeloId))
      .map((v) => ({ id: v.modeloId, nombre: v.modeloNombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [variants]);

  const voltajes = useMemo(() => {
    if (!modeloId) return [];
    const seen = new Set<string>();
    return variants
      .filter((v) => v.modeloId === modeloId && !seen.has(v.voltajeId) && seen.add(v.voltajeId))
      .map((v) => ({ id: v.voltajeId, label: v.voltajeLabel }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [variants, modeloId]);

  const colores = useMemo(() => {
    if (!modeloId || !voltajeId) return [];
    return variants
      .filter((v) => v.modeloId === modeloId && v.voltajeId === voltajeId)
      .map((v) => ({ id: v.colorId, nombre: v.colorNombre }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));
  }, [variants, modeloId, voltajeId]);

  const resolvedVariant = useMemo(
    () =>
      modeloId && voltajeId && colorId
        ? (variants.find((v) => v.modeloId === modeloId && v.voltajeId === voltajeId && v.colorId === colorId) ?? null)
        : null,
    [variants, modeloId, voltajeId, colorId]
  );

  const handleColorSelect = useCallback(
    (cid: string) => {
      setColorId(cid);
      const v = variants.find(
        (vv) => vv.modeloId === modeloId && vv.voltajeId === voltajeId && vv.colorId === cid
      );
      if (v) setUnitPrice(v.precio);
    },
    [variants, modeloId, voltajeId]
  );

  // ── Derived payment values ─────────────────────────────────────────────────
  const total = unitPrice * quantity;
  const remaining = total - deposit;
  const secondaryAmountNum = Math.max(0, deposit - primaryAmount);

  // ── Customer search ────────────────────────────────────────────────────────
  const filteredCustomers = useMemo(() => {
    const q = customerSearch.toLowerCase();
    return customers
      .filter((c) => c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q))
      .slice(0, 8);
  }, [customers, customerSearch]);

  const selectedCustomer = customerId ? customers.find((c) => c.id === customerId) : null;
  const effectiveCustomerId = customerMode === "search" ? customerId : createdCustomerId;

  // ── Create new customer ────────────────────────────────────────────────────
  const handleCreateCustomer = async () => {
    if (!newCustomer.name.trim() || newCustomer.phone.trim().length < 10) return;
    setCreatingCustomer(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newCustomer.name.trim(),
          phone: newCustomer.phone.trim(),
          phone2: newCustomer.phone2.trim() || undefined,
          email: newCustomer.email.trim() || undefined,
          street: newCustomer.street.trim() || undefined,
          extNum: newCustomer.extNum.trim() || undefined,
          intNum: newCustomer.intNum.trim() || undefined,
          colonia: newCustomer.colonia.trim() || undefined,
          city: newCustomer.city.trim() || undefined,
          state: newCustomer.state.trim() || undefined,
          zip: newCustomer.zip.trim() || undefined,
          refs: newCustomer.refs.trim() || undefined,
          rfc: newCustomer.rfc.trim() || undefined,
          razonSocial: newCustomer.razonSocial.trim() || undefined,
          regimenFiscal: newCustomer.regimenFiscal || undefined,
          usoCFDI: newCustomer.usoCFDI || undefined,
          emailFiscal: newCustomer.emailFiscal.trim() || undefined,
          direccionFiscal: newCustomer.direccionFiscal.trim() || undefined,
        }),
      }).then((r) => r.json() as Promise<{ success: boolean; data?: { id: string; name: string }; error?: string }>);

      if (res.success && res.data) {
        setCreatedCustomerId(res.data.id);
        setCreatedCustomerName(res.data.name);
        toast.success(`Cliente "${res.data.name}" creado`);
      } else {
        toast.error(res.error ?? "Error al crear cliente");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setCreatingCustomer(false);
    }
  };

  const ncSet =
    (field: keyof NewCustomerForm) =>
    (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
      setNewCustomer((p) => ({ ...p, [field]: e.target.value }));

  // ── Reset ──────────────────────────────────────────────────────────────────
  const reset = () => {
    setOrderType("BACKORDER");
    setCustomerMode("search");
    setCustomerSearch("");
    setCustomerId("");
    setCustomerOpen(false);
    setNewCustomer(EMPTY_NC);
    setCreatedCustomerId(null);
    setCreatedCustomerName("");
    setModeloId("");
    setVoltajeId("");
    setColorId("");
    setQuantity(1);
    setUnitPrice(0);
    setDeposit(0);
    setPaymentMethod("CASH");
    setIsSplitPayment(false);
    setPrimaryAmount(0);
    setPrimaryMethod("CASH");
    setSecondaryMethod("TRANSFER");
    setDeliveryDate("");
    setNotes("");
  };

  const handleClose = () => { reset(); onOpenChange(false); };

  // ── Validation ─────────────────────────────────────────────────────────────
  const customerValid = customerMode === "search" ? customerId !== "" : createdCustomerId !== null;
  const productValid = resolvedVariant !== null && unitPrice > 0;
  const splitCovered = !isSplitPayment || Math.abs(primaryAmount + secondaryAmountNum - deposit) < 0.01;

  const canSubmit =
    customerValid &&
    productValid &&
    quantity >= 1 &&
    deposit >= 0 &&
    deposit <= total &&
    splitCovered &&
    (orderType === "LAYAWAY" || deliveryDate !== "") &&
    !submitting;

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async () => {
    if (!canSubmit || !resolvedVariant || !effectiveCustomerId) return;
    setSubmitting(true);
    toast.loading("Creando pedido...", { id: "nuevo-pedido" });

    try {
      const payload: Record<string, unknown> = {
        customerId: effectiveCustomerId,
        productVariantId: resolvedVariant.id,
        quantity,
        unitPrice,
        depositAmount: isSplitPayment ? primaryAmount : deposit,
        paymentMethod: isSplitPayment ? primaryMethod : paymentMethod,
        orderType,
        expectedDeliveryDate: deliveryDate || undefined,
        notes: notes.trim() || undefined,
      };

      if (isSplitPayment && deposit > 0) {
        payload.isSplitPayment = true;
        payload.secondaryPaymentMethod = secondaryMethod;
        payload.secondaryDepositAmount = secondaryAmountNum;
      }

      const res = await fetch("/api/pedidos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json() as Promise<{ success: boolean; data?: { folio: string }; error?: string }>);

      if (res.success) {
        toast.success(`Pedido ${res.data?.folio ?? ""} creado`, { id: "nuevo-pedido" });
        handleClose();
        router.refresh();
      } else {
        toast.error(res.error ?? "Error al crear el pedido", { id: "nuevo-pedido" });
      }
    } catch {
      toast.error("Error de conexión", { id: "nuevo-pedido" });
    } finally {
      setSubmitting(false);
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden"
        style={{
          /* Glassmorphism — dual-mode — mirrors customer-selector-modal.tsx */
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "var(--shadow)",
          borderRadius: "var(--r-xl)",
          maxWidth: 520,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ───────────────────────────────────────────────────────── */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <DialogTitle
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--on-surf)",
            }}
          >
            Nuevo Pedido
          </DialogTitle>
        </DialogHeader>

        {/* ── Scrollable body ───────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-0 flex flex-col gap-5">

          {/* ── Tipo de pedido ─────────────────────────────────────────────── */}
          <div
            className="flex gap-1 p-1 rounded-full"
            style={{ background: "var(--surf-high)" }}
          >
            {(["BACKORDER", "LAYAWAY"] as OrderType[]).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setOrderType(t)}
                className="flex-1 flex items-center justify-center gap-2 py-2 rounded-full text-sm font-semibold transition-all"
                style={
                  orderType === t
                    ? {
                        background: "var(--surf-bright)",
                        color: t === "BACKORDER" ? "var(--ter)" : "var(--p)",
                      }
                    : { color: "var(--on-surf-var)" }
                }
              >
                {t === "BACKORDER" ? <Truck className="w-3.5 h-3.5" /> : <Repeat2 className="w-3.5 h-3.5" />}
                {t === "BACKORDER" ? "Backorder" : "Apartado"}
              </button>
            ))}
          </div>

          {orderType === "BACKORDER" && (
            <p className="text-xs -mt-2" style={{ color: "var(--on-surf-var)" }}>
              Backorder: sin stock. No descuenta inventario al crearlo.
            </p>
          )}

          {/* ── Cliente ────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            {/* Mode tabs */}
            <div className="flex items-center justify-between">
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--on-surf-var)",
                  letterSpacing: "0.04em",
                }}
              >
                Cliente <span style={{ color: "var(--p-bright)" }}>*</span>
              </span>
              <div
                className="flex gap-0.5 p-0.5 rounded-full"
                style={{ background: "var(--surf-high)" }}
              >
                {(["search", "new"] as CustomerMode[]).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => setCustomerMode(m)}
                    className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all"
                    style={
                      customerMode === m
                        ? { background: "var(--surf-bright)", color: "var(--p-mid)" }
                        : { color: "var(--on-surf-var)" }
                    }
                  >
                    {m === "search" ? <Users className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                    {m === "search" ? "Buscar" : "Nuevo"}
                  </button>
                ))}
              </div>
            </div>

            {customerMode === "search" ? (
              /* Search mode */
              <div className="flex flex-col gap-2">
                <div className="relative">
                  <Search
                    className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                    style={{ color: "var(--on-surf-var)" }}
                  />
                  <Input
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value);
                      setCustomerId("");
                      setCustomerOpen(true);
                    }}
                    onFocus={() => setCustomerOpen(true)}
                    onBlur={() => setTimeout(() => setCustomerOpen(false), 150)}
                    placeholder="Nombre o teléfono..."
                    className="pl-9"
                    style={INPUT_STYLE}
                  />
                </div>

                {customerOpen && filteredCustomers.length > 0 && (
                  <div
                    className="flex flex-col gap-1 rounded-[var(--r-lg)] overflow-hidden p-1"
                    style={{ background: "var(--surf-high)" }}
                  >
                    {filteredCustomers.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={() => {
                          setCustomerId(c.id);
                          setCustomerSearch(c.name);
                          setCustomerOpen(false);
                        }}
                        className="w-full text-left px-3 py-2 rounded-[var(--r-md)] transition-colors"
                        style={{ background: "var(--surf-lowest)" }}
                        onMouseEnter={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--surf-low)";
                        }}
                        onMouseLeave={(e) => {
                          (e.currentTarget as HTMLButtonElement).style.background = "var(--surf-lowest)";
                        }}
                      >
                        <p
                          className="text-sm font-medium"
                          style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
                        >
                          {c.name}
                        </p>
                        {c.phone && (
                          <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                            {c.phone}
                          </p>
                        )}
                      </button>
                    ))}
                  </div>
                )}

                {selectedCustomer && (
                  <p className="text-xs" style={{ color: "var(--sec)" }}>
                    ✓ {selectedCustomer.name}
                  </p>
                )}
              </div>
            ) : (
              /* New customer mode */
              <div className="flex flex-col gap-4">
                {createdCustomerId ? (
                  <div
                    className="flex items-center gap-2 px-4 py-3 rounded-[var(--r-lg)]"
                    style={{ background: "var(--sec-container)" }}
                  >
                    <span style={{ color: "var(--on-sec-container)", fontSize: "0.875rem", fontWeight: 600 }}>
                      ✓ Cliente &ldquo;{createdCustomerName}&rdquo; creado correctamente
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Basic fields */}
                    <div className="grid grid-cols-2 gap-3">
                      <FieldGroup className="col-span-2">
                        <FieldLabel required>Nombre completo</FieldLabel>
                        <Input
                          value={newCustomer.name}
                          onChange={ncSet("name")}
                          placeholder="Nombre del cliente"
                          style={INPUT_STYLE}
                        />
                      </FieldGroup>
                      <FieldGroup>
                        <FieldLabel required>Teléfono</FieldLabel>
                        <Input
                          value={newCustomer.phone}
                          onChange={ncSet("phone")}
                          placeholder="10 dígitos"
                          type="tel"
                          style={INPUT_STYLE}
                        />
                      </FieldGroup>
                      <FieldGroup>
                        <FieldLabel>Teléfono 2</FieldLabel>
                        <Input
                          value={newCustomer.phone2}
                          onChange={ncSet("phone2")}
                          placeholder="Opcional"
                          type="tel"
                          style={INPUT_STYLE}
                        />
                      </FieldGroup>
                      <FieldGroup className="col-span-2">
                        <FieldLabel>Email</FieldLabel>
                        <Input
                          value={newCustomer.email}
                          onChange={ncSet("email")}
                          placeholder="correo@ejemplo.com"
                          type="email"
                          style={INPUT_STYLE}
                        />
                      </FieldGroup>
                    </div>

                    {/* Collapsible sections */}
                    <CollapsibleSection title="Dirección para flete">
                      <FieldGroup className="col-span-2">
                        <FieldLabel>Calle</FieldLabel>
                        <Input value={newCustomer.street} onChange={ncSet("street")} style={INPUT_STYLE} />
                      </FieldGroup>
                      <FieldGroup>
                        <FieldLabel>No. Ext</FieldLabel>
                        <Input value={newCustomer.extNum} onChange={ncSet("extNum")} style={INPUT_STYLE} />
                      </FieldGroup>
                      <FieldGroup>
                        <FieldLabel>No. Int</FieldLabel>
                        <Input value={newCustomer.intNum} onChange={ncSet("intNum")} style={INPUT_STYLE} />
                      </FieldGroup>
                      <FieldGroup>
                        <FieldLabel>Colonia</FieldLabel>
                        <Input value={newCustomer.colonia} onChange={ncSet("colonia")} style={INPUT_STYLE} />
                      </FieldGroup>
                      <FieldGroup>
                        <FieldLabel>Ciudad</FieldLabel>
                        <Input value={newCustomer.city} onChange={ncSet("city")} style={INPUT_STYLE} />
                      </FieldGroup>
                      <FieldGroup>
                        <FieldLabel>Estado</FieldLabel>
                        <Input value={newCustomer.state} onChange={ncSet("state")} style={INPUT_STYLE} />
                      </FieldGroup>
                      <FieldGroup>
                        <FieldLabel>C.P.</FieldLabel>
                        <Input value={newCustomer.zip} onChange={ncSet("zip")} style={INPUT_STYLE} />
                      </FieldGroup>
                      <FieldGroup className="col-span-2">
                        <FieldLabel>Referencias</FieldLabel>
                        <Input
                          value={newCustomer.refs}
                          onChange={ncSet("refs")}
                          placeholder="Entre calles, color de puerta..."
                          style={INPUT_STYLE}
                        />
                      </FieldGroup>
                    </CollapsibleSection>

                    <CollapsibleSection title="Datos de facturación">
                      <FieldGroup>
                        <FieldLabel>RFC</FieldLabel>
                        <Input
                          value={newCustomer.rfc}
                          onChange={ncSet("rfc")}
                          placeholder="XAXX010101000"
                          style={INPUT_STYLE}
                        />
                      </FieldGroup>
                      <FieldGroup>
                        <FieldLabel>Razón Social</FieldLabel>
                        <Input value={newCustomer.razonSocial} onChange={ncSet("razonSocial")} style={INPUT_STYLE} />
                      </FieldGroup>
                      <FieldGroup className="col-span-2">
                        <FieldLabel>Régimen Fiscal</FieldLabel>
                        <select value={newCustomer.regimenFiscal} onChange={ncSet("regimenFiscal")} style={SELECT_STYLE}>
                          <option value="">Selecciona...</option>
                          {REGIMEN_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </FieldGroup>
                      <FieldGroup className="col-span-2">
                        <FieldLabel>Uso CFDI</FieldLabel>
                        <select value={newCustomer.usoCFDI} onChange={ncSet("usoCFDI")} style={SELECT_STYLE}>
                          <option value="">Selecciona...</option>
                          {USO_CFDI_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </FieldGroup>
                      <FieldGroup className="col-span-2">
                        <FieldLabel>Email fiscal</FieldLabel>
                        <Input value={newCustomer.emailFiscal} onChange={ncSet("emailFiscal")} type="email" style={INPUT_STYLE} />
                      </FieldGroup>
                      <FieldGroup className="col-span-2">
                        <FieldLabel>Dirección fiscal</FieldLabel>
                        <Input value={newCustomer.direccionFiscal} onChange={ncSet("direccionFiscal")} style={INPUT_STYLE} />
                      </FieldGroup>
                    </CollapsibleSection>

                    <Button
                      type="button"
                      onClick={handleCreateCustomer}
                      disabled={!newCustomer.name.trim() || newCustomer.phone.trim().length < 10 || creatingCustomer}
                      style={{
                        background: "linear-gradient(135deg, var(--p-mid), var(--p-bright))",
                        color: "var(--on-p)",
                        borderRadius: "var(--r-full)",
                        border: "none",
                        height: 44,
                        fontSize: "0.875rem",
                        fontFamily: "var(--font-body)",
                        fontWeight: 600,
                      }}
                    >
                      {creatingCustomer ? (
                        <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Crear cliente
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* ── Producto — cascading selects ────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                fontWeight: 600,
                color: "var(--on-surf-var)",
                letterSpacing: "0.04em",
              }}
            >
              Producto <span style={{ color: "var(--p-bright)" }}>*</span>
            </span>

            {/* Modelo */}
            <div className="relative">
              <select
                value={modeloId}
                onChange={(e) => {
                  setModeloId(e.target.value);
                  setVoltajeId("");
                  setColorId("");
                  setUnitPrice(0);
                }}
                style={SELECT_STYLE}
              >
                <option value="">— Modelo —</option>
                {modelos.map((m) => <option key={m.id} value={m.id}>{m.nombre}</option>)}
              </select>
              <ChevronDown
                className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                style={{ color: "var(--on-surf-var)" }}
              />
            </div>

            {/* Voltaje */}
            {modeloId && (
              <div className="relative">
                <select
                  value={voltajeId}
                  onChange={(e) => {
                    setVoltajeId(e.target.value);
                    setColorId("");
                    setUnitPrice(0);
                  }}
                  style={SELECT_STYLE}
                >
                  <option value="">— Voltaje —</option>
                  {voltajes.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "var(--on-surf-var)" }}
                />
              </div>
            )}

            {/* Color */}
            {modeloId && voltajeId && (
              <div className="relative">
                <select
                  value={colorId}
                  onChange={(e) => handleColorSelect(e.target.value)}
                  style={SELECT_STYLE}
                >
                  <option value="">— Color —</option>
                  {colores.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
                </select>
                <ChevronDown
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                  style={{ color: "var(--on-surf-var)" }}
                />
              </div>
            )}

            {resolvedVariant && (
              <p className="text-xs" style={{ color: "var(--sec)" }}>
                ✓ {resolvedVariant.label} ·{" "}
                <span style={{ fontFamily: "monospace" }}>{resolvedVariant.sku}</span>
              </p>
            )}
          </div>

          {/* ── Cantidad + Precio ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup>
              <FieldLabel required>Cantidad</FieldLabel>
              <Input
                type="number"
                min={1}
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                style={INPUT_STYLE}
              />
            </FieldGroup>
            <FieldGroup>
              <FieldLabel required>Precio unitario</FieldLabel>
              <Input
                type="number"
                min={0}
                step={0.01}
                value={unitPrice}
                onChange={(e) => setUnitPrice(parseFloat(e.target.value) || 0)}
                style={INPUT_STYLE}
              />
            </FieldGroup>
          </div>

          {/* ── Resumen total ─────────────────────────────────────────────── */}
          {unitPrice > 0 && (
            <div
              className="flex justify-between items-center px-4 py-3 rounded-[var(--r-lg)]"
              style={{ background: "var(--surf-high)" }}
            >
              <span className="text-sm" style={{ color: "var(--on-surf-var)", fontFamily: "var(--font-body)" }}>
                Total ({quantity} × {formatMXN(unitPrice)})
              </span>
              <span
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "1rem",
                  fontWeight: 700,
                  color: "var(--on-surf)",
                }}
              >
                {formatMXN(total)}
              </span>
            </div>
          )}

          {/* ── Anticipo / Pago ────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.75rem",
                  fontWeight: 600,
                  color: "var(--on-surf-var)",
                  letterSpacing: "0.04em",
                }}
              >
                Anticipo inicial
              </span>
              <button
                type="button"
                onClick={() => setIsSplitPayment((p) => !p)}
                className="text-xs font-semibold px-3 py-1 rounded-full transition-all"
                style={
                  isSplitPayment
                    ? {
                        background: "color-mix(in srgb, var(--p-mid) 15%, transparent)",
                        color: "var(--p-mid)",
                      }
                    : { background: "var(--surf-high)", color: "var(--on-surf-var)" }
                }
              >
                Pago combinado
              </button>
            </div>

            {!isSplitPayment ? (
              /* Simple payment */
              <div className="grid grid-cols-2 gap-3">
                <Input
                  type="number"
                  min={0}
                  max={total}
                  step={0.01}
                  value={deposit}
                  onChange={(e) => setDeposit(Math.min(total, parseFloat(e.target.value) || 0))}
                  placeholder="$0.00"
                  style={INPUT_STYLE}
                />
                <div className="relative">
                  <select
                    value={paymentMethod}
                    onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}
                    style={SELECT_STYLE}
                  >
                    {(["CASH", "CARD", "TRANSFER"] as PaymentMethod[]).map((m) => (
                      <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                    ))}
                  </select>
                  <ChevronDown
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
                    style={{ color: "var(--on-surf-var)" }}
                  />
                </div>
              </div>
            ) : (
              /* Split payment */
              <div
                className="rounded-[var(--r-lg)] p-4 flex flex-col gap-3"
                style={{ background: "var(--surf-high)" }}
              >
                {/* Total anticipo */}
                <div className="flex items-center gap-3">
                  <span className="text-xs shrink-0" style={{ color: "var(--on-surf-var)" }}>
                    Anticipo total
                  </span>
                  <Input
                    type="number"
                    min={0}
                    max={total}
                    step={0.01}
                    value={deposit}
                    onChange={(e) => {
                      const d = Math.min(total, parseFloat(e.target.value) || 0);
                      setDeposit(d);
                      setPrimaryAmount((p) => Math.min(p, d));
                    }}
                    placeholder="$0.00"
                    className="flex-1"
                    style={INPUT_STYLE}
                  />
                </div>

                {/* Primary */}
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    min={0}
                    max={deposit}
                    step={0.01}
                    value={primaryAmount}
                    onChange={(e) => setPrimaryAmount(Math.min(deposit, parseFloat(e.target.value) || 0))}
                    placeholder="Primer monto"
                    style={INPUT_STYLE}
                  />
                  <div className="relative">
                    <select
                      value={primaryMethod}
                      onChange={(e) => setPrimaryMethod(e.target.value as PaymentMethod)}
                      style={SELECT_STYLE}
                    >
                      {(["CASH", "CARD", "TRANSFER"] as PaymentMethod[]).map((m) => (
                        <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--on-surf-var)" }} />
                  </div>
                </div>

                {/* Secondary (computed) */}
                <div className="grid grid-cols-2 gap-2">
                  <div
                    className="flex items-center px-3 rounded-[var(--r-lg)]"
                    style={{ background: "var(--surf-lowest)", height: 44 }}
                  >
                    <span
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: "0.9rem",
                        fontWeight: 600,
                        color: "var(--p-mid)",
                      }}
                    >
                      {formatMXN(secondaryAmountNum)}
                    </span>
                  </div>
                  <div className="relative">
                    <select
                      value={secondaryMethod}
                      onChange={(e) => setSecondaryMethod(e.target.value as PaymentMethod)}
                      style={SELECT_STYLE}
                    >
                      {(["CASH", "CARD", "TRANSFER"] as PaymentMethod[]).map((m) => (
                        <option key={m} value={m}>{METHOD_LABELS[m]}</option>
                      ))}
                    </select>
                    <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" style={{ color: "var(--on-surf-var)" }} />
                  </div>
                </div>
              </div>
            )}

            {deposit > 0 && total > 0 && (
              <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                Resta:{" "}
                <strong style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}>
                  {formatMXN(remaining)}
                </strong>
              </p>
            )}
          </div>

          {/* ── Fecha de entrega ───────────────────────────────────────────── */}
          <FieldGroup>
            <FieldLabel required={orderType === "BACKORDER"}>
              Fecha estimada de entrega
            </FieldLabel>
            <Input
              type="date"
              value={deliveryDate}
              onChange={(e) => setDeliveryDate(e.target.value)}
              style={INPUT_STYLE}
            />
          </FieldGroup>

          {/* ── Notas ─────────────────────────────────────────────────────── */}
          <FieldGroup>
            <FieldLabel>Notas (opcional)</FieldLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Especificaciones, comentarios del cliente..."
              rows={2}
              style={TEXTAREA_STYLE}
            />
          </FieldGroup>
        </div>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
        <div
          className="flex justify-end gap-3 px-6 py-4 shrink-0"
          style={{ borderTop: "1px solid color-mix(in srgb, var(--outline-var) 20%, transparent)" }}
        >
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={submitting}
            style={{ fontSize: "0.875rem", height: 40 }}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            style={{
              background:
                orderType === "BACKORDER"
                  ? "linear-gradient(135deg, #1a1a2e, var(--ter))"
                  : "var(--velocity-gradient)",
              color: "#fff",
              borderRadius: "var(--r-full)",
              border: "none",
              fontSize: "0.875rem",
              height: 40,
              minWidth: "9rem",
              fontFamily: "var(--font-body)",
              fontWeight: 600,
            }}
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-1.5" />
            ) : orderType === "BACKORDER" ? (
              <Truck className="h-4 w-4 mr-1.5" />
            ) : (
              <Repeat2 className="h-4 w-4 mr-1.5" />
            )}
            {orderType === "BACKORDER" ? "Crear Backorder" : "Crear Apartado"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
