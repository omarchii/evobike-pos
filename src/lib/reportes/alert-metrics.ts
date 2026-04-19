/**
 * Claves de métricas para AlertThreshold.
 *
 * Para agregar una métrica nueva:
 * 1. Añadir la clave a este array (ordenado alfabético por prefijo de dominio).
 * 2. Documentar en el JSDoc qué representa y sus unidades esperadas.
 * 3. Usar la nueva clave en el reporte correspondiente.
 *
 * No requiere migración Prisma — el campo metricKey es String libre en DB,
 * la validación es runtime vía Zod.
 */
export const ALERT_METRICS = [
  // Ventas
  "SALES_DAILY_MIN",          // Venta mínima diaria esperada (MXN)
  "MARGIN_PCT_MIN",           // Margen bruto mínimo aceptable (%)

  // Inventario
  "STOCK_MIN_UNITS",          // Unidades mínimas en stock por producto
  "DAYS_SINCE_LAST_SALE_MAX", // Días máximos sin venta antes de alertar

  // Financiero
  "AP_AGING_DAYS_WARN",       // Días de vencimiento CxP para warning
  "CASH_FLOW_MIN",            // Saldo mínimo de tesorería (MXN)
  "PROFIT_MARGIN_MIN",        // Margen neto mínimo (%)
] as const;

export type AlertMetricKey = (typeof ALERT_METRICS)[number];
