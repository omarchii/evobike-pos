/**
 * Tipos compartidos del módulo de reportes (P10).
 */

/** KPI individual para las cards superiores de un reporte. */
export interface ReportKPI {
  label: string;
  value: number;
  /** Cómo formatear el valor en la UI. */
  format: "currency" | "number" | "percent";
  /** Subtexto de tendencia opcional (ej. "vs mes anterior"). */
  trend?: string;
}

/** Filtros base compartidos por todos los reportes. */
export interface ReportFilters {
  from: string; // ISO date "YYYY-MM-DD"
  to: string; // ISO date "YYYY-MM-DD"
  branchId?: string;
}

/** Fila genérica para tablas de reporte (clave → valor serializado). */
export type ReportRow = Record<string, string | number | boolean | null>;
