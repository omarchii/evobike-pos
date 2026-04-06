"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Search, UserPlus, ChevronDown, ChevronUp, X, User } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

// ── SAT catalogues ──────────────────────────────────────────────────────────

const REGIMENES_FISCALES = [
  { value: "601", label: "601 – General de Ley Personas Morales" },
  { value: "603", label: "603 – Personas Morales con Fines no Lucrativos" },
  { value: "605", label: "605 – Sueldos y Salarios e Ingresos Asimilados" },
  { value: "606", label: "606 – Arrendamiento" },
  { value: "607", label: "607 – Enajenación o Adquisición de Bienes" },
  { value: "608", label: "608 – Demás ingresos" },
  { value: "612", label: "612 – Personas Físicas con Actividades Empresariales" },
  { value: "616", label: "616 – Sin obligaciones fiscales" },
  { value: "621", label: "621 – Incorporación Fiscal" },
  { value: "622", label: "622 – Actividades Agrícolas, Ganaderas, Silvícolas y Pesqueras" },
  { value: "625", label: "625 – Actividades con ingresos por Plataformas Tecnológicas" },
  { value: "626", label: "626 – Régimen Simplificado de Confianza (RESICO)" },
] as const;

const USOS_CFDI = [
  { value: "G01", label: "G01 – Adquisición de mercancias" },
  { value: "G02", label: "G02 – Devoluciones, descuentos o bonificaciones" },
  { value: "G03", label: "G03 – Gastos en general" },
  { value: "I01", label: "I01 – Construcciones" },
  { value: "I03", label: "I03 – Equipo de transporte" },
  { value: "I04", label: "I04 – Equipo de cómputo y accesorios" },
  { value: "D01", label: "D01 – Honorarios médicos y gastos hospitalarios" },
  { value: "D04", label: "D04 – Donativos" },
  { value: "D10", label: "D10 – Pagos por servicios educativos" },
  { value: "S01", label: "S01 – Sin efectos fiscales" },
  { value: "CP01", label: "CP01 – Pagos" },
  { value: "CN01", label: "CN01 – Nómina" },
] as const;

// ── Types ────────────────────────────────────────────────────────────────────

export interface CustomerOption {
  id: string;
  name: string;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  balance: number;
  creditLimit: number;
}

interface Props {
  open: boolean;
  onClose: () => void;
  customers: CustomerOption[];
  onSelect: (customer: CustomerOption) => void;
  onCustomerCreated: (customer: CustomerOption) => void;
}

// ── Form schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  phone: z.string().min(10, "Mínimo 10 dígitos"),
  phone2: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),

  shippingStreet: z.string().optional(),
  shippingExtNum: z.string().optional(),
  shippingIntNum: z.string().optional(),
  shippingColonia: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingZip: z.string().optional(),
  shippingRefs: z.string().optional(),

  rfc: z.string().optional(),
  razonSocial: z.string().optional(),
  regimenFiscal: z.string().optional(),
  usoCFDI: z.string().optional(),
  emailFiscal: z.string().email("Correo fiscal inválido").optional().or(z.literal("")),
  direccionFiscal: z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

// ── Design tokens (shortcuts) ─────────────────────────────────────────────────
// Usados en inline styles para ser explícitos con el Design System.

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

const SELECT_TRIGGER_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  height: 44,
};

// ── CollapsibleSection ────────────────────────────────────────────────────────

function CollapsibleSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div
      style={{
        background: "var(--surf-high)",
        borderRadius: "var(--r-lg)",
        overflow: "hidden",
      }}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
        style={{ color: "var(--on-surf-var)" }}
      >
        <span
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "0.75rem",
            fontWeight: 600,
            letterSpacing: "0.08em",
            textTransform: "uppercase",
            color: "var(--on-surf-var)",
          }}
        >
          {title}
        </span>
        {open ? (
          <ChevronUp className="w-3.5 h-3.5" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5" />
        )}
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

// ── Field helper ──────────────────────────────────────────────────────────────

function Field({
  label,
  required,
  error,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <Label
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.75rem",
          fontWeight: 500,
          letterSpacing: "0.05em",
          color: "var(--on-surf-var)",
        }}
      >
        {label}
        {required && (
          <span style={{ color: "var(--p-bright)", marginLeft: 2 }}>*</span>
        )}
      </Label>
      {children}
      {error && (
        <span
          style={{
            fontFamily: "var(--font-body)",
            fontSize: 10,
            color: "var(--ter)",
          }}
        >
          {error}
        </span>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function CustomerSelectorModal({
  open,
  onClose,
  customers,
  onSelect,
  onCustomerCreated,
}: Props) {
  const [mode, setMode] = useState<"search" | "new">("search");
  const [query, setQuery] = useState("");
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  const filtered = customers.filter(
    (c) =>
      c.name.toLowerCase().includes(query.toLowerCase()) ||
      (c.phone ?? "").includes(query)
  );

  function handleClose() {
    setMode("search");
    setQuery("");
    reset();
    onClose();
  }

  function handlePickCustomer(c: CustomerOption) {
    onSelect(c);
    handleClose();
  }

  async function onSubmit(values: FormValues) {
    setSaving(true);
    try {
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json: unknown = await res.json();
      if (
        typeof json === "object" &&
        json !== null &&
        "success" in json &&
        (json as { success: boolean }).success
      ) {
        const created = (json as { success: boolean; data: CustomerOption }).data;
        onCustomerCreated(created);
        onSelect(created);
        toast.success(`Cliente "${created.name}" registrado`);
        handleClose();
      } else {
        const errMsg =
          typeof json === "object" && json !== null && "error" in json
            ? String((json as { error: unknown }).error)
            : "No se pudo crear el cliente";
        toast.error(errMsg);
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent
        showCloseButton={false}
        className="p-0 gap-0 overflow-hidden"
        style={{
          /* Glassmorphism — dual-mode vía color-mix sobre --surf-bright */
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          /* Ambient shadow — nunca sombra negra pura */
          boxShadow: "var(--shadow)",
          borderRadius: "var(--r-xl)",
          maxWidth: 520,
          maxHeight: "88vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── Header ── */}
        <DialogHeader className="px-6 pt-6 pb-4 shrink-0">
          <div className="flex items-center justify-between mb-4">
            <DialogTitle
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.75rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--on-surf)",
              }}
            >
              Seleccionar cliente
            </DialogTitle>

            {/* Botón cerrar — surface-container-high, sin borde sólido */}
            <button
              onClick={handleClose}
              className="w-9 h-9 flex items-center justify-center transition-colors shrink-0"
              style={{
                borderRadius: "var(--r-full)",
                background: "var(--surf-high)",
                color: "var(--on-surf-var)",
                border: "none",
              }}
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* ── Mode tabs — pill style ── */}
          <div
            className="flex p-1 gap-1"
            style={{
              background: "var(--surf-high)",
              borderRadius: "var(--r-full)",
            }}
          >
            {(["search", "new"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 transition-all"
                style={{
                  borderRadius: "var(--r-full)",
                  background:
                    mode === m ? "var(--p-container)" : "transparent",
                  color:
                    mode === m ? "var(--on-p-container)" : "var(--on-surf-var)",
                  fontFamily: "var(--font-body)",
                  fontSize: 12,
                  fontWeight: mode === m ? 600 : 400,
                  boxShadow:
                    mode === m
                      ? "0px 2px 8px -2px rgba(19,27,46,0.12)"
                      : "none",
                }}
              >
                {m === "search" ? (
                  <>
                    <Search className="w-3 h-3" />
                    Buscar cliente
                  </>
                ) : (
                  <>
                    <UserPlus className="w-3 h-3" />
                    Nuevo cliente
                  </>
                )}
              </button>
            ))}
          </div>
        </DialogHeader>

        {/* ── Body ── */}
        <div className="flex-1 overflow-y-auto px-6 pb-6 pt-2">

          {/* ── Modo búsqueda ── */}
          {mode === "search" && (
            <div className="flex flex-col gap-3">
              <div className="relative">
                <Search
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 pointer-events-none"
                  style={{ color: "var(--on-surf-var)" }}
                />
                <Input
                  autoFocus
                  placeholder="Nombre o teléfono…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  className="pl-9"
                  style={INPUT_STYLE}
                />
              </div>

              {filtered.length === 0 ? (
                <div
                  className="text-center py-10"
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    color: "var(--on-surf-var)",
                  }}
                >
                  {query ? (
                    <>
                      Sin resultados para{" "}
                      <span style={{ color: "var(--on-surf)", fontWeight: 500 }}>
                        &ldquo;{query}&rdquo;
                      </span>
                      <br />
                      <button
                        type="button"
                        onClick={() => setMode("new")}
                        className="mt-2 inline-flex items-center gap-1 underline underline-offset-2"
                        style={{ color: "var(--p-bright)" }}
                      >
                        <UserPlus className="w-3 h-3" />
                        Crear cliente nuevo
                      </button>
                    </>
                  ) : (
                    "Sin clientes registrados aún."
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-2 pb-2">
                  {filtered.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handlePickCustomer(c)}
                      className="group flex items-center gap-3 px-4 py-3 text-left transition-all"
                      style={{
                        background: "var(--surf-lowest)",
                        borderRadius: "var(--r-lg)",
                        boxShadow: "var(--shadow)",
                        color: "var(--on-surf)",
                      }}
                      onMouseEnter={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "var(--surf-high)";
                      }}
                      onMouseLeave={(e) => {
                        (e.currentTarget as HTMLButtonElement).style.background =
                          "var(--surf-lowest)";
                      }}
                    >
                      {/* Avatar */}
                      <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                        style={{
                          background: "var(--p-container)",
                        }}
                      >
                        <User
                          className="w-4 h-4"
                          style={{ color: "var(--on-p-container)" }}
                        />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div
                          className="truncate"
                          style={{
                            fontFamily: "var(--font-display)",
                            fontSize: 14,
                            fontWeight: 600,
                            color: "var(--on-surf)",
                          }}
                        >
                          {c.name}
                        </div>
                        {c.phone && (
                          <div
                            style={{
                              fontFamily: "var(--font-body)",
                              fontWeight: 400,
                              fontSize: 12,
                              color: "var(--on-surf-var)",
                              marginTop: 2,
                            }}
                          >
                            {c.phone}
                            {c.phone2 && (
                              <span style={{ opacity: 0.6 }}> · {c.phone2}</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Balance chip */}
                      {c.balance > 0 && (
                        <span
                          className="shrink-0 px-2 py-0.5"
                          style={{
                            background: "var(--sec-container)",
                            color: "var(--on-sec-container)",
                            borderRadius: "var(--r-full)",
                            fontFamily: "var(--font-display)",
                            fontSize: 10,
                            fontWeight: 600,
                            letterSpacing: "0.02em",
                          }}
                        >
                          ${c.balance.toFixed(2)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── Modo nuevo cliente ── */}
          {mode === "new" && (
            <form
              id="new-customer-form"
              onSubmit={handleSubmit(onSubmit)}
            >
              {/* Datos básicos */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <Field
                  label="Nombre completo"
                  required
                  error={errors.name?.message}
                  className="col-span-2"
                >
                  <Input
                    {...register("name")}
                    placeholder="Nombre del cliente"
                    style={INPUT_STYLE}
                  />
                </Field>

                <Field
                  label="Teléfono principal"
                  required
                  error={errors.phone?.message}
                >
                  <Input
                    {...register("phone")}
                    placeholder="10 dígitos"
                    type="tel"
                    style={INPUT_STYLE}
                  />
                </Field>

                <Field
                  label="Teléfono secundario"
                  error={errors.phone2?.message}
                >
                  <Input
                    {...register("phone2")}
                    placeholder="Opcional"
                    type="tel"
                    style={INPUT_STYLE}
                  />
                </Field>

                <Field
                  label="Correo electrónico"
                  error={errors.email?.message}
                  className="col-span-2"
                >
                  <Input
                    {...register("email")}
                    placeholder="correo@ejemplo.com (opcional)"
                    type="email"
                    style={INPUT_STYLE}
                  />
                </Field>
              </div>

              {/* Dirección para flete */}
              <div className="mb-5">
                <CollapsibleSection title="Dirección para flete">
                  <Field label="Calle" className="col-span-2">
                    <Input
                      {...register("shippingStreet")}
                      placeholder="Av. Principal"
                      style={INPUT_STYLE}
                    />
                  </Field>
                  <Field label="Núm. exterior">
                    <Input
                      {...register("shippingExtNum")}
                      placeholder="123"
                      style={INPUT_STYLE}
                    />
                  </Field>
                  <Field label="Núm. interior">
                    <Input
                      {...register("shippingIntNum")}
                      placeholder="A"
                      style={INPUT_STYLE}
                    />
                  </Field>
                  <Field label="Colonia" className="col-span-2">
                    <Input
                      {...register("shippingColonia")}
                      placeholder="Col. Centro"
                      style={INPUT_STYLE}
                    />
                  </Field>
                  <Field label="Ciudad">
                    <Input
                      {...register("shippingCity")}
                      placeholder="León"
                      style={INPUT_STYLE}
                    />
                  </Field>
                  <Field label="Estado">
                    <Input
                      {...register("shippingState")}
                      placeholder="Guanajuato"
                      style={INPUT_STYLE}
                    />
                  </Field>
                  <Field label="C.P.">
                    <Input
                      {...register("shippingZip")}
                      placeholder="37000"
                      style={INPUT_STYLE}
                    />
                  </Field>
                  <Field label="Referencias" className="col-span-2">
                    <Input
                      {...register("shippingRefs")}
                      placeholder="Entre calles, color de fachada…"
                      style={INPUT_STYLE}
                    />
                  </Field>
                </CollapsibleSection>
              </div>

              {/* Datos de facturación */}
              <div className="mb-2">
                <CollapsibleSection title="Datos de facturación">
                  <Field label="RFC" className="col-span-2">
                    <Input
                      {...register("rfc")}
                      placeholder="XAXX010101000"
                      style={INPUT_STYLE}
                      className="uppercase"
                      onChange={(e) =>
                        setValue("rfc", e.target.value.toUpperCase())
                      }
                    />
                  </Field>
                  <Field label="Razón social" className="col-span-2">
                    <Input
                      {...register("razonSocial")}
                      placeholder="Nombre o empresa como en el SAT"
                      style={INPUT_STYLE}
                    />
                  </Field>
                  <Field label="Régimen fiscal" className="col-span-2">
                    <Select
                      onValueChange={(v) => setValue("regimenFiscal", v)}
                      value={watch("regimenFiscal") ?? ""}
                    >
                      <SelectTrigger style={SELECT_TRIGGER_STYLE}>
                        <SelectValue placeholder="Seleccionar régimen…" />
                      </SelectTrigger>
                      <SelectContent>
                        {REGIMENES_FISCALES.map((r) => (
                          <SelectItem key={r.value} value={r.value}>
                            {r.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field label="Uso de CFDI" className="col-span-2">
                    <Select
                      onValueChange={(v) => setValue("usoCFDI", v)}
                      value={watch("usoCFDI") ?? ""}
                    >
                      <SelectTrigger style={SELECT_TRIGGER_STYLE}>
                        <SelectValue placeholder="Seleccionar uso…" />
                      </SelectTrigger>
                      <SelectContent>
                        {USOS_CFDI.map((u) => (
                          <SelectItem key={u.value} value={u.value}>
                            {u.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Field
                    label="Correo fiscal"
                    error={errors.emailFiscal?.message}
                    className="col-span-2"
                  >
                    <Input
                      {...register("emailFiscal")}
                      placeholder="facturacion@empresa.com"
                      type="email"
                      style={INPUT_STYLE}
                    />
                  </Field>
                  <Field label="Dirección fiscal" className="col-span-2">
                    <Input
                      {...register("direccionFiscal")}
                      placeholder="Dirección registrada en el SAT"
                      style={INPUT_STYLE}
                    />
                  </Field>
                </CollapsibleSection>
              </div>
            </form>
          )}
        </div>

        {/* ── Footer (solo en modo nuevo) ── */}
        {mode === "new" && (
          <div
            className="shrink-0 px-6 py-4 flex gap-3 justify-end"
            style={{ background: "var(--surf-low)" }}
          >
            {/* Cancelar — ghost, rounded-full, Space Grotesk */}
            <button
              type="button"
              onClick={handleClose}
              className="px-5 py-2.5 transition-opacity"
              style={{
                borderRadius: "var(--r-full)",
                border: "1.5px solid rgba(45,106,79,0.2)",
                background: "transparent",
                color: "var(--p)",
                fontFamily: "var(--font-display)",
                fontSize: "0.875rem",
                fontWeight: 600,
              }}
            >
              Cancelar
            </button>

            {/* Registrar — velocity gradient, rounded-full, Space Grotesk */}
            <button
              type="submit"
              form="new-customer-form"
              disabled={saving}
              className="px-6 py-2.5 text-white transition-opacity disabled:opacity-60"
              style={{
                borderRadius: "var(--r-full)",
                background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
                fontFamily: "var(--font-display)",
                fontSize: "0.875rem",
                fontWeight: 600,
                border: "none",
                boxShadow: "0px 8px 24px -4px rgba(46,204,113,0.35)",
              }}
            >
              {saving ? "Guardando…" : "Registrar cliente"}
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
