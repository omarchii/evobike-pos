import { QuotationStatus } from "@prisma/client";

export type EffectiveStatus = QuotationStatus | "EXPIRED";

// Q.8/Q.10/Q.11 mod4 — state machine helpers (plan v2.2 sesión 4).
// Fuente de verdad: project_mod4_cotizaciones_plan.md state machine.

/** Estados desde los que se puede convertir a venta vía Q.12 (POS handoff). */
export const CONVERTIBLE_STATUSES: QuotationStatus[] = [
  "DRAFT",
  "EN_ESPERA_CLIENTE",
  "EN_ESPERA_FABRICA",
  "ACEPTADA",
  "PAGADA",
];

export function canBeConverted(q: { status: QuotationStatus }): boolean {
  return CONVERTIBLE_STATUSES.includes(q.status);
}

/**
 * Estados desde los que se puede cancelar/rechazar manualmente.
 * PAGADA NO cancelable v1 (terminal hasta convert; ADMIN void manual escala JIT).
 * EXPIRED no se cancela: el cron ya lo marcó como terminal por inactividad.
 */
export const CANCELLABLE_STATUSES: QuotationStatus[] = [
  "DRAFT",
  "EN_ESPERA_CLIENTE",
  "EN_ESPERA_FABRICA",
  "ACEPTADA",
];

export function canBeCancelled(q: { status: QuotationStatus }): boolean {
  return CANCELLABLE_STATUSES.includes(q.status);
}

/**
 * Estados desde los que el portal público acepta el CTA "Aceptar cotización".
 * ACEPTADA, PAGADA, FINALIZADA, RECHAZADA, EXPIRED → no se vuelve a aceptar.
 */
export const PORTAL_ACCEPTABLE_STATUSES: QuotationStatus[] = [
  "DRAFT",
  "EN_ESPERA_CLIENTE",
  "EN_ESPERA_FABRICA",
];

/**
 * Determina el estado efectivo de una cotización en tiempo real.
 * Si el campo status es DRAFT o EN_ESPERA_CLIENTE pero validUntil ya pasó,
 * devuelve "EXPIRED" aunque el campo en DB no se haya actualizado.
 * EN_ESPERA_FABRICA, ACEPTADA, PAGADA, FINALIZADA y RECHAZADA no expiran
 * (ya hay compromiso del cliente o son estados terminales).
 * Fuente de verdad: spec 7.4.
 */
export function getEffectiveStatus(quotation: {
  status: QuotationStatus;
  validUntil: Date | string;
}): EffectiveStatus {
  const validUntil =
    quotation.validUntil instanceof Date
      ? quotation.validUntil
      : new Date(quotation.validUntil);

  if (
    (quotation.status === "DRAFT" || quotation.status === "EN_ESPERA_CLIENTE") &&
    validUntil < new Date()
  ) {
    return "EXPIRED";
  }
  return quotation.status;
}

/**
 * Retorna los días restantes de vigencia (puede ser negativo si ya expiró).
 */
export function getDaysRemaining(validUntil: Date | string): number {
  const until =
    validUntil instanceof Date ? validUntil : new Date(validUntil);
  const now = new Date();
  const diff = until.getTime() - now.getTime();
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

// formatMXN ya no vive aquí — la app interna usa `formatMXN(v, { decimals: 2 })` de
// `@/lib/format`. Comprobantes financieros (portal público, PDFs) definen un
// helper local con `minimumFractionDigits: 2` y comentario in-file (decisión
// "Opción C", ver feedback_financial_formatters).

export function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

/**
 * Desglosa un total que ya incluye IVA al 16% en {subtotal, iva, total}.
 * Cliente confirmó (A.1bis 2026-05-03) que los precios del catálogo
 * incluyen IVA — el desglose es informativo, no se suma 16% extra.
 * Redondeo half-up al centavo (estándar SAT México).
 *
 * Nota: `lib/pdf/helpers.ts` tiene `calcSubtotalFromTotal` con la misma
 * matemática para los PDFs; este helper expone la versión UI con `total`
 * incluido en el retorno para callsites que lo necesitan.
 */
export function desglosarIVA(totalConIVA: number): {
  subtotal: number;
  iva: number;
  total: number;
} {
  const subtotal = Math.round((totalConIVA / 1.16) * 100) / 100;
  const iva = Math.round((totalConIVA - subtotal) * 100) / 100;
  return { subtotal, iva, total: totalConIVA };
}
