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
