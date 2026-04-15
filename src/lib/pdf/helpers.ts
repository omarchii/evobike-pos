import { Prisma } from "@prisma/client";
import { NumerosALetras } from "numero-a-letras";

const MXN_FORMATTER = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatMXN(value: number | Prisma.Decimal): string {
  const num =
    value instanceof Prisma.Decimal ? value.toNumber() : (value as number);
  return MXN_FORMATTER.format(num);
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export function totalEnLetra(value: number): string {
  const raw: string = NumerosALetras(value);
  if (!raw) return "";
  // Mayúscula inicial, resto en minúsculas.
  // Luego restauramos la abreviatura "M.N." que quedó en minúsculas.
  const lowered = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
  return lowered.replace(/m\.n\.?$/, "M.N.");
}

export function calcIVA(subtotal: number): { iva: number; total: number } {
  const iva = Math.round(subtotal * 0.16 * 100) / 100;
  const total = Math.round((subtotal + iva) * 100) / 100;
  return { iva, total };
}

/**
 * Extrae subtotal e IVA de un precio que ya incluye IVA al 16%.
 * Los precios del catálogo de EvoBike incluyen IVA — el PDF debe
 * mostrar el desglose neto + impuesto.
 */
export function calcSubtotalFromTotal(total: number): {
  subtotal: number;
  iva: number;
} {
  const subtotal = Math.round((total / 1.16) * 100) / 100;
  const iva = Math.round((total - subtotal) * 100) / 100;
  return { subtotal, iva };
}
