import type { ExportHandler } from "./export-types";
import { ventasEIngresosExportHandler } from "@/app/(pos)/reportes/ventas-e-ingresos/export-handler";
import { estadoResultadosExportHandler } from "@/app/(pos)/reportes/estado-resultados/export-handler";

export const EXPORT_HANDLERS: Record<string, ExportHandler> = {
  "ventas-e-ingresos": ventasEIngresosExportHandler,
  "estado-resultados": estadoResultadosExportHandler,
};

export function getExportHandler(slug: string): ExportHandler | null {
  return EXPORT_HANDLERS[slug] ?? null;
}
