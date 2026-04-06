# CLAUDE.md

Guía de trabajo para Claude Code en este repositorio.
Lee este archivo completo antes de tocar cualquier código.

---

## Comandos

```bash
# Infraestructura (requiere Docker)
docker-compose up -d        # PostgreSQL en puerto 5434

# Desarrollo
npm run dev                 # Dev server en http://localhost:3000

# Base de datos
npx prisma migrate dev      # Aplicar migraciones pendientes
npx prisma db seed          # Seed inicial (usuarios, sucursales, catálogo)
npx prisma studio           # UI visual de la DB en http://localhost:5555

# Build y calidad
npm run build
npm run lint
```

No hay suite de tests configurada.

---

## Stack

Next.js 16 (App Router) · React 19 · TypeScript 5 · Prisma 6 + PostgreSQL
NextAuth 4 · shadcn/ui (new-york) · Tailwind CSS 4 · react-hook-form + Zod · sonner

---

## Arquitectura y flujo de datos

**Grupos de rutas:**

- `(auth)/` — rutas públicas (solo `/login`)
- `(pos)/` — rutas protegidas; el `layout.tsx` valida sesión server-side

**Patrón de datos:**

```
Server Components (page.tsx)
  └── Consultas Prisma directas con "use server"
        └── Datos como props a Client Components
              └── Mutaciones → API Routes en src/app/api/
```

**Consultas (lectura):**
Usar Server Components con lógica de servidor directa. Las páginas
(`page.tsx`) deben ser async y consultar Prisma directamente.
Marcar con `"use server"` o mantener como RSC (sin `"use client"`).

**Mutaciones (escritura):**
Toda lógica de negocio que modifique datos va en API Routes
(`src/app/api/`), nunca en Server Actions.
Los Client Components llaman a estas rutas con `fetch`.

**Autenticación:**
NextAuth con JWT. El token lleva `role`, `branchId`, `branchName`.
Todas las API routes validan sesión y respetan `branchId`.

**Multi-sucursal:**
Toda entidad mayor tiene `branch_id`.
Siempre filtrar por la sucursal del usuario, excepto ADMIN.

---

## Modelos de dominio clave (Prisma)

- **Modelo / Color / Voltaje / ProductVariant** — catálogo de productos. `ProductVariant` (mapeado como `ModeloConfiguracion` en DB via `@@map`) es único por `(modelo_id, color_id, voltaje_id)`.
- **Stock** — inventario por producto por sucursal. Se actualiza via `InventoryMovement` (tipos: `SALE`, `RETURN`, `TRANSFER_OUT/IN`, `ADJUSTMENT`, `PURCHASE_RECEIPT`, `WORKSHOP_USAGE`).
- **Sale / SaleItem** — ventas con folio secuencial por sucursal (`LEO-0001`), enum `SaleType` y status (`COMPLETED | CANCELLED | LAYAWAY`). Requiere `CashRegisterSession` abierta.
- **CashRegisterSession / CashTransaction** — turno de caja por usuario. Métodos de pago: `CASH | CARD | TRANSFER | CREDIT_BALANCE | ATRATO`. `CollectionStatus`: `COLLECTED | PENDING`.
- **ServiceOrder / ServiceOrderItem** — órdenes de taller, Kanban: `PENDING → IN_PROGRESS → COMPLETED → DELIVERED → CANCELLED`. Items pueden referenciar `ProductVariant` o `ServiceCatalog`.
- **ServiceCatalog** — catálogo de servicios por sucursal (mano de obra, refacciones estándar).
- **Customer / CustomerBike** — CRM con saldo de crédito y bicicletas por VIN. `CustomerBike` único por `(serialNumber, branchId)`.
- **VoltageChangeLog** — historial de cambios de voltaje en `CustomerBike`.
- **Layaway / Pedido** — Sale con status `LAYAWAY` o tipo backorder; pagos parciales. Fusionados en módulo Pedidos (Fase 2G).
- **CommissionRule / CommissionRecord** — reglas de comisión por rol/modelo y registros generados en cada venta.
- **BatteryConfiguration** — cuántas baterías (y de qué `ProductVariant`) requiere cada combinación `(Modelo, Voltaje)`.
- **BatteryLot** — lote de recepción de baterías (proveedor, referencia, fecha).
- **Battery** — unidad individual con serial único. Estados: `IN_STOCK | INSTALLED | DEFECTIVE | WARRANTY_REVIEW`.
- **BatteryAssignment** — historial de instalaciones/desinstalaciones de batería en `CustomerBike`.
- **AssemblyOrder** — orden de ensamble vehículo+batería. Estados: `PENDING | COMPLETED | CANCELLED`.
- **Branch.lastSaleFolioNumber** — contador secuencial de folios por sucursal (atómico via `$transaction`).

---

## Reglas de código

### TypeScript

- **Prohibido usar `any`** en cualquier circunstancia.
  Usar `unknown` + type guard, tipos específicos, o `never` según el caso.
- Siempre tipar los retornos de funciones explícitamente.
- Los esquemas Zod son la fuente de verdad para tipos de formularios y API.

### Server Actions

- **No usar Server Actions para lógica de negocio ni mutaciones.**
- Su único uso permitido es como thin wrappers de revalidación si
  fuera estrictamente necesario.
- Toda mutación va en una API Route.

### API Routes (`src/app/api/`)

- Toda lógica de negocio que modifique datos va aquí.
- Siempre validar sesión con `getServerSession(authOptions)`.
- Usar `prisma.$transaction()` para operaciones multi-tabla.
- Serializar `Decimal` a `number` antes de responder (no es serializable por defecto).
- Retornar siempre `{ success: boolean, data?: T, error?: string }`.

### Consultas en páginas

- Los `page.tsx` deben ser Server Components async.
- Consultar Prisma directamente, nunca desde el cliente.
- Agregar `export const dynamic = "force-dynamic"` si los datos
  cambian frecuentemente.

### Componentes

- `src/components/ui/` — shadcn generados, **nunca editar manualmente**.
  Regenerar con `npx shadcn add [component]`.
- `src/components/pos/` — componentes de negocio reutilizables.
- Componentes específicos de una ruta van junto a su `page.tsx`.

### Formularios

- Siempre `react-hook-form` + schema Zod. Nunca `useState` para estado de formulario.

### Notificaciones

- Siempre `import { toast } from "sonner"`. Nunca `alert()` ni `console.log` en UI.

### Estilos

- Tailwind utility-first. `cn()` de `@/lib/utils` para clases condicionales.
- No crear archivos `.css` custom salvo `globals.css`.
- Sistema de diseño: **EvoFlow Green Edition** (dual mode — light/dark).
  - Tokens en `globals.css` como CSS custom properties (`--color-*`, `--radius-*`).
  - Verde primario: `oklch(0.55 0.18 145)` en dark, `oklch(0.40 0.18 145)` en light.
  - Tipografía: Inter (body) + Space Grotesk (headings).
  - Sin bordes sólidos de 1px; usar diferencia de fondos para separar secciones.
  - Glassmorphism para elementos flotantes/modales.

### Imports

- Siempre usar el alias `@/*` → `src/*`. Nunca rutas relativas desde `src/`.

```typescript
// ✅ Correcto
import { prisma } from "@/lib/prisma";
// ❌ Incorrecto
import { prisma } from "../../lib/prisma";
```

### Lenguaje

- Todo string visible para el usuario **en español**.
- Variables, funciones, tipos y nombres de archivos en inglés/camelCase.

### React Compiler

- Está habilitado. **No usar `useMemo` ni `useCallback` manualmente**
  salvo que un profiling lo justifique explícitamente.

---

## Decisiones arquitectónicas clave

- **`ProductVariant` via `@@map`** — el modelo Prisma se llama `ProductVariant` en TypeScript pero la tabla en DB sigue siendo `ModeloConfiguracion`. Usar siempre el nombre TypeScript en el código.
- **Folio secuencial por sucursal** — folios tipo `LEO-0001` generados con `Branch.lastSaleFolioNumber` incrementado atómicamente dentro de `prisma.$transaction()`.
- **Layaway + Backorder → módulo Pedidos** — ambos flujos se fusionan en la misma UI (Fase 2G). No crear módulos separados.
- **Server Actions → API Routes (deuda técnica)** — actualmente las mutaciones viven en `src/actions/`. La migración a API Routes es deuda técnica programada para Fase 2H. **No migrar antes de tiempo.**
- **Módulo de montaje (Fase 2H) requiere Opus** — el diseño e implementación del módulo de ensamble batería+vehículo debe planificarse con Claude Opus por su complejidad.

---

## Roadmap de fases

| Fase | Descripción | Estado |
|------|-------------|--------|
| 0 | Setup inicial, auth, estructura | ✅ Completo |
| 1A | Catálogo & variantes (`ProductVariant`) | ✅ Completo |
| 1B | POS Terminal básico + flujo de venta | ✅ Completo |
| 1.5 | Sistema de diseño EvoFlow aplicado | ✅ Completo |
| 1C | Schema baterías, comisiones, catálogo servicios | ✅ Completo |
| 2 (parcial) | Módulos de inventario, taller, clientes | ✅ Parcial |
| 2F | Modales de pago avanzados (múltiples métodos, ATRATO) | ✅ Completo |
| **2F.5** | **Historial de Ventas** (consulta por folio, filtros por fecha/vendedor/método de pago, detalle de venta) | ⏳ Pendiente |
| **2F.6** | **Cliente obligatorio en POS** — modal de selección/creación con campos completos (teléfono, dirección flete, datos de facturación) | ⏳ Pendiente |
| **2G** | **Módulo Pedidos** (Layaway + Backorder fusionados) | ⏳ Pendiente |
| **2H** | **Módulo de montaje** (battery+vehículo UI) — requiere Opus + migrar a API Routes | ⏳ Pendiente |
| 3 | Cotizaciones | ⏳ Pendiente |
| 4 | Taller completo (cobro al entregar + descuento automático de stock) | ⏳ Pendiente |
| 5 | Reportes y comisiones (incluye desglose COLLECTED vs PENDING en caja) | ⏳ Pendiente |
| 6 | Cierre / producción (tests, hardening, deploy, config Prisma v7) | ⏳ Pendiente |

---

## Reglas de sesión de trabajo

### Commits

- **No hacer commit hasta que el módulo o sesión completa esté sin errores.**
- Verificar antes de commitear:
  - `npm run lint` pasa sin errores
  - `npm run build` compila sin errores de TypeScript
  - La funcionalidad trabajada se probó manualmente
- Un commit por módulo o unidad lógica completa, no por archivo suelto.
- Mensaje de commit en español, descriptivo:

```
  feat: agregar validación de VIN único por sucursal
  fix: corregir cálculo de saldo en pago con crédito
  refactor: mover lógica de cobro de taller a API route
```

### Antes de empezar cualquier tarea

1. Leer los archivos relevantes completos antes de editar.
2. Entender las dependencias del componente o módulo.
3. Si la tarea afecta datos financieros, confirmar el flujo completo
   antes de implementar.

### Al terminar cualquier tarea

1. Revisar que no queden `console.log`, `any`, ni `TODO` sin documentar.
2. Confirmar que `lint` y `build` pasan.
3. Solo entonces proceder al commit.
