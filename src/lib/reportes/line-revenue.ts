import type { Decimal } from "@prisma/client/runtime/library";
import { IVA_RATE } from "@/lib/reportes/money";

export type LineRevenueInput = {
  discount: Decimal;
  items: Array<{
    id: string;
    price: Decimal;
    quantity: number;
    discount: Decimal;
  }>;
};

export type LineRevenue = {
  revenueConIva: number;
  revenueNeto: number;
  descuentoProrrateado: number;
};

/**
 * Calcula el revenue efectivo por línea de venta, prorateando el descuento
 * global de cabecera (Sale.discount) en proporción al peso de cada línea.
 *
 * revenueNeto = revenueConIva / (1 + IVA_RATE)  → sin IVA, para margen.
 */
export function computeLineRevenues(
  sale: LineRevenueInput,
): Map<string, LineRevenue> {
  const result = new Map<string, LineRevenue>();
  const saleDiscount = Number(sale.discount);

  // Ingreso bruto por línea (precio × qty − descuento de línea)
  const brutosById = new Map<string, number>();
  let totalBruto = 0;
  for (const item of sale.items) {
    const bruto = Number(item.price) * item.quantity - Number(item.discount);
    brutosById.set(item.id, bruto);
    totalBruto += bruto;
  }

  for (const item of sale.items) {
    const bruto = brutosById.get(item.id) ?? 0;
    const descuentoProrrateado =
      totalBruto > 0 ? saleDiscount * (bruto / totalBruto) : 0;
    const revenueConIva = bruto - descuentoProrrateado;
    const revenueNeto = revenueConIva / (1 + IVA_RATE);
    result.set(item.id, { revenueConIva, revenueNeto, descuentoProrrateado });
  }

  return result;
}
