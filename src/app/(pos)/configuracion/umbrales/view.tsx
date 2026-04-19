"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { ALERT_METRICS, getMetricsForReport } from "@/lib/reportes/alert-metrics";
import type { AlertMetricKey } from "@/lib/reportes/alert-metrics";
import { REPORTS } from "@/lib/reportes/reports-config";
import type { ThresholdRow } from "@/components/reportes/shell/thresholds-context";

type Branch = { id: string; name: string; code: string };

type UmbralesViewProps = {
  branches: Branch[];
  thresholds: ThresholdRow[];
  role: "ADMIN" | "MANAGER";
};

// ── Grupos de reportes que tienen métricas ────────────────────────────────────

function getReportGroups() {
  return REPORTS.filter((r) => getMetricsForReport(r.slug).length > 0);
}

// ── Formulario por métrica × sucursal ─────────────────────────────────────────

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

type MetricRowProps = {
  metricKey: AlertMetricKey;
  branchId: string;
  existing: ThresholdRow | null;
  onSaved: (row: ThresholdRow) => void;
  onDeleted: (metricKey: string, branchId: string) => void;
};

function MetricRow({ metricKey, branchId, existing, onSaved, onDeleted }: MetricRowProps) {
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

  React.useEffect(() => {
    form.reset({
      thresholdValue: existing?.thresholdValue ?? 0,
      comparator: existing?.comparator ?? "LT",
      isActive: existing?.isActive ?? true,
    });
  }, [existing, form]);

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
      toast.success(`"${meta.label}" guardado`);
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
      const res = await fetch(`/api/reportes/thresholds/${existing.id}`, { method: "DELETE" });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "Error al eliminar el umbral");
        return;
      }
      toast.success(`"${meta.label}" eliminado`);
      form.reset({ thresholdValue: 0, comparator: "LT", isActive: true });
      onDeleted(metricKey, branchId);
      router.refresh();
    } catch {
      toast.error("No se pudo conectar con el servidor");
    } finally {
      setDeleting(false);
    }
  }

  const isShared = meta.reportSlugs.length > 1;

  return (
    <form
      onSubmit={form.handleSubmit(handleSave)}
      className="rounded-[var(--r-md)] border border-[color-mix(in_srgb,var(--on-surf)_10%,transparent)] bg-[var(--surf-lowest)] p-4 space-y-3"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-[var(--on-surf)]">{meta.label}</p>
            {isShared && (
              <Chip variant="info" label={`Compartida (${meta.reportSlugs.length} reportes)`} />
            )}
          </div>
          <p className="text-xs text-[var(--on-surf-var)] mt-0.5">{meta.description}</p>
        </div>
        <span className="shrink-0 text-[0.625rem] font-medium uppercase tracking-wider text-[var(--on-surf-var)] mt-1">
          {meta.unit}
        </span>
      </div>

      <div className="flex gap-2">
        <div className="flex-1">
          <label className="block text-[0.625rem] font-medium uppercase tracking-wider text-[var(--on-surf-var)] mb-1">
            Valor
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

// ── Vista principal ───────────────────────────────────────────────────────────

export function UmbralesView({ branches, thresholds, role }: UmbralesViewProps) {
  const [localThresholds, setLocalThresholds] = React.useState<ThresholdRow[]>(thresholds);
  const reportGroups = getReportGroups();

  function handleSaved(row: ThresholdRow) {
    setLocalThresholds((prev) => {
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
    setLocalThresholds((prev) =>
      prev.filter((t) => !(t.metricKey === metricKey && t.branchId === branchId)),
    );
  }

  // Métricas que ya están cubiertas en secciones anteriores (para detectar "compartidas")
  const seenMetricKeys = new Set<string>();

  return (
    <div className="max-w-3xl mx-auto space-y-8 pb-12">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-[var(--on-surf-var)]">
        <Link href="/configuracion" className="hover:text-[var(--on-surf)] transition-colors">
          Configuración
        </Link>
        <Icon name="chevronRight" size={12} />
        <span className="text-[var(--on-surf)]">Umbrales</span>
      </nav>

      {/* Header */}
      <div>
        <h1
          className="text-3xl font-semibold text-[var(--on-surf)]"
          style={{ fontFamily: "var(--font-heading, 'Space Grotesk')" }}
        >
          Umbrales de alerta
        </h1>
        <p className="mt-1 text-sm text-[var(--on-surf-var)]">
          Configura valores mínimos o máximos esperados por métrica. Los reportes mostrarán un
          badge cuando un KPI cruce su umbral.
        </p>
        {role === "ADMIN" && branches.length > 1 && (
          <p className="mt-2 text-xs text-[var(--on-surf-var)]">
            Como ADMIN ves todas las sucursales. Cada fila corresponde a una métrica × sucursal.
          </p>
        )}
        {role === "MANAGER" && (
          <p className="mt-2 text-xs text-[var(--on-surf-var)]">
            Como MANAGER ves únicamente tu sucursal.
          </p>
        )}
      </div>

      {/* Secciones por reporte */}
      {reportGroups.map((report) => {
        const metrics = getMetricsForReport(report.slug);
        return (
          <section key={report.slug} className="space-y-4">
            <div className="flex items-center gap-2">
              <Icon name={report.icon} size={16} />
              <h2
                className="text-base font-semibold text-[var(--on-surf)]"
                style={{ fontFamily: "var(--font-heading, 'Space Grotesk')" }}
              >
                {report.title}
              </h2>
              {report.status !== "ready" && (
                <Chip variant="neutral" label="Próximamente" />
              )}
            </div>

            {branches.map((branch) => (
              <div key={branch.id} className="space-y-2">
                {branches.length > 1 && (
                  <p className="text-[0.625rem] font-medium uppercase tracking-wider text-[var(--on-surf-var)]">
                    {branch.name} ({branch.code})
                  </p>
                )}
                {metrics.map((key) => {
                  const isFirstOccurrence = !seenMetricKeys.has(`${key}-${branch.id}`);
                  seenMetricKeys.add(`${key}-${branch.id}`);
                  const existing =
                    localThresholds.find(
                      (t) => t.metricKey === key && t.branchId === branch.id,
                    ) ?? null;
                  return (
                    <div key={key} className={!isFirstOccurrence ? "opacity-80" : undefined}>
                      {!isFirstOccurrence && (
                        <p className="mb-1 text-[0.625rem] text-[var(--on-surf-var)]">
                          ↳ Esta métrica también aplica a otro reporte. Editar aquí actualiza el mismo registro.
                        </p>
                      )}
                      <MetricRow
                        metricKey={key as AlertMetricKey}
                        branchId={branch.id}
                        existing={existing}
                        onSaved={handleSaved}
                        onDeleted={handleDeleted}
                      />
                    </div>
                  );
                })}
              </div>
            ))}
          </section>
        );
      })}

      {reportGroups.length === 0 && (
        <p className="text-sm text-[var(--on-surf-var)]">
          No hay métricas de umbral configuradas en el sistema.
        </p>
      )}
    </div>
  );
}

