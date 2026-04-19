"use client";

import * as React from "react";
import { Icon } from "@/components/primitives/icon";
import type { IconName } from "@/components/primitives/icon";

type FilterChipProps = {
  label: string;
  value?: string | null;
  icon?: IconName;
  children: React.ReactNode;
  onClear?: () => void;
};

export function FilterChip({
  label,
  value,
  icon,
  children,
  onClear,
}: FilterChipProps) {
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const hasValue = value !== null && value !== undefined && value !== "";

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  React.useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    if (open) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="flex h-8 items-center gap-1.5 rounded-[var(--r-full)] px-3 text-xs font-medium transition-colors"
        style={{
          background: hasValue
            ? "var(--p-container)"
            : "var(--surf-high)",
          color: hasValue ? "var(--on-p-container)" : "var(--on-surf)",
          outline: open ? "2px solid var(--p-bright)" : "none",
          outlineOffset: 1,
        }}
      >
        {icon && <Icon name={icon} size={12} />}
        <span>{hasValue ? `${label}: ${value}` : label}</span>
        <Icon name="chevronDown" size={12} />
        {hasValue && onClear && (
          <span
            role="button"
            tabIndex={0}
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.stopPropagation();
                onClear();
              }
            }}
            className="ml-0.5 flex items-center rounded-full hover:opacity-70"
            aria-label={`Limpiar filtro ${label}`}
          >
            <Icon name="close" size={11} />
          </span>
        )}
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            zIndex: 50,
            minWidth: 240,
            background: "var(--surf-lowest)",
            border: "1px solid var(--ghost-border)",
            borderRadius: "var(--r-md)",
            boxShadow: "var(--shadow)",
            padding: "1rem",
          }}
          role="dialog"
          aria-label={`Filtro ${label}`}
        >
          {children}
          <div className="mt-3 flex justify-end">
            <button
              onClick={() => setOpen(false)}
              className="rounded-[var(--r-full)] bg-[var(--surf-high)] px-3 py-1 text-xs font-medium text-[var(--on-surf)] hover:bg-[var(--surf-highest)]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
