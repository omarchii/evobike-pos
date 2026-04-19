"use client";

import * as React from "react";
import { Icon } from "@/components/primitives/icon";
import { useReportFilters } from "./use-report-filters";
import { toDateString } from "@/lib/reportes/date-range";

const PRESETS = [
  { label: "Hoy", days: 0 },
  { label: "Últimos 7 días", days: 7 },
  { label: "Últimos 30 días", days: 30 },
  { label: "Este mes", days: -1 },
  { label: "Últimos 90 días", days: 90 },
] as const;

function getPresetRange(days: number): { from: string; to: string } {
  const now = new Date();
  const to = toDateString(now);
  if (days === 0) {
    return { from: to, to };
  }
  if (days === -1) {
    const from = toDateString(new Date(now.getFullYear(), now.getMonth(), 1));
    return { from, to };
  }
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - days + 1);
  return { from: toDateString(fromDate), to };
}

type DateRangeChipProps = {
  fromValue: string;
  toValue: string;
};

export function DateRangeChip({ fromValue, toValue }: DateRangeChipProps) {
  const { setFilters } = useReportFilters();
  const [open, setOpen] = React.useState(false);
  const [customFrom, setCustomFrom] = React.useState(fromValue);
  const [customTo, setCustomTo] = React.useState(toValue);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  React.useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  function applyPreset(days: number) {
    const range = getPresetRange(days);
    setFilters({ from: range.from, to: range.to });
    setOpen(false);
  }

  function applyCustom() {
    if (customFrom && customTo && customFrom <= customTo) {
      setFilters({ from: customFrom, to: customTo });
      setOpen(false);
    }
  }

  const displayLabel = fromValue === toValue
    ? fromValue
    : `${fromValue} – ${toValue}`;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 items-center gap-1.5 rounded-[var(--r-full)] px-3 text-xs font-medium transition-colors"
        style={{
          background: "var(--p-container)",
          color: "var(--on-p-container)",
          outline: open ? "2px solid var(--p-bright)" : "none",
          outlineOffset: 1,
        }}
      >
        <Icon name="calendar" size={12} />
        <span>{displayLabel}</span>
        <Icon name="chevronDown" size={12} />
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            width: 280,
            background: "var(--surf-lowest)",
            border: "1px solid var(--ghost-border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow)",
            padding: "1rem",
          }}
        >
          <p
            className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--on-surf-var)" }}
          >
            Presets
          </p>
          <div className="mb-3 flex flex-col gap-0.5">
            {PRESETS.map((preset) => (
              <button
                key={preset.label}
                onClick={() => applyPreset(preset.days)}
                className="rounded-[var(--r-sm)] px-2 py-1.5 text-left text-xs hover:bg-[var(--surf-high)]"
                style={{ color: "var(--on-surf)" }}
              >
                {preset.label}
              </button>
            ))}
          </div>

          <p
            className="mb-2 text-[0.6875rem] font-medium uppercase tracking-[0.05em]"
            style={{ color: "var(--on-surf-var)" }}
          >
            Personalizado
          </p>
          <div className="flex flex-col gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[0.6875rem]" style={{ color: "var(--on-surf-var)" }}>
                Desde
              </label>
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="rounded-[var(--r-sm)] bg-[var(--surf-low)] px-2 py-1 text-xs text-[var(--on-surf)] outline-none"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[0.6875rem]" style={{ color: "var(--on-surf-var)" }}>
                Hasta
              </label>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="rounded-[var(--r-sm)] bg-[var(--surf-low)] px-2 py-1 text-xs text-[var(--on-surf)] outline-none"
              />
            </div>
            <button
              onClick={applyCustom}
              disabled={!customFrom || !customTo || customFrom > customTo}
              className="mt-1 rounded-[var(--r-full)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
              style={{ background: "linear-gradient(135deg, var(--p), var(--p-bright))" }}
            >
              Aplicar rango
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
