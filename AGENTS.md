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
- **Server Actions → API Routes ✅** — migración completada en Fase 2H-A. `src/actions/` eliminado. Todas las mutaciones viven en `src/app/api/`.
- **Módulo de montaje (Fase 2H)** — diseñado con Opus. `CustomerBike.customerId` es nullable para soportar vehículos pre-venta (sin cliente asignado). El montaje ocurre antes de la venta. La integración con POS se difiere a Fase 4 por riesgo.
- **Integración Inventario ↔ Montaje (Fase 2H-C)** — Al recibir mercancía (`PURCHASE_RECEIPT`), se crean automáticamente `AssemblyOrder` PENDING para cada unidad de vehículo ensamblable. Un vehículo es ensamblable si `modelo.requiere_vin === true` AND existe `BatteryConfiguration` para `(modeloId, voltajeId)`. La `AssemblyOrder` se crea SIN `customerBikeId` (null) — el VIN se captura durante el montaje físico, no en la recepción. `Stock` sube en la recepción y baja en la venta (el montaje no cambia Stock). Las baterías usan flujo dual: `Stock` + `InventoryMovement` para contabilidad, `BatteryLot` + `Battery` para trazabilidad por serial.
- **`AssemblyOrder.productVariantId`** — FK nullable a `ProductVariant`. Permite crear órdenes de montaje sin VIN. También elimina el lookup frágil por nombre de modelo en el flujo de completar montaje.
- **`CustomerBike.productVariantId`** — FK nullable a `ProductVariant`. Vincula la bici al catálogo estructuralmente, reemplazando los textos libres `model`/`color`/`voltaje` para vehículos EVOBIKE.

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
| **2F.6** | **Cliente obligatorio en POS** — modal de selección/creación con campos completos | ✅ Completo |
| **2G** | **Módulo Pedidos** (Layaway + Backorder fusionados) | ✅ Completo |
| **2H** | **Módulo de Montaje** — ensamble batería+vehículo, trazabilidad para garantía | 🔧 En curso |
| 2H-0 | Schema: `CustomerBike.customerId` → nullable (vehículos pre-venta) | ⏳ Pendiente |
| 2H-1 | Recepción de baterías (BatteryLot + Battery CRUD, UI de lotes) | ⏳ Pendiente |
| 2H-2 | Backend de montaje (API Routes: crear, completar, cancelar) | ⏳ Pendiente |
| 2H-3 | UI de montaje (Kanban + modal multi-paso, sidebar entry) | ⏳ Pendiente |
| 2H-4 | Desinstalación de baterías (flujo inverso: desasignar batería → IN_STOCK) | ⏳ Pendiente |
| 3 | Cotizaciones | ⏳ Pendiente |
| 4 | Taller completo (cobro al entregar + descuento automático de stock + **integración POS-montaje**: buscar `CustomerBike` por VIN al vender, upgrade voltaje) | ⏳ Pendiente |
| 5 | Reportes y comisiones (incluye desglose COLLECTED vs PENDING en caja) | ⏳ Pendiente |
| 6 | Cierre / producción (tests, hardening, deploy, config Prisma v7) | ⏳ Pendiente |

### Reglas del módulo de montaje (2H)

- **Permisos**: Todos los roles pueden crear órdenes de montaje. Solo TECHNICIAN, MANAGER y ADMIN pueden completarlas.
- **Baterías**: Permanecen `IN_STOCK` al crear la orden (PENDING). Se cambian a `INSTALLED` solo al completar el montaje, dentro de `$transaction`.
- **Desinstalación (2H-4)**: Flujo inverso — desasigna baterías de un vehículo, regresándolas a `IN_STOCK`. Marca `BatteryAssignment.isCurrent = false` y actualiza `Battery.status`.
- **Integración POS**: Fuera del scope de 2H. Se implementará en Fase 4 junto con taller completo. `pos-terminal.tsx` es el archivo de mayor riesgo del proyecto.

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

## 🎨 Frontend y UI
- **Sistema de Diseño (EvoFlow):** Para cualquier trabajo de UI, creación de vistas o modificación visual, **es OBLIGATORIO leer el archivo `DESIGN.md`** (allí están las reglas de tipografías, ausencia de bordes sólidos, glassmorphism y tokens de color). Si trabajas en backend, ignora ese archivo.
- **Componentes Base:** Ubicados en `src/components/ui/` (shadcn/ui). **NUNCA los edites manualmente.**
- **Estilos:** Tailwind utility-first. Usa `cn()` para clases condicionales. No crees archivos `.css` (usa los tokens EvoFlow de `globals.css`).
- **Formularios y Alertas:** Obligatorio usar `react-hook-form` + Zod. Obligatorio usar `toast` de `sonner` (Cero `alert()` o `console.log` en producción).
- **Idioma y Rutas:** Textos visibles al usuario en **español**. Variables/archivos en español. Usa siempre el alias `@/*` para imports.




