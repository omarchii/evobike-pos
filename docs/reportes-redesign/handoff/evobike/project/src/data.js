// Mock data for Evobike reportes
// Retail pequeño-mediano: 2 sucursales (LEO, AV135), ~2,600 SKUs, 30-60 ventas/mes/sucursal

const BRANCHES = [
  { id: "leo", name: "LEO", color: "#2ECC71", full: "Sucursal LEO" },
  { id: "av135", name: "AV135", color: "#52B788", full: "Sucursal AV135" },
];

// MTD: Abril 2026 (1-18)
const DAYS_IN_PERIOD = 18;

// Deterministic pseudo-random for reproducibility
function seeded(seed) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const rng = seeded(42);

// Daily sales per branch (MXN)
const dailySales = Array.from({ length: DAYS_IN_PERIOD }, (_, i) => {
  const day = i + 1;
  const weekend = (day % 7 === 6 || day % 7 === 0);
  const leoBase = weekend ? 38000 : 22000;
  const av135Base = weekend ? 31000 : 18500;
  const leo = Math.round(leoBase + (rng() - 0.4) * 14000);
  const av135 = Math.round(av135Base + (rng() - 0.4) * 12000);
  return {
    day,
    date: `2026-04-${String(day).padStart(2, "0")}`,
    leo: Math.max(8000, leo),
    av135: Math.max(6000, av135),
    total: 0, // filled below
  };
}).map(d => ({ ...d, total: d.leo + d.av135 }));

// Previous period (march MTD equivalent, days 1-18)
const dailySalesPrev = Array.from({ length: DAYS_IN_PERIOD }, (_, i) => {
  const day = i + 1;
  const weekend = (day % 7 === 6 || day % 7 === 0);
  const leoBase = weekend ? 33000 : 19500;
  const av135Base = weekend ? 27000 : 16000;
  const leo = Math.round(leoBase + (rng() - 0.4) * 11000);
  const av135 = Math.round(av135Base + (rng() - 0.4) * 9500);
  return {
    day,
    leo: Math.max(7000, leo),
    av135: Math.max(5500, av135),
    total: 0,
  };
}).map(d => ({ ...d, total: d.leo + d.av135 }));

const sumNet = dailySales.reduce((s, d) => s + d.total, 0);
const sumNetPrev = dailySalesPrev.reduce((s, d) => s + d.total, 0);

// ~38% blended gross margin
const grossMargin = Math.round(sumNet * 0.381);
const grossMarginPrev = Math.round(sumNetPrev * 0.362);

// KPI data
const KPIS = {
  ventasNetas: {
    id: "ventasNetas",
    label: "Ventas netas",
    value: sumNet,
    format: "currency",
    prev: sumNetPrev,
    delta: (sumNet - sumNetPrev) / sumNetPrev,
    sub: "MTD · abril vs. marzo",
    series: dailySales.map(d => ({ x: d.day, y: d.total })),
    hero: true,
  },
  margenBruto: {
    id: "margenBruto",
    label: "Margen bruto",
    value: grossMargin,
    format: "currency",
    prev: grossMarginPrev,
    delta: (grossMargin - grossMarginPrev) / grossMarginPrev,
    pct: grossMargin / sumNet,
    sub: `${((grossMargin / sumNet) * 100).toFixed(1)}% margen blended`,
    series: dailySales.map(d => ({ x: d.day, y: Math.round(d.total * 0.381) })),
  },
  cxc: {
    id: "cxc",
    label: "Cuentas por cobrar",
    value: 147850,
    format: "currency",
    prev: 131200,
    delta: 0.127,
    sub: "23 apartados · 4 próximos a vencer",
    series: [
      { x: 1, y: 131200 }, { x: 5, y: 136400 }, { x: 10, y: 140500 },
      { x: 14, y: 144200 }, { x: 18, y: 147850 },
    ],
    warning: true,
  },
  cxp: {
    id: "cxp",
    label: "Cuentas por pagar",
    value: 223400,
    format: "currency",
    prev: 198700,
    delta: 0.124,
    sub: "9 facturas · 2 vencidas ($48,200)",
    series: [
      { x: 1, y: 198700 }, { x: 5, y: 205100 }, { x: 10, y: 212900 },
      { x: 14, y: 218500 }, { x: 18, y: 223400 },
    ],
    critical: true,
    splits: [
      { label: "Vencidas", value: 48200, color: "ter" },
      { label: "0–7 días", value: 62800, color: "warn" },
      { label: "8–30 días", value: 112400, color: "sec" },
    ],
  },
  stockCritico: {
    id: "stockCritico",
    label: "Stock crítico",
    value: 47,
    format: "count",
    prev: 38,
    delta: 0.237,
    sub: "LEO: 28 · AV135: 19",
    series: [
      { x: 1, y: 38 }, { x: 5, y: 41 }, { x: 10, y: 44 },
      { x: 14, y: 46 }, { x: 18, y: 47 },
    ],
    critical: true,
  },
};

// Recent sales (last N for detail table)
const VEHICLES = [
  "VOTES ROJO / AZUL 48V", "VOTES GRIS / AMARILLO 48V", "VOTES NARANJA 48V",
  "SOL AZUL CIELO 48V", "SOL NEGRO 48V", "SOL VERDE 48V",
  "KINETIC PRO 72V", "KINETIC URBAN 48V", "KINETIC LITE 36V",
  "SCOOT MX-1 48V", "SCOOT MX-2 60V", "EVO CARGO 60V",
];
const CUSTOMERS = [
  "María Pérez", "Juan Canul", "Sofía Ramírez", "Carlos Dzul", "Laura Chan",
  "Miguel Uc", "Andrea Pool", "Roberto May", "Fernanda Euán", "Diego Cetina",
  "Valentina Tec", "Ricardo Balam", "Alejandra Koh", "Héctor Cámara",
];
const SELLERS = ["A. Gómez", "R. Tzuc", "M. Canché", "L. Huchim", "D. Interián"];
const STATUSES = ["COMPLETED", "COMPLETED", "COMPLETED", "COMPLETED", "LAYAWAY", "COMPLETED", "REFUNDED"];

function genSales(n) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const day = Math.floor(rng() * DAYS_IN_PERIOD) + 1;
    const vehicle = VEHICLES[Math.floor(rng() * VEHICLES.length)];
    const price = 14000 + Math.floor(rng() * 42000);
    const branch = rng() > 0.48 ? "LEO" : "AV135";
    const status = STATUSES[Math.floor(rng() * STATUSES.length)];
    out.push({
      id: `V-${String(3480 + i).padStart(5, "0")}`,
      date: `2026-04-${String(day).padStart(2, "0")}`,
      customer: CUSTOMERS[Math.floor(rng() * CUSTOMERS.length)],
      product: vehicle,
      branch,
      seller: SELLERS[Math.floor(rng() * SELLERS.length)],
      total: price,
      margin: Math.round(price * (0.30 + rng() * 0.14)),
      status,
      payment: rng() > 0.5 ? "Efectivo" : (rng() > 0.5 ? "Tarjeta" : "Transferencia"),
    });
  }
  return out.sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
}

const SALES = genSales(62);

// Top products
const TOP_PRODUCTS = [
  { name: "VOTES ROJO / AZUL 48V", units: 14, revenue: 498000, margin: 0.38 },
  { name: "SOL NEGRO 48V", units: 11, revenue: 362000, margin: 0.41 },
  { name: "KINETIC URBAN 48V", units: 9, revenue: 328500, margin: 0.35 },
  { name: "SOL AZUL CIELO 48V", units: 8, revenue: 284200, margin: 0.40 },
  { name: "VOTES GRIS / AMARILLO 48V", units: 7, revenue: 241800, margin: 0.37 },
  { name: "SCOOT MX-1 48V", units: 6, revenue: 192000, margin: 0.33 },
];

// Low stock items
const LOW_STOCK = [
  { sku: "BAT-48V-20AH-LI", name: "Batería Litio 48V 20Ah", branch: "LEO", stock: 1, min: 5, cat: "Batería" },
  { sku: "VOTES-RA-48V", name: "VOTES ROJO / AZUL 48V", branch: "LEO", stock: 0, min: 3, cat: "Vehículo" },
  { sku: "VOTES-GA-48V", name: "VOTES GRIS / AMARILLO 48V", branch: "AV135", stock: 1, min: 3, cat: "Vehículo" },
  { sku: "REF-CNT-36V", name: "Controlador 36V 350W", branch: "LEO", stock: 2, min: 6, cat: "Refacción" },
  { sku: "SOL-AC-48V", name: "SOL AZUL CIELO 48V", branch: "AV135", stock: 0, min: 2, cat: "Vehículo" },
  { sku: "REF-LLA-26", name: "Llanta 26x2.125", branch: "LEO", stock: 3, min: 12, cat: "Refacción" },
  { sku: "ACC-CAS-NEG", name: "Casco urbano negro", branch: "AV135", stock: 2, min: 8, cat: "Accesorio" },
  { sku: "BAT-36V-12AH", name: "Batería Litio 36V 12Ah", branch: "LEO", stock: 1, min: 4, cat: "Batería" },
];

// Branch comparison
const BRANCH_COMPARISON = [
  {
    id: "leo",
    name: "Sucursal LEO",
    sales: dailySales.reduce((s, d) => s + d.leo, 0),
    prev: dailySalesPrev.reduce((s, d) => s + d.leo, 0),
    units: 38,
    ticket: 0,
    margin: 0.389,
  },
  {
    id: "av135",
    name: "Sucursal AV135",
    sales: dailySales.reduce((s, d) => s + d.av135, 0),
    prev: dailySalesPrev.reduce((s, d) => s + d.av135, 0),
    units: 31,
    ticket: 0,
    margin: 0.374,
  },
].map(b => ({ ...b, ticket: Math.round(b.sales / b.units), delta: (b.sales - b.prev) / b.prev }));

// Reports available
const REPORTS_CATALOG = [
  { id: "ventas", group: "Ventas", title: "Ventas e ingresos", desc: "Tickets, comisiones, ranking de vendedores y productos.", icon: "sales", updated: "Hace 2 min", items: 62, pinned: true },
  { id: "margen", group: "Ventas", title: "Margen bruto por producto", desc: "Revenue neto / 1.16 − costo resuelto. Drill a SKU.", icon: "margin", updated: "Hace 2 min", items: 48, pinned: true },
  { id: "comisiones", group: "Ventas", title: "Comisiones por vendedor", desc: "Acumulado del período, split por sucursal.", icon: "commission", updated: "Hoy 10:42", items: 5 },
  { id: "apartados", group: "Clientes", title: "Apartados / LAYAWAY", desc: "Saldos pendientes, antigüedad y recordatorios.", icon: "layaway", updated: "Hace 8 min", items: 23, pinned: true },
  { id: "retencion", group: "Clientes", title: "Retención y recompra", desc: "Clientes recurrentes, cohortes, NPS estimado.", icon: "retention", updated: "Ayer", items: 312 },
  { id: "taller", group: "Taller", title: "Mantenimiento y fallas", desc: "OTs activas, tiempo promedio, fallas recurrentes.", icon: "wrench", updated: "Hace 12 min", items: 18, pinned: true },
  { id: "sla", group: "Taller", title: "SLA y tiempos de respuesta", desc: "Cumplimiento de compromisos, umbrales configurables.", icon: "clock", updated: "Hace 30 min", items: 24 },
  { id: "inventario", group: "Inventario", title: "Stock y rotación", desc: "Inventario polimórfico: vehículos, accesorios, refacciones, baterías.", icon: "box", updated: "Hace 4 min", items: 2641, pinned: true },
  { id: "stock-critico", group: "Inventario", title: "Stock crítico", desc: "Items bajo mínimo, con proyección de quiebre.", icon: "alert", updated: "Hace 4 min", items: 47 },
  { id: "pnl", group: "Financiero", title: "P&L del período", desc: "Resultado operativo, consolidado y por sucursal.", icon: "pnl", updated: "Hoy 08:00", items: null, pinned: true },
  { id: "cashflow", group: "Financiero", title: "Cashflow y tesorería", desc: "Entradas, salidas, saldos y conciliación bancaria.", icon: "cash", updated: "Hoy 08:00", items: null },
  { id: "cxp-rep", group: "Financiero", title: "Cuentas por pagar", desc: "Facturas pendientes, vencidas y próximas.", icon: "invoice", updated: "Hace 15 min", items: 9 },
  { id: "export-contabilidad", group: "Exportaciones", title: "Exportación contable", desc: "XML CFDI, póliza mensual, formato para contador externo.", icon: "export", updated: "Última: 01-abr", items: null },
];

// Saved views
const SAVED_VIEWS = [
  { id: "ceo-weekly", name: "CEO · Semanal consolidado", shared: false, metrics: 5 },
  { id: "leo-daily", name: "LEO · Diario operativo", shared: true, metrics: 7 },
  { id: "av135-daily", name: "AV135 · Diario operativo", shared: true, metrics: 7 },
  { id: "taller-sla", name: "Taller · SLA y fallas", shared: false, metrics: 4 },
];

// Alerts
const ALERTS_ACTIVE = [
  { id: "a1", severity: "critical", title: "Batería Litio 48V 20Ah sin stock en LEO", time: "Hace 14 min", module: "Inventario" },
  { id: "a2", severity: "warning", title: "Margen de SOL NEGRO 48V bajó del 35%", time: "Hoy 09:15", module: "Margen" },
  { id: "a3", severity: "warning", title: "Apartado #L-2023 vence mañana", time: "Hoy 08:40", module: "Apartados" },
  { id: "a4", severity: "critical", title: "Factura CFDI-8821 vencida 3 días", time: "Ayer 18:02", module: "CxP" },
];

window.EVOBIKE_DATA = {
  BRANCHES, KPIS, SALES, TOP_PRODUCTS, LOW_STOCK, BRANCH_COMPARISON,
  REPORTS_CATALOG, SAVED_VIEWS, ALERTS_ACTIVE,
  dailySales, dailySalesPrev,
  DAYS_IN_PERIOD,
};
