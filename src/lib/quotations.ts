import { QuotationStatus } from "@prisma/client";

export type EffectiveStatus = QuotationStatus | "EXPIRED";

/**
 * Determina el estado efectivo de una cotización en tiempo real.
 * Si el campo status es DRAFT o SENT pero validUntil ya pasó,
 * devuelve "EXPIRED" aunque el campo en DB no se haya actualizado.
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
    (quotation.status === "DRAFT" || quotation.status === "SENT") &&
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

export function formatMXN(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

export function formatDate(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date);
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}
