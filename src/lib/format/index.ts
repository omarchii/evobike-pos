export { formatRelative } from "@/lib/format-relative";

export function formatMXN(value: number, opts?: { compact?: boolean }): string {
  if (opts?.compact) {
    return new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      notation: "compact",
      maximumFractionDigits: 1,
    }).format(value);
  }
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatNumber(
  value: number,
  opts?: { decimals?: number; compact?: boolean }
): string {
  if (value == null) return "—";
  const decimals = opts?.decimals ?? 0;
  return new Intl.NumberFormat("es-MX", {
    notation: opts?.compact ? "compact" : "standard",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(
  value: number,
  opts?: { decimals?: number; sign?: boolean }
): string {
  const decimals = opts?.decimals ?? 1;
  return new Intl.NumberFormat("es-MX", {
    style: "percent",
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
    signDisplay: opts?.sign ? "exceptZero" : "auto",
  }).format(value);
}

export function formatDate(
  value: Date | string,
  style: "short" | "medium" | "long" = "short"
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const optsByStyle: Record<"short" | "medium" | "long", Intl.DateTimeFormatOptions> = {
    short: { day: "numeric", month: "short", timeZone: "America/Merida" },
    medium: { day: "numeric", month: "long", year: "numeric", timeZone: "America/Merida" },
    long: { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "America/Merida" },
  };
  return new Intl.DateTimeFormat("es-MX", optsByStyle[style]).format(date);
}

export function formatDateRange(from: Date | string, to: Date | string): string {
  return `${formatDate(from, "short")} – ${formatDate(to, "short")}`;
}
