"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContentGlass,
  ChartLegend,
  ChartLegendContent,
  buildChartConfig,
  CHART_AXIS_TICK_PROPS,
  CHART_GRID_PROPS,
} from "@/components/primitives/chart";
import { formatNumber } from "@/lib/format";
import type { SalesChartRow } from "./queries";

const chartConfig = buildChartConfig([
  { key: "contado", label: "Contado" },
  { key: "credito", label: "Crédito" },
  { key: "apartado", label: "Apartado" },
]);

function formatDay(dateStr: string): string {
  const [, month, day] = dateStr.split("-");
  const months = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"];
  return `${parseInt(day)} ${months[parseInt(month) - 1]}`;
}

type SalesChartProps = {
  data: SalesChartRow[];
};

export function SalesChart({ data }: SalesChartProps) {
  if (data.length === 0) {
    return (
      <div
        className="flex h-80 items-center justify-center rounded-[var(--r-lg)]"
        style={{ background: "var(--surf-lowest)" }}
      >
        <p className="text-sm" style={{ color: "var(--on-surf-var)" }}>
          Sin datos para el período seleccionado
        </p>
      </div>
    );
  }

  const formattedData = data.map((row) => ({
    ...row,
    fecha: formatDay(row.fecha),
  }));

  return (
    <div
      className="rounded-[var(--r-lg)] p-5"
      style={{ background: "var(--surf-lowest)" }}
    >
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3
            className="text-[0.9375rem] font-semibold tracking-[-0.01em]"
            style={{ color: "var(--on-surf)" }}
          >
            Evolución diaria
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: "var(--on-surf-var)" }}>
            Ingresos por método de pago
          </p>
        </div>
      </div>

      <ChartContainer config={chartConfig} className="h-80 w-full">
        <BarChart data={formattedData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
          <CartesianGrid
            stroke={CHART_GRID_PROPS.stroke}
            strokeDasharray={CHART_GRID_PROPS.strokeDasharray}
            vertical={false}
          />
          <XAxis
            dataKey="fecha"
            tick={CHART_AXIS_TICK_PROPS}
            axisLine={false}
            tickLine={false}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={CHART_AXIS_TICK_PROPS}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => formatNumber(v, { compact: true })}
            width={56}
          />
          <ChartTooltip
            content={<ChartTooltipContentGlass />}
            cursor={{ fill: "var(--surf-high)", fillOpacity: 0.5 }}
          />
          <ChartLegend content={<ChartLegendContent />} />
          <Bar
            dataKey="contado"
            fill="var(--color-contado)"
            stackId="a"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="credito"
            fill="var(--color-credito)"
            stackId="a"
            radius={[0, 0, 0, 0]}
          />
          <Bar
            dataKey="apartado"
            fill="var(--color-apartado)"
            stackId="a"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ChartContainer>
    </div>
  );
}
