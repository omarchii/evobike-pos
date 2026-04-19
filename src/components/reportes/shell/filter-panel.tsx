"use client";

import * as React from "react";
import type { IconName } from "@/components/primitives/icon";
import { FilterChip } from "./filter-chip";
import { useReportFilters } from "./use-report-filters";

export type FilterSpec = {
  key: string;
  label: string;
  kind: "single-select" | "multi-select" | "text";
  options?: Array<{ value: string; label: string }>;
  icon?: IconName;
};

type FilterPanelProps = {
  specs: FilterSpec[];
};

export function FilterPanel({ specs }: FilterPanelProps) {
  const { sp, setFilter } = useReportFilters();

  return (
    <div className="flex flex-wrap items-center gap-2">
      {specs.map((spec) => {
        const currentValue = sp.get(spec.key) ?? "";
        const displayLabel =
          spec.kind === "single-select" && currentValue
            ? spec.options?.find((o) => o.value === currentValue)?.label ?? currentValue
            : currentValue || undefined;

        return (
          <FilterChip
            key={spec.key}
            label={spec.label}
            value={displayLabel}
            icon={spec.icon}
            onClear={currentValue ? () => setFilter(spec.key, null) : undefined}
          >
            {spec.kind === "single-select" && spec.options && (
              <div className="flex flex-col gap-1">
                <button
                  onClick={() => setFilter(spec.key, null)}
                  className="rounded-[var(--r-sm)] px-2 py-1 text-left text-xs hover:bg-[var(--surf-high)]"
                  style={{
                    color: !currentValue ? "var(--p)" : "var(--on-surf-var)",
                    fontWeight: !currentValue ? 600 : 400,
                  }}
                >
                  Todos
                </button>
                {spec.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => setFilter(spec.key, opt.value)}
                    className="rounded-[var(--r-sm)] px-2 py-1 text-left text-xs hover:bg-[var(--surf-high)]"
                    style={{
                      color: currentValue === opt.value ? "var(--p)" : "var(--on-surf)",
                      fontWeight: currentValue === opt.value ? 600 : 400,
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}

            {spec.kind === "text" && (
              <input
                type="text"
                defaultValue={currentValue}
                placeholder={`Buscar ${spec.label.toLowerCase()}…`}
                className="w-full rounded-[var(--r-sm)] bg-[var(--surf-low)] px-2 py-1 text-xs text-[var(--on-surf)] outline-none"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    setFilter(spec.key, e.currentTarget.value || null);
                  }
                }}
              />
            )}
          </FilterChip>
        );
      })}
    </div>
  );
}
