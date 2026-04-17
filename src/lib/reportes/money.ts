/**
 * Helpers de serialización y formato monetario para reportes.
 */

/**
 * Convierte un `Prisma.Decimal` (o cualquier valor con `.toNumber()`) a `number`.
 * Retorna 0 si el valor es nulo o indefinido.
 *
 * No usar JSON.stringify/JSON.parse para serializar Decimals:
 * los valores se pierden silenciosamente.
 */
export function serializeDecimal(
  d: { toNumber(): number } | null | undefined,
): number {
  if (d == null) return 0;
  return d.toNumber();
}

/**
 * Formatea un número como moneda MXN.
 * Ejemplo: 1500.5 → "$1,500.50"
 */
export function formatMXN(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
}
