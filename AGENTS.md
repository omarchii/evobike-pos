## Arquitectura y flujo de datos

- **Migraciones con drift BD-adelantada** — Si `prisma db push` fue usado en algún momento, el procedimiento de sincronización es: generar SQL con `migrate diff`, crear el archivo manualmente en `prisma/migrations/`, luego `prisma migrate resolve --applied <nombre>`. Nunca resetear la BD.

**Grupos de rutas:**

- `(auth)/` — rutas públicas (solo `/login`)
- `(pos)/` — rutas protegidas; el `layout.tsx` valida sesión server-side con `redirect("/login")`
- `src/app/<ruta>/` (sin grupo) — páginas públicas que no requieren auth y no deben heredar el layout de `(pos)`. Ejemplo: `src/app/cotizaciones/public/[token]/page.tsx`. **Nunca** meter rutas sin auth dentro de `(pos)` — el layout las redirige a login.

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
- **CommissionRule / CommissionRecord** — reglas de comisión por rol/modelo/sucursal y registros generados automáticamente en cada venta. `CommissionStatus`: `PENDING → APPROVED → PAID`, más `CANCELLED` cuando la venta origen se cancela.
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
- **Enums de Prisma en Client Components** — los enums exportados por `@prisma/client` son **server-only en runtime**; al importarlos desde un archivo `"use client"` el valor llega como `undefined` y `z.nativeEnum(EnumDePrisma)` truena en tiempo de evaluación con "Cannot convert undefined or null to object". Workaround obligatorio: definir una tupla local `as const` en el archivo cliente y usar `z.enum(LOCAL_TUPLE)`. El tipo se puede seguir importando con `import type` (se elide en compilación) o reconstruir como `(typeof LOCAL_TUPLE)[number]`. El server (API Route) sigue importando el enum real de Prisma como fuente de verdad.

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
- Sistema de diseño: **EvoFlow Green Edition** (dual mode — light/dark). La spec completa vive en `DESIGN.md`; esta sección lista solo las reglas operativas.
- **Tokens antes que valores literales.** Cualquier color, borde sutil, radius o familia tipográfica debe venir de una CSS variable definida en `globals.css`. Si necesitas un valor que no existe como token, primero tokenízalo en `globals.css` con pares light/dark, después úsalo.
- **Prohibido hardcodear** (rompen dark mode silenciosamente):
  - `rgba(178,204,192,0.15)` / `.2` / `.08` → `var(--ghost-border)`
  - Rojos literales (`#dc2626`, `bg-red-500`, `text-red-600`) → `var(--ter)` / `var(--ter-container)` / `var(--on-ter-container)`
  - `bg-white`, `#ffffff` como fondo de card → `bg-[var(--surf-lowest)]`
  - `text-black`, `#000000` → `text-[var(--on-surf)]`
  - Tailwind neutrales (`bg-slate-*`, `bg-zinc-*`, `bg-gray-*`, `text-gray-*`) → surface/on-surface tokens
- **Glassmorphism oficial**: `color-mix(in srgb, var(--surf-bright) 88%, transparent)` + `backdrop-filter: blur(20px)`. No reemplazar por `rgba` fijo.
- **Velocity Gradient**: máximo 2 instancias por vista (KPI destacado + CTA primario). Excepciones permitidas: toggles de rango temporal y barras de progreso comparativo. Ver `DESIGN.md §10`.
- **Tipografía**: Space Grotesk (`var(--font-display)`) exclusivo de títulos de página (`1.5rem / 700 / -0.01em`) y KPIs (`2.75rem / 700 / -0.02em`). Inter para todo lo demás. No mezclar `font-semibold` en body copy. El token `var(--font-heading)` **no existe** — usar `var(--font-display)`.
- **No-Line rule**: separación entre secciones/headers/paneles por cambio tonal de surface, nunca `border-b` con color sólido. Las tablas son excepción (pueden usar `var(--ghost-border)` en header).
- **Antes de commitear UI**: correr checklist de `DESIGN.md §10` y probar la vista en light y dark mode vía el `ThemeToggle` del topbar.

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
- **Módulo de montaje (Fase 2H)** — diseñado con Opus. `CustomerBike.customerId` es nullable para soportar vehículos pre-venta (sin cliente asignado). El montaje ocurre antes de la venta. La integración con POS se completó en Fase 4.
- **Integración Inventario ↔ Montaje (Fase 2H-C)** — Al recibir mercancía (`PURCHASE_RECEIPT`), se crean automáticamente `AssemblyOrder` PENDING para cada unidad de vehículo ensamblable. Un vehículo es ensamblable si `modelo.requiere_vin === true` AND existe `BatteryConfiguration` para `(modeloId, voltajeId)`. La `AssemblyOrder` se crea SIN `customerBikeId` (null) — el VIN se captura durante el montaje físico, no en la recepción. `Stock` sube en la recepción y baja en la venta (el montaje no cambia Stock). Las baterías usan flujo dual: `Stock` + `InventoryMovement` para contabilidad, `BatteryLot` + `Battery` para trazabilidad por serial.
- **`AssemblyOrder.productVariantId`** — FK nullable a `ProductVariant`. Permite crear órdenes de montaje sin VIN. También elimina el lookup frágil por nombre de modelo en el flujo de completar montaje.
- **`CustomerBike.productVariantId`** — FK nullable a `ProductVariant`. Vincula la bici al catálogo estructuralmente, reemplazando los textos libres `model`/`color`/`voltaje` para vehículos EVOBIKE.
- **Vinculación Pedidos ↔ Baterías ↔ Montaje (Fase 2H-D)** — `BatteryLot.saleItemId` (nullable, FK a `SaleItem`) y `AssemblyOrder.saleId` (nullable, FK a `Sale`) vinculan recepciones de baterías y órdenes de montaje al pedido que las originó. Null = operación independiente (baterías sueltas, montaje sin pedido). La cantidad esperada de baterías se calcula siempre vía `BatteryConfiguration`, nunca se almacena redundantemente. El vínculo es a nivel de `SaleItem`, no de `Sale`, porque un pedido puede tener múltiples modelos con distintas configuraciones de batería.
- **Recepción parcial bidireccional (Fase 2H-D)** — Los flujos `inventory/receipts` (vehículos → Stock + AssemblyOrder PENDING) y `batteries/lots` (baterías → BatteryLot + Battery IN_STOCK) son independientes. Ambos órdenes de llegada están soportados sin sincronización entre recepciones. El montaje vincula ambos al completarse. No se requiere bloqueo explícito: si no hay baterías IN_STOCK, el técnico simplemente no puede completar el montaje.
- **Separación Pedidos vs. Inventario** — El cobro de anticipos y abonos vive en Pedidos (2G) vía `Sale + CashTransaction`. La recepción de mercancía vive en Inventario vía `inventory/receipts`. No se fusionan (dominios distintos: venta a cliente vs. operación de almacén, cardinalidad N:M entre envíos y pedidos). La disponibilidad de stock para un BACKORDER se resuelve con query de lectura a `Stock` en el Server Component, sin acoplamiento de escritura.
- **Flujo dual de baterías corregido (Fase 2H-D)** — La creación de un `BatteryLot` DEBE generar `InventoryMovement(PURCHASE_RECEIPT)` y actualizar `Stock` dentro de la misma `$transaction`. Esto corrige la inconsistencia original donde los Battery records existían sin contrapartida contable. Script de sincronización para datos existentes diferido a Fase 6 (no hay datos reales de producción aún).
- **SimpleProduct polimórfico (Fase P0)** — Accesorios, cargadores, refacciones y baterías standalone viven en `SimpleProduct` (categoría enum, `precioPublico` + `precioMayorista`, `stockMinimo`/`stockMaximo`, `modeloAplicable` como string libre). `Stock`, `InventoryMovement` y `BatteryLot` son polimórficos: ambos FKs (`productVariantId`, `simpleProductId`) son nullable y existe un CHECK constraint en SQL `(productId IS NOT NULL) <> (simpleProductId IS NOT NULL)` para exigir exactamente uno. La unicidad de `Stock` usa dos `@@unique` regulares — Postgres trata `NULL` como distinto, lo que da el efecto deseado sin necesidad de índices únicos parciales. Los CHECK constraints se editan manualmente en el `.sql` de la migración después de `migrate dev --create-only` porque Prisma no los declara. `modeloAplicable` se mantiene como `String?` libre (null = GLOBAL); la normalización y validación cruzada con `Modelo.nombre` se resuelve con un helper pendiente de P3. `ProductVariant` también gana `stockMinimo`/`stockMaximo` para unificar alertas de reposición entre ambos tipos.
- **Configuración de sucursal (Fase P1-A / P6-S1)** — Los PDFs (P6) consultan `Branch` directamente por `rfc`, `razonSocial`, `regimenFiscal`, dirección desglosada, contacto, `sealImageUrl`, y plantillas `terminosCotizacion/Pedido/Poliza`. Antes de emitir un PDF llamar `assertBranchConfiguredForPDF(branchId, tipoDoc)` (`src/lib/branch.ts`). **Contrato actualizado en P6-S1**: la función ahora **lanza `BranchNotConfiguredError`** (ya no retorna `{ok: false}`) y **devuelve `BranchPDFData`** tipado listo para pasar a componentes. `TipoDocPDF = 'cotizacion' | 'pedido' | 'ticket' | 'poliza'`. Validaciones: todos los tipos requieren `rfc`, `razonSocial`, `regimenFiscal`, `street`, `colonia`, `city`, `state`, `zip`, `phone`, `sealImageUrl`; además `terminosCotizacion/Pedido/Poliza` según el tipo. El seed precarga placeholders `CONFIGURAR …` — el guard falla hasta que ADMIN los sobreescriba en `/configuracion/sucursal`. El sello se guarda en `/public/sellos/{branchId}-{ts}.webp`; como react-pdf no acepta WebP directamente, usar `resolveSealBuffer(sealImageUrl)` exportado desde `src/lib/pdf/components/document-footer.tsx` para convertir a PNG buffer antes de renderizar. El campo `Branch.address` (legacy) queda y no debe usarse para nueva UI.
- **Infraestructura PDF (Fase P6-S1)** — Capa de generación de PDFs en `src/lib/pdf/`. Librería: `@react-pdf/renderer@4.4.1` (NO actualizar a 4.5.0 — depende de `@react-pdf/svg` aún no publicado en npm; pinear también `@react-pdf/layout@4.5.1` y `@react-pdf/image@3.0.4`). Fuente única en PDFs: Inter TTF (no Space Grotesk — solo aplica en la app web). Renderizado: `renderToBuffer`. `Content-Disposition: inline`. **Gotcha crítico de imágenes**: `public/evobike-logo.png` es un RIFF WebP con extensión `.png`; react-pdf falla silenciosamente al cargarlo. Usar siempre `public/evobike-logo-pdf.png` (PNG real generado con sharp). Los sellos de sucursal se almacenan como WebP (P1-A); llamar `resolveSealBuffer(url)` antes de pasarlos a `<DocumentFooter>` — convierte WebP → PNG buffer usando sharp. **Patrón de llamada en Route Handlers**: resolver imágenes (logo, sello) antes de `renderToBuffer`; los componentes PDF son síncronos y reciben buffers ya procesados. `Font.registerHyphenationCallback((w) => [w])` desactiva la partición silábica automática (sin esto, headers de tabla se parten en guiones). Los CSS vars del app (`--surf-low`, etc.) no funcionan en react-pdf — usar la paleta hardcoded de `src/lib/pdf/colors.ts`. Las rutas dev-only (`/dev/pdf-preview`, `/api/dev/pdf-preview`) bloquean con `notFound()` en producción.
- **Módulo de Configuración (Fase P1)** — Hub `/configuracion` (ADMIN + MANAGER) con tarjetas a sub-módulos. Sub-módulos disponibles: `/configuracion/sucursal` (ADMIN — P1-A), `/configuracion/usuarios` (ADMIN — P1-B), `/configuracion/servicios` (ADMIN + MANAGER — P1-C), `/configuracion/comisiones` (redirect a `/reportes/comisiones/reglas` — P1-D). Pendiente P1-E (catálogo de productos). Los usuarios no se eliminan: se desactivan (`User.isActive = false`). El login (`src/lib/auth.ts`) rechaza usuarios con `isActive = false`. ADMIN puede crear/editar comisiones y servicios en cualquier sucursal pasando `branchId` en el payload; MANAGER queda restringido a su sucursal. Un usuario no puede desactivarse a sí mismo.
- **Código polimórfico: filtrar antes de serializar** — Cualquier serializer que asuma `productVariant` non-null (ej. `assembly/page.tsx`, `dashboard/page.tsx`, `batteries/lots GET`) debe filtrar por `productVariant !== null` y/o por `productVariantId !== null`. A medida que se agregue UI/reportes para `SimpleProduct`, considerar una segunda lista (`simpleProducts`) en vez de forzarla en la misma estructura. Recordatorio: el CHECK de DB garantiza que exactamente uno está poblado, pero TypeScript no lo sabe.
- **POS polimórfico y cart mixto (Fase P3.4)** — `POST /api/sales` acepta líneas tipo `ProductVariant`, `SimpleProduct` y concepto libre en un mismo payload. `saleItemSchema`/`frozenItemSchema` usan schema flat con `productVariantId?`, `simpleProductId?`, `isFreeForm?` + `superRefine` que exige exactamente uno. **Decisión:** flat + `superRefine` en vez de `z.discriminatedUnion` porque mantiene compatibilidad con callers existentes (POS, seed transaccional, quotation conversion) sin refactor de payloads. Stock check y `InventoryMovement` son polimórficos en ambos paths (normal y frozen): `simpleProductId_branchId` cuando hay `simpleProductId`; `productVariantId_branchId` en otro caso. `SaleItem` persiste `description = sp.nombre` como snapshot para SimpleProduct (en free-form persiste el texto libre). Comisiones: `generateCommissions` salta cualquier línea sin `productVariantId` — SimpleProduct y free-form no comisionan (política operativa: solo se comisiona venta de vehículo). `POST /api/pedidos` extiende solo el path de `frozenItems` (las líneas directas siguen siendo single-variant para apartado/backorder de vehículo). UI: tab "Accesorios" en `point-of-sale/pos-terminal.tsx` sustituye el grid de modelos cuando está activo, con sub-filtros de `modeloAplicable` (Todos / Universal / cada modelo). `CartItem.simpleProductId + simpleCategoria` discrimina en render; un mismo carrito combina vehículos + accesorios + free-form + baterías standalone.
- **Compras al proveedor (Fase P4-A/P4-B)** — Se introduce cabecera `PurchaseReceipt` (cuid) sobre `InventoryMovement` y `BatteryLot`. Razones: una factura del proveedor cubre N SKUs (vehículos + SimpleProducts + baterías); el estado de pago, factura adjunta y proveedor son por documento, no por línea; consistente con `Sale↔SaleItem` y `BatteryLot↔Battery`; las cuentas por pagar (P10-F) consultan directo a la cabecera. `BatteryLot.purchaseReceiptId` es nullable porque la misma factura puede traer vehículos + baterías. `InventoryMovement.purchaseReceiptId` también es nullable — la invariante "solo PURCHASE_RECEIPT lo tiene poblado" se documenta aquí, no se impone con CHECK (SALE/RETURN/TRANSFER/ADJUSTMENT/WORKSHOP_USAGE jamás lo setean). El `@@unique([branchId, proveedor, folioFacturaProveedor])` aprovecha que Postgres trata NULL como distinto, así que recepciones sin factura formal coexisten sin índice único parcial. El vínculo Pedido↔Recepción vive en `BatteryLot.saleItemId` y `AssemblyOrder.saleId` (2H-D), con granularidad de ítem. `PurchaseReceipt` **no** tiene `saleId` — una recepción del proveedor es N:M con pedidos (un envío cubre varios backorders + stock libre), así que un FK a nivel cabecera era ambiguo. Eliminado en migración `20260412110000_drop_purchase_receipt_saleid`. El seed crea una cabecera sintética `"Histórico previo a P4"` por sucursal y vincula todo `InventoryMovement(PURCHASE_RECEIPT)` y `BatteryLot` previo, más 4 recepciones realistas adicionales por sucursal cubriendo PAGADA/PENDIENTE/CREDITO. **APIs (P4-B):** `POST /api/inventory/receipts` acepta líneas polimórficas via `z.discriminatedUnion("kind", [variant, simple])`; `totalPagado` se calcula server-side ignorando lo que mande el cliente; `ProductVariant.costo` y `SimpleProduct.precioMayorista` **no** se tocan — el costo catálogo (editable en P1-E) y el costo histórico real (`InventoryMovement.precioUnitarioPagado`) son conceptos distintos, fundamental para rentabilidad P10-C. Reglas cruzadas en `superRefine`: `CREDITO ⇒ fechaVencimiento`; `CONTADO + estadoPago=CREDITO` inconsistente; `PAGADA` rechaza `fechaVencimiento`; `fechaPago = now()` se setea server-side. P2002 del `@@unique` se mapea a 409 español. Guard `MANAGER+ADMIN` inline en todos los endpoints (`/api/inventory/receipts`, `/[id]`, `/[id]/pagar`, `/[id]/invoice`) — `batteries/lots` **no** tiene guard MANAGER+ADMIN porque lo usan técnicos en el flujo de montaje. La cabecera en `batteries/lots` se valida con `findUnique` dentro del `$transaction` para evitar TOCTOU. Upload de factura sigue el patrón de sello de sucursal (P1-A): PDFs raw (10MB max), imágenes vía `sharp` → WebP 2000px (5MB max pre-sharp), `/public/facturas/{branchId}-{receiptId}-{ts}.{ext}`, DELETE simétrico, la recepción se valida antes de parsear formData para no dejar huérfanos. Cancelación/reversión de recepción diferida a P10-E/Fase 6 — interim: `InventoryMovement(ADJUSTMENT)` manual.
- **UI de recepciones (Fase P4-C)** — Rutas en español bajo `/inventario/recepciones`. El listado (`/inventario/recepciones`) usa Server Component con Prisma directo (no self-fetch a API Routes) para poder hacer la query `DISTINCT proveedor` y el filtro de proveedor en un solo viaje; los filtros se sincronizan en la URL via `router.replace()` + `useSearchParams()` (no useState). El formulario de nueva recepción (`/inventario/recepciones/nuevo`) usa `useReducer` para las líneas mixtas (variant/simple) + `react-hook-form+zod` solo para la cabecera; las reglas cruzadas entre forma de pago y estado de pago se validan en el submit handler, no en `superRefine`, para poder lanzar `setError()` de RHF. El detalle (`/inventario/recepciones/[id]`) es Server Component que serializa `PurchaseReceipt` con variantes/simples/batteryLots a un `SerializedReceiptDetail` y delega la interactividad (marcar pagada, upload/delete factura) a un Client Component; las tres acciones usan `router.refresh()` para sincronizar sin estado local. `ReceiptStatusBadge` es componente compartido sin "use client" usado tanto en listado como en detalle. Tab Alertas en `/configuracion/catalogo` discrimina el link de recepción rápida: `?variantId=X` vs `?simpleProductId=X` (en lugar de `?productId=X` ambiguo previo). **Deuda conocida:** normalización de nombre de proveedor (string libre, sin tabla maestra) — diferida a commit futuro. **P10-F reducido:** el listado con filtros cubre el caso operativo de cuentas por pagar; P10-F queda como reporte agregado / export CSV únicamente.
- **Seed transaccional (Fase P2)** — `prisma/seed-transactional.ts` replica la lógica de API Routes (sales, pedidos, service-orders, assembly, batteries/lots) sin acoplamiento — NO importa desde `src/app/api/`. Cualquier cambio en la lógica real debe reflejarse manualmente en el seed. Idempotencia por marcadores: cada tarea chequea existencia (Customer con `phone` sentinela, counts por sucursal, etc.) y skipea si ya corrió. Folios en seed usan `branch.code` en lugar de `branch.name` para evitar colisión ("Sucursal Leo" y "Sucursal Av 135" ambos normalizan a prefix `"SUC"`). El concepto de "vehículo ensamblable" se resuelve por existencia de `BatteryConfiguration(modeloId, voltajeId)`, NO por `Modelo.requiere_vin` — el seed de catálogo original deja `requiere_vin=false` por un upsert-drift; evitar depender de ese flag en el seed transaccional.
- **Caja per-branch + validación isActive en mutaciones + night audit (post-P5)** — La `CashRegisterSession` dejó de ser per-user: la búsqueda canónica de sesión activa es `findFirst({ where: { branchId, status: "OPEN" } })` porque el negocio tiene UNA caja física por sucursal que comparten todos los vendedores del turno. El campo `CashRegisterSession.userId` pasa a significar "quién la abrió" (audit), no "dueño del turno" — sin cambios de schema. Cualquier usuario autenticado puede abrir y cerrar; el primero en llegar abre, cualquiera cierra. **Helpers** en `src/lib/cash-register.ts`: `getActiveSession(branchId)`, `getOrphanedSession(branchId)` (compara `toDateString()` con hoy), `assertSessionFreshOrThrow(session)` (lanza `OrphanedCashSessionError`). **Patrón en mutaciones** (stateless reads, stateful writes): `getServerSession` → `requireActiveUser(session)` (helper en `src/lib/auth-helpers.ts` que hace `findUnique` por PK y throw `UserInactiveError` si no existe o `isActive=false`) → `getActiveSession(branchId)` → `assertSessionFreshOrThrow` → `$transaction`. Solo se valida en mutaciones (POST/PATCH); las lecturas siguen confiando en el JWT — el `session.maxAge` bajó a 8h para que el cliente se re-autentique cada turno. Todas las rutas mapean `UserInactiveError` a 401 y `OrphanedCashSessionError` a 409 con "La caja del día anterior debe cerrarse antes de registrar nuevas operaciones." Rutas migradas: `sales`, `pedidos`, `pedidos/[id]/payments`, `service-orders/[id]/charge|deliver`, `customers/[id]/balance`, `cotizaciones/[id]/convert`, `workshop/deliver`, `cash-register/session` (GET/POST/PATCH). **Night audit sin cron ni schema**: lazy check en el layout `(pos)/` — `OrphanedSessionBanner` Server Component renderiza banner glassmorphism tono `--warn-container` con CTA a `/cash-register` si la caja abierta no es del día actual. En mutaciones que generan `CashTransaction`, `assertSessionFreshOrThrow` bloquea con 409 — imposible vender con caja vieja abierta. **Error handling del cash-register route**: `console.error` obligatorio en cada catch + detección de `Prisma.PrismaClientKnownRequestError.code === "P2003"` → 401 "Sesión obsoleta. Cierra sesión y vuelve a iniciar." Este 500 silencioso se repetía cuando el JWT del cliente tenía un `userId` que ya no existía en DB (reseed + JWT viejo); el query log del INSERT se imprimía pero el FK fallaba sin diagnóstico. **UX del `CashSessionManager`**: si el POST al abrir devuelve 409 "Ya hay una caja abierta" (porque otro usuario la abrió primero mientras el modal estaba montado), el cliente cierra el modal + `router.refresh()` con toast informativo — no deja al usuario atrapado. **Deuda conocida** (ambas diferidas a Fase 6, ver ROADMAP.md): race condition al abrir caja simultáneamente desde dos navegadores (falta unique parcial `WHERE status='OPEN'`), y cron proactivo de notificación de caja huérfana.
- **Historial de abonos en `/pedidos/[id]` (Fase P8 — sesión 2026-04-15)** — Timeline visual ya existía (commits previos) con punto/ícono por método, fecha, vendedor, monto y última fila destacada con gradient. P8 cerró dos huecos: (1) `DetallePayment.remainingAfter` calculado server-side en `page.tsx` con `reduce` (purity-safe; React Compiler bloquea `let acc = 0; arr.map(...)` por reasignación post-render). El microtexto bajo cada monto muestra "Restante tras este abono: $X,XXX.XX" (10px, `var(--on-surf-var)`, alineado a la derecha). (2) Header del timeline pasa de "Historial de abonos (N)" a "Historial de abonos · N exhibiciones realizadas" (singular `exhibición realizada` para N=1). **Decisión de modelo:** `CashTransaction` y `Sale` no distinguen enganche vs exhibición — el `downPayment` de `POST /api/sales` solo nombra el monto inicial al crear LAYAWAY pero se persiste como `CashTransaction` idéntica al resto. El label se mantiene uniforme; agregar la distinción en el futuro requiere migración (campo en `CashTransaction` o convención "primer pago = enganche"). **Mini-fix de UX en `pedido-detalle.tsx`:** `pending` ahora se clampea con `Math.max(0, …)` para evitar que la celda "Restante" muestre negativos si por corrección manual `totalPaid > total`. El servidor ya clampea `remainingAfter` por abono. PDF P6-B (`abonos-timeline.tsx`) intacto — ya tenía la tabla con totales correctos.
- **Cotizaciones mejoradas (Fase P7 — sesión 2026-04-15)** — **Enum `QuotationStatus` rediseñado** (P7-A): `DRAFT | EN_ESPERA_CLIENTE | EN_ESPERA_FABRICA | PAGADA | FINALIZADA | RECHAZADA`. Migración mapea `SENT → EN_ESPERA_CLIENTE`, `CONVERTED → FINALIZADA`, `CANCELLED → RECHAZADA`. `EXPIRED` es un estado **computado** (no persiste en DB): `getEffectiveStatus()` en `src/lib/quotations.ts` lo deriva en runtime para `DRAFT` y `EN_ESPERA_CLIENTE` cuando `validUntil < now`; `EN_ESPERA_FABRICA`, `PAGADA`, `FINALIZADA` y `RECHAZADA` nunca expiran (hay compromiso activo o son terminales). `type EffectiveStatus = QuotationStatus | "EXPIRED"`. **Máquina de transiciones (P7-B):** `PATCH /api/cotizaciones/[id]/status` con Zod + `superRefine` que valida la arista antes de persistir — rechaza con 422 si la transición no está permitida. **PDF sin datos fiscales del cliente (P7-C):** `CotizacionPDFData.cliente` ahora solo lleva `{ nombre, telefono }`. `ClientInfoBlock` renderiza la fila RFC solo si `client.rfc !== undefined` — los otros PDFs que sí pasan `rfc` no se ven afectados. `DocumentFooter` ya omitía la sección de términos si el string era falsy (vacío/null), sin cambios. **Badge compartido (P7-D):** `QuotationStatusBadge` movido de `src/app/(pos)/cotizaciones/_components/` a `src/components/quotation-status-badge.tsx`; import en `quotations-table.tsx` actualizado. **Tab Cotizaciones en perfil del cliente:** `/customers/[id]` ahora tiene 4 tabs; la query `Quotation.findMany({ where: { customerId }, take: 20 })` corre en paralelo con el query principal del cliente via `Promise.all`. No se filtra por `branchId` — un cliente puede tener cotizaciones de ambas sucursales.
- **PDF Templates + helper cliente (Fase P6-S2 — sesión 2026-04-14)** — Templates en `src/lib/pdf/templates/`: `CotizacionPDF` (con `CotizacionPDFData`) y `TicketPDF` (con `TicketPDFData`). Ambos son componentes React síncronos server-side que reciben `sealSrc` ya resuelto (el route handler llama `resolveSealBuffer` antes de `renderToBuffer`). **`TotalsBlock`** ganó prop `descuento?: number` — si > 0 renderiza fila "Descuento" entre Subtotal e IVA; las demás plantillas simplemente no lo pasan. **`DocumentFooter.lineHeight`** reducido a 1.3 para texto de términos compacto. **`src/lib/pdf-client.ts`** (único archivo client-side de PDF): `openPDFInNewTab(url)` — fetch → check 412 (sucursal sin configurar) → blob → `URL.createObjectURL` → `window.open`; limpia el object URL tras 60s; toasts de sonner para 412 y errores. El directorio `src/lib/pdf/` es server-only; este helper es el único punto de contacto con el cliente. **Endpoints**: `GET /api/cotizaciones/[id]/pdf` (`.tsx` para habilitar JSX) y `GET /api/sales/[id]/ticket-pdf` (`.ts` con `React.createElement` + cast `as unknown as React.ReactElement<DocumentProps>` porque `renderToBuffer` exige ese tipo). **`TicketPDFData.cliente`** es `{nombre, telefono, email} | null` — las ventas no siempre tienen cliente. **Lógica IVA** en ambas rutas: precios del catálogo YA incluyen IVA → usar `calcSubtotalFromTotal(total − descuento)` para el desglose inverso. **`PDFItem.discount`** es fracción (0.1 = 10%); en cotización se calcula como `1 − lineTotal / (unitPrice × qty)`; en ticket como `discountAmt / (unitPrice × qty)`. **Banner de cancelación en ticket**: fondo `#FDECEA`, texto `#7B241C`; el autorizador se obtiene de `AuthorizationRequest(tipo: CANCELACION, status: APPROVED)` vinculado a la venta via `sale.authorizationRequests`. Los botones de UI (`"Descargar PDF"` en `quotation-actions-bar.tsx`, `"Descargar Ticket"` en `sale-detail.tsx`) usan `openPDFInNewTab` directamente.
- **Reportes expandidos infraestructura (P10 Lote 1 — 2026-04-16)** — Capa compartida en `src/lib/reportes/` (6 módulos) y `src/app/(pos)/reportes/_components/` (6 componentes). **`downloadCSV`** recibe `Record<string, unknown>[]` — las claves del primer objeto son los headers; NO usar la API antigua de `(headers[], rows[][], filename)`. **Enums de Prisma en clientes CSV**: igual que en el POS, los enums son server-only; definir tuplas locales `as const`. **`branchWhere(session, filterBranchId?)`**: retorna `{}` para ADMIN sin filtro, `{ branchId: filterBranchId }` para ADMIN con filtro, `{ branchId: session.branchId }` para MANAGER, `{ branchId: "__none__" }` si MANAGER sin branchId. **`parseDateRange`**: el `to` se ajusta a `23:59:59.999` del día — al mostrar en UI restar 1ms con `new Date(toDate.getTime() − 1)` antes de `toDateString()`. **Filtro cross-model en stock**: `quantity ≤ productVariant.stockMinimo` no es expresable en Prisma `where` — fetch con `stockMinimo > 0` y filtrar in-memory. **Sidebar `hasSpecificSibling`**: cuando una ruta padre (`/reportes/caja`) y una ruta hija específica (`/reportes/caja/historial`) coexisten como sub-items, el padre usa match exacto (`pathname === child.href`) para evitar que quede activo en la ruta hija. **⚠️ Deuda TZ detectada en P10-A**: varios filtros de fecha pre-P10 usan `new Date("YYYY-MM-DD")` que interpreta UTC midnight, no local — en `America/Merida` (UTC−6) corre el día un pelo (afecta `ventas/page.tsx`, `api/reportes/caja/route.ts`, `reportes/caja/page.tsx`, `reportes/comisiones/page.tsx`, `reportes/caja/historial/page.tsx`, `api/tesoreria/summary/route.ts`, `autorizaciones/page.tsx`). Fix: migrar a `parseDateRange`/`parseLocalDate` de `src/lib/reportes/date-range.ts`. Diferido a Fase 6, ver ROADMAP.md.

- **Tesorería (Fase P9 — sesión 2026-04-15)** — Módulo nuevo en `/tesoreria` (MANAGER + ADMIN). **Schema aditivo** (migración `20260415074752_add_operational_expense_and_bank_balance`): `OperationalExpense` (categoria enum `ExpenseCategory`: RENTA/SERVICIOS/NOMINA/PUBLICIDAD/TRANSPORTE/MANTENIMIENTO_INMUEBLE/IMPUESTOS/COMISIONES_BANCARIAS/OTRO) con anulación inmutable (`isAnulado + anuladoPor + anuladoAt + motivoAnulacion`) e índices por branch+fecha y branch+categoria; `BankBalanceSnapshot` **SIN `branchId`** — es cuenta única empresarial, historial inmutable ordenado por `createdAt desc` (el "saldo actual" es siempre el último snapshot). **Helpers en `src/lib/tesoreria.ts`**: `mapCashExpenseToOperational()` unifica `CashExpenseCategory → ExpenseCategory` solo para el agregado del summary (MENSAJERIA→TRANSPORTE, PAPELERIA/LIMPIEZA→SERVICIOS, MANTENIMIENTO→MANTENIMIENTO_INMUEBLE, resto→OTRO); `getActiveBankBalance`, `getExpensesInRange`, `getCashExpensesInRange`, `getDefaultMonthRange` (mes en curso = default del summary y de la UI), `OPERATIONAL_EXPENSE_METHODS` (tuple literal excluyendo CASH). **Regla de doble registro**: los `EXPENSE_OUT` en efectivo viven en `CashTransaction` (módulo Caja); los demás gastos en `OperationalExpense` (Tesorería). **Nunca** se duplican — Zod en `POST /api/tesoreria/expenses` rechaza `metodoPago === "CASH"` forzando al usuario a pasar por `/api/cash/expense`. **APIs `/api/tesoreria/`**: `expenses` POST/GET (MANAGER su sucursal + ADMIN cross-branch), `expenses/[id]` PATCH (solo `descripcion/categoria/comprobanteUrl`; mandar `monto/fecha/metodoPago` → **422** explícito "Para corregir estos campos, anula el gasto y crea uno nuevo"; MANAGER solo gastos del día y su sucursal), `expenses/[id]/anular` POST (**solo ADMIN**, motivo min 5, 409 idempotente), `expenses/[id]/comprobante` POST/DELETE (upload patrón P4-A: PDFs 10MB raw, imágenes via sharp → WebP 2000px 5MB pre-sharp, en `/public/comprobantes/{branchId}-{expenseId}-{ts}.{ext}`, valida gasto antes de parsear formData, DELETE simétrico), `bank-balance` GET (MANAGER+ADMIN, `?historial=true` paginado) + POST (**solo ADMIN**, siempre INSERT — historial inmutable), `summary` GET (ingresos=ventas completadas en rango, egresos=gastosEfectivo+gastosOperativos+comprasProveedor, balanceNeto, gastosPorCategoria unificado con denominador `gastosEfectivo+gastosOperativos` **excluyendo compras al proveedor**, saldo efectivo vía `summarizeSession().expectedCash` por cada caja abierta, saldo bancario del último snapshot). **Trampa superRefine/upload**: el create `POST /api/tesoreria/expenses` exige `comprobanteUrl` cuando `metodoPago === "TRANSFER"`; la UI manda un placeholder URL (`https://placeholder.local/tmp`) al crear y luego llama `POST /comprobante` que sobrescribe con el path real `/comprobantes/...`. Workaround pragmático porque el upload multipart es la UX correcta en el modal — si el endpoint falla tras el create, el gasto queda con URL placeholder hasta corrección manual. **UI `/tesoreria/page.tsx`** (Server Component) hace las 8 queries en paralelo con `Promise.all` (expenses, cash tx, sesiones abiertas, bank balance, Sale.aggregate, PurchaseReceipt.aggregate) y replica la lógica del endpoint `summary` inline para evitar self-fetch. 3 secciones tonales (sin `border-b` sólido): saldos (2 cards), gastos (filtros URL-params + tabla mixta operational+cash), reportes (barras CSS, sin librería de charts). Tabla mixta discrimina origen con badge "Efectivo" para filas `CashTransaction` (no editables desde aquí — link a `/cash-register`). El botón "Actualizar saldo" del card bancario está disabled para MANAGER con tooltip. **useWatch en vez de form.watch()**: patrón compiler-safe — los modales de Caja (`entrada-efectivo-dialog.tsx`, `expense-dialog.tsx`) migraron al mismo patrón el 2026-04-15 junto con el lint cleanup. **handleOpenChange wrapper** para resetear `useState(file)` al cerrar modales (React Compiler bloquea `setState` en `useEffect`).

- **Módulo Caja UI completo (Fase P5.6 — sesión 2026-04-14)** — Rediseño operativo de `/cash-register` (sidebar renombrado de "Arqueo de Caja" → "Caja", ruta intacta) sobre los helpers per-branch de P5.5. **Schema aditivo:** `CashTransaction.collectedAt DateTime?` (null mientras `collectionStatus = PENDING`, se llena al transitar a `COLLECTED` — incluye backfill `UPDATE … SET collectedAt = createdAt WHERE collectionStatus='COLLECTED'`); `CashTransaction.expenseCategory CashExpenseCategory?` con enum `MENSAJERIA | PAPELERIA | CONSUMO | MANTENIMIENTO | AJUSTE_CAJA | OTRO` (se pobla solo cuando `type='EXPENSE_OUT'`); comentario en `CashRegisterSession.openingAmt` aclarando que es **efectivo exclusivamente**. Migración `20260414065858_add_collected_at_and_expense_category` (aditiva, sin reset). **APIs nuevas (`/api/cash/`):** `POST /api/cash/expense` (Zod: amount positivo, method `CASH` literal, category enum, reference min 3 chars; tope SELLER $500 → 403 "Requiere autorización de gerente (pendiente de implementación en fase P5)"; MANAGER/ADMIN sin tope; `collectedAt = now()`); `POST /api/cash/withdrawal` (MANAGER/ADMIN only, 403 para SELLER/TECHNICIAN; `method = CASH` hardcoded, `collectedAt = now()`); `PATCH /api/cash/transactions/[id]/collect` (todos los roles; conserva el `method` original, solo flipea status + setea `collectedAt`; 404/403/409 para tx inexistente, otra sucursal, caja cerrada o ya cobrada). Los tres aplican `assertSessionFreshOrThrow` y mapeo consistente de `UserInactiveError`/`OrphanedCashSessionError`. **Reglas operativas que NO se reabren:** ajustes de cajón se registran como `EXPENSE_OUT` con categoría `AJUSTE_CAJA` (no se añadió nuevo tipo al enum); el tope de gasto SELLER es hardcoded $500 (configurabilidad por sucursal queda en backlog); cobrar pendiente NO muta el `method` (un ATRATO sigue siendo ATRATO después de liquidarse). **UI:** página rediseñada con tokens DESIGN.md (header con chip de estado Abierta/Huérfana, subtítulo `branch · abierta por · hace X`; grid de 6 KPIs por método con Atrato condicional sin movimientos; panel sticky "Esperado en cajón" = `Fondo + Efectivo − Reembolsos − Retiros − Gastos`; tabs Cobros/Reembolsos/Gastos/Retiros con badge "Pendiente" + botón "Cobrar" inline en filas `PAYMENT_IN + PENDING`). `CashActionsBar` (Client) absorbe el viejo `close-register-button.tsx` y renderiza los 4 botones del header; `Imprimir corte` queda disabled hasta P6. **Banner huérfano refactorizado:** split en server (`orphaned-session-banner.tsx`, hace la query) + client wrapper (`orphaned-session-banner-content.tsx`, usa `usePathname()` para auto-ocultarse cuando `pathname === "/cash-register"`) — evita duplicación con el chip "Huérfana" inline del header. `CashSessionManager` ahora usa el label "Efectivo inicial" (antes "Monto en efectivo"). **Trampa:** los enums de Prisma exportados desde `@prisma/client` son **server-only en runtime** — al importarlos en un Client Component (`"use client"`) el valor llega como `undefined` y `z.nativeEnum(undefined)` explota con "Cannot convert undefined or null to object". Workaround obligatorio: definir una tupla local `as const` en el archivo cliente y usar `z.enum(LOCAL_TUPLE)`; el server (API Route) sigue importando el enum real de Prisma como fuente de verdad. Esta regla aplica a `CashExpenseCategory` y a cualquier enum futuro consumido en cliente. **Pendientes (Fase P5.7):** modal "Imprimir corte Z" (P6), tope de gasto configurable por sucursal, integración con `OperationalExpense` cuando aterrice P9 (decisión: por ahora los `EXPENSE_OUT` viven solo en `CashTransaction` y P9 los lee de ahí, no se duplican).

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
| **2F.5** | **Historial de Ventas** (consulta por folio, filtros por fecha/vendedor/método de pago, detalle de venta) | ✅ Completo (cubierto en Fase 5-B) |
| **2F.6** | **Cliente obligatorio en POS** — modal de selección/creación con campos completos | ✅ Completo |
| **2G** | **Módulo Pedidos** (Layaway + Backorder fusionados) | ✅ Completo |
| **2H** | **Módulo de Montaje** — ensamble batería+vehículo, trazabilidad para garantía | ✅ Completo |
| 2H-A | Migración Server Actions → API Routes | ✅ Completo |
| 2H-B | Schema + API Routes montaje (crear, completar, cancelar, desinstalación) | ✅ Completo |
| 2H-C | Integración Inventario ↔ Montaje (auto-crear AssemblyOrders en recepción) | ✅ Completo |
| **2H-D** | **Vinculación Pedidos ↔ Baterías ↔ Montaje** (BatteryLot.saleItemId, AssemblyOrder.saleId, modal Nuevo Pedido completo, chip Kanban, dialog completar con lotes) | ✅ Completo |
| 3 | Cotizaciones | ✅ Completo |
| 4 | Taller completo (cobro de servicios, stock automático al entregar, VIN obligatorio en POS, cambio de voltaje pre-venta, póliza diferida, cancelación con reversión, `/ventas/[id]`) | ✅ Completo |
| 5 | Reportes, Historial de Ventas y Comisiones (sub-fases 5-A a 5-G) | ✅ Completo |
| 5-H | Navegación: agregar item "Reportes" al sidebar con sub-items | ⏳ Pendiente |

### Roadmap post-Fase 5 (detalle en `ROADMAP.md`)

Orden y estado vigente. Al terminar una sub-fase, marcar ✅ aquí y actualizar la fuente en `ROADMAP.md`.

| Fase | Descripción | Modelo | Dependencias | Estado |
|------|-------------|--------|--------------|--------|
| **P0** | **Arquitectura SimpleProduct** — schema polimórfico (Stock/InventoryMovement/BatteryLot), dual pricing, stockMin/Max, trazabilidad en SaleItem/ServiceOrderItem, baterías standalone unificadas con `BatteryLot/Battery` | Opus | — | ✅ Completo (2026-04-12) |
| **P1** | **Módulo de Configuración** (ADMIN) | Opus diseño → Sonnet impl | P0 | ✅ Completo (2026-04-12) |
| P1-A | Datos de sucursal (RFC, dirección, sello, términos por tipo de documento) | | P0 | ✅ Completo (2026-04-12) |
| P1-B | Gestión de usuarios (CRUD, reset password) | | P0 | ✅ Completo (2026-04-12) |
| P1-C | Catálogo de servicios del taller (`ServiceCatalog` CRUD) | | P0 | ✅ Completo (2026-04-12) |
| P1-D | Reglas de comisión (completar UI de Fase 5-D) | | P0 | ✅ Completo (2026-04-12) |
| P1-E | Catálogo de productos (cascada Modelo→Color→Voltaje→Variant, CRUD SimpleProduct, alertas stock mínimo) | | P0 | ✅ Completo (2026-04-12) |
| **P2** | **Datos de prueba realistas** — SimpleProducts desde CSV, stock inicial + módulo `seed-transactional.ts` (customers, ventas, pedidos, taller, montaje, comisiones, cotizaciones) | Sonnet | P0, P1 | ✅ Completo (2026-04-12) |
| **P3** | **Fixes y mejoras POS** — labels en español, separar baterías del grid, tabs por categoría, UX cambio de voltaje, concepto libre, tab SimpleProduct con filtro modeloAplicable, cart mixto (vehículos + accesorios + concepto libre) | Sonnet | P0, P2 | ✅ Completo (2026-04-12) |
| **P4** | **Inventario enriquecido** — proveedor, factura URL, precio pagado, forma/estado de pago en `inventory/receipts` | Sonnet | P0 | ✅ Completo (2026-04-12) |
| P4-A | Schema `PurchaseReceipt` + migración + seed histórico/sintético | | P0 | ✅ Completo (2026-04-12) |
| P4-B | API Routes (`inventory/receipts`, `batteries/lots`, upload de factura) | | P4-A | ✅ Completo (2026-04-12) |
| P4-C | UI de recepción enriquecida + cuentas por pagar | | P4-B | ✅ Completo (2026-04-12) |
| **P5** | **Flujo de autorización** (PIN presencial + remoto con polling) — modelo `AuthorizationRequest` para cancelaciones y descuentos | Opus | — | ✅ Completo (2026-04-13) |
| **P5.5** | **Caja per-branch + validación isActive en mutaciones + night audit** — refactor de `CashRegisterSession` de per-user a per-branch, helpers `requireActiveUser`/`getOrphanedSession`/`assertSessionFreshOrThrow`, banner de caja huérfana, `session.maxAge = 8h` | Sonnet | P5 | ✅ Completo (2026-04-13) |
| **P5.6** | **Módulo Caja UI completo** — sidebar "Caja", `/cash-register` rediseñado con tokens (header + KPIs + esperado en cajón + tabs); schema aditivo `CashTransaction.collectedAt` + enum `CashExpenseCategory`; APIs `POST /api/cash/expense` (tope SELLER $500), `POST /api/cash/withdrawal` (MANAGER+ADMIN), `PATCH /api/cash/transactions/[id]/collect`; modales RHF+Zod glassmorphism; banner huérfano se auto-oculta en `/cash-register` | Opus | P5.5 | ✅ Completo (2026-04-14) |
| **P6** | **Documentos PDF** (`@react-pdf/renderer@4.4.1`, IVA 16% fijo) | Sonnet | P1-A | ✅ Completo (2026-04-15) |
| P6-S1 | Infraestructura base: fuentes Inter TTF, `src/lib/pdf/` (colors/fonts/helpers/styles/types/components), `assertBranchConfiguredForPDF` reescrito, dev preview | Sonnet | P1-A | ✅ Completo (2026-04-14) |
| P6-A | PDF Cotización (formato Alegra) | | P6-S1 | ✅ Completo (2026-04-14) |
| P6-B | PDF Recibo de Pedido / Apartado (timeline de abonos, badge de status) | | P6-S1 | ✅ Completo (2026-04-14) |
| P6-C | PDF Ticket de venta | | P6-S1 | ✅ Completo (2026-04-14) |
| P6-D | PDF Póliza de garantía (auto-generada desde `warrantyDocReady`) | | P6-S1 | ✅ Completo (2026-04-14) |
| P6-E | PDF Comprobante de cierre de corte — `denominationsJson` migrado, template `CortePDF`, endpoint 403/409/412, `DocumentFooter.terminos` opcional, botón activado en dialog | | P6-S1 | ✅ Completo (2026-04-15) |
| **P7** | **Cotizaciones mejoradas** — rediseño de `QuotationStatus`, términos desde `Branch`, vinculación a perfil del cliente | Sonnet | P6-A | ✅ Completo (2026-04-15) |
| **P8** | **Historial de abonos** — timeline visual en `/pedidos/[id]` | Sonnet | — | ✅ Completo (2026-04-15) |
| **P9** | **Tesorería** — gastos operativos (`OperationalExpense`), saldos, reportes de ingresos vs. gastos | Sonnet | — | ✅ Completo (2026-04-15) |
| **P10** | **Reportes expandidos** | Sonnet | P4 (rentabilidad) | 🔄 Parcial |
| P10-Inf | Infraestructura `src/lib/reportes/` (csv, money, branch-scope, date-range, types, cost-resolver) + 6 componentes `_components/` | | — | ✅ Completo (2026-04-16) |
| P10-A | Ventas por vendedor — `/reportes/ventas-vendedor`, KPIs, resumen+detalle, CSV doble | | — | ✅ Completo (2026-04-16) |
| P10-B | Estado de cuenta por cliente — `/reportes/clientes` (lista agregada) + `/reportes/clientes/[id]` (detalle). SELLER+MANAGER+ADMIN. Nivel 1: KPIs (clientes activos, apartados, saldo pendiente, saldo a favor), filtros `q`/`branchId`/`hasPending`, orden por saldo pendiente desc, CSV. Nivel 2: cabecera (contacto, RFC, saldo a favor), secciones Compras (COMPLETED+CANCELLED, cancelada tachada sin sumar) y Apartados (pagado/pendiente/último abono/entrega), filtro de rango opcional, CSV combinado con columna `Sección`. Branch scoping para clientes globales vía subqueries `distinct customerId` en Sale+Quotation. `notFound()` si no-ADMIN y cero compras+apartados en su sucursal. N+1-safe con 3 aggregates batch (groupBy COMPLETED, findMany LAYAWAY con payments, groupBy _max createdAt). `creditLimit` no se muestra (sin flujo activo). | | — | ✅ Completo (Lote 4 — 2026-04-16) |
| P10-C | Rentabilidad por producto | | P4 | ⏳ Pendiente |
| P10-D | Valor de inventario | | P0, P4 | ⏳ Pendiente |
| P10-E | Movimientos de inventario — `/reportes/inventario/movimientos`, kardex con polimorfismo variant+simple, batch N+1-safe, KPIs (entradas, salidas, ajustes, productos distintos), filtros URL (tipo, kind, sign, q), CSV, MANAGER+ADMIN | | P0 | ✅ Completo (2026-04-16) |
| P10-F | Historial de cortes de caja — `/reportes/caja/historial`, KPIs, tabla con PDF por fila, CSV, MANAGER+ADMIN. Mini-fix (Lote 3): orden de resolución del autorizador corregido (`closeAuthorization.approver` canónico P5 primero; `authorizedBy` como fallback legacy). | | P6-E | ✅ Completo (2026-04-16) |
| P10-G | Compras al proveedor — reporte agregado / export CSV (listado operativo ya en P4-C) | | P4 | ⏳ Pendiente |
| P10-H | Reporte de stock mínimo — `/reportes/inventario/stock-minimo`, polimórfico variant+simple, severidad, KPIs, CSV | | P0 | ✅ Completo (2026-04-16) |
| P10-I | Reporte anual (KPIs por mes, comparativa entre sucursales) | | P4, P9 | ⏳ Pendiente |
| **P11** | **Seguimiento de mantenimientos** — semáforo de pólizas a 6 meses | Sonnet | — | ⏳ Pendiente |
| **6** | **Hardening y producción** — tests, rate limiting, security headers, Prisma v7, PgBouncer/Accelerate, deploy, limpieza final, carga de `refacciones_revisar.csv` | Opus | TODO | ⏳ Pendiente |

**Fuente de verdad:** `ROADMAP.md`. Esta tabla es un espejo resumido para navegación rápida; actualizar ambos al cerrar una fase.

### Reglas del módulo de montaje (2H)

- **Permisos**: Todos los roles pueden crear órdenes de montaje. Solo TECHNICIAN, MANAGER y ADMIN pueden completarlas.
- **Baterías**: Permanecen `IN_STOCK` al crear la orden (PENDING). Se cambian a `INSTALLED` solo al completar el montaje, dentro de `$transaction`.
- **Desinstalación (2H-4)**: Flujo inverso — desasigna baterías de un vehículo, regresándolas a `IN_STOCK`. Marca `BatteryAssignment.isCurrent = false` y actualiza `Battery.status`.
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

## Fase 4 — Estado completado (sesión 2026-04-11)

### Cambios de schema (migración `20260411000000_fix_schema_drift_phase4`)

Los campos fueron aplicados vía `db push` antes de crear la migración formal. Para sincronizar el historial se usó `migrate diff` + `migrate resolve --applied` (sin reset, sin pérdida de datos).

- `VoltageChangeLog.reason` — cambió de `TEXT` nullable a enum `VoltageChangeReason NOT NULL` (`PRE_SALE | POST_SALE`).
- `VoltageChangeLog.saleId String?` — FK nullable a `Sale`. Presente cuando el cambio ocurre en contexto de una venta.
- `VoltageChangeLog.serviceOrderId String?` — FK nullable a `ServiceOrder`. Para cambios post-venta de taller.
- `AssemblyOrder.voltageChangeLogId String? @unique` — vincula la orden de reensamble al cambio de voltaje que la originó. `@unique` = solo un reensamble por cambio.
- `Sale.warrantyDocReady Boolean @default(true)` — `false` mientras haya reensambles PENDING vinculados a la venta. Se pone `true` automáticamente al completar la última `AssemblyOrder` PENDING.
- `Sale.serviceOrderId String? @unique` — FK a `ServiceOrder` cuando la venta proviene del cobro en taller.
- `ServiceOrder.prepaid Boolean @default(false)` — marca si la orden fue cobrada anticipadamente (al recibir, no al entregar).
- `ServiceOrderItem.inventoryMovementId String? @unique` — traza el `InventoryMovement(WORKSHOP_USAGE)` generado al descontar el ítem de stock.
- `enum SaleType` — definido en schema pero sin columna que lo use aún (enum huérfano, no genera columna en DB).

### Nuevas API Routes

- `POST /api/service-orders/[id]/charge` — cobra una ServiceOrder COMPLETED anticipadamente. Crea `Sale(type=SERVICE)` con folio propio + `CashTransaction`. Marca `ServiceOrder.prepaid = true`.
- `POST /api/service-orders/[id]/deliver` — entrega la ServiceOrder al cliente. Si `prepaid = true` usa la venta existente; si no, crea la venta y cobra en el acto. Descuenta stock (`WORKSHOP_USAGE`) por cada ítem de inventario dentro de `$transaction`. Marca `ServiceOrder.status = DELIVERED`.
- `POST /api/service-orders/[id]/cancel` — cancela la orden. Si había venta pre-paga, crea `REFUND_OUT` + revierte stock de ítems ya descontados.
- `GET /api/customer-bikes/available?productVariantId=X` — lista `CustomerBike` sin dueño asignado (`customerId = null`) del `productVariantId` dado, dentro de la sucursal. Usada por el POS para seleccionar VIN al vender.
- `POST /api/sales/[id]/cancel` — cancela una venta COMPLETED o LAYAWAY. Solo MANAGER/ADMIN. Dentro de `$transaction`: revierte stock por SaleItems, crea `REFUND_OUT` por cada pago si hay caja abierta, revierte `CustomerBike.voltaje` a `fromVoltage` según `VoltageChangeLog`, cancela `AssemblyOrders` PENDING, marca `Sale.status = CANCELLED`.
- `GET /api/sales/[id]/warranty-pdf` — genera y devuelve el PDF de póliza de garantía. Devuelve `409` con `{ success: false, error, pendingAssemblyOrders: N }` si `warrantyDocReady = false`. Requiere `CustomerBike` vinculado via `customerId + productVariantId` donde `modelo.requiere_vin = true`; baterías desde `BatteryAssignment.isCurrent = true`.
- `POST /api/assembly/[id]/complete` — modificado: tras completar el montaje, verifica si hay otras `AssemblyOrders` PENDING para el mismo `saleId`; si no quedan, pone `Sale.warrantyDocReady = true`.

### Nuevas páginas UI

- `/workshop/[id]` (`page.tsx` + `service-order-details.tsx` + modales) — detalle de orden de taller con acciones Cobrar / Entregar / Cancelar según estado. Link "Ver venta →" a `/ventas/[id]` cuando `status = DELIVERED`.
- `/ventas/[id]` (`page.tsx` + `sale-detail.tsx`) — detalle de venta: folio, badges de status, artículos con subtotales, sección de reensambles pendientes (solo si hay `AssemblyOrders` con `voltageChangeLogId`), datos del cliente. Botón "Imprimir póliza" si `warrantyDocReady = true`; badge de advertencia si es `false`.

### Decisiones clave

- **VIN obligatorio en POS para vehículos ensamblables**: el vendedor selecciona de un `CustomerBike` ya ensamblado (sin dueño), no tipea el VIN. Bloquea la venta si no hay ninguno disponible del modelo seleccionado. Al confirmar la venta, `CustomerBike.customerId` se asigna dentro del `$transaction` de `POST /api/sales`.
- **Cambio de voltaje pre-venta inline en POS**: sin costo para el cliente. Crea `VoltageChangeLog(reason: PRE_SALE)`, desinstala baterías actuales atómicamente (sin `AssemblyOrder` de desinstalación), crea una sola `AssemblyOrder PENDING` de reensamble vinculada a `saleId` y `voltageChangeLogId`. La `@unique` en `voltageChangeLogId` previene duplicados.
- **`warrantyDocReady` flow**: `POST /api/sales` lo pone `false` si hay cambios de voltaje. `POST /api/assembly/[id]/complete` lo pone `true` cuando ya no quedan PENDING para ese `saleId`. El endpoint `warranty-pdf` rechaza con 409 si aún es `false`.
- **Stock de taller se descuenta al ENTREGAR, no al agregar ítems**: atómico con la creación de la venta en `deliver`. Evita reservas fantasma y stock negativo por cancelaciones.
- **Cancelación de venta revierte voltaje**: `POST /api/sales/[id]/cancel` lee `VoltageChangeLog.fromVoltage` para restaurar `CustomerBike.voltaje`. Si la migración de reensamble ya se completó (batería nueva instalada), el voltaje queda en el nuevo — el cancel no revierte el montaje físico, solo el registro de la venta.
- **Cobro anticipado en taller (`prepaid`)**: al cobrar antes de entregar se crea la `Sale` con el folio del taller. Al entregar después, la misma venta se reutiliza — no se crea una segunda. El flag `ServiceOrder.prepaid` evita cobrar dos veces.

---

## Fase 5 — Estado completado (Reportes, Historial y Comisiones)

### Cambios de schema (migración `20260411221234_add_cancelled_commission_status`)

- `CommissionStatus` — agregado valor `CANCELLED` (aditivo, no destructivo). Se aplica a registros cuya `Sale` origen fue cancelada.

### Convención de URLs

- `POST /api/sales` — endpoint de **escritura** (inglés, legacy).
- `GET /api/ventas` — endpoint de **lectura** con filtros y paginación (español, consistente con la URL de UI `/ventas`).
- Análoga: `/api/comisiones`, `/api/reportes/caja` para módulos nuevos en español.

### Sub-fase 5-B — Historial de Ventas (`/ventas`)

- `GET /api/ventas` — listado con filtros server-side (rango fecha, vendedor, status, método de pago, folio, cliente, sucursal). Paginación cursor-based, 25 items/página.
- `/ventas/page.tsx` + `sales-history-table.tsx` — Server Component + Client con tabla filtrable. Permisos: SELLER ve solo lo suyo, MANAGER su sucursal, ADMIN todas.

### Sub-fase 5-C — Reportes de Caja (`/reportes/caja`)

- `GET /api/reportes/caja?view=sessions|period` — dos vistas:
  - **Por turno**: lista de `CashRegisterSession` con desglose efectivo real vs. declarado (diferencia), totales COLLECTED vs PENDING, transacciones individuales expandibles.
  - **Por período**: agregación de KPIs (Ingresos COLLECTED, Ingresos PENDING, Devoluciones, Gastos, Retiros, Neto Operativo), desglose por método y por día.
- Cálculo del **efectivo real**: `openingAmt + Σ(CASH PAYMENT_IN) − Σ(CASH REFUND_OUT + EXPENSE_OUT + WITHDRAWAL)`. La diferencia con `closingAmt` se muestra en verde (cero) o rojo (≠0).
- Permisos: SELLER no accede; MANAGER su sucursal; ADMIN todas con filtro.

### Sub-fase 5-D — CRUD de Reglas de Comisión (`/reportes/comisiones/reglas`)

- `GET / POST /api/comisiones/reglas` y `PATCH / DELETE /api/comisiones/reglas/[id]` (soft-delete vía `isActive=false`).
- UI con tabla de reglas + modal crear/editar (rol, tipo PERCENTAGE/FIXED_AMOUNT, valor, modelo opcional, sucursal). Solo MANAGER/ADMIN.

### Sub-fase 5-E — Generación automática de comisiones

- Dentro del `$transaction` de `POST /api/sales` y `POST /api/pedidos`: para cada `SaleItem` con `productVariantId`, busca `CommissionRule` aplicable y crea `CommissionRecord(PENDING)`.
- **Búsqueda de regla**: primero específica (`role + branchId + modeloId`), fallback genérica (`modeloId = null`). Si no hay regla → silencioso, no error.
- **Cálculo**: `PERCENTAGE` aplica `(price × qty − discount) × value/100`; `FIXED_AMOUNT` usa `value` por línea.
- Cancelación: dentro del `$transaction` de `POST /api/sales/[id]/cancel`, `updateMany` pone `CommissionRecord.status = CANCELLED` para las del `saleId` que estuvieran PENDING o APPROVED.

### Sub-fase 5-F — Panel de Comisiones (`/reportes/comisiones`)

- `GET /api/comisiones` — listado con filtros (userId, branchId, status, dateRange).
- `PATCH /api/comisiones/batch` — actualización masiva de status: `{ ids: string[], status: "APPROVED" | "PAID" }`.
- UI por rol:
  - **SELLER**: solo sus comisiones, KPIs PENDING/APPROVED/PAID del mes, sin acciones.
  - **MANAGER**: comisiones del equipo en su sucursal, batch "Aprobar seleccionadas".
  - **ADMIN**: cross-branch, batch "Aprobar" + "Marcar como pagadas", filtro por sucursal.

### Sub-fase 5-G — Dashboard Gerencial mejorado

- Selector de período en el header (Hoy / Semana / Mes) implementado vía query param `?period=today|week|month`. Default: `today`. El Server Component re-consulta Prisma con el rango.
- KPIs y comparación dinámicos: label ("INGRESOS HOY" → "INGRESOS ESTA SEMANA") y trend ("vs ayer" → "vs semana pasada" → "vs mes pasado") se adaptan al período.
- Comparación contra período anterior equivalente (semana pasada misma cantidad de días, mes pasado hasta el mismo día del mes).
- Nuevas secciones (debajo de las existentes, MANAGER + ADMIN):
  - **Ventas por Modelo** — top 5 por revenue del período (groupBy en `SaleItem.productVariantId`, agregación por `Modelo.nombre`).
  - **Ventas por Vendedor** — ranking por revenue (groupBy en `Sale.userId`).
  - **Flujo de Caja** — cards COBRADO (verde) vs PENDIENTE (amarillo) con link a `/reportes/caja`.
  - **Comisiones del Equipo** — POR APROBAR vs APROBADAS del período, link a `/reportes/comisiones`.

### Decisiones clave

- Toda la Fase 5 (excepto 5-E) es **solo lectura**: queries de agregación que no tocan flujo transaccional. La 5-E modifica `$transaction` existente de forma append-only — si falla, la venta entera se rollbackea (consistente).
- No se crearon modelos nuevos. Los modelos `CommissionRule` y `CommissionRecord` ya existían desde Fase 1C.
- Reportes sin export PDF/Excel — diferido a Fase 6 si se necesita.
- Sub-fase 5-H (navegación con item "Reportes" en sidebar) **pendiente**.

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

### Verificación de calidad — comandos que funcionan

`npm run lint` puede fallar con `Invalid project directory` en el entorno de herramientas (bug del shell). Usar siempre estas alternativas:

```bash
npx tsc --noEmit                  # TypeScript — errores de tipo
node_modules/.bin/next build      # Build completo — incluye type-check + bundle
```

Ambos comandos son equivalentes o superiores a lint para detectar problemas antes de commitear.

## Frontend y UI

> Para cualquier trabajo de UI o modificación visual, **es OBLIGATORIO leer `DESIGN.md`** (tipografías, regla "no-line", glassmorphism, tokens de color en light/dark mode). Si trabajas solo en backend, puedes ignorarlo.

Las reglas operativas (componentes base, formularios, notificaciones, idioma) están en la sección "Reglas de código" arriba.

---

## Patrones de UI — páginas públicas y print

### Light mode forzado en páginas públicas

Las páginas fuera de `(pos)` comparten el `RootLayout` que tiene `ThemeProvider` con `attribute="class"`. Si el usuario tiene dark mode, `html` recibe `class="dark"` y los tokens CSS cambian. Para forzar light mode en una página pública:

**Técnica:** redefinir todos los tokens en un wrapper con clase específica. Las CSS custom properties del hijo más cercano ganan sobre el ancestro, independientemente de `html.dark`.

```tsx
// En el Server Component, inline style block:
<style>{`
  .public-page-wrapper {
    --p: #1b4332;
    --surf-lowest: #ffffff;
    --on-surf: #131b2e;
    /* ... todos los tokens del light mode ... */
    background: #f8fafa;
    color: #131b2e;
  }
`}</style>
<div className="public-page-wrapper">
  {/* contenido — siempre en light mode */}
</div>
```

Ver implementación en `src/app/cotizaciones/public/[token]/page.tsx` (clase `.evobike-public-doc`).

### @media print — Reglas para Safari (críticas)

Safari respeta los valores CSS literalmente sin reescalar como Chrome. Para lograr que una página quepa en una sola hoja:

```css
@media print {
  @page {
    margin: 1.5cm;   /* 2cm es demasiado — ajustar según contenido */
    size: letter;
  }

  /* OBLIGATORIO: quitar min-height: 100vh del contenedor raíz */
  /* Safari lo toma literal → página ocupa 2 hojas */
  .root-wrapper {
    min-height: auto !important;
  }

  /* Compactar padding vertical agresivamente */
  .doc-inner {
    padding-top: 0.75rem !important;
    padding-bottom: 0.75rem !important;
  }

  /* Reducir display size de elementos grandes (títulos, folios) */
  .display-title {
    font-size: 2.25rem !important;  /* vs 3.5rem en pantalla */
  }

  /* Evitar que filas de tabla se corten entre páginas */
  .table-row {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Evitar que el header de tabla quede huérfano al final de página */
  .table-header {
    page-break-after: avoid;
    break-after: avoid;
  }

  /* Mantener bloque de totales siempre junto */
  .totals-block {
    page-break-inside: avoid;
    break-inside: avoid;
  }

  /* Desactivar glassmorphism — no se renderiza en papel */
  * {
    backdrop-filter: none !important;
    -webkit-backdrop-filter: none !important;
  }

  /* Eliminar tonal shifts en filas alternas — se ven mal en papel */
  .row-alt {
    background: #ffffff !important;
  }

  /* Ocultar UI no-documento */
  .no-print {
    display: none !important;
  }
}
```

**El "EVOBIKE POS / fecha / URL / número de página"** en headers/footers del print NO es CSS tuyo — es el navegador. El usuario lo desactiva en "Más opciones → Headers and footers" del diálogo de impresión. No intentar ocultarlo desde CSS (no es fiable cross-browser).

Ver implementación completa en `src/app/cotizaciones/public/[token]/page.tsx`.

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


