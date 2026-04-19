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

// ── Helpers internos ────────────────────────────────────────────────────────

function _startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function _endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function _subDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() - n);
  return r;
}

function _subMonths(d: Date, n: number): Date {
  const r = new Date(d);
  r.setMonth(r.getMonth() - n);
  return r;
}

function _subYears(d: Date, n: number): Date {
  const r = new Date(d);
  r.setFullYear(r.getFullYear() - n);
  return r;
}

function _diffCalendarDays(later: Date, earlier: Date): number {
  const aDay = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const bDay = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((aDay - bDay) / 86400000);
}

// ── Rango comparable ────────────────────────────────────────────────────────

export type CompareMode = "prev-period" | "prev-month" | "prev-year";

/**
 * Dado un rango, calcula el rango comparable anterior según el modo.
 * - prev-period (default): mismo largo de días inmediatamente previos.
 *   1-15 abril → 17-31 marzo.
 * - prev-month: mismo rango calendario del mes previo.
 *   1-15 abril → 1-15 marzo.
 * - prev-year: mismo rango calendario del año previo (YoY).
 *   1-15 abril 2026 → 1-15 abril 2025.
 *
 * Respeta timezone America/Merida. Normaliza a startOfDay/endOfDay.
 */
export function previousComparableRange(
  range: { from: Date; to: Date },
  mode: CompareMode = "prev-period",
): { from: Date; to: Date } {
  const from = _startOfDay(range.from);
  const to = _endOfDay(range.to);

  switch (mode) {
    case "prev-period": {
      const days = _diffCalendarDays(to, from) + 1;
      const prevTo = _endOfDay(_subDays(from, 1));
      const prevFrom = _startOfDay(_subDays(prevTo, days - 1));
      return { from: prevFrom, to: prevTo };
    }
    case "prev-month":
      return {
        from: _startOfDay(_subMonths(from, 1)),
        to: _endOfDay(_subMonths(to, 1)),
      };
    case "prev-year":
      return {
        from: _startOfDay(_subYears(from, 1)),
        to: _endOfDay(_subYears(to, 1)),
      };
  }
}

export function parseCompareMode(raw: string | null | undefined): CompareMode {
  if (raw === "prev-month" || raw === "prev-year") return raw;
  return "prev-period";
}

// ── toDateString ─────────────────────────────────────────────────────────────

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
