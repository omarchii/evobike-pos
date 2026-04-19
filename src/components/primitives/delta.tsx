import { Icon } from "@/components/primitives/icon";
import { formatPercent, formatMXN, formatNumber } from "@/lib/format";

type DeltaProps = {
  value: number;
  format?: "percent" | "currency" | "number";
  showIcon?: boolean;
};

function formatDeltaValue(value: number, format: "percent" | "currency" | "number"): string {
  const sign = value > 0 ? "+" : "";
  switch (format) {
    case "percent":
      return formatPercent(value, { decimals: 1, sign: true });
    case "currency":
      return `${sign}${formatMXN(value)}`;
    case "number":
      return `${sign}${formatNumber(value)}`;
  }
}

export function Delta({ value, format = "percent", showIcon = true }: DeltaProps) {
  const isPositive = value > 0;
  const isNegative = value < 0;

  const color = isPositive
    ? "var(--p-bright)"
    : isNegative
    ? "var(--ter)"
    : "var(--on-surf-var)";

  return (
    <span
      className="inline-flex items-center gap-[0.2rem] text-[0.75rem] font-semibold"
      style={{ color, fontVariantNumeric: "tabular-nums" }}
    >
      {showIcon && (
        <Icon
          name={isPositive ? "arrowUp" : isNegative ? "arrowDown" : "minus"}
          size={12}
          strokeWidth={2.25}
        />
      )}
      {formatDeltaValue(value, format)}
    </span>
  );
}
