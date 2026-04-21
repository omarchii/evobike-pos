export type AlertMetricUnit = "MXN" | "PCT" | "UNITS" | "DAYS";

export type AlertMetricMeta = {
  label: string;
  description: string;
  unit: AlertMetricUnit;
  reportSlugs: string[];
  /** KPIs donde aplica el badge. `kpiKey` = valor del campo `key` en KpiSpec. */
  kpiBindings: Array<{ reportSlug: string; kpiKey: string }>;
};

export const ALERT_METRICS: Record<string, AlertMetricMeta> = {
  // Ventas
  SALES_DAILY_MIN: {
    label: "Venta diaria mínima",
    description: "Monto mínimo de ventas esperado por día.",
    unit: "MXN",
    reportSlugs: ["ventas-e-ingresos"],
    kpiBindings: [{ reportSlug: "ventas-e-ingresos", kpiKey: "ingresoTotal" }],
  },
  MARGIN_PCT_MIN: {
    label: "Margen bruto mínimo",
    description: "Porcentaje mínimo aceptable de margen bruto.",
    unit: "PCT",
    reportSlugs: ["ventas-e-ingresos", "margen-bruto"],
    kpiBindings: [
      { reportSlug: "ventas-e-ingresos", kpiKey: "margenBruto" },
      { reportSlug: "margen-bruto", kpiKey: "margenPct" },
    ],
  },

  // Inventario
  STOCK_MIN_UNITS: {
    label: "Stock mínimo por producto",
    description: "Unidades mínimas en stock antes de alertar.",
    unit: "UNITS",
    reportSlugs: ["stock-critico", "inventario"],
    kpiBindings: [],
  },
  DAYS_SINCE_LAST_SALE_MAX: {
    label: "Días máximos sin venta",
    description: "Días máximos sin registrar ventas de un producto antes de alertar.",
    unit: "DAYS",
    reportSlugs: ["stock-critico", "inventario"],
    kpiBindings: [],
  },

  // Financiero
  AP_AGING_DAYS_WARN: {
    label: "Aging máximo de CxP",
    description: "Días de vencimiento máximos aceptables en cuentas por pagar.",
    unit: "DAYS",
    reportSlugs: ["cuentas-por-pagar"],
    kpiBindings: [],
  },
  CASH_FLOW_MIN: {
    label: "Saldo mínimo de tesorería",
    description: "Saldo mínimo esperado en caja y bancos.",
    unit: "MXN",
    reportSlugs: ["tesoreria"],
    kpiBindings: [{ reportSlug: "tesoreria", kpiKey: "saldoActual" }],
  },
  PROFIT_MARGIN_MIN: {
    label: "Margen neto mínimo",
    description: "Porcentaje mínimo aceptable de margen neto.",
    unit: "PCT",
    reportSlugs: ["estado-resultados"],
    kpiBindings: [{ reportSlug: "estado-resultados", kpiKey: "margenNeto" }],
  },

  // V12 Estado de resultados
  MARGEN_BRUTO_PCT: {
    label: "Margen bruto %",
    description: "Porcentaje mínimo aceptable de margen bruto del período.",
    unit: "PCT",
    reportSlugs: ["estado-resultados"],
    kpiBindings: [{ reportSlug: "estado-resultados", kpiKey: "margenBrutoPct" }],
  },
  MARGEN_OPERATIVO_MXN: {
    label: "Margen operativo (MXN)",
    description: "Monto mínimo aceptable de margen operativo del período.",
    unit: "MXN",
    reportSlugs: ["estado-resultados"],
    kpiBindings: [{ reportSlug: "estado-resultados", kpiKey: "margenOperativo" }],
  },
} as const;

export type AlertMetricKey = keyof typeof ALERT_METRICS;

export const ALERT_METRIC_KEYS = Object.keys(ALERT_METRICS) as AlertMetricKey[];

export function getMetricsForReport(slug: string): AlertMetricKey[] {
  return ALERT_METRIC_KEYS.filter((k) => ALERT_METRICS[k].reportSlugs.includes(slug));
}

export function getKpiBinding(slug: string, kpiKey: string): AlertMetricKey | null {
  for (const key of ALERT_METRIC_KEYS) {
    const hit = ALERT_METRICS[key].kpiBindings.find(
      (b) => b.reportSlug === slug && b.kpiKey === kpiKey,
    );
    if (hit) return key;
  }
  return null;
}
