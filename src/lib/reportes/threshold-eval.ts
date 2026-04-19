import type { ThresholdComparator } from "@prisma/client";
import { formatMXN, formatNumber, formatPercent } from "@/lib/format";
import type { AlertMetricUnit } from "./alert-metrics";

export type EvaluatedThreshold = {
  crossed: boolean;
  severity: "warn" | "error" | null;
};

export function evaluateThreshold(
  value: number,
  threshold: {
    thresholdValue: number;
    comparator: ThresholdComparator;
    isActive: boolean;
  } | null,
): EvaluatedThreshold {
  if (!threshold || !threshold.isActive) return { crossed: false, severity: null };
  const t = threshold.thresholdValue;
  let crossed = false;
  switch (threshold.comparator) {
    case "LT":  crossed = value <  t; break;
    case "LTE": crossed = value <= t; break;
    case "GT":  crossed = value >  t; break;
    case "GTE": crossed = value >= t; break;
    case "EQ":  crossed = value === t; break;
  }
  return { crossed, severity: crossed ? "error" : null };
}

const COMPARATOR_SYMBOLS: Record<ThresholdComparator, string> = {
  LT:  "<",
  LTE: "≤",
  GT:  ">",
  GTE: "≥",
  EQ:  "=",
};

export function formatThresholdBadgeLabel(
  threshold: { thresholdValue: number; comparator: ThresholdComparator },
  unit: AlertMetricUnit,
): string {
  const sym = COMPARATOR_SYMBOLS[threshold.comparator];
  let formatted: string;
  switch (unit) {
    case "MXN":
      formatted = formatMXN(threshold.thresholdValue);
      break;
    case "PCT":
      formatted = formatPercent(threshold.thresholdValue / 100);
      break;
    case "UNITS":
      formatted = `${formatNumber(threshold.thresholdValue)} uds`;
      break;
    case "DAYS":
      formatted = `${formatNumber(threshold.thresholdValue)} días`;
      break;
  }
  return `${sym} ${formatted}`;
}
