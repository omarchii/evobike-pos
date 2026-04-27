"use client";

import { useState, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Eye, Upload, Trash2 } from "lucide-react";

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body, 'Inter')",
  fontWeight: 400,
  fontSize: "0.875rem",
  height: 44,
  width: "100%",
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  outline: "none",
};

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  height: "auto",
  minHeight: 180,
  paddingTop: "0.75rem",
  paddingBottom: "0.75rem",
  resize: "vertical",
  lineHeight: 1.5,
};

const SECTION_STYLE: React.CSSProperties = {
  background: "var(--surf-high)",
  borderRadius: "var(--r-xl)",
  padding: "1.25rem",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--on-surf-var)",
  marginBottom: "0.375rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

const schema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  rfc: z.string(),
  razonSocial: z.string(),
  regimenFiscal: z.string(),
  street: z.string(),
  extNum: z.string(),
  intNum: z.string(),
  colonia: z.string(),
  city: z.string(),
  state: z.string(),
  zip: z.string(),
  phone: z.string(),
  email: z
    .string()
    .refine((v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), {
      message: "Email inválido",
    }),
  website: z.string(),
  terminosCotizacion: z.string(),
  terminosPedido: z.string(),
  terminosPoliza: z.string(),
});

type FormValues = z.infer<typeof schema>;

export interface InitialData extends FormValues {
  id: string;
  code: string;
  sealImageUrl: string | null;
}

export function SucursalConfigForm({ initial }: { initial: InitialData }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [sealUrl, setSealUrl] = useState<string | null>(initial.sealImageUrl);
  const [uploadingSeal, setUploadingSeal] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<{
    title: string;
    body: string;
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isDirty },
    watch,
    reset,
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: initial.name,
      rfc: initial.rfc,
      razonSocial: initial.razonSocial,
      regimenFiscal: initial.regimenFiscal,
      street: initial.street,
      extNum: initial.extNum,
      intNum: initial.intNum,
      colonia: initial.colonia,
      city: initial.city,
      state: initial.state,
      zip: initial.zip,
      phone: initial.phone,
      email: initial.email,
      website: initial.website,
      terminosCotizacion: initial.terminosCotizacion,
      terminosPedido: initial.terminosPedido,
      terminosPoliza: initial.terminosPoliza,
    },
  });

  const onSubmit = async (values: FormValues): Promise<void> => {
    setSaving(true);
    try {
      const res = await fetch(`/api/configuracion/sucursal/${initial.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo guardar");
        return;
      }
      toast.success("Datos de sucursal guardados");
      reset(values);
      router.refresh();
    } catch {
      toast.error("Error de red al guardar");
    } finally {
      setSaving(false);
    }
  };

  const onUploadSeal = async (file: File): Promise<void> => {
    if (file.size > 2 * 1024 * 1024) {
      toast.error("La imagen excede 2MB");
      return;
    }
    const allowed = ["image/png", "image/jpeg", "image/jpg", "image/webp"];
    if (!allowed.includes(file.type)) {
      toast.error("Usa PNG, JPEG o WebP");
      return;
    }
    setUploadingSeal(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch(`/api/configuracion/sucursal/${initial.id}/seal`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo subir el sello");
        return;
      }
      setSealUrl(json.data.sealImageUrl);
      toast.success("Sello actualizado");
      router.refresh();
    } catch {
      toast.error("Error de red al subir el sello");
    } finally {
      setUploadingSeal(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const onDeleteSeal = async (): Promise<void> => {
    if (!sealUrl) return;
    if (!confirm("¿Eliminar el sello actual?")) return;
    try {
      const res = await fetch(`/api/configuracion/sucursal/${initial.id}/seal`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo eliminar el sello");
        return;
      }
      setSealUrl(null);
      toast.success("Sello eliminado");
      router.refresh();
    } catch {
      toast.error("Error de red al eliminar el sello");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      <Tabs defaultValue="datos">
        <TabsList>
          <TabsTrigger value="datos">Datos fiscales y contacto</TabsTrigger>
          <TabsTrigger value="sello">Sello</TabsTrigger>
          <TabsTrigger value="terminos">Términos legales</TabsTrigger>
        </TabsList>

        <TabsContent value="datos" className="mt-4 space-y-4">
          <div style={SECTION_STYLE}>
            <h2
              className="text-sm font-semibold mb-3 uppercase tracking-widest"
              style={{ color: "var(--on-surf-var)" }}
            >
              Identidad
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Field label="Nombre comercial" error={errors.name?.message}>
                <input {...register("name")} style={INPUT_STYLE} />
              </Field>
              <Field label="Código (solo lectura)">
                <input value={initial.code} disabled style={{ ...INPUT_STYLE, opacity: 0.6 }} />
              </Field>
              <Field label="RFC">
                <input {...register("rfc")} style={INPUT_STYLE} placeholder="XAXX010101000" />
              </Field>
              <Field label="Razón social">
                <input {...register("razonSocial")} style={INPUT_STYLE} />
              </Field>
              <Field label="Régimen fiscal">
                <input {...register("regimenFiscal")} style={INPUT_STYLE} placeholder="Ej. 612 Personas Físicas con Actividades Empresariales" />
              </Field>
            </div>
          </div>

          <div style={SECTION_STYLE}>
            <h2
              className="text-sm font-semibold mb-3 uppercase tracking-widest"
              style={{ color: "var(--on-surf-var)" }}
            >
              Dirección
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <Field label="Calle">
                  <input {...register("street")} style={INPUT_STYLE} />
                </Field>
              </div>
              <Field label="Núm. exterior">
                <input {...register("extNum")} style={INPUT_STYLE} />
              </Field>
              <Field label="Núm. interior">
                <input {...register("intNum")} style={INPUT_STYLE} />
              </Field>
              <Field label="Colonia">
                <input {...register("colonia")} style={INPUT_STYLE} />
              </Field>
              <Field label="Código postal">
                <input {...register("zip")} style={INPUT_STYLE} />
              </Field>
              <Field label="Ciudad">
                <input {...register("city")} style={INPUT_STYLE} />
              </Field>
              <Field label="Estado">
                <input {...register("state")} style={INPUT_STYLE} />
              </Field>
            </div>
          </div>

          <div style={SECTION_STYLE}>
            <h2
              className="text-sm font-semibold mb-3 uppercase tracking-widest"
              style={{ color: "var(--on-surf-var)" }}
            >
              Contacto
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <Field label="Teléfono">
                <input {...register("phone")} style={INPUT_STYLE} placeholder="9981234567" />
              </Field>
              <Field label="Email" error={errors.email?.message}>
                <input {...register("email")} style={INPUT_STYLE} placeholder="contacto@evobike.mx" />
              </Field>
              <Field label="Sitio web">
                <input {...register("website")} style={INPUT_STYLE} placeholder="https://evobike.mx" />
              </Field>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="sello" className="mt-4">
          <div style={SECTION_STYLE}>
            <h2
              className="text-sm font-semibold mb-4 uppercase tracking-widest"
              style={{ color: "var(--on-surf-var)" }}
            >
              Sello de sucursal
            </h2>
            <div className="flex items-start gap-6 flex-wrap">
              <div
                className="relative flex items-center justify-center overflow-hidden"
                style={{
                  width: 220,
                  height: 220,
                  background: "var(--surf-low)",
                  borderRadius: "var(--r-xl)",
                }}
              >
                {sealUrl ? (
                  <Image
                    src={sealUrl}
                    alt="Sello"
                    fill
                    sizes="220px"
                    style={{ objectFit: "contain" }}
                  />
                ) : (
                  <span className="text-xs text-[var(--on-surf-var)]">Sin sello</span>
                )}
              </div>
              <div className="flex-1 min-w-[240px] space-y-3">
                <p className="text-sm text-[var(--on-surf-var)]">
                  PNG, JPEG o WebP. Máximo 2MB. Se redimensiona automáticamente a 800×800.
                  SVG no soportado.
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingSeal}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                    style={{
                      background: "var(--p)",
                      color: "#ffffff",
                      opacity: uploadingSeal ? 0.6 : 1,
                    }}
                  >
                    <Upload className="h-4 w-4" />
                    {sealUrl ? "Reemplazar" : "Subir sello"}
                  </button>
                  {sealUrl && (
                    <button
                      type="button"
                      onClick={onDeleteSeal}
                      disabled={uploadingSeal}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
                      style={{
                        background: "var(--surf-low)",
                        color: "var(--on-surf)",
                      }}
                    >
                      <Trash2 className="h-4 w-4" />
                      Eliminar
                    </button>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) onUploadSeal(file);
                  }}
                />
              </div>
            </div>
          </div>
        </TabsContent>

        <TabsContent value="terminos" className="mt-4 space-y-4">
          <TermsBlock
            title="Términos de cotización"
            name="terminosCotizacion"
            register={register}
            onPreview={() =>
              setPreviewDoc({
                title: "Vista previa — Términos de cotización",
                body: watch("terminosCotizacion"),
              })
            }
          />
          <TermsBlock
            title="Términos de pedido (apartado / backorder)"
            name="terminosPedido"
            register={register}
            onPreview={() =>
              setPreviewDoc({
                title: "Vista previa — Términos de pedido",
                body: watch("terminosPedido"),
              })
            }
          />
          <TermsBlock
            title="Términos de póliza de garantía"
            name="terminosPoliza"
            register={register}
            onPreview={() =>
              setPreviewDoc({
                title: "Vista previa — Términos de póliza",
                body: watch("terminosPoliza"),
              })
            }
          />
        </TabsContent>
      </Tabs>

      <div className="flex items-center justify-end gap-3 sticky bottom-0 py-3">
        <button
          type="submit"
          disabled={saving || !isDirty}
          className="px-5 py-2.5 rounded-xl text-sm font-medium"
          style={{
            background: "var(--p)",
            color: "#ffffff",
            opacity: saving || !isDirty ? 0.5 : 1,
          }}
        >
          {saving ? "Guardando…" : "Guardar cambios"}
        </button>
      </div>

      <Dialog open={previewDoc !== null} onOpenChange={(o) => !o && setPreviewDoc(null)}>
        <DialogContent
          className="p-0 gap-0 overflow-hidden max-w-2xl"
          style={{
            background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "var(--shadow)",
            borderRadius: "var(--r-xl)",
          }}
        >
          <DialogHeader className="px-6 pt-6 pb-2">
            <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
              {previewDoc?.title}
            </DialogTitle>
          </DialogHeader>
          <div
            className="evobike-preview-light mx-6 mb-6 mt-2 rounded-xl p-6 max-h-[60vh] overflow-auto whitespace-pre-wrap text-sm leading-relaxed"
            style={{
              background: "#ffffff",
              color: "#131b2e",
              fontFamily: "var(--font-body, 'Inter')",
            }}
          >
            {previewDoc?.body && previewDoc.body.trim().length > 0
              ? previewDoc.body
              : "(sin contenido)"}
          </div>
        </DialogContent>
      </Dialog>
    </form>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
      {error && (
        <p className="text-xs mt-1" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function TermsBlock({
  title,
  name,
  register,
  onPreview,
}: {
  title: string;
  name: "terminosCotizacion" | "terminosPedido" | "terminosPoliza";
  register: ReturnType<typeof useForm<FormValues>>["register"];
  onPreview: () => void;
}) {
  return (
    <div style={SECTION_STYLE}>
      <div className="flex items-center justify-between mb-3">
        <h2
          className="text-sm font-semibold uppercase tracking-widest"
          style={{ color: "var(--on-surf-var)" }}
        >
          {title}
        </h2>
        <button
          type="button"
          onClick={onPreview}
          className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg"
          style={{ background: "var(--surf-low)", color: "var(--on-surf)" }}
        >
          <Eye className="h-3.5 w-3.5" />
          Vista previa
        </button>
      </div>
      <textarea {...register(name)} style={TEXTAREA_STYLE} />
    </div>
  );
}
