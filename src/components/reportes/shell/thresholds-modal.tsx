"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";
import {
  ALERT_METRICS,
  ALERT_METRIC_KEYS,
  getMetricsForReport,
} from "@/lib/reportes/alert-metrics";
import type { AlertMetricKey } from "@/lib/reportes/alert-metrics";
import type { ThresholdRow } from "./thresholds-context";

type BranchOption = { id: string; label: string };

export type ThresholdsModalProps = {
  open: boolean;
  onClose: () => void;
  reportSlug: string;
  branchOptions: BranchOption[];
  currentBranchId: string | null;
  initialThresholds: ThresholdRow[];
};

// ── Formulario por métrica ────────────────────────────────────────────────────

const COMPARATORS = ["LT", "LTE", "GT", "GTE", "EQ"] as const;
const COMPARATOR_LABELS: Record<(typeof COMPARATORS)[number], string> = {
  LT:  "< menor que",
  LTE: "≤ menor o igual",
  GT:  "> mayor que",
  GTE: "≥ mayor o igual",
  EQ:  "= igual a",
};

const metricSchema = z.object({
  thresholdValue: z.number({ invalid_type_error: "Ingresa un número" }).min(0, "Debe ser ≥ 0"),
  comparator: z.enum(COMPARATORS),
  isActive: z.boolean(),
});

type MetricFormValues = z.infer<typeof metricSchema>;

type MetricThresholdRowProps = {
  metricKey: AlertMetricKey;
  branchId: string;
  existing: ThresholdRow | null;
  onSaved: (row: ThresholdRow) => void;
  onDeleted: (metricKey: string, branchId: string) => void;
};

function MetricThresholdRow({
  metricKey,
  branchId,
  existing,
  onSaved,
  onDeleted,
}: MetricThresholdRowProps) {
  const meta = ALERT_METRICS[metricKey];
  const router = useRouter();
  const [saving, setSaving] = React.useState(false);
  const [deleting, setDeleting] = React.useState(false);

  const form = useForm<MetricFormValues>({
    resolver: zodResolver(metricSchema),
    defaultValues: {
      thresholdValue: existing?.thresholdValue ?? 0,
      comparator: existing?.comparator ?? "LT",
      isActive: existing?.isActive ?? true,
    },
  });

  async function handleSave(values: MetricFormValues) {
    setSaving(true);
    try {
      const res = await fetch("/api/reportes/thresholds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          metricKey,
          branchId,
          thresholdValue: values.thresholdValue,
          comparator: values.comparator,
          isActive: values.isActive,
        }),
      });
      const json = (await res.json()) as { success: boolean; data?: ThresholdRow; error?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Error al guardar el umbral");
        return;
      }
      toast.success(`Umbral "${meta.label}" guardado`);
      onSaved(json.data!);
      router.refresh();
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    if (!existing) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/reportes/thresholds/${existing.id}`, {
        method: "DELETE",
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Error al eliminar el umbral");
        return;
      }
      toast.success(`Umbral "${meta.label}" eliminado`);
      form.reset({ thresholdValue: 0, comparator: "LT", isActive: true });
      onDeleted(metricKey, branchId);
      router.refresh();
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form
      onSubmit={form.handleSubmit(handleSave)}
      className="rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--on-surf)_10%,transparent)] p-4 space-y-3"
    >
      <div>
        <p className="text-sm font-medium text-[var(--on-surf)]">{meta.label}</p>
        <p className="text-xs text-[var(--on-surf-var)] mt-0.5">{meta.description}</p>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--on-surf-var)] mb-1">
            Valor ({meta.unit})
          </label>
          <input
            type="number"
            step="any"
            min="0"
            {...form.register("thresholdValue", { valueAsNumber: true })}
            className="w-full rounded-[var(--r-sm)] border border-[color-mix(in_srgb,var(--on-surf)_15%,transparent)] bg-[var(--surf-low)] px-3 py-1.5 text-sm text-[var(--on-surf)] focus:outline-none focus:ring-1 focus:ring-[var(--p)]"
          />
          {form.formState.errors.thresholdValue && (
            <p className="mt-1 text-[0.625rem] text-[var(--ter)]">
              {form.formState.errors.thresholdValue.message}
            </p>
          )}
        </div>

        <div className="flex-1">
          <label className="block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--on-surf-var)] mb-1">
            Condición
          </label>
          <select
            {...form.register("comparator")}
            className="w-full rounded-[var(--r-sm)] border border-[color-mix(in_srgb,var(--on-surf)_15%,transparent)] bg-[var(--surf-low)] px-3 py-1.5 text-sm text-[var(--on-surf)] focus:outline-none focus:ring-1 focus:ring-[var(--p)]"
          >
            {COMPARATORS.map((c) => (
              <option key={c} value={c}>
                {COMPARATOR_LABELS[c]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <label className="flex items-center gap-2 cursor-pointer select-none">
          <input
            type="checkbox"
            {...form.register("isActive")}
            className="h-4 w-4 rounded accent-[var(--p)]"
          />
          <span className="text-xs text-[var(--on-surf)]">Activo</span>
        </label>

        <div className="flex items-center gap-2">
          {existing && (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="rounded-[var(--r-full)] px-3 py-1 text-xs font-medium text-[var(--ter)] transition-colors hover:bg-[color-mix(in_srgb,var(--ter)_10%,transparent)] disabled:opacity-40"
            >
              {deleting ? "Eliminando…" : "Eliminar"}
            </button>
          )}
          <button
            type="submit"
            disabled={saving || deleting}
            className="rounded-[var(--r-full)] px-4 py-1.5 text-xs font-medium transition-opacity disabled:opacity-60"
            style={{ background: "var(--p)", color: "var(--on-p)" }}
          >
            {saving ? "Guardando…" : "Guardar"}
          </button>
        </div>
      </div>
    </form>
  );
}

// ── Modal principal ───────────────────────────────────────────────────────────

export function ThresholdsModal({
  open,
  onClose,
  reportSlug,
  branchOptions,
  currentBranchId,
  initialThresholds,
}: ThresholdsModalProps) {
  const [selectedBranchId, setSelectedBranchId] = React.useState(
    currentBranchId ?? branchOptions[0]?.id ?? "",
  );
  const [thresholds, setThresholds] = React.useState<ThresholdRow[]>(initialThresholds);

  React.useEffect(() => {
    setThresholds(initialThresholds);
  }, [initialThresholds]);

  React.useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  const metrics = getMetricsForReport(reportSlug);

  function handleSaved(row: ThresholdRow) {
    setThresholds((prev) => {
      const idx = prev.findIndex(
        (t) => t.metricKey === row.metricKey && t.branchId === row.branchId,
      );
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = row;
        return next;
      }
      return [...prev, row];
    });
  }

  function handleDeleted(metricKey: string, branchId: string) {
    setThresholds((prev) =>
      prev.filter((t) => !(t.metricKey === metricKey && t.branchId === branchId)),
    );
  }

  const activeBranchId = selectedBranchId || currentBranchId || "";

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
        aria-label="Umbrales de este reporte"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--on-surf)_10%,transparent)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Icon name="alert" size={16} />
            <span className="text-sm font-semibold text-[var(--on-surf)]">
              Umbrales de este reporte
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
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          {/* Selector de sucursal */}
          {branchOptions.length > 1 && (
            <div>
              <label className="block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--on-surf-var)] mb-1">
                Sucursal
              </label>
              <select
                value={selectedBranchId}
                onChange={(e) => setSelectedBranchId(e.target.value)}
                className="w-full rounded-[var(--r-sm)] border border-[color-mix(in_srgb,var(--on-surf)_15%,transparent)] bg-[var(--surf-low)] px-3 py-2 text-sm text-[var(--on-surf)] focus:outline-none focus:ring-1 focus:ring-[var(--p)]"
              >
                {branchOptions.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Métricas */}
          {metrics.length === 0 ? (
            <p className="text-sm text-[var(--on-surf-var)]">
              No hay métricas configuradas para este reporte.
            </p>
          ) : (
            <div className="space-y-3">
              {metrics.map((key) => {
                const existing =
                  thresholds.find(
                    (t) => t.metricKey === key && t.branchId === activeBranchId,
                  ) ?? null;
                return (
                  <MetricThresholdRow
                    key={`${key}-${activeBranchId}`}
                    metricKey={key as AlertMetricKey}
                    branchId={activeBranchId}
                    existing={existing}
                    onSaved={handleSaved}
                    onDeleted={handleDeleted}
                  />
                );
              })}
            </div>
          )}

          {/* Link a vista global */}
          <div className="pt-2 border-t border-[color-mix(in_srgb,var(--on-surf)_8%,transparent)]">
            <a
              href="/configuracion/umbrales"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-xs text-[var(--p)] hover:underline"
            >
              Ver todos los umbrales
              <Icon name="arrowRight" size={12} />
            </a>
          </div>
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

