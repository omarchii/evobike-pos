"use client";

// Formulario unificado de registro y edición de clientes (BRIEF §7.3 — Sub-fase D).
// Modos: "create" consume POST /api/customers; "edit" consume PUT /api/customers/[id]
// con role-gating + motivo obligatorio para campos fiscales (guardrails).

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useForm, useWatch, type SubmitHandler } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { normalizePhoneMX } from "@/lib/customers/phone";
import { CUSTOMER_SENSITIVE_FIELDS } from "@/lib/customers/validation";
import { useRegisterBreadcrumbLabel } from "@/lib/breadcrumbs/client-store";

// Listas SAT (coinciden con las del customer-create-form legacy).
const REGIMENES_FISCALES = [
  { value: "", label: "Sin régimen" },
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
  { value: "", label: "Sin uso" },
  { value: "G01", label: "G01 – Adquisición de mercancías" },
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

// Schema permisivo del form. La validación dura vive server-side
// (customerCreateSchema / customerUpdateSchema en /lib/customers/validation.ts).
const formSchema = z.object({
  firstName: z.string().trim(),
  lastName: z.string().trim(),
  birthday: z.string().optional(),
  isBusiness: z.boolean(),

  email: z.string().trim().email("Correo inválido").optional().or(z.literal("")),
  phone: z.string().trim().regex(/^\d{10}$/, "El teléfono debe tener 10 dígitos").optional().or(z.literal("")),
  phone2: z.string().trim().optional(),
  curp: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/,
      "CURP inválida (18 caracteres alfanuméricos)",
    )
    .optional()
    .or(z.literal("")),
  communicationConsent: z.boolean(),

  rfc: z
    .string()
    .trim()
    .toUpperCase()
    .regex(
      /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/,
      "RFC inválido (3-4 letras + 6 dígitos + 3 alfanuméricos)",
    )
    .optional()
    .or(z.literal("")),
  razonSocial: z.string().trim().optional(),
  regimenFiscal: z.string().optional(),
  usoCFDI: z.string().optional(),
  emailFiscalSame: z.boolean(),
  emailFiscal: z.string().trim().email("Correo fiscal inválido").optional().or(z.literal("")),
  fiscalStreet: z.string().trim().optional(),
  fiscalExtNum: z.string().trim().optional(),
  fiscalIntNum: z.string().trim().optional(),
  fiscalColonia: z.string().trim().optional(),
  fiscalCity: z.string().trim().optional(),
  fiscalState: z.string().trim().optional(),
  fiscalZip: z.string().trim().optional(),

  shippingSameAsFiscal: z.boolean(),
  shippingStreet: z.string().trim().optional(),
  shippingExtNum: z.string().trim().optional(),
  shippingIntNum: z.string().trim().optional(),
  shippingColonia: z.string().trim().optional(),
  shippingCity: z.string().trim().optional(),
  shippingState: z.string().trim().optional(),
  shippingZip: z.string().trim().optional(),
  shippingRefs: z.string().trim().optional(),
});

type FormValues = z.infer<typeof formSchema>;

export interface CustomerFormInitial {
  id?: string;
  name: string;
  phone: string | null;
  phone2: string | null;
  curp: string | null;
  email: string | null;
  birthday: string | null;
  isBusiness: boolean;
  communicationConsent: boolean;
  ineScanUrl: string | null;
  rfc: string | null;
  razonSocial: string | null;
  regimenFiscal: string | null;
  usoCFDI: string | null;
  emailFiscal: string | null;
  fiscalStreet: string | null;
  fiscalExtNum: string | null;
  fiscalIntNum: string | null;
  fiscalColonia: string | null;
  fiscalCity: string | null;
  fiscalState: string | null;
  fiscalZip: string | null;
  shippingStreet: string | null;
  shippingExtNum: string | null;
  shippingIntNum: string | null;
  shippingColonia: string | null;
  shippingCity: string | null;
  shippingState: string | null;
  shippingZip: string | null;
  shippingRefs: string | null;
}

interface CustomerFormProps {
  mode: "create" | "edit";
  initial: CustomerFormInitial | null;
  role: string;
}

interface DuplicateMatch {
  id: string;
  name: string;
  rfc: string | null;
  phone: string | null;
  email: string | null;
}

type DuplicateField = "phone" | "email" | "rfc";

function IneUploadSection({ customerId, hasIne }: { customerId: string; hasIne: boolean }) {
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(hasIne);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/customers/${customerId}/ine`, { method: "POST", body: fd });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Error al subir INE");
        return;
      }
      setUploaded(true);
      toast.success("INE cargada correctamente");
    } catch {
      toast.error("Error al subir INE");
    } finally {
      setUploading(false);
      e.target.value = "";
    }
  };

  return (
    <div
      className="flex items-center justify-between gap-3 rounded-lg px-3 py-2"
      style={{ background: "var(--surf-low)" }}
    >
      <div className="flex items-center gap-2">
        <Icon name="user" size={18} />
        <span className="text-xs font-medium" style={{ color: "var(--on-surf-var)" }}>
          INE escaneada
        </span>
        {uploaded && (
          <Chip variant="success" label="Cargada" />
        )}
      </div>
      <label
        className="cursor-pointer rounded-md px-3 py-1 text-xs font-semibold transition-colors"
        style={{
          background: "var(--primary)",
          color: "var(--on-primary)",
          opacity: uploading ? 0.5 : 1,
        }}
      >
        {uploading ? "Subiendo..." : uploaded ? "Reemplazar" : "Subir"}
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleUpload}
          disabled={uploading}
        />
      </label>
    </div>
  );
}

function splitInitialName(fullName: string): { firstName: string; lastName: string } {
  const trimmed = fullName.trim();
  if (!trimmed) return { firstName: "", lastName: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return { firstName: parts[0], lastName: "" };
  // Heurística cosmética: 1 palabra = nombre, el resto = apellidos.
  return { firstName: parts[0], lastName: parts.slice(1).join(" ") };
}

export function CustomerForm({ mode, initial, role }: CustomerFormProps): React.JSX.Element {
  const router = useRouter();
  const isEdit = mode === "edit";
  const isManagerPlus = role === "ADMIN" || role === "MANAGER";

  useRegisterBreadcrumbLabel(
    isEdit && initial ? `/customers/${initial.id}` : "",
    isEdit && initial ? initial.name : null,
  );

  const defaults: FormValues = useMemo(() => {
    if (!initial) {
      return {
        firstName: "",
        lastName: "",
        birthday: "",
        isBusiness: false,
        email: "",
        phone: "",
        phone2: "",
        curp: "",
        communicationConsent: false,
        rfc: "",
        razonSocial: "",
        regimenFiscal: "",
        usoCFDI: "",
        emailFiscalSame: true,
        emailFiscal: "",
        fiscalStreet: "",
        fiscalExtNum: "",
        fiscalIntNum: "",
        fiscalColonia: "",
        fiscalCity: "",
        fiscalState: "",
        fiscalZip: "",
        shippingSameAsFiscal: false,
        shippingStreet: "",
        shippingExtNum: "",
        shippingIntNum: "",
        shippingColonia: "",
        shippingCity: "",
        shippingState: "",
        shippingZip: "",
        shippingRefs: "",
      };
    }
    const { firstName, lastName } = splitInitialName(initial.name);
    const emailSame = !!initial.email && initial.email === initial.emailFiscal;
    return {
      firstName,
      lastName,
      birthday: initial.birthday ?? "",
      isBusiness: initial.isBusiness,
      email: initial.email ?? "",
      phone: initial.phone ?? "",
      phone2: initial.phone2 ?? "",
      curp: initial.curp ?? "",
      communicationConsent: initial.communicationConsent,
      rfc: initial.rfc ?? "",
      razonSocial: initial.razonSocial ?? "",
      regimenFiscal: initial.regimenFiscal ?? "",
      usoCFDI: initial.usoCFDI ?? "",
      emailFiscalSame: emailSame,
      emailFiscal: emailSame ? "" : initial.emailFiscal ?? "",
      fiscalStreet: initial.fiscalStreet ?? "",
      fiscalExtNum: initial.fiscalExtNum ?? "",
      fiscalIntNum: initial.fiscalIntNum ?? "",
      fiscalColonia: initial.fiscalColonia ?? "",
      fiscalCity: initial.fiscalCity ?? "",
      fiscalState: initial.fiscalState ?? "",
      fiscalZip: initial.fiscalZip ?? "",
      shippingSameAsFiscal: false,
      shippingStreet: initial.shippingStreet ?? "",
      shippingExtNum: initial.shippingExtNum ?? "",
      shippingIntNum: initial.shippingIntNum ?? "",
      shippingColonia: initial.shippingColonia ?? "",
      shippingCity: initial.shippingCity ?? "",
      shippingState: initial.shippingState ?? "",
      shippingZip: initial.shippingZip ?? "",
      shippingRefs: initial.shippingRefs ?? "",
    };
  }, [initial]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting, isDirty, dirtyFields },
  } = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: defaults,
  });

  // Detección de duplicados inline (BRIEF §7.3 — solo modo create).
  const [dupes, setDupes] = useState<Record<DuplicateField, DuplicateMatch[]>>({
    phone: [],
    email: [],
    rfc: [],
  });
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  const checkDuplicate = async (field: DuplicateField, value: string): Promise<void> => {
    if (!isEdit) {
      if (!value.trim()) {
        setDupes((d) => ({ ...d, [field]: [] }));
        return;
      }
      try {
        const res = await fetch(
          `/api/customers/search?match=${field}&value=${encodeURIComponent(value)}`,
        );
        const json = (await res.json()) as { success: boolean; data?: DuplicateMatch[] };
        if (json.success && json.data) {
          setDupes((d) => ({ ...d, [field]: json.data! }));
        }
      } catch {
        // Silencio: la detección es un nice-to-have, el server valida.
      }
    }
  };

  // Guardrail: diálogo de motivo si se tocan campos sensibles en edición.
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reasonText, setReasonText] = useState("");
  const [pendingValues, setPendingValues] = useState<FormValues | null>(null);

  const sensitiveTouched = (values: FormValues): boolean => {
    if (!isEdit || !initial) return false;
    for (const field of CUSTOMER_SENSITIVE_FIELDS) {
      if (field === "creditLimit") continue;
      const dirty = dirtyFields[field as keyof FormValues];
      if (!dirty) continue;
      const current = (values as unknown as Record<string, unknown>)[field];
      const original = (initial as unknown as Record<string, unknown>)[field] ?? "";
      if ((current ?? "") !== (original ?? "")) return true;
    }
    return false;
  };

  const onSubmit: SubmitHandler<FormValues> = async (values) => {
    if (sensitiveTouched(values) && !reasonText) {
      setPendingValues(values);
      setReasonOpen(true);
      return;
    }
    await submitValues(values, reasonText || undefined);
  };

  const confirmReason = async (): Promise<void> => {
    if (!reasonText.trim()) {
      toast.error("Escribe un motivo para registrar el cambio");
      return;
    }
    setReasonOpen(false);
    if (pendingValues) {
      const values = pendingValues;
      setPendingValues(null);
      await submitValues(values, reasonText.trim());
    }
  };

  const submitValues = async (values: FormValues, reason?: string): Promise<void> => {
    const name = `${values.firstName} ${values.lastName}`.trim();
    if (!name) {
      toast.error("El nombre es obligatorio");
      return;
    }
    const payload: Record<string, unknown> = {
      name,
      phone: values.phone ? normalizePhoneMX(values.phone) ?? values.phone : null,
      phone2: values.phone2 ? normalizePhoneMX(values.phone2) : null,
      curp: values.curp || null,
      email: values.email || null,
      birthday: values.birthday || null,
      isBusiness: values.isBusiness,
      communicationConsent: values.communicationConsent,
      rfc: values.rfc || null,
      razonSocial: values.isBusiness ? values.razonSocial || null : null,
      regimenFiscal: values.regimenFiscal || null,
      usoCFDI: values.usoCFDI || null,
      emailFiscal: values.emailFiscalSame ? values.email || null : values.emailFiscal || null,
      fiscalStreet: values.fiscalStreet || null,
      fiscalExtNum: values.fiscalExtNum || null,
      fiscalIntNum: values.fiscalIntNum || null,
      fiscalColonia: values.fiscalColonia || null,
      fiscalCity: values.fiscalCity || null,
      fiscalState: values.fiscalState || null,
      fiscalZip: values.fiscalZip || null,
      shippingStreet: values.shippingStreet || null,
      shippingExtNum: values.shippingExtNum || null,
      shippingIntNum: values.shippingIntNum || null,
      shippingColonia: values.shippingColonia || null,
      shippingCity: values.shippingCity || null,
      shippingState: values.shippingState || null,
      shippingZip: values.shippingZip || null,
      shippingRefs: values.shippingRefs || null,
    };
    if (reason) payload.reason = reason;

    if (values.shippingSameAsFiscal) {
      // Copia los 7 campos fiscales → envío (shippingRefs no tiene equivalente fiscal).
      payload.shippingStreet = values.fiscalStreet || null;
      payload.shippingExtNum = values.fiscalExtNum || null;
      payload.shippingIntNum = values.fiscalIntNum || null;
      payload.shippingColonia = values.fiscalColonia || null;
      payload.shippingCity = values.fiscalCity || null;
      payload.shippingState = values.fiscalState || null;
      payload.shippingZip = values.fiscalZip || null;
    }

    const url = isEdit ? `/api/customers/${initial!.id}` : `/api/customers`;
    const method = isEdit ? "PUT" : "POST";
    toast.loading(isEdit ? "Guardando cambios…" : "Registrando cliente…", { id: "save" });

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const json = (await res.json()) as { success: boolean; error?: string; data?: { id: string; name: string } };
      if (!json.success) {
        toast.error(json.error ?? "No se pudo guardar", { id: "save" });
        return;
      }
      toast.success(isEdit ? "Cliente actualizado" : `Cliente "${json.data?.name}" registrado`, {
        id: "save",
      });
      const id = isEdit ? initial!.id! : json.data!.id;
      router.push(`/customers/${id}`);
      router.refresh();
    } catch {
      toast.error("Error de conexión", { id: "save" });
    }
  };

  const isBusiness = useWatch({ control, name: "isBusiness" });
  const emailFiscalSame = useWatch({ control, name: "emailFiscalSame" });
  const shippingSameAsFiscal = useWatch({ control, name: "shippingSameAsFiscal" });

  const dupesFor = (field: DuplicateField): DuplicateMatch[] =>
    dupes[field].filter((m) => !dismissed.has(`${field}:${m.id}`));

  const dismissDupe = (field: DuplicateField, id: string): void => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(`${field}:${id}`);
      return next;
    });
  };

  return (
    <>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <Link
              href={isEdit ? `/customers/${initial?.id}` : "/customers"}
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: "var(--on-surf-var)" }}
            >
              <Icon name="chevronLeft" size={13} /> Volver
            </Link>
            <h1
              className="mt-1 text-2xl font-bold tracking-[-0.01em]"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              {isEdit ? `Editar ${initial?.name ?? "cliente"}` : "Nuevo cliente"}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={isEdit ? `/customers/${initial?.id}` : "/customers"}
              className="px-4 py-2 text-sm font-semibold"
              style={{
                borderRadius: "var(--r-full)",
                border: "1.5px solid rgba(45,106,79,0.2)",
                background: "transparent",
                color: "var(--p)",
                fontFamily: "var(--font-display)",
              }}
            >
              Cancelar
            </Link>
            <button
              type="submit"
              disabled={isSubmitting || (isEdit && !isDirty)}
              className="px-5 py-2 text-sm font-semibold disabled:opacity-60"
              style={{
                borderRadius: "var(--r-full)",
                background: "var(--velocity-gradient)",
                color: "var(--on-p)",
                fontFamily: "var(--font-display)",
                border: "none",
                boxShadow: "0px 8px 24px -4px rgba(46,204,113,0.35)",
              }}
            >
              {isSubmitting ? "Guardando…" : isEdit ? "Guardar cambios" : "Guardar registro"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Columna izquierda */}
          <div className="flex flex-col gap-4">
            <Card title="Datos personales">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Nombre(s)" required error={errors.firstName?.message}>
                  <input {...register("firstName")} className={INPUT_CLASS} style={INPUT_STYLE} autoComplete="given-name" />
                </FormField>
                <FormField label="Apellidos" error={errors.lastName?.message}>
                  <input {...register("lastName")} className={INPUT_CLASS} style={INPUT_STYLE} autoComplete="family-name" />
                </FormField>
                <FormField label="Fecha de nacimiento">
                  <input type="date" {...register("birthday")} className={INPUT_CLASS} style={INPUT_STYLE} />
                </FormField>
                <FormField label="Tipo">
                  <label className="flex items-center gap-2 h-11 px-3" style={{ background: "var(--surf-low)", borderRadius: "var(--r-lg)" }}>
                    <input type="checkbox" {...register("isBusiness")} />
                    <span className="text-sm" style={{ color: "var(--on-surf)" }}>Es empresa / B2B</span>
                  </label>
                </FormField>
              </div>
            </Card>

            <Card title="Contacto">
              <div className="grid grid-cols-2 gap-3">
                <FormField label="Correo electrónico" error={errors.email?.message} className="col-span-2">
                  <input
                    type="email"
                    {...register("email")}
                    className={INPUT_CLASS}
                    style={INPUT_STYLE}
                    onBlur={(e) => checkDuplicate("email", e.target.value)}
                    autoComplete="email"
                  />
                  <DuplicateBanner
                    field="email"
                    matches={dupesFor("email")}
                    onDismiss={(id) => dismissDupe("email", id)}
                    currentId={initial?.id}
                  />
                </FormField>
                <FormField label="Teléfono principal" error={errors.phone?.message}>
                  <input
                    type="tel"
                    {...register("phone")}
                    placeholder="10 dígitos"
                    className={INPUT_CLASS}
                    style={INPUT_STYLE}
                    onBlur={(e) => checkDuplicate("phone", e.target.value)}
                    autoComplete="tel"
                  />
                  <DuplicateBanner
                    field="phone"
                    matches={dupesFor("phone")}
                    onDismiss={(id) => dismissDupe("phone", id)}
                    currentId={initial?.id}
                  />
                </FormField>
                <FormField label="Teléfono secundario" error={errors.phone2?.message}>
                  <input type="tel" {...register("phone2")} className={INPUT_CLASS} style={INPUT_STYLE} />
                </FormField>
                <FormField label="CURP" error={errors.curp?.message} className="col-span-2">
                  <input
                    {...register("curp")}
                    placeholder="ABCD123456HDFXXX01"
                    maxLength={18}
                    className={INPUT_CLASS}
                    style={{ ...INPUT_STYLE, textTransform: "uppercase", letterSpacing: "0.5px" }}
                  />
                </FormField>
                {isEdit && initial?.id && (
                  <div className="col-span-2">
                    <IneUploadSection customerId={initial.id} hasIne={!!initial.ineScanUrl} />
                  </div>
                )}
                <FormField label="Consentimiento" className="col-span-2">
                  <label
                    className="flex items-start gap-2 p-3"
                    style={{ background: "var(--surf-low)", borderRadius: "var(--r-lg)" }}
                  >
                    <input type="checkbox" {...register("communicationConsent")} className="mt-1" />
                    <span className="text-xs leading-snug" style={{ color: "var(--on-surf-var)" }}>
                      Acepta recibir comunicación por WhatsApp/email (LFPDPPP). Los clientes sin
                      consentimiento quedan excluidos de listas masivas.
                    </span>
                  </label>
                </FormField>
              </div>
            </Card>
          </div>

          {/* Columna derecha */}
          <div className="flex flex-col gap-4">
            <Card
              title="Datos fiscales"
              lockHint="Los cambios en RFC, razón social y régimen quedan registrados en el historial."
            >
              <div className="grid grid-cols-2 gap-3">
                <FormField
                  label="RFC"
                  error={errors.rfc?.message}
                  sensitive
                  className="col-span-2"
                >
                  <input
                    {...register("rfc")}
                    placeholder="XAXX010101000"
                    className={`${INPUT_CLASS} uppercase`}
                    style={INPUT_STYLE}
                    onBlur={(e) => checkDuplicate("rfc", e.target.value)}
                    autoCapitalize="characters"
                  />
                  <DuplicateBanner
                    field="rfc"
                    matches={dupesFor("rfc")}
                    onDismiss={(id) => dismissDupe("rfc", id)}
                    currentId={initial?.id}
                  />
                </FormField>
                {isBusiness && (
                  <FormField label="Razón social" className="col-span-2" sensitive>
                    <input {...register("razonSocial")} className={INPUT_CLASS} style={INPUT_STYLE} />
                  </FormField>
                )}
                <FormField label="Régimen fiscal" sensitive className="col-span-2">
                  <select {...register("regimenFiscal")} className={INPUT_CLASS} style={INPUT_STYLE}>
                    {REGIMENES_FISCALES.map((r) => (
                      <option key={r.value} value={r.value}>{r.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Uso de CFDI" className="col-span-2">
                  <select {...register("usoCFDI")} className={INPUT_CLASS} style={INPUT_STYLE}>
                    {USOS_CFDI.map((u) => (
                      <option key={u.value} value={u.value}>{u.label}</option>
                    ))}
                  </select>
                </FormField>
                <FormField label="Correo fiscal" error={errors.emailFiscal?.message} className="col-span-2">
                  <label
                    className="flex items-center gap-2 mb-2 text-xs"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    <input type="checkbox" {...register("emailFiscalSame")} />
                    Mismo que correo de contacto
                  </label>
                  <input
                    type="email"
                    {...register("emailFiscal")}
                    disabled={emailFiscalSame}
                    className={INPUT_CLASS}
                    style={{
                      ...INPUT_STYLE,
                      opacity: emailFiscalSame ? 0.5 : 1,
                      cursor: emailFiscalSame ? "not-allowed" : "text",
                    }}
                  />
                </FormField>
                <FormField label="Calle" className="col-span-2">
                  <input {...register("fiscalStreet")} className={INPUT_CLASS} style={INPUT_STYLE} />
                </FormField>
                <FormField label="Núm. exterior">
                  <input {...register("fiscalExtNum")} className={INPUT_CLASS} style={INPUT_STYLE} />
                </FormField>
                <FormField label="Núm. interior">
                  <input {...register("fiscalIntNum")} className={INPUT_CLASS} style={INPUT_STYLE} />
                </FormField>
                <FormField label="Colonia" className="col-span-2">
                  <input {...register("fiscalColonia")} className={INPUT_CLASS} style={INPUT_STYLE} />
                </FormField>
                <FormField label="Ciudad">
                  <input {...register("fiscalCity")} className={INPUT_CLASS} style={INPUT_STYLE} />
                </FormField>
                <FormField label="Estado">
                  <input {...register("fiscalState")} className={INPUT_CLASS} style={INPUT_STYLE} />
                </FormField>
                <FormField label="C.P.">
                  <input {...register("fiscalZip")} className={INPUT_CLASS} style={INPUT_STYLE} />
                </FormField>
              </div>
            </Card>

            <Card title="Logística y entregas">
              <label
                className="flex items-center gap-2 mb-3 text-xs"
                style={{ color: "var(--on-surf-var)" }}
              >
                <input type="checkbox" {...register("shippingSameAsFiscal")} />
                Misma dirección que facturación
              </label>
              {!shippingSameAsFiscal && (
                <div className="grid grid-cols-2 gap-3">
                  <FormField label="Calle" className="col-span-2">
                    <input {...register("shippingStreet")} className={INPUT_CLASS} style={INPUT_STYLE} />
                  </FormField>
                  <FormField label="Núm. exterior">
                    <input {...register("shippingExtNum")} className={INPUT_CLASS} style={INPUT_STYLE} />
                  </FormField>
                  <FormField label="Núm. interior">
                    <input {...register("shippingIntNum")} className={INPUT_CLASS} style={INPUT_STYLE} />
                  </FormField>
                  <FormField label="Colonia" className="col-span-2">
                    <input {...register("shippingColonia")} className={INPUT_CLASS} style={INPUT_STYLE} />
                  </FormField>
                  <FormField label="Ciudad">
                    <input {...register("shippingCity")} className={INPUT_CLASS} style={INPUT_STYLE} />
                  </FormField>
                  <FormField label="Estado">
                    <input {...register("shippingState")} className={INPUT_CLASS} style={INPUT_STYLE} />
                  </FormField>
                  <FormField label="C.P.">
                    <input {...register("shippingZip")} className={INPUT_CLASS} style={INPUT_STYLE} />
                  </FormField>
                  <FormField label="Referencias para transportista" className="col-span-2">
                    <textarea
                      {...register("shippingRefs")}
                      rows={2}
                      className={INPUT_CLASS}
                      style={{ ...INPUT_STYLE, height: "auto", paddingTop: 10, paddingBottom: 10 }}
                    />
                  </FormField>
                </div>
              )}
            </Card>

            {isEdit && isManagerPlus && (
              <div
                className="p-3 text-xs"
                style={{ background: "var(--surf-low)", borderRadius: "var(--r-lg)", color: "var(--on-surf-var)" }}
              >
                El límite de crédito se ajusta desde <strong>Finanzas</strong> en la ficha del cliente.
              </div>
            )}
          </div>
        </div>
      </form>

      {reasonOpen && (
        <ReasonDialog
          value={reasonText}
          onChange={setReasonText}
          onCancel={() => {
            setReasonOpen(false);
            setPendingValues(null);
            setReasonText("");
          }}
          onConfirm={confirmReason}
        />
      )}
    </>
  );
}

// ── UI helpers ───────────────────────────────────────────────────────────────

const INPUT_CLASS = "w-full text-sm outline-none";
const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  height: 44,
  paddingLeft: 12,
  paddingRight: 12,
};

function Card({
  title,
  lockHint,
  children,
}: {
  title: string;
  lockHint?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      className="p-5 rounded-[var(--r-lg)]"
      style={{ background: "var(--surf-lowest)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-xs font-semibold uppercase tracking-[0.08em]"
          style={{ color: "var(--on-surf-var)", fontFamily: "var(--font-display)" }}
        >
          {title}
        </h2>
        {lockHint && (
          <span
            className="text-[0.625rem] flex items-center gap-1"
            style={{ color: "var(--on-surf-var)" }}
            title={lockHint}
          >
            <Icon name="alert" size={11} /> Campos auditados
          </span>
        )}
      </div>
      {children}
    </section>
  );
}

function FormField({
  label,
  required,
  error,
  sensitive,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  sensitive?: boolean;
  className?: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div className={`flex flex-col gap-1.5 ${className ?? ""}`}>
      <label
        className="text-[0.6875rem] font-medium uppercase tracking-[0.05em] flex items-center gap-1"
        style={{ color: "var(--on-surf-var)" }}
      >
        {label}
        {required && <span style={{ color: "var(--p-bright)" }}>*</span>}
        {sensitive && <Icon name="alert" size={10} />}
      </label>
      {children}
      {error && (
        <span className="text-[0.6875rem]" style={{ color: "var(--ter)" }}>
          {error}
        </span>
      )}
    </div>
  );
}

function DuplicateBanner({
  field,
  matches,
  onDismiss,
  currentId,
}: {
  field: DuplicateField;
  matches: DuplicateMatch[];
  onDismiss: (id: string) => void;
  currentId?: string;
}): React.JSX.Element | null {
  const relevant = matches.filter((m) => m.id !== currentId);
  if (relevant.length === 0) return null;
  const first = relevant[0];
  const labelByField: Record<DuplicateField, string> = {
    phone: "teléfono",
    email: "email",
    rfc: "RFC",
  };
  return (
    <div
      className="mt-2 p-2 text-xs flex items-start gap-2"
      style={{
        background: "var(--warn-container)",
        color: "var(--on-surf)",
        borderRadius: "var(--r-md)",
      }}
    >
      <Icon name="alert" size={13} className="mt-0.5" />
      <div className="flex-1">
        Existe un cliente con este {labelByField[field]}:{" "}
        <Link href={`/customers/${first.id}`} className="font-semibold underline">
          {first.name}
        </Link>
        {first.rfc && <span className="ml-1 font-mono text-[0.6875rem]">({first.rfc})</span>}
        {relevant.length > 1 && (
          <span className="ml-1 text-[0.6875rem]">+{relevant.length - 1} más</span>
        )}
      </div>
      <button
        type="button"
        onClick={() => relevant.forEach((m) => onDismiss(m.id))}
        className="text-[0.6875rem] font-semibold shrink-0"
        style={{ color: "var(--p)" }}
      >
        No, es otro
      </button>
    </div>
  );
}

function ReasonDialog({
  value,
  onChange,
  onCancel,
  onConfirm,
}: {
  value: string;
  onChange: (v: string) => void;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.45)" }}
      onClick={onCancel}
    >
      <div
        className="w-full max-w-md p-6 flex flex-col gap-3"
        style={{
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderRadius: "var(--r-xl)",
          boxShadow: "var(--shadow)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          className="text-lg font-bold"
          style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
        >
          Confirmar edición fiscal
        </h2>
        <p className="text-sm" style={{ color: "var(--on-surf-var)" }}>
          Este cambio no modifica CFDIs ya emitidos, pero quedará registrado en el
          historial del cliente junto con el motivo.
        </p>
        <Chip variant="warn" label="Campo auditado" />
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          autoFocus
          placeholder="Motivo del cambio (ej. corrección SAT, actualización de régimen, …)"
          className="w-full text-sm outline-none p-3"
          style={{
            background: "var(--surf-low)",
            border: "none",
            borderRadius: "var(--r-lg)",
            color: "var(--on-surf)",
            fontFamily: "var(--font-body)",
          }}
        />
        <div className="flex gap-2 justify-end pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm font-semibold"
            style={{
              borderRadius: "var(--r-full)",
              border: "1.5px solid rgba(45,106,79,0.2)",
              background: "transparent",
              color: "var(--p)",
              fontFamily: "var(--font-display)",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="px-5 py-2 text-sm font-semibold"
            style={{
              borderRadius: "var(--r-full)",
              background: "var(--velocity-gradient)",
              color: "var(--on-p)",
              fontFamily: "var(--font-display)",
              border: "none",
            }}
          >
            Guardar con motivo
          </button>
        </div>
      </div>
    </div>
  );
}
