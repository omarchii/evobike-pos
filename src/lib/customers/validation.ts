// Validación compartida entre endpoints de Customer y quick-create POS.
// BRIEF.md §4.4. Fuente única de reglas — Sub-fase L consume `customerQuickCreateSchema`.

import { z } from "zod";
import { normalizePhoneMX } from "./phone";

// Cualquier empty-string se coerce a null (form envia "").
const optionalString = () =>
  z.preprocess((v) => (typeof v === "string" && v.trim() === "" ? null : v), z.string().trim().nullable().optional());

const optionalEmail = () =>
  z.preprocess(
    (v) => (typeof v === "string" && v.trim() === "" ? null : v),
    z.string().trim().email("Correo inválido").nullable().optional(),
  );

// RFC: trim + upper + regex. Permite nulos/empty.
const rfcField = z.preprocess(
  (v) => {
    if (v == null) return null;
    if (typeof v !== "string") return v;
    const trimmed = v.trim().toUpperCase();
    return trimmed === "" ? null : trimmed;
  },
  z
    .string()
    .regex(
      /^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/,
      "RFC inválido (formato esperado: 3-4 letras + 6 dígitos + 3 alfanuméricos)",
    )
    .nullable()
    .optional(),
);

// Phone: normaliza a 10 dígitos MX. Emite error si `input` vino no-vacío
// pero no se pudo normalizar (evita que un teléfono inválido se guarde
// como null silenciosamente).
const phoneField = z.preprocess((v) => {
  if (v == null) return null;
  if (typeof v !== "string") return v;
  if (v.trim() === "") return null;
  const norm = normalizePhoneMX(v);
  if (norm) return norm;
  // Devuelve el valor original para que el regex falle con mensaje claro.
  return v;
}, z.string().regex(/^\d{10}$/, "El teléfono debe tener 10 dígitos").nullable().optional());

const tagsField = z.array(z.string().trim().min(1)).default([]);

export const customerCreateSchema = z.object({
  name: z.string().trim().min(1, "El nombre es obligatorio"),
  phone: phoneField,
  phone2: phoneField,
  email: optionalEmail(),

  birthday: z.preprocess(
    (v) => {
      if (v == null || v === "") return null;
      if (v instanceof Date) return v;
      if (typeof v === "string") {
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? v : d;
      }
      return v;
    },
    z.date().nullable().optional(),
  ),
  isBusiness: z.boolean().default(false),
  communicationConsent: z.boolean().default(false),
  tags: tagsField.optional(),

  curp: z.preprocess(
    (v) => {
      if (v == null) return null;
      if (typeof v !== "string") return v;
      const trimmed = v.trim().toUpperCase();
      return trimmed === "" ? null : trimmed;
    },
    z
      .string()
      .regex(
        /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/,
        "CURP inválida (18 caracteres alfanuméricos)",
      )
      .nullable()
      .optional(),
  ),

  shippingStreet: optionalString(),
  shippingExtNum: optionalString(),
  shippingIntNum: optionalString(),
  shippingColonia: optionalString(),
  shippingCity: optionalString(),
  shippingState: optionalString(),
  shippingZip: optionalString(),
  shippingRefs: optionalString(),

  rfc: rfcField,
  razonSocial: optionalString(),
  regimenFiscal: optionalString(),
  usoCFDI: optionalString(),
  emailFiscal: optionalEmail(),
  fiscalStreet: optionalString(),
  fiscalExtNum: optionalString(),
  fiscalIntNum: optionalString(),
  fiscalColonia: optionalString(),
  fiscalCity: optionalString(),
  fiscalState: optionalString(),
  fiscalZip: optionalString(),
  // Legacy (solo lectura; nuevas capturas usan los 7 campos desglosados).
  direccionFiscal: optionalString(),
});

export type CustomerCreateInput = z.infer<typeof customerCreateSchema>;

// Quick-create (Sub-fase L). Mínimo viable: nombre + teléfono + consent.
export const customerQuickCreateSchema = customerCreateSchema.pick({
  name: true,
  phone: true,
  communicationConsent: true,
});

export type CustomerQuickCreateInput = z.infer<typeof customerQuickCreateSchema>;

// Update permite parciales; el endpoint PUT controla qué campos puede tocar cada rol.
export const customerUpdateSchema = customerCreateSchema.partial();
export type CustomerUpdateInput = z.infer<typeof customerUpdateSchema>;

// Subset de campos considerados "sensibles" — disparan confirmación + audit log
// (BRIEF §7.3 guardrails).
export const CUSTOMER_SENSITIVE_FIELDS = [
  "rfc",
  "razonSocial",
  "regimenFiscal",
  "creditLimit",
] as const;

export type CustomerSensitiveField = (typeof CUSTOMER_SENSITIVE_FIELDS)[number];
