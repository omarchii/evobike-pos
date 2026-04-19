"use client";

import type { CompareMode } from "@/lib/reportes/date-range";
import { useReportFilters } from "./use-report-filters";

const MODES: Array<{ value: CompareMode; label: string }> = [
  { value: "prev-period", label: "Período anterior" },
  { value: "prev-month", label: "Mes anterior" },
  { value: "prev-year", label: "Año anterior" },
];

type CompareToggleProps = {
  paramKey?: string;
  value: CompareMode;
};

export function CompareToggle({ paramKey = "compareMode", value }: CompareToggleProps) {
  const { setFilter } = useReportFilters();

  return (
    <div
      className="flex items-center gap-0.5 rounded-[var(--r-full)] p-0.5"
      style={{ background: "var(--surf-low)" }}
      role="radiogroup"
      aria-label="Modo de comparación"
    >
      {MODES.map((mode) => {
        const isActive = value === mode.value;
        return (
          <button
            key={mode.value}
            role="radio"
            aria-checked={isActive}
            onClick={() => setFilter(paramKey, mode.value)}
            className="rounded-[var(--r-full)] px-3 py-1 text-xs font-medium transition-colors"
            style={{
              background: isActive ? "var(--p-container)" : "transparent",
              color: isActive ? "var(--on-p-container)" : "var(--on-surf-var)",
            }}
          >
            {mode.label}
          </button>
        );
      })}
    </div>
  );
}
