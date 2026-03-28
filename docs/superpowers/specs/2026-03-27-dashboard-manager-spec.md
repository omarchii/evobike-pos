# Dashboard Manager — Spec v1

**Fecha:** 2026-03-28
**Alcance:** `src/app/(pos)/dashboard/page.tsx` — versión extendida para MANAGER y ADMIN
**Restricción:** No modifica lógica de negocio, actions, ni otros módulos

---

## 0. Contexto y decisiones de sesión

Esta spec reemplaza los tokens visuales de `2026-03-27-dashboard-redesign-design.md` para el dashboard de Manager. El sidebar ya rediseñado no cambia. Los cambios son:

| Decisión anterior | Decisión vigente |
|---|---|
| Paleta Forest Green (`#1B4332` / `#a5d0b9`) | Verde eléctrico `#22c55e` como único acento |
| Dark mode fijo | Light/dark toggle — sidebar siempre oscuro |
| Tipografía Space Grotesk + Inter | System font, pesos 400 y 500 únicamente |
| `rounded-2xl` cards | `rounded-[10px]` cards, `rounded-[6px]` elementos internos |
| `text-3xl font-bold` en KPIs | `text-[22px] font-medium` en valores KPI |
| Panel: 4 cards + tendencia + ventas recientes + taller | 4 KPIs + 7 paneles completos (ver §1) |

La estructura general del shell (sidebar + topbar + main) se mantiene del spec anterior. Esta spec define exclusivamente el contenido de `dashboard/page.tsx`.

---

## 1. Componentes y layout

### 1.1 Guard de permisos

El dashboard Manager es visible **solo para `role === "MANAGER"` y `role === "ADMIN"`**. Cualquier otro rol que acceda a `/dashboard` ve una versión reducida (el dashboard SELLER, fuera de alcance de esta spec).

```
if (role !== 'MANAGER' && role !== 'ADMIN') → redirigir a /point-of-sale
```

### 1.2 Selector de sucursal (URL param)

| Rol | Comportamiento |
|---|---|
| `MANAGER` | Ve su sucursal por defecto. Un toggle `LEO / AV135` en el header de la página permite cambiar la vista. El cambio usa `?vista=LEO` o `?vista=AV135` como search param — no requiere estado cliente. |
| `ADMIN` | Ve datos agregados de todas las sucursales. El comparativo entre sucursales siempre muestra ambas en paralelo. No hay selector de sucursal — el ADMIN ve todo. |

El parámetro `vista` solo tiene efecto para MANAGER. Para ADMIN se ignora.

### 1.3 Grid de layout (12 columnas)

```
┌──────────────────────────────────────────────────────────────┐
│  Row 0: Header + selector de sucursal (solo MANAGER)          │
├────────┬────────┬────────┬────────────────────────────────────┤
│ KPI 1  │ KPI 2  │ KPI 3  │ KPI 4            ← Row 1: 4×3 cols │
├────────────────────────────┬───────────────────────────────────┤
│  Tendencia semanal (8 cols) │ Comparativo LEO/AV135 (4 cols)  │  ← Row 2
├────────────────────────────┴───────────────────────────────────┤
│  Últimas ventas — tabla completa (12 cols)   ← Row 3           │
├────────────────────────────┬──────────┬────────────────────────┤
│  Taller activo (6 cols)    │ Atrato   │ Comisiones  ← Row 4    │
│                             │ (3 cols) │ período (3 cols)       │
└────────────────────────────┴──────────┴────────────────────────┘
```

Tailwind: `grid grid-cols-12 gap-4`

### 1.4 Especificación de cada panel

#### Panel A — KPIs del día (Row 1)

4 cards iguales en ancho (`col-span-3`). Estructura interna:

```
[ícono (16px, color acento)]   [etiqueta 11px uppercase muted]
[valor 22px weight-500]
[nota auxiliar 11px muted]
```

| # | Etiqueta | Valor | Ícono | Nota auxiliar |
|---|---|---|---|---|
| 1 | INGRESOS DEL DÍA | `$revenueToday` formateado | `Banknote` | "Ventas completadas" |
| 2 | TRANSACCIONES | `transactionsToday` + " ventas" | `TrendingUp` | "Hoy · cobradas" |
| 3 | EFECTIVO EN CAJA | `$cashInRegister` formateado | `Vault` | "Sesiones abiertas" |
| 4 | APARTADOS | `activeLayawaysCount` + " tickets · $`pendingLayawayAmount`" | `ArchiveRestore` | "Saldo por liquidar" |

La card de ingresos lleva el fondo acento (`--accent`): fondo `#22c55e`, texto blanco. Las demás son `var(--bg-card)`.

#### Panel B — Tendencia semanal (Row 2, col-span-8)

- Header: "Tendencia de Ingresos" (weight-500) + "Últimos 7 días" (11px muted)
- Toggle Semana/Mes en el header: botones con `rounded-[6px]`, activo fondo `--accent`, inactivo fondo `--bg-card-inner`
- Cuerpo v1: placeholder `h-56` con texto "El gráfico se activará en v2" centrado, fondo `--bg-card-inner`, `rounded-[6px]`
- El query para v2 está documentado en §2 pero no se implementa en esta versión

#### Panel C — Comparativo LEO vs AV135 (Row 2, col-span-4)

Siempre muestra ambas sucursales, independiente del rol o del selector de vista.

Estructura por sucursal (2 filas apiladas con separación de fondo):
```
[código sucursal badge]   [nombre]
[barra visual de progreso relativa]
[$revenue]   [N transacciones]
```

La barra es proporcional: la sucursal con mayor ingreso ocupa el 100% del ancho, la otra escala relativamente. Color de la barra: `--accent`.

#### Panel D — Últimas ventas (Row 3, col-span-12)

Tabla con scroll horizontal si es necesario. Columnas:

| Col | Ancho | Contenido |
|---|---|---|
| Folio | auto | badge `rounded-[6px]` fondo `--bg-card-inner` |
| Producto | flex-1 | nombre del modelo (primera variante del item) |
| Voltaje | 80px | etiqueta de voltaje de la variante (`voltaje.label`) |
| Vendedor | 120px | `user.name` |
| Método | 90px | badge por método: CASH = verde, CARD = azul, TRANSFER = violet, CREDIT_BALANCE = amber |
| Monto | 100px text-right | `$total` en color `--accent` |

Filas: máximo 15. Sin paginación en v1. Incluye ventas del día únicamente (desde `startOfDay`).

#### Panel E — Taller activo (Row 4, col-span-6)

Lista de órdenes con estado PENDING o IN_PROGRESS. Por fila:

```
[chip estado]  [cliente · folio]       [voltaje bici si existe]
               [bikeInfo o diagnosis]   [tiempo transcurrido]
```

- Chip PENDING: fondo `--bg-card-inner`, texto muted
- Chip EN PROCESO: fondo `#22c55e/10`, texto `#22c55e`
- Tiempo transcurrido: calculado desde `createdAt` — mostrar "Xh Ym" o "Xd" si > 24h. Si > 48h: texto color `#f59e0b` (amber-400) como alerta visual suave.
- Máximo 8 órdenes. Sin paginación v1.

#### Panel F — Atrato pendiente (Row 4, col-span-3)

Transacciones `method = ATRATO` con `collectionStatus = PENDING`.

Header: "Atrato por Cobrar" + total acumulado en `--accent`

Por fila:
```
[folio de la venta]   [$monto]
[fecha]               [días pendiente]
```

Si días pendiente > 7: monto en amber. Si > 14: monto en red-400.

Máximo 5 filas. Si hay más, mostrar "y N más" al final.

#### Panel G — Comisiones del período (Row 4, col-span-3)

`CommissionRecord` donde `status = PENDING`, mes en curso.

Header: "Comisiones Pendientes" + total acumulado

Por fila:
```
[nombre vendedor]   [$monto]
[folio venta]       [rol badge]
```

Máximo 5 filas. Si hay más, mostrar "y N más".

---

## 2. Queries Prisma necesarias

### 2.0 Tipos base

```typescript
interface SessionUser {
  id: string;
  role: string;       // "ADMIN" | "MANAGER" | "SELLER" | "TECHNICIAN"
  branchId: string | null;
  branchName: string | null;
}

// Resultado serializado del dashboard (pasado como props al cliente)
type DashboardData = {
  kpis: KpiData;
  comparison: BranchComparisonData;
  recentSales: RecentSaleRow[];
  activeOrders: ActiveOrderRow[];
  atratiPendientes: AtratoRow[];
  pendingCommissions: CommissionRow[];
};
```

### 2.1 Preparación de rangos de fecha

```typescript
const now = new Date();
const startOfDay = new Date(now);
startOfDay.setHours(0, 0, 0, 0);
const endOfDay = new Date(now);
endOfDay.setHours(23, 59, 59, 999);
const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
```

### 2.2 Filtro de sucursal

```typescript
// Para MANAGER: usa viewBranchId (del selector de URL o JWT)
// Para ADMIN: sin filtro de branchId en KPIs (agrega todo)
const branchFilter: { branchId?: string } =
  role === 'ADMIN' ? {} : { branchId: viewBranchId };
```

### 2.3 KPI 1 + 2: Ingresos y transacciones

```typescript
type RevenueAgg = {
  _sum: { total: Decimal | null };
  _count: { id: number };
};

const revenueAgg: RevenueAgg = await prisma.sale.aggregate({
  where: { ...branchFilter, status: 'COMPLETED', createdAt: { gte: startOfDay, lte: endOfDay } },
  _sum: { total: true },
  _count: { id: true },
});

const revenueToday: number = Number(revenueAgg._sum.total ?? 0);
const transactionsToday: number = revenueAgg._count.id;
```

### 2.4 KPI 3: Efectivo en caja

Suma neta de CASH en sesiones OPEN del branch.
`PAYMENT_IN` suma positivo. `REFUND_OUT`, `EXPENSE_OUT`, `WITHDRAWAL` suman negativo.

```typescript
type CashAgg = { _sum: { amount: Decimal | null } };

const [cashIn, cashOut, openingAmts]: [CashAgg, CashAgg, { _sum: { openingAmt: Decimal | null } }] =
  await Promise.all([
    prisma.cashTransaction.aggregate({
      where: {
        session: { ...branchFilter, status: 'OPEN' },
        type: 'PAYMENT_IN',
        method: 'CASH',
      },
      _sum: { amount: true },
    }),
    prisma.cashTransaction.aggregate({
      where: {
        session: { ...branchFilter, status: 'OPEN' },
        type: { in: ['REFUND_OUT', 'EXPENSE_OUT', 'WITHDRAWAL'] },
        method: 'CASH',
      },
      _sum: { amount: true },
    }),
    prisma.cashRegisterSession.aggregate({
      where: { ...branchFilter, status: 'OPEN' },
      _sum: { openingAmt: true },
    }),
  ]);

const cashInRegister: number =
  Number(openingAmts._sum.openingAmt ?? 0) +
  Number(cashIn._sum.amount ?? 0) -
  Number(cashOut._sum.amount ?? 0);
```

### 2.5 KPI 4: Apartados activos

```typescript
type LayawaySummary = {
  id: string;
  total: Decimal;
  payments: { amount: Decimal }[];
};

const layaways: LayawaySummary[] = await prisma.sale.findMany({
  where: { ...branchFilter, status: 'LAYAWAY' },
  select: {
    id: true,
    total: true,
    payments: { select: { amount: true } },
  },
});

const activeLayawaysCount: number = layaways.length;
const pendingLayawayAmount: number = layaways.reduce((acc, l) => {
  const paid = l.payments.reduce((s, p) => s + Number(p.amount), 0);
  return acc + (Number(l.total) - paid);
}, 0);
```

### 2.6 Comparativo LEO vs AV135

Siempre consulta ambas sucursales por código, independientemente del rol.

```typescript
type BranchRecord = { id: string; code: string; name: string };

const branches: BranchRecord[] = await prisma.branch.findMany({
  select: { id: true, code: true, name: true },
  orderBy: { code: 'asc' },
});

type BranchComparisonData = Array<{
  branchId: string;
  branchCode: string;
  branchName: string;
  revenue: number;
  transactions: number;
}>;

const comparison: BranchComparisonData = await Promise.all(
  branches.map(async (b) => {
    const agg = await prisma.sale.aggregate({
      where: { branchId: b.id, status: 'COMPLETED', createdAt: { gte: startOfDay, lte: endOfDay } },
      _sum: { total: true },
      _count: { id: true },
    });
    return {
      branchId: b.id,
      branchCode: b.code,
      branchName: b.name,
      revenue: Number(agg._sum.total ?? 0),
      transactions: agg._count.id,
    };
  })
);
```

### 2.7 Tendencia semanal (v2 — documentado, no implementar en v1)

```typescript
// v2: Raw query agrupada por fecha
// const sevenDaysAgo = new Date(now);
// sevenDaysAgo.setDate(now.getDate() - 6);
// sevenDaysAgo.setHours(0, 0, 0, 0);
//
// type WeeklyPoint = { date: Date; revenue: number };
// const weeklyTrend: WeeklyPoint[] = await prisma.$queryRaw`
//   SELECT DATE("createdAt") as date, CAST(SUM(total) AS FLOAT) as revenue
//   FROM "Sale"
//   WHERE "branchId" = ${viewBranchId}
//     AND status = 'COMPLETED'
//     AND "createdAt" >= ${sevenDaysAgo}
//   GROUP BY DATE("createdAt")
//   ORDER BY date ASC
// `;
// v1: no query, renderizar placeholder
```

### 2.8 Últimas ventas del día

```typescript
type RecentSalePrisma = {
  id: string;
  folio: string;
  total: Decimal;
  createdAt: Date;
  items: Array<{
    productVariant: {
      modelo: { nombre: string };
      voltaje: { label: string };
    } | null;
  }>;
  user: { name: string };
  payments: Array<{ method: string }>;
};

const recentSalesPrisma: RecentSalePrisma[] = await prisma.sale.findMany({
  where: { ...branchFilter, status: 'COMPLETED', createdAt: { gte: startOfDay } },
  orderBy: { createdAt: 'desc' },
  take: 15,
  select: {
    id: true,
    folio: true,
    total: true,
    createdAt: true,
    items: {
      take: 1,
      select: {
        productVariant: {
          select: {
            modelo: { select: { nombre: true } },
            voltaje: { select: { label: true } },
          },
        },
      },
    },
    user: { select: { name: true } },
    payments: {
      take: 1,
      orderBy: { createdAt: 'asc' },
      select: { method: true },
    },
  },
});

type RecentSaleRow = {
  id: string;
  folio: string;
  total: number;
  createdAt: Date;
  mainProduct: string | null;
  mainProductVoltaje: string | null;
  vendedor: string;
  paymentMethod: string | null;
};

const recentSales: RecentSaleRow[] = recentSalesPrisma.map((s) => ({
  id: s.id,
  folio: s.folio,
  total: Number(s.total),
  createdAt: s.createdAt,
  mainProduct: s.items[0]?.productVariant?.modelo.nombre ?? null,
  mainProductVoltaje: s.items[0]?.productVariant?.voltaje.label ?? null,
  vendedor: s.user.name,
  paymentMethod: s.payments[0]?.method ?? null,
}));
```

### 2.9 Órdenes de taller activas

```typescript
type ActiveOrderPrisma = {
  id: string;
  folio: string;
  status: string;
  createdAt: Date;
  bikeInfo: string | null;
  customer: { name: string };
  customerBike: {
    model: string | null;
    voltaje: string | null;
    serialNumber: string;
  } | null;
};

const activeOrdersPrisma: ActiveOrderPrisma[] = await prisma.serviceOrder.findMany({
  where: { ...branchFilter, status: { in: ['PENDING', 'IN_PROGRESS'] } },
  orderBy: { createdAt: 'asc' },
  take: 8,
  select: {
    id: true,
    folio: true,
    status: true,
    createdAt: true,
    bikeInfo: true,
    customer: { select: { name: true } },
    customerBike: {
      select: { model: true, voltaje: true, serialNumber: true },
    },
  },
});

type ActiveOrderRow = {
  id: string;
  folio: string;
  status: string;
  createdAt: Date;
  customerName: string;
  bikeInfo: string | null;
  bikeVoltaje: string | null;
  minutosTranscurridos: number;
};

const activeOrders: ActiveOrderRow[] = activeOrdersPrisma.map((o) => ({
  id: o.id,
  folio: o.folio,
  status: o.status,
  createdAt: o.createdAt,
  customerName: o.customer.name,
  bikeInfo: o.bikeInfo ?? o.customerBike?.model ?? null,
  bikeVoltaje: o.customerBike?.voltaje ?? null,
  minutosTranscurridos: Math.floor((now.getTime() - o.createdAt.getTime()) / 60000),
}));
```

### 2.10 Atrato pendiente de cobrar

```typescript
type AtratiPrisma = {
  id: string;
  amount: Decimal;
  createdAt: Date;
  sale: { folio: string; createdAt: Date } | null;
};

const atratiPrisma: AtratiPrisma[] = await prisma.cashTransaction.findMany({
  where: {
    method: 'ATRATO',
    collectionStatus: 'PENDING',
    session: { ...branchFilter },
  },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    amount: true,
    createdAt: true,
    sale: { select: { folio: true, createdAt: true } },
  },
});

type AtratoRow = {
  id: string;
  amount: number;
  createdAt: Date;
  saleForlio: string | null;
  diasPendiente: number;
};

const atratiPendientes: AtratoRow[] = atratiPrisma.map((t) => ({
  id: t.id,
  amount: Number(t.amount),
  createdAt: t.createdAt,
  saleForlio: t.sale?.folio ?? null,
  diasPendiente: Math.floor((now.getTime() - t.createdAt.getTime()) / 86400000),
}));

const atratoTotal: number = atratiPendientes.reduce((s, t) => s + t.amount, 0);
```

### 2.11 Comisiones del período (mes actual)

```typescript
type CommissionPrisma = {
  id: string;
  amount: Decimal;
  createdAt: Date;
  user: { name: string; role: string };
  sale: { folio: string; total: Decimal };
};

const commissionsPrisma: CommissionPrisma[] = await prisma.commissionRecord.findMany({
  where: {
    status: 'PENDING',
    createdAt: { gte: startOfMonth },
    user: { ...branchFilter },
  },
  orderBy: { createdAt: 'desc' },
  select: {
    id: true,
    amount: true,
    createdAt: true,
    user: { select: { name: true, role: true } },
    sale: { select: { folio: true, total: true } },
  },
});

type CommissionRow = {
  id: string;
  amount: number;
  createdAt: Date;
  userName: string;
  userRole: string;
  saleForlio: string;
  saleTotal: number;
};

const pendingCommissions: CommissionRow[] = commissionsPrisma.map((c) => ({
  id: c.id,
  amount: Number(c.amount),
  createdAt: c.createdAt,
  userName: c.user.name,
  userRole: c.user.role,
  saleForlio: c.sale.folio,
  saleTotal: Number(c.sale.total),
}));

const commissionsTotal: number = pendingCommissions.reduce((s, c) => s + c.amount, 0);
```

---

## 3. Tokens de diseño aplicados (variables CSS)

Definir en `src/app/globals.css` bajo `:root` y `.dark`. No crear nuevo archivo CSS.

```css
:root {
  /* Layout */
  --sidebar-bg: #18181b;          /* zinc-900 — fijo en ambos modos */
  --sidebar-accent: #22c55e;      /* green-500 — fijo */

  /* Fondos (light) */
  --bg-base: #f4f4f5;             /* zinc-100 */
  --bg-card: #ffffff;
  --bg-card-inner: #f9fafb;       /* zinc-50 — para nested / placeholder */
  --bg-card-hover: #f1f5f9;       /* slate-100 */

  /* Texto (light) */
  --text-primary: #09090b;        /* zinc-950 */
  --text-muted: #71717a;          /* zinc-500 */

  /* Acento (ambos modos) */
  --accent: #22c55e;              /* green-500 */
  --accent-subtle: #f0fdf4;       /* green-50 */
  --accent-text: #166534;         /* green-800 — texto sobre fondo sutil */

  /* Alertas */
  --warning: #f59e0b;             /* amber-400 */
  --danger: #f87171;              /* red-400 */

  /* Radios */
  --radius-card: 10px;
  --radius-inner: 6px;
}

.dark {
  --bg-base: #09090b;             /* zinc-950 */
  --bg-card: #18181b;             /* zinc-900 */
  --bg-card-inner: #27272a;       /* zinc-800 */
  --bg-card-hover: #3f3f46;       /* zinc-700 */
  --text-primary: #fafafa;        /* zinc-50 */
  --text-muted: #71717a;          /* zinc-500 — igual en ambos */
  --accent-subtle: #052e16;       /* green-950 */
  --accent-text: #86efac;         /* green-300 — sobre fondo oscuro */
}
```

### Tipografía

- `font-family`: `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`
- Pesos permitidos: `400` (normal) y `500` (medium) únicamente
- Eliminar referencias a `font-space-grotesk` y `font-inter` del dashboard
- Tamaños aplicados:
  - Título de sección: `text-sm` (14px) `font-medium`
  - Label KPI: `text-[11px] uppercase tracking-wider font-medium`
  - Valor KPI: `text-[22px] font-medium`
  - Nota auxiliar KPI: `text-[11px] font-normal`
  - Cuerpo tabla: `text-sm font-normal`
  - Badge / chip: `text-[11px] font-medium`

### Glassmorphism — solo topbar (floating element)

```css
/* Topbar — único lugar permitido */
backdrop-filter: blur(12px);
background: rgba(255,255,255,0.8);   /* light */
/* dark: rgba(9,9,11,0.8) */
border-bottom: 1px solid rgba(0,0,0,0.06);   /* ghost border, no separa secciones */
```

Las cards del dashboard **no usan glassmorphism**. Separación solo por diferencia de fondo (`--bg-base` vs `--bg-card`).

### Sombras

- Cards en light mode: `box-shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)` — ambient, no drop shadow estándar
- Cards en dark mode: sin sombra (el fondo oscuro ya eleva)
- No usar `shadow-sm`, `shadow-md` de Tailwind — usar la variable directamente

---

## 4. Estados vacíos de cada panel

| Panel | Estado vacío |
|---|---|
| KPIs | Valor `$0.00` o `00` — nunca skeleton. Se muestra el 0 real. |
| Tendencia semanal | Placeholder "El gráfico se activará en v2" — no cambia |
| Comparativo | Si no hay ventas del día: barras en `0%`, mostrar "$0.00 · 0 ventas". No ocultar el panel. |
| Últimas ventas | `<tr>` único con "No hay ventas registradas hoy." centrado en la tabla, spanning todas las columnas |
| Taller activo | "No hay órdenes activas." centrado, `text-muted`, `py-8` |
| Atrato pendiente | "Sin cobros Atrato pendientes." + ícono `CheckCircle` en `--accent` |
| Comisiones | "No hay comisiones pendientes este mes." + ícono `CheckCircle` en `--accent` |

Regla general: los paneles vacíos **mantienen su altura mínima** (`min-h-[100px]`) para que el grid no colapse.

---

## 5. Comportamiento light/dark mode

### Sidebar

**No cambia en ningún modo.** Siempre `background: var(--sidebar-bg)` (`#18181b`). El toggle de modo no afecta al sidebar.

```
sidebar → bg-[#18181b] — hardcoded, NO usa var(--bg-card)
```

### Topbar

- Light: `bg-white/80 backdrop-blur-[12px] border-b border-black/[0.06]`
- Dark: `bg-zinc-950/80 backdrop-blur-[12px] border-b border-white/[0.06]`

### Área principal (dashboard)

- Light: `background: var(--bg-base)` → `#f4f4f5`
- Dark: `background: var(--bg-base)` → `#09090b`

### Cards

- Light: `background: var(--bg-card)` + sombra ambient
- Dark: `background: var(--bg-card)` → `#18181b` sin sombra

### Card de ingresos (acento)

Fondo `--accent` (`#22c55e`) y texto blanco **en ambos modos**. No cambia.

### Badges de método de pago

| Método | Light | Dark |
|---|---|---|
| CASH | `bg-green-50 text-green-700` | `bg-green-950 text-green-300` |
| CARD | `bg-blue-50 text-blue-700` | `bg-blue-950 text-blue-300` |
| TRANSFER | `bg-violet-50 text-violet-700` | `bg-violet-950 text-violet-300` |
| CREDIT_BALANCE | `bg-amber-50 text-amber-700` | `bg-amber-950 text-amber-300` |
| ATRATO | `bg-orange-50 text-orange-700` | `bg-orange-950 text-orange-300` |

### Toggle de modo

- Posición: icono `Sun`/`Moon` en el topbar, extremo derecho junto al avatar
- Implementado con `next-themes` (`useTheme`) — ya disponible en el proyecto
- Estado inicial: `"light"` (forzado desde `12f2e5e`)

### Tabla de últimas ventas

- Fila hover: `hover:bg-[--bg-card-hover]`
- Header de tabla: `text-[11px] uppercase tracking-wider text-muted font-medium`
- Sin línea separadora entre filas — usar `py-3` y diferencia de fondo en hover

---

## 6. Archivos afectados (solo este spec)

| Archivo | Cambio |
|---|---|
| `src/app/(pos)/dashboard/page.tsx` | Reemplazar queries y layout completo |
| `src/app/globals.css` | Agregar variables CSS `--accent`, `--bg-card-inner`, `--radius-card`, `--radius-inner` |

No se crean archivos nuevos. No se toca ningún otro módulo.

---

## 7. Lo que NO cambia

- Lógica de Server Actions (`sale.ts`, `workshop.ts`, etc.)
- Sidebar visual (rediseñado en commits previos) — solo se cambia el color de fondo de `#0d0d0d` a `#18181b`
- Rutas y navegación
- Autenticación y sesión (`auth.ts`)
- `CashSessionManager` overlay
- Todos los demás módulos (POS, Inventario, Taller, Apartados, Clientes)
- Componentes shadcn en `src/components/ui/`
