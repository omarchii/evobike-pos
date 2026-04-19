import type { IconName } from "@/components/primitives/icon";

export type ReportGroup =
  | "VENTAS"
  | "CLIENTES"
  | "INVENTARIO"
  | "FINANCIERO"
  | "EXPORTACIONES";

export type ReportStatus =
  | "ready"              // existe /<slug>/page.tsx propio hoy
  | "ready-pending-impl" // catch-all muestra placeholder; sesión futura lo implementa
  | "placeholder"        // intencional: sin backend en v1
  | "reserved";          // v1.5 o v2 — catch-all tira notFound()

export type ReportRole = "ADMIN" | "MANAGER" | "SELLER" | "TECHNICIAN";

export type ReportMeta = {
  slug: string;
  title: string;
  description: string;
  group: ReportGroup;
  icon: IconName;
  status: ReportStatus;
  allowedRoles: ReportRole[];
};

export const REPORTS: readonly ReportMeta[] = [
  // === VENTAS ===
  {
    slug: "ventas-e-ingresos",
    title: "Ventas e ingresos",
    description: "Ingresos por período, método de pago y vendedor",
    group: "VENTAS",
    icon: "sales",
    status: "ready",
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    slug: "margen-bruto",
    title: "Margen bruto",
    description: "Rentabilidad por producto y categoría",
    group: "VENTAS",
    icon: "margin",
    status: "ready-pending-impl",
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    slug: "comisiones",
    title: "Comisiones",
    description: "Comisiones generadas y pagadas por vendedor",
    group: "VENTAS",
    icon: "commission",
    status: "ready",
    allowedRoles: ["ADMIN", "MANAGER"],
  },

  // === CLIENTES ===
  {
    slug: "apartados",
    title: "Apartados",
    description: "Layaway activos, antigüedad y seguimiento",
    group: "CLIENTES",
    icon: "layaway",
    status: "ready-pending-impl",
    allowedRoles: ["ADMIN", "MANAGER", "SELLER"],
  },
  {
    slug: "clientes",
    title: "Estado de cuenta",
    description: "Saldos por cliente y detalle de transacciones",
    group: "CLIENTES",
    icon: "user",
    status: "ready",
    allowedRoles: ["ADMIN", "MANAGER", "SELLER"],
  },

  // === INVENTARIO ===
  {
    slug: "inventario",
    title: "Stock y rotación",
    description: "Valor de inventario y velocidad de rotación",
    group: "INVENTARIO",
    icon: "box",
    status: "ready-pending-impl",
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    slug: "stock-critico",
    title: "Stock crítico",
    description: "Productos bajo mínimo y forecast de reposición",
    group: "INVENTARIO",
    icon: "alert",
    status: "ready-pending-impl",
    allowedRoles: ["ADMIN", "MANAGER"],
  },

  // === FINANCIERO ===
  {
    slug: "estado-resultados",
    title: "Estado de resultados",
    description: "P&L del período por categoría y sucursal",
    group: "FINANCIERO",
    icon: "pnl",
    status: "ready-pending-impl",
    allowedRoles: ["ADMIN"],
  },
  {
    slug: "tesoreria",
    title: "Cashflow y tesorería",
    description: "Flujo de efectivo y movimientos de caja",
    group: "FINANCIERO",
    icon: "cash",
    status: "ready-pending-impl",
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    slug: "cuentas-por-pagar",
    title: "Cuentas por pagar",
    description: "CxP a proveedores con aging buckets",
    group: "FINANCIERO",
    icon: "invoice",
    status: "ready-pending-impl",
    allowedRoles: ["ADMIN", "MANAGER"],
  },

  // === EXPORTACIONES ===
  {
    slug: "exportacion-contable",
    title: "Exportación contable",
    description: "Exportación de datos para contabilidad",
    group: "EXPORTACIONES",
    icon: "export",
    status: "placeholder",
    allowedRoles: ["ADMIN"],
  },

  // === RESERVADOS — no aparecen en hub; catch-all tira notFound() ===
  {
    slug: "retencion",
    title: "Retención y recompra",
    description: "Cohortes y LTV — v1.5",
    group: "CLIENTES",
    icon: "retention",
    status: "reserved",
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    slug: "taller-mantenimiento",
    title: "Mantenimiento y fallas",
    description: "Tasa de retrabajos — v1.5",
    group: "CLIENTES",
    icon: "wrench",
    status: "reserved",
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    slug: "taller-sla",
    title: "SLA del taller",
    description: "Tiempos por subStatus — v1.5",
    group: "CLIENTES",
    icon: "clock",
    status: "reserved",
    allowedRoles: ["ADMIN", "MANAGER"],
  },
  {
    slug: "transferencias-mermas",
    title: "Transferencias y mermas",
    description: "Movimientos entre sucursales — v2",
    group: "INVENTARIO",
    icon: "box",
    status: "reserved",
    allowedRoles: ["ADMIN"],
  },
] as const;

export const REPORTS_BY_SLUG: Record<string, ReportMeta> = Object.fromEntries(
  REPORTS.map((r) => [r.slug, r]),
);

export function getVisibleReports(role: ReportRole): ReportMeta[] {
  return REPORTS.filter(
    (r) => r.status !== "reserved" && r.allowedRoles.includes(role),
  );
}

export function getReportsByGroup(
  role: ReportRole,
): Record<ReportGroup, ReportMeta[]> {
  const visible = getVisibleReports(role);
  const groups: Record<ReportGroup, ReportMeta[]> = {
    VENTAS: [],
    CLIENTES: [],
    INVENTARIO: [],
    FINANCIERO: [],
    EXPORTACIONES: [],
  };
  for (const r of visible) groups[r.group].push(r);
  return groups;
}
