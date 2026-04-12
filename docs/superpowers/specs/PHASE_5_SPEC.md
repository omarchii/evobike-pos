# Fase 5 — Reportes, Historial de Ventas y Comisiones

## 1. Resumen

Fase 5 completa el ciclo de información del negocio. Añade cuatro sub-módulos que hoy no existen o están incompletos:

1. **Historial de Ventas** (2F.5 diferido) — tabla filtrable con detalle por venta
2. **Reportes de Caja** — desglose COLLECTED vs PENDING por turno y período
3. **Módulo de Comisiones** — CRUD de reglas, generación automática al vender, panel de aprobación/pago
4. **Dashboard Gerencial mejorado** — KPIs de período, tendencias, y acceso a reportes

No hay riesgo de regresión en el flujo de venta: Fase 5 es **solo lectura** (queries de agregación) más el ciclo de vida de comisiones (escritura aislada). No toca `pos-terminal.tsx`, `POST /api/sales`, ni ningún flujo transaccional existente.

---

## 2. Decisiones rectoras

| # | Decisión | Razón |
|---|---|---|
| D1 | Historial de ventas es una página nueva `/ventas` con tabla paginada server-side | Volumen potencialmente alto. No es viable cargar todo en memoria. |
| D2 | Los reportes de caja operan sobre `CashTransaction` + `CashRegisterSession`, no recalculan desde Sales | La fuente de verdad financiera es la transacción de caja, no la venta. Una venta puede tener múltiples pagos en distintos métodos. |
| D3 | Las comisiones se generan al momento de la venta (`POST /api/sales` y `POST /api/pedidos`) | Cálculo determinista en el mismo `$transaction`. Evita cron jobs y race conditions. |
| D4 | El ciclo de comisiones es: `PENDING → APPROVED → PAID`. Solo MANAGER/ADMIN aprueban. Solo ADMIN marca como PAID. | Segregación de responsabilidades. El vendedor ve pero no modifica. |
| D5 | Reportes de caja distinguen `COLLECTED` vs `PENDING` (Atrato) en todo momento | Decisión de negocio existente (ya está en el schema con `CollectionStatus`). Los reportes lo hacen visible por primera vez. |
| D6 | No se crea schema nuevo. `CommissionRule` y `CommissionRecord` ya existen. Solo se necesitan API routes y UI. | Fase 1C creó los modelos. Solo falta el código de aplicación. |
| D7 | Paginación server-side con cursor-based para historial de ventas, offset-based para reportes | Historial crece indefinidamente (cursor es O(1)). Reportes son rangos de fecha acotados (offset es suficiente). |
| D8 | Los reportes no tienen export PDF/Excel en Fase 5. Se difiere a Fase 6 si se necesita. | Reducir scope. La UI de reportes en pantalla tiene prioridad. |
| D9 | La navegación agrega un item "Reportes" con sub-rutas, no items separados en el sidebar | Un solo punto de entrada para toda la inteligencia de negocio. |
| D10 | Comisiones sobre ventas CANCELLED se eliminan (soft: status → CANCELLED, no delete) | Si se cancela una venta, sus comisiones no deben pagarse. El campo `status` del CommissionRecord necesita un nuevo valor CANCELLED. |

---

## 3. Cambios de schema

### 3.1 Modificación a enum existente

```prisma
enum CommissionStatus {
  PENDING    // Generada automáticamente al vender
  APPROVED   // Aprobada por MANAGER/ADMIN
  PAID       // Pagada al vendedor
  CANCELLED  // Venta cancelada → comisión invalidada (NUEVO)
}
```

> **Migración**: `ALTER TYPE "CommissionStatus" ADD VALUE 'CANCELLED';` — aditiva, no destructiva.

### 3.2 No se crean modelos nuevos

Todos los modelos necesarios ya existen:
- `CommissionRule` — reglas por rol/modelo/sucursal
- `CommissionRecord` — registros generados por venta
- `Sale`, `SaleItem`, `CashTransaction`, `CashRegisterSession` — datos fuente para reportes

---

## 4. Sub-módulo A — Historial de Ventas (`/ventas`)

### 4.1 Página: `/ventas` (Server Component)

**Ruta**: `src/app/(pos)/ventas/page.tsx`

> Ya existe `/ventas/[id]` (Fase 4). Esta es la página índice que lista todas las ventas.

**Datos visibles** (tabla paginada):

| Columna | Fuente | Notas |
|---------|--------|-------|
| Folio | `Sale.folio` | Link a `/ventas/[id]` |
| Fecha | `Sale.createdAt` | Formato `dd mmm yyyy HH:mm` |
| Cliente | `Sale.customer.name` | "Sin cliente" si null |
| Vendedor | `Sale.user.name` | |
| Tipo | `Sale.status` + `Sale.orderType` | Chip: COMPLETED, LAYAWAY, CANCELLED, BACKORDER |
| Método de pago | `CashTransaction.method` (primer pago) | Chip con color por método |
| Total | `Sale.total` | Formato MXN |

**Filtros** (query params, server-side):

| Filtro | Tipo | Default |
|--------|------|---------|
| Rango de fecha | Date range picker | Últimos 30 días |
| Vendedor | Select (usuarios de la sucursal) | Todos |
| Estado | Multi-select chips | Todos |
| Método de pago | Select | Todos |
| Búsqueda por folio | Text input | — |
| Cliente | Text input (búsqueda parcial) | — |

**Paginación**: Cursor-based, 25 items por página. Cursor = `Sale.createdAt` + `Sale.id` (composite para determinismo).

**Permisos**:
- SELLER: solo ve sus propias ventas (`userId = session.user.id`)
- MANAGER: ve todas las ventas de su sucursal
- ADMIN: ve todas las ventas de todas las sucursales (+ filtro por sucursal)

### 4.2 API Route: `GET /api/ventas`

**Ruta**: `src/app/api/ventas/route.ts`

> Separada de `POST /api/sales` (creación). GET para listado con filtros. El nombre en español (`ventas`) es consistente con la convención de URLs del POS.

**Query params**:
```
?cursor=<id>&limit=25
&from=2026-04-01&to=2026-04-30
&userId=<uuid>
&status=COMPLETED,LAYAWAY
&paymentMethod=CASH,CARD
&folio=LEO
&customer=García
&branchId=<uuid>  (solo ADMIN)
```

**Response**:
```typescript
{
  success: true,
  data: {
    items: SaleListItem[],
    nextCursor: string | null,
    totalCount: number  // para UI "Mostrando X de Y"
  }
}
```

**Implementación**:
```typescript
// Pseudocódigo del query principal
const where: Prisma.SaleWhereInput = {
  branchId: isAdmin ? input.branchId : userBranchId,
  ...(isSeller && { userId: session.user.id }),
  createdAt: { gte: from, lte: to },
  ...(statuses.length && { status: { in: statuses } }),
  ...(folio && { folio: { contains: folio, mode: "insensitive" } }),
  ...(customer && {
    customer: { name: { contains: customer, mode: "insensitive" } },
  }),
};

// Payment method filter requires join
if (paymentMethod) {
  where.payments = { some: { method: { in: paymentMethods } } };
}

const sales = await prisma.sale.findMany({
  where,
  include: {
    customer: { select: { name: true } },
    user: { select: { name: true } },
    payments: { select: { method: true }, take: 1 },
  },
  orderBy: { createdAt: "desc" },
  take: limit + 1, // +1 para saber si hay más
  ...(cursor && {
    cursor: { id: cursor },
    skip: 1,
  }),
});
```

---

## 5. Sub-módulo B — Reportes de Caja (`/reportes/caja`)

### 5.1 Página: `/reportes/caja` (Server Component)

**Ruta**: `src/app/(pos)/reportes/caja/page.tsx`

**Dos vistas**:

#### Vista 1: Por Turno (Session)

Lista de `CashRegisterSession` cerradas, con desglose por cada una.

| Dato | Fuente |
|------|--------|
| Cajero | `session.user.name` |
| Apertura | `session.openedAt` |
| Cierre | `session.closedAt` |
| Monto apertura | `session.openingAmt` |
| Monto cierre declarado | `session.closingAmt` |
| **Efectivo real en caja** | `openingAmt + Σ(CASH PAYMENT_IN) - Σ(CASH REFUND_OUT + EXPENSE_OUT + WITHDRAWAL)` |
| **Diferencia** | `closingAmt - efectivoReal` (verde si 0, rojo si ≠ 0) |
| Total COLLECTED | `Σ(tx WHERE collectionStatus = COLLECTED)` |
| Total PENDING | `Σ(tx WHERE collectionStatus = PENDING)` — típicamente Atrato |
| Desglose por método | Grouped by `method`: CASH, CARD, TRANSFER, CREDIT_BALANCE, ATRATO |
| Nro. transacciones | Count |

**Expandible**: al hacer click en un turno, se expande mostrando cada `CashTransaction` individual (tipo, método, monto, referencia, venta asociada).

#### Vista 2: Por Período

Agregación de todas las transacciones en un rango de fecha.

| KPI | Query |
|-----|-------|
| Ingresos totales (COLLECTED) | `SUM(amount) WHERE type=PAYMENT_IN AND collectionStatus=COLLECTED` |
| Ingresos pendientes (PENDING) | `SUM(amount) WHERE type=PAYMENT_IN AND collectionStatus=PENDING` |
| Devoluciones | `SUM(amount) WHERE type=REFUND_OUT` |
| Gastos | `SUM(amount) WHERE type=EXPENSE_OUT` |
| Retiros | `SUM(amount) WHERE type=WITHDRAWAL` |
| **Neto operativo** | `COLLECTED - Devoluciones - Gastos - Retiros` |
| Desglose por método | Agrupado por `PaymentMethod` |
| Desglose por día | Agrupado por `DATE(createdAt)` — mini-gráfico de barras opcional |

**Filtros**:
- Rango de fecha (default: mes actual)
- Sucursal (ADMIN: todas; MANAGER: la suya)
- Cajero (select)

**Permisos**:
- SELLER: no tiene acceso a reportes de caja
- MANAGER: ve reportes de su sucursal
- ADMIN: ve todas las sucursales con filtro

### 5.2 API Route: `GET /api/reportes/caja`

**Ruta**: `src/app/api/reportes/caja/route.ts`

**Query params**:
```
?view=sessions|period
&from=2026-04-01&to=2026-04-30
&branchId=<uuid>
&userId=<uuid>
```

**Response (view=sessions)**:
```typescript
{
  success: true,
  data: {
    sessions: Array<{
      id: string;
      userName: string;
      openedAt: string;
      closedAt: string | null;
      openingAmt: number;
      closingAmt: number | null;
      cashReal: number;       // calculado
      difference: number;     // closingAmt - cashReal
      totalCollected: number;
      totalPending: number;
      transactionCount: number;
      byMethod: Record<PaymentMethod, number>;
      transactions: Array<{
        id: string;
        type: string;
        method: string;
        amount: number;
        reference: string | null;
        collectionStatus: string;
        createdAt: string;
        saleFolio: string | null;
      }>;
    }>;
  }
}
```

**Response (view=period)**:
```typescript
{
  success: true,
  data: {
    summary: {
      totalCollected: number;
      totalPending: number;
      totalRefunds: number;
      totalExpenses: number;
      totalWithdrawals: number;
      netOperating: number;
    };
    byMethod: Record<PaymentMethod, { collected: number; pending: number }>;
    byDay: Array<{ date: string; collected: number; pending: number }>;
  }
}
```

---

## 6. Sub-módulo C — Comisiones (`/reportes/comisiones`)

### 6.1 Flujo completo

```
Venta cerrada (POST /api/sales)
  └─ Dentro del $transaction:
       └─ Buscar CommissionRule activa para (userId.role, branchId, modelo_id?)
            └─ Si existe: crear CommissionRecord(PENDING, amount calculado)

MANAGER revisa en /reportes/comisiones
  └─ Filtra PENDING → selecciona → Aprobar (batch)
       └─ PATCH /api/comisiones/batch → status = APPROVED

ADMIN marca como pagadas
  └─ Filtra APPROVED → selecciona → Marcar pagadas (batch)
       └─ PATCH /api/comisiones/batch → status = PAID

Venta cancelada (POST /api/sales/[id]/cancel)
  └─ Dentro del $transaction:
       └─ UPDATE CommissionRecord SET status = CANCELLED WHERE saleId = X
```

### 6.2 Generación automática de comisiones

**Dónde**: Dentro del `$transaction` de `POST /api/sales` (path normal y path de conversión de cotización) y `POST /api/pedidos`.

**Lógica**:
```typescript
// Pseudocódigo — ejecutar dentro del $transaction existente
async function generateCommissions(
  tx: PrismaTransactionClient,
  sale: Sale & { items: SaleItem[] },
  userId: string,
  branchId: string,
): Promise<void> {
  // Obtener rol del vendedor
  const user = await tx.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user) return;

  // Para cada item de la venta, buscar regla aplicable
  for (const item of sale.items) {
    if (item.isFreeForm || !item.productVariantId) continue;

    const variant = await tx.productVariant.findUnique({
      where: { id: item.productVariantId },
      select: { modelo_id: true },
    });
    if (!variant) continue;

    // Buscar regla: primero específica por modelo, luego genérica (modeloId = null)
    const rule = await tx.commissionRule.findFirst({
      where: {
        branchId,
        role: user.role,
        isActive: true,
        OR: [
          { modeloId: variant.modelo_id },
          { modeloId: null },
        ],
      },
      orderBy: { modeloId: "desc" }, // específica primero (not null > null)
    });
    if (!rule) continue;

    // Calcular monto
    const lineTotal = Number(item.price) * item.quantity - Number(item.discount);
    const amount =
      rule.commissionType === "PERCENTAGE"
        ? lineTotal * (Number(rule.value) / 100)
        : Number(rule.value); // FIXED_AMOUNT por línea

    if (amount <= 0) continue;

    await tx.commissionRecord.create({
      data: {
        saleId: sale.id,
        userId,
        ruleId: rule.id,
        amount,
        status: "PENDING",
      },
    });
  }
}
```

**Reglas de búsqueda de CommissionRule**:
1. Match exacto: `role + branchId + modeloId`
2. Fallback genérico: `role + branchId + modeloId = null`
3. Si no hay regla → no se genera comisión (silencioso, no es error)

### 6.3 Cancelación de comisiones

**Dónde**: Agregar al `$transaction` de `POST /api/sales/[id]/cancel`.

```typescript
// Dentro del $transaction existente de cancelación
await tx.commissionRecord.updateMany({
  where: { saleId: sale.id, status: { in: ["PENDING", "APPROVED"] } },
  data: { status: "CANCELLED" },
});
```

### 6.4 Página: `/reportes/comisiones` (Server Component)

**Ruta**: `src/app/(pos)/reportes/comisiones/page.tsx`

**Vista por rol**:

#### SELLER
- Ve solo sus comisiones
- KPIs: Total PENDING, Total APPROVED, Total PAID (mes actual)
- Tabla: lista de `CommissionRecord` con folio de venta, monto, status, fecha
- Sin acciones (solo lectura)

#### MANAGER
- Ve comisiones de todos los usuarios de su sucursal
- KPIs: Total PENDING (equipo), Total por aprobar, Total aprobado (mes)
- Tabla con filtros: usuario, status, rango de fecha
- **Acción**: Seleccionar múltiples → "Aprobar seleccionadas" (batch)
- Agrupable por vendedor

#### ADMIN
- Ve comisiones de todas las sucursales
- Mismos KPIs que MANAGER pero cross-branch
- **Acciones**: Aprobar (batch) + Marcar como pagadas (batch)
- Filtro por sucursal adicional

### 6.5 CRUD de Reglas: `/reportes/comisiones/reglas`

**Ruta**: `src/app/(pos)/reportes/comisiones/reglas/page.tsx`

**Solo MANAGER/ADMIN**.

**Tabla de reglas existentes**:

| Columna | Campo |
|---------|-------|
| Rol | `CommissionRule.role` |
| Tipo | `PERCENTAGE` / `FIXED_AMOUNT` |
| Valor | `3.5%` o `$50.00` |
| Modelo | `Modelo.nombre` o "Todos" |
| Activa | Toggle |
| Acciones | Editar, Desactivar |

**Modal crear/editar regla**:
- Rol (select: SELLER, TECHNICIAN, MANAGER)
- Tipo de comisión (PERCENTAGE / FIXED_AMOUNT)
- Valor (number input)
- Modelo (select con opción "Todos los modelos")
- Sucursal: se toma del usuario (MANAGER) o select (ADMIN)

### 6.6 API Routes de Comisiones

| Método | Ruta | Descripción |
|--------|------|-------------|
| `GET` | `/api/comisiones` | Lista comisiones con filtros (userId, branchId, status, dateRange) |
| `PATCH` | `/api/comisiones/batch` | Actualizar status en lote: `{ ids: string[], status: "APPROVED" \| "PAID" }` |
| `GET` | `/api/comisiones/reglas` | Lista reglas de la sucursal |
| `POST` | `/api/comisiones/reglas` | Crear regla |
| `PATCH` | `/api/comisiones/reglas/[id]` | Editar regla |
| `DELETE` | `/api/comisiones/reglas/[id]` | Soft-delete (isActive = false) |

---

## 7. Sub-módulo D — Dashboard Gerencial mejorado

### 7.1 Cambios al dashboard existente

El `manager-dashboard.tsx` ya tiene KPIs de hoy. Fase 5 añade:

**Nuevo selector de período** en la parte superior:
- Hoy (default actual)
- Esta semana
- Este mes
- Rango personalizado

Los KPIs existentes (revenue, transactions, cash, layaways) se recalculan según el período seleccionado. La comparación cambia dinámicamente (ayer → semana pasada → mes pasado).

**Nuevas secciones** (debajo de las existentes):

| Sección | Datos | Visible para |
|---------|-------|-------------|
| Ventas por modelo | Top 5 modelos por revenue en el período | MANAGER, ADMIN |
| Ventas por vendedor | Ranking de vendedores por revenue | MANAGER, ADMIN |
| Flujo de caja | COLLECTED vs PENDING del período (2 números grandes) | MANAGER, ADMIN |
| Comisiones del equipo | Total PENDING + APPROVED, link a `/reportes/comisiones` | MANAGER, ADMIN |

### 7.2 Implementación

El selector de período se implementa como **query params** en la URL (`?period=week` o `?from=X&to=Y`). El Server Component re-consulta Prisma con el rango. No requiere API route nueva — es una query directa en `page.tsx`.

---

## 8. Navegación

### 8.1 Cambios al Sidebar

Agregar un item "Reportes" con sub-items colapsables:

```
📊 Reportes
  ├── Historial de Ventas    → /ventas
  ├── Caja                   → /reportes/caja
  └── Comisiones             → /reportes/comisiones
```

**Permisos por item**:
- Historial de Ventas: todos los roles (SELLER ve solo las suyas)
- Caja: MANAGER, ADMIN
- Comisiones: todos los roles (SELLER ve solo las suyas, read-only)

**Implementación**: El sidebar ya tiene un array estático de items. Agregar un item con `children` y lógica de collapse/expand. Filtrar hijos por rol.

---

## 9. Estructura de archivos

```
src/app/(pos)/
  ventas/
    page.tsx                    ← NUEVO: historial de ventas (Server Component)
    sales-history-table.tsx     ← NUEVO: Client Component con filtros y tabla
    sales-filters.tsx           ← NUEVO: barra de filtros
  reportes/
    layout.tsx                  ← NUEVO: layout de reportes (tabs/breadcrumbs)
    caja/
      page.tsx                  ← NUEVO: Server Component
      cash-report.tsx           ← NUEVO: Client Component con toggle session/period
      session-detail.tsx        ← NUEVO: expandible de sesión individual
    comisiones/
      page.tsx                  ← NUEVO: Server Component
      commissions-table.tsx     ← NUEVO: Client Component con tabla y acciones batch
      reglas/
        page.tsx                ← NUEVO: Server Component
        commission-rules.tsx    ← NUEVO: Client Component con CRUD

src/app/api/
  ventas/
    route.ts                    ← NUEVO: GET con filtros y paginación cursor
  reportes/
    caja/
      route.ts                  ← NUEVO: GET con vista sessions/period
  comisiones/
    route.ts                    ← NUEVO: GET lista + PATCH batch
    reglas/
      route.ts                  ← NUEVO: GET + POST
      [id]/
        route.ts                ← NUEVO: PATCH + DELETE
```

---

## 10. Orden de implementación (sub-fases)

| Sub-fase | Descripción | Dependencias |
|----------|-------------|-------------|
| **5-A** | Schema: agregar `CANCELLED` a `CommissionStatus` + migración | Ninguna |
| **5-B** | Historial de Ventas: `GET /api/ventas` + página `/ventas` con tabla filtrable | 5-A (por el enum, aunque no lo usa directamente) |
| **5-C** | Reportes de Caja: `GET /api/reportes/caja` + página `/reportes/caja` | Ninguna |
| **5-D** | CRUD de Reglas de Comisión: API routes + página `/reportes/comisiones/reglas` | 5-A |
| **5-E** | Generación automática de comisiones en `POST /api/sales` y `POST /api/pedidos` + cancelación en `POST /api/sales/[id]/cancel` | 5-A, 5-D (necesita reglas creadas) |
| **5-F** | Panel de Comisiones: página `/reportes/comisiones` con tabla, filtros, batch approve/pay | 5-E |
| **5-G** | Dashboard Gerencial mejorado: selector de período + nuevas secciones | 5-B, 5-C (usa los mismos queries) |
| **5-H** | Navegación: agregar "Reportes" al sidebar con sub-items | 5-B, 5-C, 5-F (todas las páginas existen) |

**Modelo sugerido por sub-fase**:
- 5-A: Sonnet (migración trivial)
- 5-B: Sonnet (CRUD estándar, tabla con filtros)
- 5-C: Opus (queries de agregación financiera, lógica COLLECTED vs PENDING)
- 5-D: Sonnet (CRUD estándar)
- 5-E: Opus (modificar $transaction existente sin regresión, lógica de búsqueda de regla con fallback)
- 5-F: Sonnet (tabla con acciones batch, permisos por rol)
- 5-G: Opus (refactor de dashboard con período dinámico, múltiples queries)
- 5-H: Sonnet (UI simple)

---

## 11. Riesgos y mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Agregar código al `$transaction` de `POST /api/sales` introduce regresión | Media | La función `generateCommissions` es append-only (no modifica datos existentes). Si falla, la venta entera se rollbackea — consistente. |
| Performance de queries de agregación en reportes de caja con muchos datos | Baja (volumen actual bajo) | Índices en `CashTransaction(sessionId, collectionStatus)` y `CashTransaction(createdAt)` ya existen implícitamente por Prisma. Agregar índice explícito si se detecta lentitud. |
| CommissionRule sin datos → comisiones silenciosamente vacías | Media | La página de reglas (5-D) se implementa antes de la generación (5-E). Agregar alerta en dashboard si no hay reglas configuradas. |
| Confusión entre `/api/sales` (POST existente) y `/api/ventas` (GET nuevo) | Baja | Convención: `sales` = endpoint de escritura (inglés, legacy). `ventas` = endpoint de lectura (español, consistente con URL de UI). Documentar en AGENTS.md. |

---

## 12. Queries de agregación — referencia

### Ventas por modelo (Dashboard 5-G)
```sql
SELECT m.nombre, SUM(si.price * si.quantity) as revenue, COUNT(DISTINCT s.id) as sales_count
FROM "Sale" s
JOIN "SaleItem" si ON si."saleId" = s.id
JOIN "ModeloConfiguracion" pv ON pv.id = si."productId"
JOIN "Modelo" m ON m.id = pv.modelo_id
WHERE s."branchId" = $1
  AND s.status = 'COMPLETED'
  AND s."createdAt" BETWEEN $2 AND $3
GROUP BY m.id, m.nombre
ORDER BY revenue DESC
LIMIT 5;
```

### Ventas por vendedor (Dashboard 5-G)
```sql
SELECT u.name, SUM(s.total) as revenue, COUNT(s.id) as sales_count
FROM "Sale" s
JOIN "User" u ON u.id = s."userId"
WHERE s."branchId" = $1
  AND s.status = 'COMPLETED'
  AND s."createdAt" BETWEEN $2 AND $3
GROUP BY u.id, u.name
ORDER BY revenue DESC;
```

### Flujo de caja por período (Reporte 5-C)
```sql
SELECT
  method,
  "collectionStatus",
  type,
  SUM(amount) as total,
  COUNT(*) as tx_count
FROM "CashTransaction" ct
JOIN "CashRegisterSession" crs ON crs.id = ct."sessionId"
WHERE crs."branchId" = $1
  AND ct."createdAt" BETWEEN $2 AND $3
GROUP BY method, "collectionStatus", type;
```

### Comisiones del período (Reporte 5-F)
```sql
SELECT
  u.name,
  u.role,
  cr.status,
  SUM(cr.amount) as total,
  COUNT(cr.id) as count
FROM "CommissionRecord" cr
JOIN "User" u ON u.id = cr."userId"
JOIN "Sale" s ON s.id = cr."saleId"
WHERE s."branchId" = $1
  AND cr."createdAt" BETWEEN $2 AND $3
  AND cr.status != 'CANCELLED'
GROUP BY u.id, u.name, u.role, cr.status;
```
