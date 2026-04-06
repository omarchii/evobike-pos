# CONTEXT.md — evobike-pos

> Documento de contexto para retomar el trabajo sin fricción. Actualizado 2026-04-03.
> Lee este archivo en su totalidad antes de tocar código.

---

## 1. Descripción general

**evobike-pos** es un sistema de punto de venta (POS) para una cadena de tiendas de vehículos eléctricos (bicicletas y scooters eléctricos). Gestiona ventas, inventario, taller mecánico, clientes con crédito, apartados/pedidos, trazabilidad de baterías y control de caja por turno.

**Para quién:** Personal de tienda en roles SELLER, TECHNICIAN, MANAGER y ADMIN que trabajan en múltiples sucursales (actualmente: LEO y AV135). Cada usuario está asignado a una sucursal y sus operaciones quedan aisladas a ella por defecto.

**No es:** un e-commerce, ni tiene integración con pasarelas de pago externas todavía. Todo es flujo interno.

---

## 2. Stack tecnológico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.1.6 |
| UI Library | React | 19.2.3 |
| Lenguaje | TypeScript | 5.9.3 |
| ORM | Prisma | 6.19.2 |
| Base de datos | PostgreSQL (Docker) | 15+ |
| Autenticación | NextAuth | 4.24.13 |
| Estilos | Tailwind CSS | 4 (alpha) |
| Componentes base | shadcn/ui (new-york) + Radix UI | 1.4.3 |
| Íconos | lucide-react | 0.575.0 |
| Formularios | react-hook-form + Zod | 7.71.2 / 4.3.6 |
| Notificaciones | sonner (toast) | 2.0.7 |
| Optimizador | React Compiler (Babel plugin) | 1.0.0 |
| Temas | next-themes | 0.4.6 |
| Utilidades | clsx, tailwind-merge, use-debounce | — |

**Infraestructura dev:** Docker Compose levanta PostgreSQL en el puerto `5434` (no 5432 para evitar conflictos).

---

## 3. Arquitectura

### Patrón general

```
Browser
  └── Next.js App Router (RSC + Client Components)
        ├── Server Components → Prisma directo (lecturas)
        ├── Client Components → UI interactiva
        └── Server Actions (src/actions/) → Prisma $transaction (escrituras)
```

> ⚠️ **Deuda técnica programada:** Las mutaciones actualmente viven en `src/actions/` (Server Actions).
> La migración a API Routes en `src/app/api/` es deuda técnica planificada para la **Fase 2H**.
> **No migrar antes de esa fase.** Ver sección de decisiones arquitectónicas.

Los pocos endpoints en `src/app/api/` son solo para NextAuth y búsquedas especiales (serial-search, cascada de modelos→colores→voltajes).

### Grupos de rutas

- `(auth)/` — Rutas públicas (solo `/login`)
- `(pos)/` — Rutas protegidas. El `layout.tsx` valida la sesión server-side y redirige a `/login` si no hay sesión.

### Aislamiento multi-sucursal

Casi toda entidad mayor tiene `branchId`. Los Server Actions extraen `branchId` del token JWT y lo fuerzan en queries y mutaciones. Un usuario en sucursal LEO no puede ver ni modificar datos de AV135.

### Estado de autenticación

Stateless JWT. El token lleva: `id`, `role`, `branchId`, `branchName`. Los Server Actions hacen `getServerSession(authOptions)` y fallan con "No autorizado" si no hay sesión válida.

---

## 4. Sistema de diseño: EvoFlow Green Edition

**Modo:** Dual (light/dark), controlado por `next-themes` + `theme-toggle.tsx`.

**Tokens principales** (definidos en `src/app/globals.css` como CSS variables):
- Verde primario dark: `oklch(0.55 0.18 145)`
- Verde primario light: `oklch(0.40 0.18 145)`
- Tipografía: **Inter** (body, pesos 300–600) + **Space Grotesk** (headings, monospace de datos)
- Sin bordes sólidos de 1px — separar secciones con diferencia de tonos de fondo
- Glassmorphism para modales y elementos flotantes

**Aplicación actual:**
- `globals.css` — tokens completos del sistema
- `pos-terminal.tsx` — primer módulo migrado al nuevo sistema visual

---

## 5. Estructura de carpetas

```
evobike-pos/
├── src/
│   ├── actions/                    # Server Actions (mutaciones, ACID) — deuda técnica → API Routes en Fase 2H
│   │   ├── cash-register.ts        # Apertura/cierre de turno de caja
│   │   ├── customer.ts             # Crear cliente, agregar saldo de crédito
│   │   ├── inventory.ts            # Recepción de mercancía (entrada de stock)
│   │   ├── layaway.ts              # Registro de pagos parciales de apartados
│   │   ├── sale.ts                 # Procesamiento de ventas (flujo principal)
│   │   └── workshop.ts             # CRUD órdenes de taller, cambio de status
│   │
│   ├── app/
│   │   ├── (auth)/
│   │   │   └── login/page.tsx      # Formulario de login (client component)
│   │   │
│   │   ├── (pos)/
│   │   │   ├── layout.tsx          # Shell protegido: valida sesión + sidebar
│   │   │   ├── sidebar.tsx         # Navegación lateral izquierda
│   │   │   ├── theme-toggle.tsx    # Toggle light/dark (EvoFlow)
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx        # KPIs del día + recientes (force-dynamic)
│   │   │   ├── point-of-sale/
│   │   │   │   ├── page.tsx        # Carga productos/clientes → PosTerminal
│   │   │   │   ├── pos-terminal.tsx # UI interactiva del carrito y cobro (EvoFlow)
│   │   │   │   └── guided-catalog.tsx # Catálogo guiado (modelo→color→voltaje)
│   │   │   ├── inventory/
│   │   │   │   ├── page.tsx        # Vista de stock por producto
│   │   │   │   └── receipts/
│   │   │   │       ├── page.tsx
│   │   │   │       └── receipts-terminal.tsx # UI para recepción de compras
│   │   │   ├── layaways/           # (será renombrado a pedidos/ en Fase 2G)
│   │   │   │   ├── page.tsx        # Lista de apartados activos
│   │   │   │   └── layaway-list.tsx
│   │   │   ├── customers/
│   │   │   │   ├── page.tsx        # Directorio de clientes
│   │   │   │   ├── customer-list.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx    # Detalle de cliente + historial
│   │   │   │       └── add-balance-dialog.tsx
│   │   │   ├── workshop/
│   │   │   │   ├── page.tsx        # Tablero Kanban del taller
│   │   │   │   ├── workshop-board.tsx
│   │   │   │   ├── new-order-dialog.tsx
│   │   │   │   └── [id]/
│   │   │   │       ├── page.tsx    # Detalle de orden de servicio
│   │   │   │       └── service-order-details.tsx
│   │   │   └── cash-register/
│   │   │       ├── page.tsx        # Reporte de turno de caja
│   │   │       └── close-register-button.tsx
│   │   │
│   │   ├── api/
│   │   │   ├── auth/[...nextauth]/route.ts  # Handler NextAuth
│   │   │   ├── modelos/route.ts             # GET lista de modelos
│   │   │   ├── modelos/[id]/colores/[colorId]/voltajes/route.ts  # Cascada catálogo
│   │   │   └── serial-search/route.ts       # Búsqueda de bicicleta por serial/VIN
│   │   │
│   │   ├── globals.css             # Tokens EvoFlow Green Edition
│   │   ├── layout.tsx              # Root layout (html, body, providers)
│   │   └── page.tsx                # Redirige a /dashboard
│   │
│   ├── components/
│   │   ├── pos/
│   │   │   └── cash-session-manager.tsx  # Modal no-dismissable de apertura de caja
│   │   ├── providers/
│   │   │   └── session-provider.tsx      # Wrapper NextAuth SessionProvider
│   │   └── ui/                     # shadcn/ui generados (NO editar manualmente)
│   │       └── [button, card, dialog, form, input, table, tabs, badge, ...]
│   │
│   └── lib/
│       ├── auth.ts                 # Config NextAuth (CredentialsProvider, callbacks JWT)
│       ├── prisma.ts               # Singleton cliente Prisma
│       └── utils.ts                # cn() helper (clsx + tailwind-merge)
│
├── prisma/
│   ├── schema.prisma               # 24+ modelos de DB + enums
│   ├── seed.ts                     # Seed basado en CSV (modelos, colores, voltajes, stock)
│   └── data/                       # Archivos CSV para el seed
│       ├── modelos.csv
│       ├── colores.csv
│       ├── voltajes.csv
│       ├── modelo_color_disponible.csv
│       └── modelo_configuracion.csv
│
├── docs/
│   └── superpowers/
│       ├── plans/
│       └── specs/
│
├── public/                         # Assets estáticos (logo, imágenes de login)
├── CLAUDE.md                       # Instrucciones para el agente de código
├── DESIGN.md                       # Sistema de diseño (referencia visual)
├── ANTIGRAVITY.MD                  # Documento técnico general del proyecto
├── CONTEXT.md                      # Este archivo
├── docker-compose.yml              # PostgreSQL en puerto 5434
└── package.json
```

---

## 6. Modelos de dominio

### 6.1 Catálogo & Inventario

| Modelo | Descripción |
|--------|-------------|
| `Modelo` | Categoría de producto (ej. "Evo Cargo"). Tiene `requiere_vin`, `imageUrl`. |
| `Color` | Colores disponibles. `isGeneric` marca colores no específicos de modelo. |
| `Voltaje` | Voltajes disponibles (valor Int + label String). |
| `ProductVariant` | Variante única por `(modelo_id, color_id, voltaje_id)`. Tabla DB: `ModeloConfiguracion` (via `@@map`). Campos: `sku`, `precioPublico`, `costo`, `precioDistribuidor`. |
| `Stock` | Cantidad disponible por `(ProductVariant, Branch)`. |
| `InventoryMovement` | Kardex de movimientos. Tipos: `SALE`, `RETURN`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT`, `PURCHASE_RECEIPT`, `WORKSHOP_USAGE`. |

### 6.2 Ventas & Caja

| Modelo | Descripción |
|--------|-------------|
| `Sale` | Venta. Folio secuencial por sucursal (`LEO-0001`). Status: `COMPLETED`, `CANCELLED`, `LAYAWAY`. Tiene `notes` e `internalNote`. |
| `SaleItem` | Ítem de venta. Precio y descuento por ítem. |
| `CashRegisterSession` | Turno de caja por usuario. Status: `OPEN`, `CLOSED`. |
| `CashTransaction` | Transacción de caja. Métodos: `CASH`, `CARD`, `TRANSFER`, `CREDIT_BALANCE`, `ATRATO`. `CollectionStatus`: `COLLECTED`, `PENDING`. |

### 6.3 CRM & Taller

| Modelo | Descripción |
|--------|-------------|
| `Customer` | Cliente con `balance` (crédito a favor) y `creditLimit`. |
| `CustomerBike` | Vehículo del cliente. Único por `(serialNumber, branchId)`. |
| `VoltageChangeLog` | Historial de cambios de voltaje de una bicicleta. Vinculado a `BatteryAssignment`. |
| `ServiceOrder` | Orden de taller. Kanban: `PENDING → IN_PROGRESS → COMPLETED → DELIVERED → CANCELLED`. |
| `ServiceOrderItem` | Ítem de orden. Puede referenciar `ProductVariant` o `ServiceCatalog`. |
| `ServiceCatalog` | Catálogo de servicios por sucursal (mano de obra, refacciones estándar). |

### 6.4 Comisiones

| Modelo | Descripción |
|--------|-------------|
| `CommissionRule` | Regla por rol+modelo. Tipo: `PERCENTAGE` o `FIXED_AMOUNT`. |
| `CommissionRecord` | Registro generado por venta. Status: `PENDING`, `APPROVED`, `PAID`. |

### 6.5 Trazabilidad de Baterías (Fase 1C — Schema completo)

| Modelo | Descripción |
|--------|-------------|
| `BatteryConfiguration` | Cuántas baterías (de qué `ProductVariant`) requiere cada `(Modelo, Voltaje)`. |
| `BatteryLot` | Lote de recepción: proveedor, referencia, fecha, usuario. |
| `Battery` | Unidad individual con `serialNumber` único. Status: `IN_STOCK`, `INSTALLED`, `DEFECTIVE`, `WARRANTY_REVIEW`. |
| `BatteryAssignment` | Historial de instalaciones en `CustomerBike`. Campos: `isCurrent`, `assignedAt`, `unassignedAt`, vínculos a `VoltageChangeLog`. |
| `AssemblyOrder` | Orden de ensamble vehículo+batería. Status: `PENDING`, `COMPLETED`, `CANCELLED`. La UI se implementa en Fase 2H. |

---

## 7. Módulos y componentes principales

### 7.1 POS Terminal (`point-of-sale/pos-terminal.tsx`)
El componente cliente más complejo del sistema. Gestiona:
- Carrito de compras (agregar/quitar productos)
- Selección de cliente (búsqueda inline)
- Métodos de pago: CASH, CARD, TRANSFER, CREDIT_BALANCE, ATRATO
- Modo apartado (layaway) con pago inicial
- Validación de número de serie (VIN) para bicicletas
- Folio secuencial por sucursal (`LEO-0001`)
- Llama a `processSaleAction()` en `src/actions/sale.ts`
- **Migrado al sistema visual EvoFlow (Fase 1.5)**

### 7.2 Cash Session Manager (`components/pos/cash-session-manager.tsx`)
Modal **no-dismissable** que bloquea el POS hasta que se abre un turno de caja. Llama a `openCashSession()` y `closeCashSession()`.

### 7.3 Workshop Board (`workshop/workshop-board.tsx`)
Tablero Kanban con columnas: `PENDING → IN_PROGRESS → COMPLETED → DELIVERED`. Llama a `updateServiceOrderStatus()`.
**Pendiente (Fase 4):** crear vínculo de cobro al entregar + descuento automático de stock.

### 7.4 Receipts Terminal (`inventory/receipts/receipts-terminal.tsx`)
UI para registrar entradas de mercancía. Llama a `receiveInventoryAction()` que hace upsert de Stock y registra `InventoryMovement(PURCHASE_RECEIPT)`.

### 7.5 Server Actions (núcleo de negocio actual)

| Archivo | Función principal | Notas críticas |
|---|---|---|
| `sale.ts` | `processSaleAction()` | Transacción ACID completa: stock→venta→folio secuencial→movimiento→pago |
| `workshop.ts` | `createServiceOrder()`, `updateServiceOrderStatus()`, `addServiceOrderItem()` | Cobro al entregar: pendiente Fase 4 |
| `inventory.ts` | `receiveInventoryAction()` | Upsert stock + actualiza costo |
| `cash-register.ts` | `openCashSession()`, `closeCashSession()` | Prerequisito de todas las ventas |
| `layaway.ts` | `registerLayawayPayment()` | Auto-completa si pago >= total |
| `customer.ts` | `createCustomer()`, `addCustomerBalance()` | CRM + saldo de crédito |

### 7.6 Catálogo guiado (`point-of-sale/guided-catalog.tsx`)
Flujo en 3 pasos: elige Modelo → elige Color → elige Voltaje. Usa las rutas API en cascada.

---

## 8. Flujo de datos principal

**Flujo: Venta contado**

```
1. Usuario abre sesión → CashRegisterSession.status = "OPEN"
   (Modal no-dismissable en cash-session-manager.tsx)

2. POS Terminal (pos-terminal.tsx):
   - Selecciona productos via guided-catalog.tsx
   - Elige cliente (opcional)
   - Elige método de pago
   - Submit → processSaleAction(input) [src/actions/sale.ts]

3. processSaleAction() - prisma.$transaction():
   a. getServerSession() → extrae userId, branchId
   b. Verifica CashRegisterSession activa para userId+branchId
   c. Si CREDIT_BALANCE: verifica customer.balance >= total
   d. Para cada item:
      - Stock.find(productVariantId, branchId) → verifica quantity
      - Stock.update(-quantity)
   e. Branch.update(lastSaleFolioNumber++) → genera folio "LEO-0001"
   f. Sale.create(status: COMPLETED, folio generado)
   g. SaleItem.createMany(items)
   h. InventoryMovement.createMany(type: SALE, qty negativo)
   i. CashTransaction.create(type: PAYMENT_IN, method, amount)
   j. Si producto requiere VIN: CustomerBike.create(serialNumber)
   k. Si CREDIT_BALANCE: Customer.update(balance -= total)

4. revalidatePath('/point-of-sale') → Next.js invalida caché

5. Browser: toast de confirmación, carrito se vacía
```

---

## 9. Variables de entorno y configuración

Archivo: `.env` en la raíz

```env
# Conexión a PostgreSQL (Docker en puerto 5434)
DATABASE_URL="postgresql://user:password@localhost:5434/evobike_pos?schema=public"

# URL pública de la app (NextAuth la usa para callbacks)
NEXTAUTH_URL="http://localhost:3000"

# Secret para firmar tokens JWT de NextAuth (usar valor largo y aleatorio en producción)
NEXTAUTH_SECRET="valor-secreto-aqui"
```

---

## 10. Comandos importantes

```bash
# Infraestructura
docker-compose up -d              # Levanta PostgreSQL en localhost:5434

# Desarrollo
npm run dev                       # Next.js dev server en http://localhost:3000

# Base de datos
npx prisma migrate dev            # Aplica migraciones pendientes
npx prisma db seed                # Seed desde CSVs en prisma/data/
npx prisma studio                 # UI visual para explorar la DB (http://localhost:5555)

# Producción
npm run build                     # Build de producción
npm start                         # Servidor de producción

# Calidad
npm run lint                      # ESLint (v9)

# Agregar componentes shadcn
npx shadcn add [component-name]   # Genera en src/components/ui/ (NO editar manualmente)
```

**Nota:** No hay suite de tests. `npm test` no existe.

---

## 11. Decisiones técnicas y arquitectónicas

### ProductVariant via `@@map`
El modelo Prisma se llama `ProductVariant` en TypeScript pero la tabla en DB sigue siendo `ModeloConfiguracion`. Esto permite mantener la DB sin migraciones destructivas mientras el código TypeScript usa un nombre más semántico. **Siempre usar `ProductVariant` en el código.**

### Folio secuencial por sucursal
Los folios se generan con `Branch.lastSaleFolioNumber` incrementado atómicamente dentro de `prisma.$transaction()`. Formato: `{BRANCH_CODE}-{número con padding}` → `LEO-0001`, `AV135-0042`.

### Layaway + Backorder → módulo Pedidos (Fase 2G)
Ambos flujos (apartado con pago inicial + pedido/backorder sin stock) se fusionan en un único módulo "Pedidos". No crear módulos separados.

### Server Actions → API Routes (deuda técnica programada)
Las mutaciones actualmente viven en `src/actions/` y funcionan correctamente. La migración a API Routes está programada para **Fase 2H** para habilitar el módulo de montaje. **No migrar antes.** Migrar módulo por módulo, no todo a la vez.

### Módulo de montaje (Fase 2H) requiere sesión con Opus
El diseño e implementación del flujo de ensamble batería+vehículo es complejo (asocia `AssemblyOrder`, `BatteryAssignment`, `VoltageChangeLog`, `CustomerBike`, stock de baterías). Debe planificarse en una sesión dedicada con Claude Opus.

### JWT stateless
El token lleva `branchId` y `role`, eliminando un round-trip a DB en cada verificación de permisos.

### React Compiler habilitado
Optimización automática de re-renders. **Evitar `useMemo`/`useCallback` manuales** salvo que profiling lo justifique.

### Prisma `$transaction` en todas las mutaciones
Consistencia ACID. Una venta que falla a mitad no debe decrementar stock sin crear la venta. Todas las operaciones multi-tabla usan transacciones.

---

## 12. Estado actual del desarrollo

### ✅ Fases completadas

| Fase | Contenido |
|------|-----------|
| **0** | Setup inicial: Next.js, Prisma, NextAuth, Docker, estructura de carpetas |
| **1A** | Catálogo: Modelo/Color/Voltaje/ProductVariant, guiado por pasos, cascada de variantes |
| **1B** | POS Terminal básico: carrito, cobro, validación VIN, apartados, sesión de caja |
| **1.5** | Sistema de diseño EvoFlow Green Edition aplicado en `globals.css` y `pos-terminal.tsx` |
| **1C** | Schema extendido: BatteryConfiguration, BatteryLot, Battery, BatteryAssignment, AssemblyOrder, VoltageChangeLog, CommissionRule/Record, ServiceCatalog, SaleType enum, folios secuenciales |
| **2 (parcial)** | Módulos: inventory, receipts, customers, workshop, cash-register, layaways |
| **2F** | Modales de pago avanzados: múltiples métodos por venta, ATRATO con CollectionStatus PENDING, split de pagos, validación de saldo a favor |

### ⏳ Pendiente

| Fase | Contenido | Notas |
|------|-----------|-------|
| **2F.5** | Historial de Ventas — consulta por folio, filtros por fecha/vendedor/método de pago, detalle de venta | Baja urgencia |
| **2F.6** | Cliente obligatorio en POS — modal de selección/creación, campos: nombre, teléfono principal/secundario, dirección (flete) y datos de facturación opcionales. Requiere migración de schema `Customer` | Antes de 2G |
| **2G** | Módulo Pedidos (Layaway + Backorder fusionados) con abonos parciales | Después de 2F.6 |
| **2H** | Módulo de montaje (battery+vehículo UI) | Requiere Opus + migrar Server Actions a API Routes |
| **3** | Cotizaciones | — |
| **4** | Taller completo: cobro al entregar + descuento automático de stock | — |
| **5** | Reportes y comisiones — KPIs, rentabilidad por sucursal, desglose COLLECTED vs PENDING | — |
| **6** | Cierre / producción — tests, hardening, deploy, migrar config Prisma v7 | — |

---

## 13. Deuda técnica conocida

1. **Server Actions → API Routes:** funciona pero es deuda programada para Fase 2H.
2. **No hay tests:** riesgo alto para sistema financiero.
3. **`workshop.ts` línea TODO:** entrega de orden no genera CashTransaction ni descuenta stock.
4. **Transferencias de stock entre sucursales:** el enum `TRANSFER_OUT/IN` existe, la UI no.
5. **Múltiples métodos de pago por venta:** el schema soportaría múltiples CashTransactions, la UI está en Fase 2F.
6. **`tmp_query.js`** en raíz: archivo temporal, eliminar.
7. **`seed-inventory.js`** en raíz: redundante con el seed TypeScript, eliminar.
8. **`NEXTAUTH_SECRET`** en `.env`: valor simple, rotar en producción.
9. **`AssemblyOrder` UI:** el schema está completo desde Fase 1C, la interfaz queda para Fase 2H.

---

## 14. Convenciones del proyecto

### Lenguaje
Todo el código de UI y strings de usuario **en español**. Variables y funciones en inglés/camelCase.

### Imports
Alias `@/*` → `src/*`. Usar siempre el alias, nunca rutas relativas desde `src/`.

```typescript
import { prisma } from "@/lib/prisma";
import { processSaleAction } from "@/actions/sale";
```

### Componentes
- **UI genéricos:** `src/components/ui/` (shadcn, no editar)
- **Componentes de negocio reutilizables:** `src/components/pos/`
- **Componentes específicos de una ruta:** colocados junto al `page.tsx`

### Server Actions
- Primera línea: `"use server"`
- Siempre validar sesión y retornar `{ success: false, error: "..." }` si no hay sesión
- Usar `prisma.$transaction()` para cualquier operación multi-tabla
- Llamar `revalidatePath()` al final de mutaciones exitosas
- Serializar `Decimal` a `number` antes de retornar (Prisma Decimal no es serializable)

### Estilos
- Tailwind utility-first
- `cn()` de `@/lib/utils` para clases condicionales
- No crear archivos CSS custom salvo `globals.css`
- Sistema EvoFlow: tokens como CSS variables en `globals.css`

### Formularios
`react-hook-form` + `@hookform/resolvers/zod` + schema Zod. No usar `useState` para estado de formulario.

### Toast notifications
`import { toast } from "sonner"` — nunca `alert()` ni `console.log` en producción.
