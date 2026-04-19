"use client";

import { Chip } from "@/components/primitives/chip";
import { evaluateThreshold, formatThresholdBadgeLabel } from "@/lib/reportes/threshold-eval";
import { ALERT_METRICS } from "@/lib/reportes/alert-metrics";
import type { AlertMetricKey } from "@/lib/reportes/alert-metrics";
import { useThresholdForMetric } from "./thresholds-context";

type ThresholdBadgeProps = {
  metricKey: AlertMetricKey;
  branchId: string | null;
  value: number;
};

export function ThresholdBadge({ metricKey, branchId, value }: ThresholdBadgeProps) {
  const threshold = useThresholdForMetric(metricKey, branchId);
  if (!threshold) return null;

  const evaluated = evaluateThreshold(value, threshold);
  if (!evaluated.crossed) return null;

  const meta = ALERT_METRICS[metricKey];
  const label = `Bajo umbral: ${formatThresholdBadgeLabel(threshold, meta.unit)}`;
  return <Chip variant="error" label={label} icon="alert" />;
}
