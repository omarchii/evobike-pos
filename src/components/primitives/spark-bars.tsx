type SparkBarsProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  highlightLast?: boolean;
  gap?: number;
};

export function SparkBars({
  data,
  width = 120,
  height = 32,
  color = "var(--data-1)",
  highlightLast = false,
  gap = 2,
}: SparkBarsProps) {
  if (data.length === 0) return null;

  const n = data.length;
  const yMax = Math.max(...data) || 1;
  const barWidth = (width - gap * (n - 1)) / n;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height, display: "block" }}
      preserveAspectRatio="none"
    >
      {data.map((v, i) => {
        const h = (v / yMax) * height;
        const x = i * (barWidth + gap);
        const isLast = i === n - 1;
        const fill = highlightLast && isLast ? "var(--p-bright)" : color;
        return (
          <rect
            key={i}
            x={x}
            y={height - h}
            width={barWidth}
            height={h}
            fill={fill}
            rx="1"
          />
        );
      })}
    </svg>
  );
}
