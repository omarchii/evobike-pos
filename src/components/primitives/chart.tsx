"use client";

import * as React from "react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

export {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
};

export type SeriesSpec = {
  key: string;
  label: string;
  color?: string;
};

export function buildChartConfig(series: SeriesSpec[]): ChartConfig {
  return series.reduce<ChartConfig>((acc, spec, i) => {
    acc[spec.key] = {
      label: spec.label,
      color: spec.color ?? `var(--data-${(i % 8) + 1})`,
    };
    return acc;
  }, {});
}

// Recharts tick/line/grid props use SVG attributes, not CSS properties.
// These types are compatible with Recharts' SVG element props.
export const CHART_AXIS_TICK_PROPS = {
  fontFamily: "var(--font-body)",
  fontSize: 12,
  fill: "var(--on-surf-var)",
} as const satisfies Record<string, string | number>;

export const CHART_AXIS_LINE_PROPS = {
  stroke: "var(--ghost-border)",
} as const satisfies Record<string, string | number>;

export const CHART_GRID_PROPS = {
  stroke: "var(--ghost-border)",
  strokeDasharray: "3 3",
} as const satisfies Record<string, string | number>;

function ChartTooltipContentGlass(
  props: React.ComponentProps<typeof ChartTooltipContent>
) {
  return (
    <div
      style={{
        background:
          "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
        backdropFilter: "blur(20px)",
        WebkitBackdropFilter: "blur(20px)",
        border: "1px solid var(--ghost-border)",
        borderRadius: "var(--r-md)",
        boxShadow: "var(--shadow)",
        padding: "0.5rem 0.75rem",
        fontFamily: "var(--font-body)",
      }}
    >
      <ChartTooltipContent {...props} />
    </div>
  );
}

export { ChartTooltipContentGlass };
