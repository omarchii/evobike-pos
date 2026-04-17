/**
 * Helpers de rango de fechas para reportes (P10).
 * Consistente con `getDefaultMonthRange` de `src/lib/tesoreria.ts`.
 */

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Rango por defecto: primer día del mes en curso → ahora.
 */
export function getDefaultDateRange(now: Date = new Date()): DateRange {
  const from = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  return { from, to: now };
}

/**
 * Parsea un string `YYYY-MM-DD` como fecha local (no UTC).
 *
 * `new Date("YYYY-MM-DD")` interpreta el string como UTC medianoche, lo que
 * desplaza el rango en zonas con offset negativo (ej. America/Merida UTC-6
 * convertiría `2026-04-01` en `2026-03-31 18:00` local). Construir la fecha
 * desde partes locales evita ese corrimiento.
 */
export function parseLocalDate(iso: string, endOfDay: boolean): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const d = endOfDay
    ? new Date(year, month, day, 23, 59, 59, 999)
    : new Date(year, month, day, 0, 0, 0, 0);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Parsea `from` y `to` desde los searchParams de la URL.
 * Si alguno no es una fecha válida, usa el default.
 *
 * Los strings `YYYY-MM-DD` se interpretan como fecha local (00:00 para `from`,
 * 23:59:59.999 para `to`). Cualquier otro formato cae al parser nativo.
 */
function parseFallback(iso: string, endOfDay: boolean): Date | null {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  if (endOfDay) d.setHours(23, 59, 59, 999);
  return d;
}

export function parseDateRange(params: {
  from?: string;
  to?: string;
}): DateRange {
  const defaults = getDefaultDateRange();

  const fromParsed = params.from
    ? (parseLocalDate(params.from, false) ?? parseFallback(params.from, false))
    : null;

  const toParsed = params.to
    ? (parseLocalDate(params.to, true) ?? parseFallback(params.to, true))
    : null;

  return {
    from: fromParsed ?? defaults.from,
    to: toParsed ?? defaults.to,
  };
}

/**
 * Convierte una `Date` a string "YYYY-MM-DD" en zona local.
 *
 * No usar `toISOString().slice(0, 10)`: convierte a UTC, lo que desplaza la
 * fecha un día en zonas con offset negativo al pasar la medianoche local.
 */
export function toDateString(d: Date): string {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}
