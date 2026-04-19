type SparklineProps = {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  fill?: boolean;
  strokeWidth?: number;
};

export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = "var(--data-1)",
  fill = true,
  strokeWidth = 1.5,
}: SparklineProps) {
  if (data.length < 2) return null;

  const yMin = Math.min(...data);
  const yMax = Math.max(...data);
  const yRange = yMax - yMin || 1;
  const xStep = width / (data.length - 1);

  const toX = (i: number) => i * xStep;
  const toY = (v: number) => height - 2 - ((v - yMin) / yRange) * (height - 4);

  const linePath = data
    .map((v, i) => `${i === 0 ? "M" : "L"}${toX(i)},${toY(v)}`)
    .join(" ");

  const areaPath =
    `${linePath} L${toX(data.length - 1)},${height} L${toX(0)},${height} Z`;

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      style={{ width: "100%", height, display: "block" }}
      preserveAspectRatio="none"
    >
      {fill && (
        <path d={areaPath} fill={color} fillOpacity="0.2" stroke="none" />
      )}
      <path
        d={linePath}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}
