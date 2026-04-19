"use client";

import * as React from "react";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";
import type { ExportFormat } from "@/lib/reportes/export-types";
import { EXPORT_FORMATS } from "@/lib/reportes/export-types";

const FORMAT_META: Record<
  ExportFormat,
  { label: string; description: string; icon: string; ext: string }
> = {
  csv: {
    label: "CSV",
    description: "Para análisis en hojas de cálculo.",
    icon: "table",
    ext: ".csv",
  },
  xlsx: {
    label: "Excel",
    description: "Con formato, totales y colores.",
    icon: "table",
    ext: ".xlsx",
  },
  pdf: {
    label: "PDF",
    description: "Listo para imprimir o compartir.",
    icon: "export",
    ext: ".pdf",
  },
};

export type ExportDrawerProps = {
  open: boolean;
  onClose: () => void;
  slug: string;
  filters: Record<string, unknown>;
  availableFormats?: ExportFormat[];
  columnLabels?: string[];
  rowCount?: number;
  rangeLabel?: string;
  branchLabel?: string;
};

export function ExportDrawer({
  open,
  onClose,
  slug,
  filters,
  availableFormats = [...EXPORT_FORMATS],
  columnLabels,
  rowCount,
  rangeLabel,
  branchLabel,
}: ExportDrawerProps) {
  const [format, setFormat] = React.useState<ExportFormat>("csv");
  const [loading, setLoading] = React.useState(false);
  const [saturatedWarning, setSaturatedWarning] = React.useState(false);

  React.useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  async function handleDownload() {
    if (loading) return;
    setLoading(true);
    setSaturatedWarning(false);

    try {
      const res = await fetch(`/api/reportes/${slug}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ format, filters }),
      });

      if (res.status === 413) {
        const data = (await res.json()) as { error: string };
        setSaturatedWarning(true);
        toast.error(data.error ?? "Rango muy grande. Afina los filtros o exporta en partes.");
        return;
      }

      if (res.status === 429) {
        const data = (await res.json()) as { error: string };
        toast.warning(data.error ?? "Ya tienes una exportación en curso. Espera a que termine.");
        return;
      }

      if (res.status === 412) {
        toast.error("La sucursal no está configurada para PDFs. Ve a Configuración.");
        return;
      }

      if (!res.ok) {
        let msg = "Error al generar la exportación.";
        try {
          const data = (await res.json()) as { error?: string };
          if (data.error) msg = data.error;
        } catch {
          // ignore json parse errors
        }
        toast.error(msg);
        return;
      }

      const blob = await res.blob();
      const contentDisposition = res.headers.get("Content-Disposition") ?? "";
      const filenameMatch = /filename="([^"]+)"/.exec(contentDisposition);
      const filename =
        filenameMatch?.[1] ?? `${slug}.${FORMAT_META[format].ext.slice(1)}`;

      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = filename;
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      toast.success("Descarga iniciada.");
      onClose();
    } catch {
      toast.error("No se pudo conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const summaryParts: string[] = [];
  if (rangeLabel) summaryParts.push(rangeLabel);
  if (branchLabel) summaryParts.push(branchLabel);
  if (rowCount !== undefined)
    summaryParts.push(
      `${new Intl.NumberFormat("es-MX").format(rowCount)} registros`,
    );
  const summary = summaryParts.join(" · ") || "Registros del período actual";

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
          background:
            "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          borderLeft: "1px solid var(--border-subtle, color-mix(in srgb, var(--on-surf) 12%, transparent))",
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Exportar reporte"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[color-mix(in_srgb,var(--on-surf)_10%,transparent)] px-5 py-4">
          <div className="flex items-center gap-2">
            <Icon name="export" size={16} />
            <span className="text-sm font-semibold text-[var(--on-surf)]">
              Exportar reporte
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
          {/* Summary */}
          <div className="rounded-[var(--r-md)] bg-[var(--surf-low)] px-4 py-3">
            <p className="text-[11px] font-medium uppercase tracking-wide text-[var(--on-surf-var)] mb-1">
              Se exportará
            </p>
            <p className="text-sm text-[var(--on-surf)]">{summary}</p>
          </div>

          {/* Saturation warning */}
          {saturatedWarning && (
            <div className="rounded-[var(--r-md)] bg-[var(--warn-container,#FFF3CD)] px-4 py-3">
              <p className="text-sm text-[var(--on-warn-container,#664D03)]">
                La última exportación superó el límite de{" "}
                <strong>10,000 filas</strong>. Afina los filtros o exporta en
                partes.
              </p>
            </div>
          )}

          {/* Format selector */}
          <div>
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--on-surf-var)]">
              Formato
            </p>
            <div className="space-y-2">
              {availableFormats.map((fmt) => {
                const meta = FORMAT_META[fmt];
                return (
                  <label
                    key={fmt}
                    className={[
                      "flex cursor-pointer items-center gap-3 rounded-[var(--r-md)] border px-4 py-3 transition-colors",
                      format === fmt
                        ? "border-[var(--p)] bg-[color-mix(in_srgb,var(--p)_8%,transparent)]"
                        : "border-[color-mix(in_srgb,var(--on-surf)_12%,transparent)] hover:bg-[var(--surf-low)]",
                    ].join(" ")}
                  >
                    <input
                      type="radio"
                      name="export-format"
                      value={fmt}
                      checked={format === fmt}
                      onChange={() => setFormat(fmt)}
                      className="sr-only"
                    />
                    <div
                      className={[
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors",
                        format === fmt
                          ? "border-[var(--p)] bg-[var(--p)]"
                          : "border-[color-mix(in_srgb,var(--on-surf)_30%,transparent)]",
                      ].join(" ")}
                    >
                      {format === fmt && (
                        <div className="h-1.5 w-1.5 rounded-full bg-white" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <span className="block text-sm font-medium text-[var(--on-surf)]">
                        {meta.label}
                      </span>
                      <span className="block text-xs text-[var(--on-surf-var)]">
                        {meta.description}
                      </span>
                    </div>
                    <span className="text-xs text-[var(--on-surf-var)]">
                      {meta.ext}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Columns */}
          {columnLabels && columnLabels.length > 0 && (
            <div>
              <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-[var(--on-surf-var)]">
                Columnas incluidas
              </p>
              <div className="flex flex-wrap gap-1.5">
                {columnLabels.map((label) => (
                  <span
                    key={label}
                    className="rounded-full bg-[var(--surf-high)] px-2.5 py-0.5 text-xs text-[var(--on-surf)]"
                  >
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 border-t border-[color-mix(in_srgb,var(--on-surf)_10%,transparent)] px-5 py-4">
          <button
            onClick={onClose}
            disabled={loading}
            className="rounded-[var(--r-full)] px-4 py-2 text-sm font-medium text-[var(--on-surf)] transition-colors hover:bg-[var(--surf-high)] disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            onClick={handleDownload}
            disabled={loading}
            className="flex min-w-[110px] items-center justify-center gap-2 rounded-[var(--r-full)] px-5 py-2 text-sm font-medium transition-opacity disabled:opacity-60"
            style={{
              background: "var(--p)",
              color: "var(--on-p)",
            }}
          >
            {loading ? (
              <>
                <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                Generando...
              </>
            ) : (
              <>
                <Icon name="export" size={14} />
                Descargar
              </>
            )}
          </button>
        </div>
      </div>
    </>
  );
}
