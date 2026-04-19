"use client";

import { Icon } from "@/components/primitives/icon";
import { toast } from "sonner";

export type DetailHeaderProps = {
  title: string;
  subtitle?: string;
  onExport?: () => void;
  onSaveView?: () => void;
  onOpenThresholds?: () => void;
};

export function DetailHeader({
  title,
  subtitle,
  onExport,
  onSaveView,
  onOpenThresholds,
}: DetailHeaderProps) {
  function handleThresholds() {
    if (onOpenThresholds) {
      onOpenThresholds();
    } else {
      toast.info("Alertas por umbral disponibles en una próxima versión");
    }
  }

  return (
    <div className="flex items-start justify-between gap-4 py-4">
      <div className="min-w-0">
        <h1
          className="text-2xl font-bold tracking-[-0.01em] text-[var(--on-surf)] truncate"
          style={{ fontFamily: "var(--font-display)" }}
        >
          {title}
        </h1>
        {subtitle && (
          <p className="mt-0.5 text-sm text-[var(--on-surf-var)]">{subtitle}</p>
        )}
      </div>

      <div className="flex shrink-0 items-center gap-2">
        {onSaveView && (
          <button
            onClick={onSaveView}
            className="flex items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--surf-high)] px-3 py-1.5 text-xs font-medium text-[var(--on-surf)] transition-colors hover:bg-[var(--surf-highest)]"
          >
            <Icon name="bookmark" size={13} />
            Guardar vista
          </button>
        )}

        <button
          onClick={handleThresholds}
          disabled={!onOpenThresholds}
          title={!onOpenThresholds ? "Alertas por umbral — próximamente" : undefined}
          className="flex items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--surf-high)] px-3 py-1.5 text-xs font-medium text-[var(--on-surf)] transition-colors hover:bg-[var(--surf-highest)] disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Icon name="alert" size={13} />
          Alertas
        </button>

        {onExport && (
          <button
            onClick={onExport}
            className="flex items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--surf-high)] px-3 py-1.5 text-xs font-medium text-[var(--on-surf)] transition-colors hover:bg-[var(--surf-highest)]"
          >
            <Icon name="export" size={13} />
            Exportar
          </button>
        )}
      </div>
    </div>
  );
}
