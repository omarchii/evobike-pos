import { formatPercent } from "@/lib/format";

const DATA_COLORS = [
  "var(--data-1)", "var(--data-2)", "var(--data-3)", "var(--data-4)",
  "var(--data-5)", "var(--data-6)", "var(--data-7)", "var(--data-8)",
];

type Segment = {
  label: string;
  value: number;
  color?: string;
};

type ProgressSplitProps = {
  segments: Segment[];
  height?: number;
  showLabels?: boolean;
};

export function ProgressSplit({
  segments,
  height = 6,
  showLabels = false,
}: ProgressSplitProps) {
  const total = segments.reduce((s, seg) => s + seg.value, 0) || 1;

  return (
    <div className="flex flex-col gap-[0.4rem] w-full">
      <div
        className="flex overflow-hidden rounded-[var(--r-full)]"
        style={{ height, background: "var(--surf-high)" }}
      >
        {segments.map((seg, i) => {
          const pct = (seg.value / total) * 100;
          const fill = seg.color ?? DATA_COLORS[i % DATA_COLORS.length];
          return (
            <div
              key={i}
              style={{ width: `${pct}%`, background: fill }}
            />
          );
        })}
      </div>
      {showLabels && (
        <div className="flex justify-between gap-2">
          {segments.map((seg, i) => {
            const fill = seg.color ?? DATA_COLORS[i % DATA_COLORS.length];
            return (
              <div key={i} className="flex flex-col gap-px min-w-0">
                <div className="flex items-center gap-1">
                  <span
                    className="shrink-0 rounded-full"
                    style={{ width: 6, height: 6, background: fill }}
                  />
                  <span
                    className="text-[0.625rem] font-medium uppercase tracking-[0.04em] truncate"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    {seg.label}
                  </span>
                </div>
                <span
                  className="text-[0.75rem] font-semibold"
                  style={{ fontVariantNumeric: "tabular-nums" }}
                >
                  {formatPercent(seg.value / total, { decimals: 1 })}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
