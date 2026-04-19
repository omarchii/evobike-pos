"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";
import { useDensity } from "./density-context";
import type { DensityLevel } from "@/lib/user/ui-preferences";
import { DENSITY_LEVELS } from "@/lib/user/ui-preferences";

const DENSITY_LABELS: Record<DensityLevel, string> = {
  compact: "Compacta",
  normal: "Normal",
  comfortable: "Cómoda",
};

const DENSITY_PREVIEW_HEIGHTS: Record<DensityLevel, number> = {
  compact: 20,
  normal: 28,
  comfortable: 38,
};

export type TweaksPanelProps = {
  open: boolean;
  onClose: () => void;
};

export function TweaksPanel({ open, onClose }: TweaksPanelProps) {
  const router = useRouter();
  const currentDensity = useDensity();
  const [saving, setSaving] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  async function handleSelect(level: DensityLevel) {
    if (level === currentDensity || saving) return;
    setSaving(true);
    try {
      const res = await fetch("/api/user/ui-preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ preferences: { density: level } }),
      });
      if (!res.ok) {
        toast.error("No se pudo guardar la preferencia");
        return;
      }
      router.refresh();
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className="fixed right-0 top-0 z-50 flex h-full w-[420px] flex-col"
        style={{
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderLeft:
            "1px solid var(--border-subtle, color-mix(in srgb, var(--on-surf) 12%, transparent))",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Ajustes visuales"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--on-surf)_10%,transparent)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Icon name="sliders" size={16} />
            <span className="text-sm font-semibold text-[var(--on-surf)]">
              Ajustes visuales
            </span>
          </div>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-full transition-colors hover:bg-[var(--surf-high)]"
            aria-label="Cerrar"
          >
            <Icon name="close" size={14} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Densidad */}
          <div>
            <p className="mb-1 text-[0.6875rem] font-medium uppercase tracking-wide text-[var(--on-surf-var)]">
              Densidad
            </p>
            <p className="mb-3 text-xs text-[var(--on-surf-var)]">
              Ajusta cuánto espacio usan las tablas y tarjetas.
            </p>

            {/* Segment group */}
            <div
              className="flex rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--on-surf)_12%,transparent)] overflow-hidden"
              role="group"
              aria-label="Nivel de densidad"
            >
              {DENSITY_LEVELS.map((level, i) => {
                const isActive = level === currentDensity;
                return (
                  <button
                    key={level}
                    onClick={() => handleSelect(level)}
                    disabled={saving}
                    aria-pressed={isActive}
                    className={[
                      "flex-1 py-2 text-xs font-medium transition-colors disabled:opacity-50",
                      i > 0
                        ? "border-l border-[color-mix(in_srgb,var(--on-surf)_12%,transparent)]"
                        : "",
                      isActive
                        ? "text-[var(--on-p)]"
                        : "text-[var(--on-surf-var)] hover:bg-[var(--surf-low)] hover:text-[var(--on-surf)]",
                    ].join(" ")}
                    style={
                      isActive
                        ? { background: "var(--p)" }
                        : {}
                    }
                  >
                    {DENSITY_LABELS[level]}
                  </button>
                );
              })}
            </div>

            {/* Preview visual */}
            <div className="mt-3 rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--on-surf)_10%,transparent)] overflow-hidden">
              {DENSITY_LEVELS.map((level) => {
                const isActive = level === currentDensity;
                const h = DENSITY_PREVIEW_HEIGHTS[level];
                return (
                  <div
                    key={level}
                    className="flex items-center gap-3 px-3 border-b border-[color-mix(in_srgb,var(--on-surf)_6%,transparent)] last:border-b-0 transition-opacity"
                    style={{
                      height: h,
                      background: isActive ? "var(--surf-low)" : "transparent",
                      opacity: isActive ? 1 : 0.35,
                    }}
                  >
                    <span
                      className="h-1.5 rounded-full shrink-0"
                      style={{
                        width: 32,
                        background: "var(--on-surf-var)",
                        opacity: 0.4,
                      }}
                    />
                    <span
                      className="h-1.5 rounded-full flex-1"
                      style={{ background: "var(--on-surf-var)", opacity: 0.2 }}
                    />
                    <span
                      className="text-[0.5625rem] font-medium shrink-0"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {DENSITY_LABELS[level]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Nota */}
          <p className="text-[0.6875rem] text-[var(--on-surf-var)] italic">
            Más opciones de personalización próximamente.
          </p>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end border-t border-[color-mix(in_srgb,var(--on-surf)_10%,transparent)] px-5 py-4">
          <button
            onClick={onClose}
            className="rounded-[var(--r-full)] px-4 py-2 text-sm font-medium text-[var(--on-surf)] transition-colors hover:bg-[var(--surf-high)]"
          >
            Cerrar
          </button>
        </div>
      </div>
    </>
  );
}
