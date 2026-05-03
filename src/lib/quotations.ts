import { QuotationStatus } from "@prisma/client";

export type EffectiveStatus = QuotationStatus | "EXPIRED";

/**
 * Determina el estado efectivo de una cotización en tiempo real.
 * Si el campo status es DRAFT o EN_ESPERA_CLIENTE pero validUntil ya pasó,
 * devuelve "EXPIRED" aunque el campo en DB no se haya actualizado.
 * EN_ESPERA_FABRICA, PAGADA, FINALIZADA y RECHAZADA no expiran
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
