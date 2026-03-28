# CONTEXT.md — evobike-pos2

> Documento de contexto para retomar el trabajo sin fricción. Generado el 2026-03-27.
> Lee este archivo en su totalidad antes de tocar código.

---

## 1. Descripción general

**evobike-pos2** es un sistema de punto de venta (POS) para una cadena de tiendas de vehículos eléctricos (bicicletas y scooters eléctricos). Gestiona ventas, inventario, taller mecánico, clientes con crédito, apartados y control de caja por turno.

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

No hay una capa de API REST para mutaciones. Todo pasa por **Server Actions** con `"use server"`. Los pocos endpoints en `src/app/api/` son solo para NextAuth y búsquedas especiales (serial-search, cascada de modelos→colores→voltajes).

### Grupos de rutas

- `(auth)/` — Rutas públicas (solo `/login`)
- `(pos)/` — Rutas protegidas. El `layout.tsx` valida la sesión server-side y redirige a `/login` si no hay sesión.

### Aislamiento multi-sucursal

Casi toda entidad mayor tiene `branchId`. Los Server Actions extraen `branchId` del token JWT y lo fuerzan en queries y mutaciones. Un usuario en sucursal LEO no puede ver ni modificar datos de AV135.

### Estado de autenticación

Stateless JWT. El token lleva: `id`, `role`, `branchId`, `branchName`. Los Server Actions hacen `getServerSession(authOptions)` y fallan con "No autorizado" si no hay sesión válida.

---

## 4. Estructura de carpetas

```
evobike-pos2/
├── src/
│   ├── actions/                    # Server Actions (mutaciones, ACID)
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
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx        # KPIs del día + recientes (force-dynamic)
│   │   │   ├── point-of-sale/
│   │   │   │   ├── page.tsx        # Carga productos/clientes → PosTerminal
│   │   │   │   ├── pos-terminal.tsx # UI interactiva del carrito y cobro
│   │   │   │   └── guided-catalog.tsx # Catálogo guiado (modelo→color→voltaje)
│   │   │   ├── inventory/
│   │   │   │   ├── page.tsx        # Vista de stock por producto
│   │   │   │   └── receipts/
│   │   │   │       ├── page.tsx
│   │   │   │       └── receipts-terminal.tsx # UI para recepción de compras
│   │   │   ├── layaways/
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
│   ├── schema.prisma               # 17 modelos de DB + enums
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
│       │   └── 2026-03-27-dashboard-redesign.md    # Plan de implementación del rediseño
│       └── specs/
│           └── 2026-03-27-dashboard-redesign-design.md  # Spec visual del rediseño
│
├── public/                         # Assets estáticos (logo, imágenes de login)
├── CLAUDE.md                       # Instrucciones para Claude Code
├── DESIGN.md                       # Sistema de diseño "Kinetic Precision"
├── ANTIGRAVITY.MD                  # Documento técnico general del proyecto
├── CONTEXT.md                      # Este archivo
├── docker-compose.yml              # PostgreSQL en puerto 5434
├── seed-inventory.js               # Seed legacy (JS, hardcodeado, probablemente obsoleto)
├── tmp_query.js                    # Script temporal de consulta (ignorar)
├── package.json
├── tsconfig.json
├── tailwind.config.js
├── components.json                 # Config de shadcn/ui (new-york style)
└── next.config.ts
```

---

## 5. Módulos y componentes principales

### 5.1 POS Terminal (`point-of-sale/pos-terminal.tsx`)
El componente cliente más complejo del sistema. Gestiona:
- Carrito de compras (agregar/quitar productos)
- Selección de cliente (búsqueda inline)
- Métodos de pago: CASH, CARD, TRANSFER, CREDIT_BALANCE
- Modo apartado (layaway) con pago inicial
- Validación de número de serie (VIN) para bicicletas
- Llama a `processSaleAction()` en `src/actions/sale.ts`

**Dependencias clave:** `guided-catalog.tsx` para seleccionar variantes, `cash-session-manager.tsx` como prerequisito.

### 5.2 Cash Session Manager (`components/pos/cash-session-manager.tsx`)
Modal **no-dismissable** que bloquea el POS hasta que se abre un turno de caja. Punto de entrada para cada sesión de trabajo. Llama a `openCashSession()` y `closeCashSession()`.

### 5.3 Workshop Board (`workshop/workshop-board.tsx`)
Tablero Kanban con columnas: `PENDING → IN_PROGRESS → COMPLETED → DELIVERED`. Llama a `updateServiceOrderStatus()`. **Pendiente:** crear vínculo de cobro al entregar.

### 5.4 Receipts Terminal (`inventory/receipts/receipts-terminal.tsx`)
UI para registrar entradas de mercancía. Llama a `receiveInventoryAction()` que hace upsert de Stock y registra `InventoryMovement(PURCHASE_RECEIPT)`.

### 5.5 Server Actions (núcleo de negocio)

| Archivo | Función principal | Notas críticas |
|---|---|---|
| `sale.ts` | `processSaleAction()` | Transacción ACID completa: stock→venta→movimiento→pago |
| `workshop.ts` | `createServiceOrder()`, `updateServiceOrderStatus()`, `addServiceOrderItem()` | TODO en entrega |
| `inventory.ts` | `receiveInventoryAction()` | Upsert stock + actualiza costo |
| `cash-register.ts` | `openCashSession()`, `closeCashSession()` | Prerequisito de todas las ventas |
| `layaway.ts` | `registerLayawayPayment()` | Auto-completa si pago >= total |
| `customer.ts` | `createCustomer()`, `addCustomerBalance()` | CRM + saldo de crédito |

### 5.6 Catálogo guiado (`point-of-sale/guided-catalog.tsx`)
Flujo en 3 pasos: elige Modelo → elige Color → elige Voltaje. Usa las rutas API en cascada (`/api/modelos`, `/api/modelos/[id]/colores/[colorId]/voltajes`).

---

## 6. Estado actual del desarrollo

### ✅ Completamente funcional
- Autenticación y manejo de sesión (NextAuth JWT)
- Multi-sucursal con aislamiento de datos por `branchId`
- Ventas completas (contado, tarjeta, transferencia, crédito)
- Apartados con pagos parciales
- Gestión de inventario (stock + movimientos + kardex)
- Recepción de mercancía
- Taller (Kanban: crear orden, agregar ítems, cambiar estado)
- CRM básico (clientes, bicicletas, historial de compras)
- Registro de caja por turno (apertura/cierre)
- Dashboard con KPIs del día

### 🔄 En progreso / parcialmente implementado
- **Rediseño de dashboard/sidebar/topbar:** Existe spec detallada en `docs/superpowers/specs/2026-03-27-dashboard-redesign-design.md` y plan en `docs/superpowers/plans/2026-03-27-dashboard-redesign.md`. El dashboard fue migrado a light mode recientemente (commits dc44236, 12f2e5e, 6cc587d).
- **Gráfica de tendencia de ingresos:** El panel existe en el dashboard pero muestra un placeholder "activará en v2".
- **Integración taller-inventario:** `addServiceOrderItem()` puede referenciar un `modeloConfiguracionId` pero no descuenta stock automáticamente. La entrega de órdenes tampoco genera cobro.

### ❌ Pendiente / no implementado
- Validación de VIN único por sucursal
- Pagos con múltiples métodos en una sola venta
- Alertas automáticas de stock bajo
- Integración con procesadores de pago externos
- Suite de tests (no existe ningún test)
- Reportes de rentabilidad por sucursal
- Transferencias de stock entre sucursales (el enum `TRANSFER_OUT/IN` existe, la UI no)

### 🐛 Deuda técnica conocida
- No hay tests automatizados de ningún tipo
- Los archivos de Server Actions están creciendo (podrían dividirse)
- `seed-inventory.js` es redundante con el seed CSV-based nuevo
- `tmp_query.js` en raíz es un archivo temporal que debe eliminarse
- `NEXTAUTH_SECRET` en `.env` es un valor simple; en producción necesita rotación

---

## 7. Flujo de datos principal

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
      - Stock.find(modeloConfiguracionId, branchId) → verifica quantity
      - Stock.update(-quantity)
   e. Sale.create(status: COMPLETED, folio: "V-{timestamp}")
   f. SaleItem.createMany(items)
   g. InventoryMovement.createMany(type: SALE, qty negativo)
   h. CashTransaction.create(type: PAYMENT_IN, method, amount)
   i. Si producto requiere VIN: CustomerBike.create(serialNumber)
   j. Si CREDIT_BALANCE: Customer.update(balance -= total)

4. revalidatePath('/point-of-sale') → Next.js invalida caché

5. Browser: toast de confirmación, carrito se vacía
```

---

## 8. Variables de entorno y configuración

Archivo: `.env` en la raíz (no está en `.gitignore`, ojo en producción)

```env
# Conexión a PostgreSQL (Docker en puerto 5434)
DATABASE_URL="postgresql://user:password@localhost:5434/evobike_pos2?schema=public"

# URL pública de la app (NextAuth la usa para callbacks)
NEXTAUTH_URL="http://localhost:3000"

# Secret para firmar tokens JWT de NextAuth (usar valor largo y aleatorio en producción)
NEXTAUTH_SECRET="valor-secreto-aqui"
```

No hay variables adicionales. El sistema no usa APIs externas, CDN, ni servicios de correo por ahora.

---

## 9. Comandos importantes

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

## 10. Decisiones técnicas relevantes

### ¿Por qué Server Actions en vez de API routes?
Reducción de boilerplate, tipado end-to-end sin codegen, acceso directo al contexto de sesión del servidor. Todas las mutaciones viven en `src/actions/` y son invocadas directamente desde los Client Components.

### ¿Por qué JWT (stateless) en vez de database sessions?
Escalabilidad y simplicidad. El token lleva `branchId` y `role`, lo que elimina un round-trip a la DB en cada verificación de permisos.

### ¿Por qué Tailwind CSS v4 (alpha)?
El proyecto usa características del alpha (nueva sintaxis de config). Esto puede traer breaking changes con actualizaciones. Se acepta la deuda como trade-off por features más modernas.

### ¿Por qué React Compiler habilitado?
Optimización automática de re-renders sin `useMemo`/`useCallback` manuales. Evitar usar estos hooks manualmente a menos que profiling lo justifique.

### ¿Por qué Prisma $transaction en todas las mutaciones?
Consistencia ACID. Una venta que falla a mitad no debe decrementar stock sin crear el registro de venta. Todas las operaciones multi-tabla usan transacciones.

### Patrón de folio único
Los folios se generan con timestamp en el Server Action (`"V-${Date.now()}"`, `"TS-${Date.now()}"`). No es secuencial, pero garantiza unicidad sin un counter de base de datos.

### Deuda técnica conocida
1. No hay tests: riesgo alto para un sistema financiero
2. `workshop.ts` necesita lógica de cobro al entregar órdenes (TODO en línea 26)
3. El transferencia de stock entre sucursales tiene el enum pero no la UI
4. `seed-inventory.js` es redundante con el seed TypeScript nuevo

---

## 11. Convenciones del proyecto

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
- **Componentes específicos de una ruta:** colocados junto al `page.tsx` (ej: `pos-terminal.tsx` junto a `point-of-sale/page.tsx`)

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
- Sistema de diseño "Kinetic Precision": sin bordes de 1px, usar diferencia de fondos para separar secciones, glassmorphism para elementos flotantes

### Formularios
`react-hook-form` + `@hookform/resolvers/zod` + schema Zod. No usar `useState` para estado de formulario.

### Toast notifications
`import { toast } from "sonner"` — nunca `alert()` ni `console.log` en producción.

---

## 12. Lo que sigue

### Prioridad alta (bloqueante para operaciones reales)
1. **Vincular entrega de orden de taller con cobro** (`src/actions/workshop.ts` línea 26)
   - Cuando status → DELIVERED, generar un CashTransaction o vincular a una Sale
2. **Descuento de stock en servicio de taller**
   - `addServiceOrderItem()` con `modeloConfiguracionId` debe decrementar Stock y crear InventoryMovement(WORKSHOP_USAGE)
3. **Validación VIN único por sucursal**
   - Actualmente se acepta cualquier serial number sin validar duplicados por branch

### Prioridad media
4. **Rediseño visual dashboard/sidebar/topbar**
   - Spec completa en `docs/superpowers/specs/2026-03-27-dashboard-redesign-design.md`
   - Plan de implementación en `docs/superpowers/plans/2026-03-27-dashboard-redesign.md`
   - Archivos afectados: `(pos)/layout.tsx`, `(pos)/sidebar.tsx`, `(pos)/dashboard/page.tsx`
5. **Gráfica de tendencia de ingresos en dashboard**
   - El contenedor ya existe como placeholder en `dashboard/page.tsx`
6. **Pagos con múltiples métodos en una venta**
   - Actualmente solo 1 método por venta; el esquema soportaría múltiples CashTransactions
7. **Transferencias de stock entre sucursales**
   - El enum `TRANSFER_OUT/IN` ya existe en InventoryMovement; falta la UI y lógica

### Prioridad baja
8. **Suite de tests** (Jest o Vitest + React Testing Library)
9. **Alertas de stock bajo** (email/push cuando quantity < threshold)
10. **Reportes de rentabilidad por sucursal** (margen por producto, costo vs precio)
11. **Integración con procesador de pago externo** (terminal bancaria, Stripe, etc.)
