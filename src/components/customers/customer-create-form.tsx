"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ChevronDown, ChevronUp } from "lucide-react";
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

// ── Form schema ──────────────────────────────────────────────────────────────

const schema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  phone: z.string().min(10, "Mínimo 10 dígitos"),
  phone2: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),
  communicationConsent: z.boolean().optional(),

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

// ── Main form ────────────────────────────────────────────────────────────────

interface CustomerCreateFormProps {
  /** form id for an external <button type="submit" form={formId}> trigger. */
  formId?: string;
  /** Prefill the name field — e.g. with the query typed in a combobox. */
  defaultName?: string;
  /** Invoked with the created CustomerOption after a successful POST. */
  onCreated: (customer: CustomerOption) => void;
  /** Mirrors the internal `saving` flag so parents can render a disabled footer. */
  onSavingChange?: (saving: boolean) => void;
  /**
   * Quick mode (BRIEF Sub-fase L): hide secondary phone, address and fiscal
   * sections; collect name + phone + consent only. The customer is flagged as
   * `profileIncomplete` server-side until the rest of the data is captured.
   */
  quickMode?: boolean;
}

export function CustomerCreateForm({
  formId = "customer-create-form",
  defaultName,
  onCreated,
  onSavingChange,
  quickMode = false,
}: CustomerCreateFormProps) {
  const [saving, setSaving] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: defaultName ?? "" },
  });

  useEffect(() => {
    onSavingChange?.(saving);
  }, [saving, onSavingChange]);

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
        toast.success(`Cliente "${created.name}" registrado`);
        onCreated(created);
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
    <form id={formId} onSubmit={handleSubmit(onSubmit)}>
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
          className={quickMode ? "col-span-2" : undefined}
        >
          <Input
            {...register("phone")}
            placeholder="10 dígitos"
            type="tel"
            style={INPUT_STYLE}
          />
        </Field>

        {!quickMode && (
          <Field label="Teléfono secundario" error={errors.phone2?.message}>
            <Input
              {...register("phone2")}
              placeholder="Opcional"
              type="tel"
              style={INPUT_STYLE}
            />
          </Field>
        )}

        {!quickMode && (
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
        )}

        <label
          className="col-span-2 flex items-start gap-2 text-xs cursor-pointer"
          style={{ color: "var(--on-surf-var)" }}
        >
          <input
            type="checkbox"
            {...register("communicationConsent")}
            className="mt-0.5"
          />
          <span>
            Acepta recibir comunicación (WhatsApp / email).
            {quickMode && (
              <span className="block opacity-70 mt-0.5">
                Sin esta marca, el cliente no aparecerá en listas de marketing.
              </span>
            )}
          </span>
        </label>
      </div>

      {quickMode && (
        <div
          className="mb-2 px-3 py-2.5 text-[0.6875rem]"
          style={{
            background: "var(--surf-low)",
            borderRadius: "var(--r-md)",
            color: "var(--on-surf-var)",
          }}
        >
          Solo se capturan datos básicos para no detener la venta. Completa
          dirección y datos fiscales después desde el perfil del cliente.
        </div>
      )}

      {!quickMode && (
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
      )}

      {!quickMode && (
      <div className="mb-2">
        <CollapsibleSection title="Datos de facturación">
          <Field label="RFC" className="col-span-2">
            <Input
              {...register("rfc")}
              placeholder="XAXX010101000"
              style={INPUT_STYLE}
              className="uppercase"
              onChange={(e) => setValue("rfc", e.target.value.toUpperCase())}
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
      )}
    </form>
  );
}
