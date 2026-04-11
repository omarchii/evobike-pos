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
- **Vinculación Pedidos ↔ Baterías ↔ Montaje (Fase 2H-D)** — `BatteryLot.saleItemId` (nullable, FK a `SaleItem`) y `AssemblyOrder.saleId` (nullable, FK a `Sale`) vinculan recepciones de baterías y órdenes de montaje al pedido que las originó. Null = operación independiente (baterías sueltas, montaje sin pedido). La cantidad esperada de baterías se calcula siempre vía `BatteryConfiguration`, nunca se almacena redundantemente. El vínculo es a nivel de `SaleItem`, no de `Sale`, porque un pedido puede tener múltiples modelos con distintas configuraciones de batería.
- **Recepción parcial bidireccional (Fase 2H-D)** — Los flujos `inventory/receipts` (vehículos → Stock + AssemblyOrder PENDING) y `batteries/lots` (baterías → BatteryLot + Battery IN_STOCK) son independientes. Ambos órdenes de llegada están soportados sin sincronización entre recepciones. El montaje vincula ambos al completarse. No se requiere bloqueo explícito: si no hay baterías IN_STOCK, el técnico simplemente no puede completar el montaje.
- **Separación Pedidos vs. Inventario** — El cobro de anticipos y abonos vive en Pedidos (2G) vía `Sale + CashTransaction`. La recepción de mercancía vive en Inventario vía `inventory/receipts`. No se fusionan (dominios distintos: venta a cliente vs. operación de almacén, cardinalidad N:M entre envíos y pedidos). La disponibilidad de stock para un BACKORDER se resuelve con query de lectura a `Stock` en el Server Component, sin acoplamiento de escritura.
- **Flujo dual de baterías corregido (Fase 2H-D)** — La creación de un `BatteryLot` DEBE generar `InventoryMovement(PURCHASE_RECEIPT)` y actualizar `Stock` dentro de la misma `$transaction`. Esto corrige la inconsistencia original donde los Battery records existían sin contrapartida contable. Script de sincronización para datos existentes diferido a Fase 6 (no hay datos reales de producción aún).

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
| **2F.5** | **Historial de Ventas** (consulta por folio, filtros por fecha/vendedor/método de pago, detalle de venta) | ⏳ Pendiente - Lo dejamos para la fase 5|
| **2F.6** | **Cliente obligatorio en POS** — modal de selección/creación con campos completos | ✅ Completo |
| **2G** | **Módulo Pedidos** (Layaway + Backorder fusionados) | ✅ Completo |
| **2H** | **Módulo de Montaje** — ensamble batería+vehículo, trazabilidad para garantía | ✅ Completo |
| 2H-A | Migración Server Actions → API Routes | ✅ Completo |
| 2H-B | Schema + API Routes montaje (crear, completar, cancelar, desinstalación) | ✅ Completo |
| 2H-C | Integración Inventario ↔ Montaje (auto-crear AssemblyOrders en recepción) | ✅ Completo |
| **2H-D** | **Vinculación Pedidos ↔ Baterías ↔ Montaje** (BatteryLot.saleItemId, AssemblyOrder.saleId, modal Nuevo Pedido completo, chip Kanban, dialog completar con lotes) | ✅ Completo |
| 3 | Cotizaciones | ✅ Completo |
| 4 | Taller completo (cobro al entregar + descuento automático de stock + **integración POS-montaje**: buscar `CustomerBike` por VIN al vender, upgrade voltaje) | ⏳ Pendiente |
| 5 | Reportes y comisiones (incluye desglose COLLECTED vs PENDING en caja) | ⏳ Pendiente |
| 6 | Cierre / producción (tests, hardening, deploy, config Prisma v7) | ⏳ Pendiente |

### Reglas del módulo de montaje (2H)

- **Permisos**: Todos los roles pueden crear órdenes de montaje. Solo TECHNICIAN, MANAGER y ADMIN pueden completarlas.
- **Baterías**: Permanecen `IN_STOCK` al crear la orden (PENDING). Se cambian a `INSTALLED` solo al completar el montaje, dentro de `$transaction`.
- **Desinstalación (2H-4)**: Flujo inverso — desasigna baterías de un vehículo, regresándolas a `IN_STOCK`. Marca `BatteryAssignment.isCurrent = false` y actualiza `Battery.status`.
- **Integración POS**: Fuera del scope de 2H. Se implementará en Fase 4 junto con taller completo. `pos-terminal.tsx` es el archivo de mayor riesgo del proyecto.
- **Chip de disponibilidad de baterías en Kanban (2H-3)**: OBLIGATORIO. El Kanban de montaje debe mostrar en cada AssemblyOrder PENDING si hay baterías suficientes disponibles (verde), parciales (amarillo) o ninguna (rojo). Se implementa como query en el Server Component `assembly/page.tsx` pasada como props — sin endpoint nuevo.
- **Validación de BatteryLot con saleItemId**: Si se proporciona `saleItemId`, validar que el tipo de batería del lote (`productVariantId`) coincide con el `batteryVariantId` de `BatteryConfiguration` para el `(modelo_id, voltaje_id)` del SaleItem. WARNING (no bloqueo) si la cantidad excede la esperada. Error 422 si el tipo de batería es incorrecto.

---

## Fase 2H-D — Estado completado (sesión 2026-04-07/08)

### Cambios de schema (migración aplicada)
- `BatteryLot.saleItemId` — FK nullable a `SaleItem`. Vincula lotes de batería al ítem específico del pedido que los originó.
- `AssemblyOrder.saleId` — FK nullable a `Sale`. Vincula órdenes de montaje al pedido que las originó.

### Nuevas API Routes
- `GET /api/assembly/[id]/available-batteries` — retorna lotes compatibles (tipo correcto, `IN_STOCK >= requiredQuantity`) para completar una `AssemblyOrder`. Usa `BatteryConfiguration` para determinar tipo y cantidad.
- `POST /api/pedidos` — crea apartado o backorder con pago inicial. Soporta pago combinado (`isSplitPayment`, `secondaryPaymentMethod`, `secondaryDepositAmount`).
- `POST /api/pedidos/[id]/payments` — abonos posteriores.

### Cambios en API Routes existentes
- `POST /api/batteries/lots` — ahora acepta `saleItemId` opcional y genera `Stock.upsert` + `InventoryMovement(PURCHASE_RECEIPT)` dentro de la misma `$transaction` (corrección del flujo dual).
- `POST /api/inventory/receipts` — acepta `saleId` opcional para vincular AssemblyOrders generadas automáticamente al pedido.

### UI — Módulo Montaje (`/assembly`)
- **Kanban con chip de baterías**: `assembly/page.tsx` computa `batteryAvailabilityMap` via `Promise.all` y lo pasa como props. `AssemblyBoard` renderiza chip verde/amarillo/rojo en cada grupo de órdenes PENDING.
- **Dialog completar montaje**: reescrito con modo "elegir del inventario" (dropdown de lotes + preview de seriales) y modo "manual" (entrada directa). Llama a `GET /api/assembly/[id]/available-batteries` al abrir.

### UI — Módulo Pedidos (`/pedidos`)
- **Modal Nuevo Pedido** (`nuevo-pedido-modal.tsx`): modal completo con:
  - Toggle BACKORDER / LAYAWAY.
  - Cliente: búsqueda en lista existente **o** creación inline con nombre, teléfono, email + collapsibles para dirección de flete y datos de facturación (RFC, régimen fiscal SAT, uso CFDI).
  - Producto: selectores en cascada Modelo → Voltaje → Color. Precio se autorrellena desde el catálogo.
  - Pago: modo simple (monto + método) o combinado (monto total → desglose en dos métodos).
  - `VariantOption` extendida con `modeloId`, `voltajeId`, `colorId` y nombres para soportar los selectores en cascada.
- **Vista detalle de pedido** (`/pedidos/[id]`): sección "Estado de recepción" para BACKORDER que muestra progreso de vehículos (recibidos / en montaje / ensamblados) y baterías (recibidas vs. esperadas).

### Patrón de estilos en modales — CRÍTICO (bug recurrente)
Ver sección completa más abajo en "Reglas de UI para modales".

---

## Fase 3 — Estado completado (módulo de Cotizaciones)

### Cambios de schema

- `Quotation`, `QuotationItem`, enum `QuotationStatus` (`DRAFT | SENT | CONVERTED | CANCELLED`). Estado efectivo `EXPIRED` se computa en lectura vía `getEffectiveStatus()` — no existe en DB.
- `Branch.lastQuotationFolioNumber Int @default(0)` — contador atómico de folios de cotización por sucursal.
- `Quotation.publicShareToken String @unique @default(cuid())` — token para vista pública sin auth.
- `Sale.quotationId String? @unique` — plain field (sin FK Prisma explícita). La FK real es `Quotation.convertedToSaleId`. Dos relaciones independientes para evitar conflicto de nombres de relación duplicados.
- `SaleItem.productVariantId` ahora nullable + nuevos campos `description String?`, `isFreeForm Boolean @default(false)` — soporta líneas libres fuera de catálogo.

### Nuevas rutas de API

- `GET /api/cotizaciones` — listado paginado con filtros (estado, sucursal, fecha, folio, cliente).
- `POST /api/cotizaciones` — crear cotización (DRAFT); genera folio atómico `<CODE>-COT-<NNNN>`.
- `GET /api/cotizaciones/[id]` — detalle con ítems, cliente, branch.
- `PATCH /api/cotizaciones/[id]` — editar (solo DRAFT/SENT).
- `POST /api/cotizaciones/[id]/send` — marcar como SENT.
- `POST /api/cotizaciones/[id]/cancel` — cancelar con motivo.
- `POST /api/cotizaciones/[id]/duplicate` — duplicar en DRAFT (sin arrastrar descuento).
- `GET /api/cotizaciones/[id]/price-check` — detectar drift de precios respecto al catálogo actual.
- `POST /api/cotizaciones/[id]/convert` — conversión one-shot a SALE / LAYAWAY / BACKORDER dentro de `$transaction`.
- `GET /api/cotizaciones/search` — búsqueda rápida por folio o cliente.

### Cambios en API Routes existentes (aditivos)

- `POST /api/sales` — acepta `quotationId` y `frozenItems` opcionales. Ruta legacy sin esos params sigue funcionando igual. El path de conversión corre dentro del mismo `$transaction`.
- `POST /api/pedidos` — ídem con `quotationId`, `frozenItems` y `total` opcionales.

### Decisiones clave

- Folio usa `Branch.code` → formato `LEO-COT-0001`. Contador independiente de ventas.
- Dos relaciones independientes Sale↔Quotation: `Quotation.convertedToSaleId` (FK Prisma) y `Sale.quotationId` (plain unique). Evita conflicto de nombres de relación duplicados en Prisma.
- Duplicar cotización **no** arrastra `discountAmount` (requiere nueva autorización de gerente).
- "Mantener precio original" cuando hay drift higher requiere auth de gerente. Por defecto se usan precios actualizados del catálogo.
- Comisión al `convertedByUserId`, no al creador original de la cotización.
- Vista pública sin auth en `src/app/cotizaciones/public/[token]/page.tsx` — fuera del grupo `(pos)` para evitar el redirect de auth del layout.
- Light mode forzado en vista pública vía CSS custom properties redefinidas en `.evobike-public-doc {}` — los tokens del hijo sobreescriben los del ancestro `html.dark`.
- Compartir por WhatsApp vía URL `wa.me/52{phone}?text={msg}` — sin dependencias, sin backend. `window.open(..., '_blank', 'noopener,noreferrer')`.
- `canShare = isActionable || effectiveStatus === "EXPIRED"` — compartir/WhatsApp visible también en cotizaciones expiradas (útil como referencia histórica para el cliente).

### Helpers en `src/lib/quotations.ts`

- `getEffectiveStatus(q)` — calcula `"EXPIRED"` si `status` es DRAFT/SENT y `validUntil < now()`. Sin cron ni write a DB.
- `getDaysRemaining(validUntil)` — días restantes (negativo si ya expiró).
- `formatMXN(value)` — formatea como `$XX,XXX.XX` con `Intl.NumberFormat("es-MX", { currency: "MXN" })`.
- `formatDate(date)` — formatea `"16 abr 2026"` con `toLocaleDateString("es-MX")`.

### Reglas del módulo

- Cotizar **no** requiere caja abierta. Convertir a Venta directa **sí** (heredado del POS).
- Cotizar **no** toca Stock. La validación de stock ocurre en la conversión.
- Vigencia: 7 días. La expiración se computa en lectura; no requiere cron.
- Líneas libres (`isFreeForm = true`) **no** generan `InventoryMovement` ni consultan Stock.
- Conversión one-shot dentro de `prisma.$transaction()` con revalidación de status al inicio — cierra la race condition de doble conversión.
- El lock de precio se refleja en la leyenda del PDF: "Los precios mostrados son válidos únicamente el día de emisión de esta cotización. Vigencia: 7 días."

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

---

## Reglas de UI para modales — Bug recurrente de contraste (3+ veces)

### El problema
Usar `--surf-high` o `--surf-highest` como fondo de inputs dentro de modales causa:
- **Light mode**: inputs verdes pálidos (#dcf0e8) → texto placeholder con bajo contraste.
- **Dark mode**: `--surf-bright` = `--surf-high` = `#2b2b2b` — **idénticos**. Los campos desaparecen visualmente.

### Regla absoluta
> **En modales, los inputs SIEMPRE usan `--surf-low` como fondo.**  
> `--surf-high` y `--surf-highest` son correctos para contenedores de sección y headers de collapsible, **no para campos interactivos**.

### Patrón canónico — copiar de `customer-selector-modal.tsx`

```tsx
// Definir al inicio del archivo (NO dentro del componente)
const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",   // ← SIEMPRE surf-low en modales
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  fontSize: "0.875rem",
  height: 44,
};

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
  width: "100%",
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  appearance: "none",
  WebkitAppearance: "none",
};
```

**Modal container (glassmorphism obligatorio):**
```tsx
<DialogContent
  className="p-0 gap-0 overflow-hidden"
  style={{
    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
  }}
>
```

**Tabla de tokens por elemento:**

| Elemento                        | Token correcto     |
|---------------------------------|--------------------|
| Fondo del modal/dialog          | glassmorphism sobre `--surf-bright` |
| Input / select / textarea       | `--surf-low`       |
| Header de sección/collapsible   | `--surf-high`      |
| Grid interior del collapsible   | `--surf-highest`   |
| Hover en lista de resultados    | `--surf-high`      |
| Ítem de lista (resting)         | `--surf-lowest`    |

**Por qué funciona `--surf-low`:**
- Light: `#f0f7f4` (suave tinte verde) sobre modal `~#fafffe` → campo visible y legible.
- Dark: `#1b1b1b` sobre modal `#2b2b2b` → campo claramente recesado, buen contraste.




