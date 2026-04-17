# ROADMAP evobike-pos2 — Post Fase 5

Última actualización: 2026-04-16 (P10 Lote 1 + Lote 2 + Lote 3 + Lote 4 + Lote 5)  
Este archivo es la fuente de verdad del trabajo pendiente. Actualizar al completar cada fase.

---

## ⏸️ BLOQUEADOS — Esperando datos del cliente

| Tema | Qué falta | Impacto |
|---|---|---|
| **Amperajes por voltaje** | Qué modelos usan 48V/12Ah vs 48V/20Ah etc. | Migración de campo en `Voltaje` o `ProductVariant` |
| **Catálogo de refacciones incompleto** | 940 filas en `refacciones_revisar.csv` con nombre inválido por PDF con imágenes | Completar seed de refacciones |

---

## FASE P0 — Arquitectura de productos simples (SimpleProduct)
**Modelo: Opus | Dependencias: ninguna**

Decisión arquitectónica crítica. Define el schema que todo lo demás usa.

### Tareas
- Diseñar modelo `SimpleProduct` en `prisma/schema.prisma`:
  - `id`, `nombre`, `descripcion?`, `categoria` (enum), `modeloAplicable?`
  - `precioPublico` Decimal — precio que ve y paga el cliente
  - `precioMayorista` Decimal — costo interno, solo reportes
  - `stockMinimo Int` — alerta roja cuando stock actual ≤ este valor
  - `stockMaximo Int` — referencia para órdenes de reposición
  - `imageUrl?` — imagen del producto
  - `isActive Boolean @default(true)`
  - Relación a `Stock` por sucursal via `InventoryMovement` (igual que unidades)
- Enum `SimpleProductCategoria`: `ACCESORIO | CARGADOR | REFACCION | BATERIA_STANDALONE`
- Definir cómo baterías standalone (litio scooter + plomo) se unifican con flujo `BatteryLot/Battery`:
  - Rastreo por serial individual para TODAS las baterías
  - `BATERIA_STANDALONE` vive en `SimpleProduct` para precio y catálogo
  - El serial se registra en `Battery` igual que las baterías de ensamble
  - Al vender una batería standalone: crear `Battery` con serial + `BatteryAssignment` opcional si se instala en ese momento
- Añadir `SimpleProductId` nullable a `ServiceOrderItem` para trazabilidad de refacciones en taller
- Migración: `prisma migrate dev --name add_simple_product`
- Campos `stockMinimo`/`stockMaximo` también aplican a baterías de ensamble (agregar a `ProductVariant` o manejar en `SimpleProduct` unificado — decisión de Opus)

### Archivos clave
- `prisma/schema.prisma`
- `src/app/api/inventory/receipts/route.ts`
- `src/app/api/batteries/lots/route.ts`
- `prisma/data/` (donde vivirán los CSVs)

---

## FASE P1 — Módulo de Configuración
**Modelo: Opus diseño → Sonnet implementación | Dependencias: P0**

Solo accesible por rol ADMIN. Ruta: `/configuracion`.

### P1-A — Datos de sucursal ✅ (2026-04-12)
- Campos aditivos en `Branch`: `rfc`, `razonSocial`, `regimenFiscal`, `street/extNum/intNum/colonia/city/state/zip`, `phone`, `email`, `website`, `sealImageUrl`, `terminosCotizacion/Pedido/Poliza`. El campo legacy `address` se conserva.
- Migración: `20260412060000_add_branch_config_fields` (aditiva, sin reset).
- API Routes (solo ADMIN):
  - `GET/PATCH /api/configuracion/sucursal/[id]` — lectura y edición parcial con Zod.
  - `POST /api/configuracion/sucursal/[id]/seal` — upload multipart, sharp → WebP 800×800 máx, 2MB, PNG/JPEG/WebP. Elimina el archivo previo.
  - `DELETE /api/configuracion/sucursal/[id]/seal` — limpia `sealImageUrl` y el archivo.
- Helper `src/lib/branch.ts#assertBranchConfiguredForPDF(branchId, tipoDoc)` — valida requisitos por tipo de documento. Pendiente de integración en P6.
- UI `/configuracion/sucursal` (ADMIN) con selector de sucursal, tabs (Datos fiscales / Sello / Términos), react-hook-form + Zod, toasts de sonner, modal glassmorphism de vista previa en light mode forzado. INPUT_STYLE con `--surf-low`.
- Seed precarga plantillas default y placeholders `CONFIGURAR …` para forzar que el guard falle hasta que ADMIN complete los datos.
- Sidebar: ítem "Configuración" ahora navega a `/configuracion/sucursal` y es exclusivo de ADMIN.

### P1-B — Gestión de usuarios ✅ (2026-04-12)
- Schema aditivo: `User.isActive Boolean @default(true)`. Migración `20260412070000_add_user_is_active`.
- API Routes (solo ADMIN):
  - `GET/POST /api/configuracion/usuarios` — listado (filtro opcional `?branchId=` + `?includeInactive=true`) y creación con Zod + bcrypt.
  - `PATCH /api/configuracion/usuarios/[id]` — editar nombre, email, rol, sucursal, `isActive`. Rechaza autodesactivación.
  - `POST /api/configuracion/usuarios/[id]/reset-password` — genera hash nuevo (mínimo 8 caracteres).
- UI `/configuracion/usuarios` (ADMIN) con tabla segmentada activos/inactivos, modales glassmorphism para crear/editar/reset.
- Login (`src/lib/auth.ts`) rechaza usuarios con `isActive = false`.
- Refacciones no-borrado: CRUD soft vía toggle de `isActive`.

### P1-C — Catálogo de servicios del taller ✅ (2026-04-12)
- API Routes (`/api/configuracion/servicios` + `[id]`) — CRUD sobre `ServiceCatalog`. ADMIN cross-branch (`?branchId=` y `branchId` en POST); MANAGER restringido a su sucursal.
- UI `/configuracion/servicios` con tabla activos/inactivos, selector de sucursal para ADMIN, modal para crear/editar (nombre + `basePrice`).
- Nota: el campo `tipo` (mano de obra vs. refacción) no se añadió al modelo: las refacciones viven en `SimpleProduct` (P0). `ServiceCatalog` representa solo mano de obra/servicios.

### P1-D — Reglas de comisión ✅ (2026-04-12)
- Existente `/reportes/comisiones/reglas` (Fase 5-D) extendido para ADMIN cross-branch:
  - `GET /api/comisiones/reglas` acepta `?branchId=` (ignorado para MANAGER).
  - `POST` acepta `branchId` opcional (solo ADMIN) y valida existencia de la sucursal.
  - `PATCH/DELETE` en `[id]` ahora permiten a ADMIN modificar reglas de cualquier sucursal.
- UI: selector de sucursal (ADMIN) arriba + dentro del modal de crear. El módulo `/configuracion/comisiones` redirige a `/reportes/comisiones/reglas`.

### P1-E — Catálogo de productos ✅ (2026-04-12)
- Schema aditivo: `Modelo.categoria` (enum `BICICLETA | TRICICLO | SCOOTER | JUGUETE | CARGA`), `Modelo.esBateria`, `Modelo.isActive`, `Color.isActive`, `Voltaje.isActive`, `ProductVariant.isActive`. Migración `20260412080000_add_category_and_soft_delete_to_catalog` (aditiva, sin reset). El modelo "Batería" existente se marca con `esBateria = true` en la migración.
- Decisión arquitectónica: las baterías viven en modelos dedicados (flag `Modelo.esBateria`), separadas de los modelos de vehículos. Esto cierra la ambigüedad de "qué variantes pueden seleccionarse como batería en `BatteryConfiguration`".
- Helper `src/lib/products.ts#normalizeModeloAplicable()` para normalizar strings libres (NFD, uppercase, trim, colapso de espacios) antes de persistir en `SimpleProduct.modeloAplicable`.
- API Routes (todas bajo `/api/configuracion/`, solo ADMIN salvo `alertas-stock`):
  - `modelos/` + `[id]` + `[id]/image` — CRUD, DELETE propaga `isActive=false` a variantes (retorna `affectedVariants`).
  - `colores/` + `[id]` — CRUD, DELETE propaga `isActive=false` a variantes.
  - `voltajes/` + `[id]` — CRUD, DELETE propaga `isActive=false` a variantes.
  - `variantes/` + `[id]` + `[id]/image` — CRUD. POST valida modelo/voltaje activos + color en `ModeloColor` + tripleta única. PATCH implementa lógica A/B/C: grupo A (precios/stock/imagen) siempre editable; grupo B (sku/modelo/color/voltaje) solo si no hay historial (`saleItem`, `inventoryMovement`, `stock.quantity > 0`) — si hay, responde 409 con `hasHistory: true`.
  - `battery-configs/` + `[id]` — CRUD, filtra candidatos a `Modelo.esBateria = true`.
  - `simple-products/` + `[id]` + `[id]/image` — CRUD con normalización de `modeloAplicable`.
  - `alertas-stock/` — GET para ADMIN + MANAGER. MANAGER filtra por su `branchId`; ADMIN puede pasar `?branchId=`. Retorna productos (variants y simple products) donde `quantity ≤ stockMinimo && stockMinimo > 0`, ordenados por `quantity − stockMinimo` asc.
- UI `/configuracion/catalogo` (ADMIN edita; MANAGER solo ve tab "Alertas"):
  - 5 tabs shadcn: Modelos, Variantes, Config. Baterías, Productos Simples, Alertas de Stock.
  - Tab Modelos: tabla con imagen miniatura, nombre, categoría, colores disponibles, VIN, batería, estado. Modal con sub-sección de colores disponibles (multi-select → `ModeloColor`).
  - Tab Variantes: selector de modelo en header + toggle inactivas. Modal respeta grupos A/B: si la respuesta 409 devuelve `hasHistory: true`, campos grupo B quedan disabled con aviso inline.
  - Tab Config. Baterías: tabla agrupada por modelo de vehículo. Dropdown de batería filtrado por `modelo_esBateria = true`.
  - Tab Productos Simples: filtro por categoría + toggle inactivos. Input libre con `<datalist>` autocompletando valores existentes de `modeloAplicable`.
  - Tab Alertas: semáforo (rojo si `quantity ≤ stockMinimo/2`, amarillo si `quantity ≤ stockMinimo`). Botón "Crear recepción" lleva a `/inventario/recepciones/nuevo?variantId=X` o `?simpleProductId=X` según el tipo de producto (discriminación entregada en P4-C).
- Imágenes bajo `/public/productos/`, sharp → WebP 1200×1200 máx, 2MB.
- `/configuracion` ahora habilita la tarjeta "Catálogo de productos" para ADMIN y MANAGER.

### Archivos clave
- `src/app/(pos)/configuracion/` (nueva ruta)
- `prisma/schema.prisma` (campo `categoria` en `Modelo`)
- `src/app/api/configuracion/` (nuevas API Routes)

---

## FASE P2 — Datos de prueba realistas ✅ Completa (2026-04-12)
**Modelo: Sonnet | Dependencias: P0 + P1**

### Implementado

**Sesión 1 — SimpleProducts + stock**
- `prisma/seed.ts` carga `accesorios.csv` (39 productos) y `refacciones.csv` (2,622 refacciones) vía upsert por `codigo`.
- `normalizeModeloAplicable()` aplicado a cada fila. `"GLOBAL"` → `null` para mantener la convención de P1-E.
- Stock inicial de SimpleProducts por sucursal (5,322 entradas) con `InventoryMovement(PURCHASE_RECEIPT)` dentro de la misma `$transaction`.

**Sesión 2 — Datos transaccionales**
- Nuevo módulo `prisma/seed-transactional.ts` (~1,500 líneas) invocado desde `seed.ts`.
- 30 Customers (15 completos con datos fiscales, 10 básicos, 5 con `balance > 0`).
- Stock de ProductVariants de vehículos (758 entradas) con su InventoryMovement.
- 6 BatteryLots con 72 baterías (`IN_STOCK` por defecto, `INSTALLED` tras montaje).
- 3 CashRegisterSessions cerradas históricas + 1 abierta por sucursal.
- CommissionRules genéricas por sucursal (SELLER 3%, MANAGER 1%).
- AssemblyOrders: ~17 globales (60% COMPLETED con CustomerBike + BatteryAssignment, 40% PENDING).
- Sales directas: ~87 globales en 6 meses, mix de métodos de pago (CASH/CARD/TRANSFER/ATRATO), 5% CANCELLED con REFUND_OUT + reversión de stock + commissions `CANCELLED`.
- Pedidos: 30 globales (60% LAYAWAY, 40% BACKORDER) con 1-3 abonos adicionales por pedido; algunos completan a status `COMPLETED` cuando se liquidan.
- ServiceOrders: 40 globales distribuidos en los 4 estados (PENDING/IN_PROGRESS/COMPLETED/DELIVERED), con cobro anticipado (`prepaid=true`) para algunos COMPLETED y descuento de stock vía `WORKSHOP_USAGE` al entregar.
- Cotizaciones: 20 globales (DRAFT/SENT/CONVERTED/EXPIRED).

### Decisiones de implementación
- **Folio en seed usa `branch.code`** (no `branch.name` como la API real) porque "Sucursal Leo" y "Sucursal Av 135" normalizan ambos a prefix `"SUC"` → colisión. El cambio es local al seed y no afecta la lógica de producción.
- **Idempotencia** por marcadores: cada tarea chequea existencia (cuenta o sentinela) y skipea si ya corrió. Para re-seedear, truncar las tablas transaccionales manualmente.
- **Comisiones**: replican la cascade strategy de Fase 5-E (regla específica por `modeloId` → fallback genérica). Solo ventas directas generan comisión; pedidos y servicios no (consistente con `POST /api/pedidos` y service-orders).
- **Ensamblable** se define por existencia de `BatteryConfiguration` para `(modelo_id, voltaje_id)`, no por `Modelo.requiere_vin`, porque el seed de catálogo original deja `requiere_vin=false` por un upsert-drift. Evita tocar ese seed.

### Archivos clave
- `prisma/seed.ts`
- `prisma/seed-transactional.ts`
- `prisma/data/accesorios.csv`
- `prisma/data/refacciones.csv`
- `prisma/data/refacciones_revisar.csv` (pendiente de revisión manual en Fase 6)
---

## FASE P3 — Fixes y mejoras POS ✅ (2026-04-12)
**Modelo: Sonnet | Dependencias: P0 + P2**

### P3.1–P3.3 ✅
- Labels en español en compra guiada (`"SYSTEM VOLTAGE"` → `"Voltaje del sistema"`, `"FRAME COLOR"` → `"Color del cuadro"`).
- Tabs del POS por categoría real de `Modelo.categoria`: `Bicicletas | Triciclos | Scooters | Juguetes | Carga`.
- Mensaje claro de reensamble al cambiar voltaje pre-venta: aviso explícito "Esta unidad requiere reensamble a [X]V" antes de confirmar.
- Exclusión de modelos `esBateria: true` del grid de unidades (baterías standalone se venden como `SimpleProduct`).
- Botón "Agregar concepto libre" en POS: dialog con descripción + precio + cantidad, usa `SaleItem.isFreeForm = true` ya existente en backend.

### P3.4 ✅ — SimpleProduct en el POS (mixto)
- **P3.4a — Backend polimórfico:** `saleItemSchema` y `frozenItemSchema` de `POST /api/sales` aceptan `simpleProductId` opcional. `superRefine` valida exactamente uno de `{productVariantId, simpleProductId, isFreeForm}`. Stock check/decrement e `InventoryMovement` usan la constraint `simpleProductId_branchId` cuando aplica. `SaleItem` persiste `simpleProductId` + `description = sp.nombre` snapshot. Comisiones solo se generan por `ProductVariant` (SimpleProduct no comisiona). `POST /api/pedidos` extiende `frozenItems` con `simpleProductId` para conversión de cotizaciones con líneas mixtas.
  - Decisión: flat schema con `superRefine` en lugar de `z.discriminatedUnion`. Razón: mantiene compatibilidad con callers existentes (POS normal, quotation conversion, seed) sin refactor de todos los payloads. El invariant XOR queda validado server-side.
- **P3.4b — Tab "Accesorios" en POS:** nueva pestaña que sustituye el grid de modelos por un grid de `SimpleProduct`. Sub-filtros por `modeloAplicable` (Todos / Universal / nombre del modelo). Card incluye badge de categoría (Accesorio/Cargador/Refacción/Batería), stock por sucursal y precio público. `page.tsx` carga `SimpleProduct` activos + stock de la sucursal del vendedor.
- **P3.4c — Cart mixto:** `CartItem` extendido con `simpleProductId?` y `simpleCategoria?`. `handleAddSimpleProduct` agrupa duplicados (incrementa cantidad respetando stock). `handleCheckout` manda `productVariantId: null` y `simpleProductId` para líneas de accesorio. El render del cart muestra `{categoría} · {SKU}` para SimpleProduct, concepto libre para free-form, y `color/voltaje` para vehículos. Un mismo carrito puede combinar vehículos + accesorios + concepto libre + baterías standalone en una sola venta o apartado.

### Pendiente P3 (movido a otras fases)
- Sidebar: item "Reportes" con sub-items → sigue en Fase 5-H.

### Archivos clave
- `src/app/(pos)/point-of-sale/pos-terminal.tsx` ✅
- `src/app/(pos)/point-of-sale/page.tsx` ✅
- `src/app/(pos)/point-of-sale/free-form-dialog.tsx` ✅
- `src/app/api/sales/route.ts` ✅
- `src/app/api/pedidos/route.ts` ✅

---

## FASE P4 — Inventario enriquecido (Compras al proveedor) ✅ (2026-04-12)
**Modelo: Sonnet | Dependencias: P0**

Enriquecer `inventory/receipts` existente. No crear módulo nuevo.

### P4-A — Schema + migración + seed ✅ (2026-04-12)
- Nuevo modelo cabecera `PurchaseReceipt` (cuid) con FKs a `Branch` y `User`. Una factura puede cubrir N SKUs (vehículos + SimpleProducts + baterías). Sin `saleId` — la vinculación Pedido↔Recepción vive en `BatteryLot.saleItemId` y `AssemblyOrder.saleId` con granularidad de ítem (una recepción es N:M con pedidos).
- Enums `FormaPagoProveedor` (`CONTADO | CREDITO | TRANSFERENCIA`) y `EstadoPagoProveedor` (`PAGADA | PENDIENTE | CREDITO`).
- Campos del modelo: `proveedor`, `folioFacturaProveedor?`, `facturaUrl?`, `formaPagoProveedor`, `estadoPago`, `fechaVencimiento?`, `fechaPago?`, `totalPagado Decimal(12,2)`, `notas?`.
- `@@unique([branchId, proveedor, folioFacturaProveedor])` — Postgres trata NULL como distinto, así que recepciones sin factura no colisionan. `@@index` por `(branchId, estadoPago)` y `fechaVencimiento` para cuentas por pagar (P10-F).
- Campos aditivos nullable:
  - `InventoryMovement.purchaseReceiptId` — nullable porque SALE/RETURN/TRANSFER/ADJUSTMENT/WORKSHOP_USAGE nunca lo usan.
  - `InventoryMovement.precioUnitarioPagado Decimal?(10,2)` — costo real por unidad.
  - `BatteryLot.purchaseReceiptId` — misma factura puede traer bicis + baterías.
- Migración `20260412100000_enrich_inventory_receipt` aplicada vía `migrate diff --from-url --to-schema-datamodel` + `migrate resolve --applied` (una migración previa había sido editada post-aplicación → se siguió el procedimiento documentado en AGENTS.md, sin reset).
- Seed (`prisma/seed-transactional.ts` → `seedPurchaseReceipts`):
  - Crea 1 cabecera sintética por sucursal con `proveedor: "Histórico previo a P4"`, `CONTADO/PAGADA`. `updateMany` vincula los `InventoryMovement(PURCHASE_RECEIPT)` y `BatteryLot` existentes (sin cabecera). `totalPagado` se recalcula sumando `costo × qty` (ProductVariant) o `precioMayorista × qty` (SimpleProduct).
  - 4 recepciones realistas adicionales por sucursal: PAGADA/CONTADO, PAGADA/TRANSFERENCIA, PENDIENTE/CONTADO, CREDITO con vencimiento (LEO vencida, AV135 próxima).
  - Idempotente por `findFirst({ proveedor: "Histórico previo a P4", branchId })`.

### P4-B — API Routes ✅ (2026-04-12)
- `POST /api/inventory/receipts` reescrito: Zod con `discriminatedUnion("kind", [variant, simple])`, `totalPagado` calculado server-side (ignora cliente), `superRefine` para reglas cruzadas (CREDITO ⇒ fechaVencimiento; CONTADO+CREDITO inconsistente; PAGADA rechaza fechaVencimiento). `fechaPago` server-side cuando estadoPago=PAGADA. `ProductVariant.costo` y `SimpleProduct.precioMayorista` **no se tocan** (separa costo catálogo del costo histórico en `InventoryMovement.precioUnitarioPagado` — fundamental para rentabilidad en P10-C). P2002 ⇒ 409 español. Guard MANAGER+ADMIN.
- `POST /api/batteries/lots` acepta `purchaseReceiptId?` opcional. Validación de cabecera (existencia + mismo branch) **dentro** del `$transaction` para evitar TOCTOU.
- `GET /api/inventory/receipts` — listado paginado con filtros `estadoPago`, `vencimientoDesde`, `vencimientoHasta`, `branchId` (ADMIN). Scoping automático por branch para no-ADMIN. Resuelve cuentas por pagar (P10-F).
- `GET /api/inventory/receipts/[id]` — detalle con líneas agrupadas: `variantLines`, `simpleLines`, `batteryLots` (filtra nulos respetando AGENTS.md:158).
- `PATCH /api/inventory/receipts/[id]/pagar` — 409 si ya PAGADA, 404 si no existe, 403 si otra sucursal. `fechaPago = now()`.
- `POST /api/inventory/receipts/[id]/invoice` y `DELETE` — multipart, mismo patrón que sello de sucursal (P1-A). Imágenes vía `sharp` → WebP (2000px max, q85). PDFs raw. Límites 10MB PDF / 5MB imagen; 413 explícito. Naming: `/public/facturas/{branchId}-{receiptId}-{ts}.{ext}`. Validación de existencia de la recepción ANTES de parsear formData para evitar archivos huérfanos.
- Cancelación/reversión de recepción: diferida a Fase 6 / P10-E. Mientras tanto, las correcciones se hacen con `InventoryMovement(ADJUSTMENT)` manual.
- Tests manuales corridos con curl (12/12 pasaron). Tests automatizados ⇒ Fase 6.
- Micro-migración `20260412110000_drop_purchase_receipt_saleid` — se eliminó `PurchaseReceipt.saleId` porque el vínculo Pedido↔Recepción vive con granularidad correcta en `BatteryLot.saleItemId` y `AssemblyOrder.saleId` (2H-D); a nivel cabecera era ambiguo (N:M real).

### P4-C — UI ✅ (2026-04-12)
- Migración de rutas a español: `/inventory/` → `/inventario/`, consistente con el resto del app. La API en inglés (`/api/inventory/receipts`) queda intacta.
- Nuevas rutas: `/inventario/recepciones` (listado), `/inventario/recepciones/nuevo` (formulario), `/inventario/recepciones/[id]` (detalle).
- Listado con filtros sincronizados a URL (estadoPago, proveedor, rango vencimiento). Server Component con Prisma directo — cubre el caso operativo de cuentas por pagar. P10-F queda reducido a reporte agregado / export CSV.
- Formulario nueva recepción: tabs Vehículos/Simples/Baterías, líneas mixtas con `useReducer`, validación cruzada cliente espeja reglas P4-B. Preselección desde tab Alertas vía `?variantId=X` / `?simpleProductId=X`.
- Detalle: vista read-only de cabecera + líneas agrupadas, acción "Marcar pagada" (PATCH `/pagar`), upload/reemplazo/eliminación de factura (POST/DELETE `/invoice`). Preview inline PDF + imagen. `router.refresh()` como SSOT tras cada mutación.
- `ReceiptStatusBadge` compartido entre listado y detalle (PAGADA/PENDIENTE/CREDITO con variantes de urgencia por días al vencimiento).
- Deuda documentada: normalización de proveedor (string libre, trim + collapse whitespace pendiente en API).

### Esto desbloquea automáticamente
- Historial de compras al proveedor (query sobre `PurchaseReceipt`).
- Cuentas por pagar (P10-F — filtros por `estadoPago = PENDIENTE | CREDITO`).
- Costo real del inventario (`precioUnitarioPagado` × stock).
- Rentabilidad (precio venta vs precio compra).

### Archivos clave
- `prisma/schema.prisma` ✅
- `prisma/migrations/20260412100000_enrich_inventory_receipt/` ✅
- `prisma/seed-transactional.ts` ✅
- `src/app/api/inventory/receipts/route.ts` ✅
- `src/app/api/inventory/receipts/[id]/route.ts` ✅
- `src/app/api/inventory/receipts/[id]/pagar/route.ts` ✅
- `src/app/api/inventory/receipts/[id]/invoice/route.ts` ✅
- `src/app/api/batteries/lots/route.ts` ✅
- `src/app/(pos)/inventario/` ✅
- `src/app/(pos)/inventario/recepciones/` ✅ (listado + types)
- `src/app/(pos)/inventario/recepciones/nuevo/` ✅ (formulario)
- `src/app/(pos)/inventario/recepciones/[id]/` ✅ (detalle)
- `src/components/inventario/receipt-status-badge.tsx` ✅

---

## FASE P5 — Flujo de autorización (PIN + remoto) ✅ (2026-04-13)

Aplica a: cancelaciones de venta y descuentos sobre precio.

### P5-A ✅ — Schema + PIN + UI de configuración
- Nuevo modelo `AuthorizationRequest` con enums `AuthorizationType` (CANCELACION | DESCUENTO), `AuthorizationStatus` (PENDING | APPROVED | REJECTED | EXPIRED) y `AuthorizationMode` (PRESENCIAL | REMOTA). Incluye `branchId` (bandeja sin join), `expiresAt` (REMOTA: now+5min), `rejectReason`. Relaciones a `Branch`, `Sale?`, requester/approver en `User`.
- `User.pin String?` (hash bcrypt, 4-6 dígitos). Campo separado del `password` — UX mala al teclear la contraseña completa del manager frente al vendedor.
- Migración drift-safe con `prisma migrate diff` + archivo manual + `migrate resolve --applied`.
- API ADMIN-only `POST/DELETE /api/configuracion/usuarios/[id]/pin` — Zod valida 4-6 dígitos y que el rol sea MANAGER/ADMIN.
- UI en `/configuracion/usuarios`: badge "Sin PIN" para MANAGER/ADMIN sin configurar, ícono candado por fila, `SetPinDialog` con confirm y botón eliminar.

### P5-B ✅ — API de autorizaciones
- Helper `src/lib/authorizations.ts`: `validatePinForBranch(pin, branchId)`, `expireIfNeeded(request)` (lazy + idempotente), `consumeAuthorization(tx, input)` transaccional con `AuthorizationConsumeError` tipada.
- **Lock de no-reuso**: DESCUENTO → `AuthorizationRequest.saleId IS NULL` (se setea al consumir en la misma $transaction); CANCELACION → `Sale.status → CANCELLED` (lock natural).
- `POST /api/auth-requests`: PRESENCIAL valida PIN inline y crea APPROVED; REMOTA crea PENDING + `expiresAt = now + 5min`. Rechaza auto-autorización (`manager.id === requester.id`).
- `GET /api/auth-requests`: historial filtrable por `tipo`, `status`, `fromDate`, `toDate`, `branchId` (solo ADMIN).
- `GET /api/auth-requests/[id]`: polling individual con lazy-expire.
- `POST /api/auth-requests/[id]/resolve`: manager aprueba/rechaza con PIN. Carreras cubiertas con `updateMany({ where: { id, status: PENDING } })` — si `count === 0` otro manager ya ganó.
- `GET /api/auth-requests/pending`: bandeja del manager, auto-expira vencidas con un `updateMany` barato por índice `(branchId, status)`, excluye `requestedBy === currentUser`.

### P5-C ✅ — Integración en POS y cancelación
- Decisión polling vs WebSockets (Opus): **polling** — sin precedente de real-time en el repo, sin infra stateful, 3s es suficiente para la UX.
- Hook compartido `useAuthorizationPolling` con cleanup estricto: `setInterval` limpiado en el return del `useEffect`, flag `cancelled` para fetches en vuelo, detiene polling al alcanzar estado terminal y tras 3 errores consecutivos.
- `POST /api/sales` acepta `discountAuthorizationId`. **SELLER con `discountAmount > 0` requiere autorización APPROVED**; MANAGER/ADMIN pueden autoaprobarse (su rol es la autorización). Consumo en $transaction con `AuthorizationConsumeError` mapeado a 400.
- `POST /api/sales/[id]/cancel` acepta `authorizationId`. Gate relajado: SELLER habilitado si provee autorización válida; MANAGER/ADMIN mantienen cancelación directa. Autorizador se añade al `internalNote` de la venta.
- POS: `DiscountAuthorizationPanel` inline con modos presencial (PIN) y remoto (polling + countdown). MANAGER/ADMIN se autoautorizan vía `useEffect` cuando `discountAmount > 0`. Reemplaza el viejo `/api/managers/pin` (que validaba contra `User.password`) — endpoint eliminado.
- `/ventas/[id]`: botón "Cancelar venta" + `CancelSaleModal` reutilizable con el mismo flujo presencial/remoto. Refresca la vista al cancelar.

### P5-D ✅ — Bandeja + historial
- `AuthorizationInbox` en dashboard manager: card que polla `/api/auth-requests/pending` cada 10s con cleanup de `setInterval` y `AbortController` para fetches en vuelo. Lista pendientes con countdown, solicitante y motivo. Aprobar/Rechazar abre `ResolveDialog` con PIN + motivo opcional (para rechazo).
- Página `/autorizaciones` (MANAGER+ADMIN): historial filtrable por tipo, estado, sucursal (solo ADMIN) y rango de fechas. Server Component con Prisma directo; filtros en URL via `useTransition`. Links clickables a `/ventas/[id]` para cancelaciones.
- Link "Autorizaciones" en sidebar (MANAGER+ADMIN) con icono `ShieldCheck`.

### Archivos clave
- `prisma/schema.prisma` — `User.pin`, `AuthorizationRequest`, enums
- `prisma/migrations/20260413000000_add_authorization_requests_and_user_pin/`
- `src/lib/authorizations.ts` — helper compartido
- `src/app/api/auth-requests/` — 4 endpoints (POST + GET + [id] GET/resolve + pending)
- `src/app/api/configuracion/usuarios/[id]/pin/` — set/clear PIN
- `src/components/pos/authorization/` — hook + panel + cancel modal compartidos
- `src/app/(pos)/autorizaciones/` — historial
- `src/app/(pos)/dashboard/authorization-inbox.tsx` — bandeja
- `src/app/api/sales/route.ts` ⚠️ — consume en path normal + frozen
- `src/app/api/sales/[id]/cancel/route.ts` ⚠️ — gate relajado + consume
- `src/app/(pos)/point-of-sale/pos-terminal.tsx` ⚠️ — migración del flujo de descuento
- `src/app/(pos)/ventas/[id]/sale-detail.tsx` — botón cancelar

---

## FASE P6 — Documentos PDF ✅ Completo (P6-A ✅ P6-B ✅ P6-C ✅ P6-D ✅ P6-E ✅)
**Modelo: Sonnet | Librería: @react-pdf/renderer@4.4.1 | Dependencias: P1-A obligatorio**

IVA 16% fijo en todos los documentos. Todos usan datos de sucursal + sello de `Branch`.

### P6-S1 — Infraestructura base ✅ (2026-04-14)
- Instala `@react-pdf/renderer@4.4.1` y `numero-a-letras` (con declaración de tipos en `src/types/`).
- Fuentes Inter TTF (400/500/600/700) descargadas en `public/fonts/`.
- `public/evobike-logo-pdf.png` — copia real PNG del logo (el `.png` original era WebP disfrazado; react-pdf no puede leerlo; todos los componentes PDF apuntan a este archivo).
- `src/lib/pdf/colors.ts` — paleta hardcoded light-mode (10 tokens; CSS vars del app no funcionan en react-pdf).
- `src/lib/pdf/fonts.ts` — `Font.register()` + `Font.registerHyphenationCallback` (desactiva partición silábica en headers de tabla). `FONT_FAMILY = 'Inter'`.
- `src/lib/pdf/helpers.ts` — `formatMXN`, `formatDate`, `totalEnLetra` (normaliza "M.N." a mayúsculas), `calcIVA`, `calcSubtotalFromTotal`.
- `src/lib/pdf/styles.ts` — `StyleSheet.create()` con estilos compartidos.
- `src/lib/pdf/types.ts` — `BranchPDFData`, `PDFItem`, `ClientPDFData`.
- 6 componentes base en `src/lib/pdf/components/`: `BaseDocument`, `DocumentHeader`, `ClientInfoBlock`, `ItemsTable`, `TotalsBlock`, `DocumentFooter`.
- `DocumentFooter` exporta `resolveSealBuffer()` — lee el sello WebP del filesystem y lo convierte a PNG buffer (los sellos de P1-A se guardan como WebP; react-pdf no los acepta directamente).
- `src/lib/branch.ts` reescrito: `assertBranchConfiguredForPDF(branchId, tipoDoc)` ahora **lanza `BranchNotConfiguredError`** (antes retornaba `{ok}`), devuelve `BranchPDFData` tipado listo para pasar a componentes. `TipoDocPDF = 'cotizacion' | 'pedido' | 'ticket' | 'poliza'`. Tipos legacy `BranchPDFDocType`/`BranchPDFGuardResult` conservados como `@deprecated`.
- Dev preview: `GET /api/dev/pdf-preview?branchId=X` genera cotización dummy; `src/app/(pos)/dev/pdf-preview/page.tsx` con iframe. Ambos bloquean con `notFound()` fuera de `development`.

### Archivos clave P6-S1
- `public/fonts/Inter-{Regular,Medium,SemiBold,Bold}.ttf` ✅
- `public/evobike-logo-pdf.png` ✅
- `src/lib/pdf/` ✅
- `src/lib/branch.ts` ✅ (reescrito)
- `src/types/numero-a-letras.d.ts` ✅
- `src/app/api/dev/pdf-preview/route.tsx` ✅
- `src/app/(pos)/dev/pdf-preview/page.tsx` ✅

### P6-S2 — Templates Cotización y Ticket ✅ (2026-04-14)

**Prerequisitos completados en esta sesión:**
- `TotalsBlock` ganó prop `descuento?: number` — fila "Descuento" se muestra solo si > 0. Las demás plantillas no la pasan.
- `DocumentFooter.terminosText.lineHeight` reducido 1.5 → 1.3 para párrafos compactos.
- `src/lib/pdf-client.ts` (client-side único): `openPDFInNewTab(url)` — fetch → 412 check → blob → `window.open`. Mantiene la separación: `src/lib/pdf/` es server-only.

**P6-A — PDF Cotización** ✅
- Template `CotizacionPDF` + interface `CotizacionPDFData` en `src/lib/pdf/templates/cotizacion-pdf.tsx`.
- Usa todos los componentes base (`BaseDocument`, `DocumentHeader`, `ClientInfoBlock`, `ItemsTable`, `TotalsBlock`, `DocumentFooter`).
- `descuento` global: si > 0 se pasa a `TotalsBlock` y aparece fila entre Subtotal e IVA.
- IVA desglosado con `calcSubtotalFromTotal(total − descuento)` (precios del catálogo ya incluyen IVA).
- `PDFItem.discount` = fracción calculada como `1 − lineTotal / (unitPrice × qty)`.
- Cliente: usa `Customer.rfc` y `Customer.direccionFiscal`; fallback a snapshot anónimo.
- Endpoint `GET /api/cotizaciones/[id]/pdf` (`.tsx`) — auth + scoping por rol (SELLER solo las suyas, MANAGER su sucursal, ADMIN todas) + 412 si sucursal sin configurar + render.
- Botón "Descargar PDF" en `quotation-actions-bar.tsx` (floating action bar, antes de Cancelar).

**P6-C — PDF Ticket de venta** ✅
- Template `TicketPDF` + interface `TicketPDFData` en `src/lib/pdf/templates/ticket-pdf.tsx`.
- `TicketPDFData.cliente` es `{nombre, telefono, email} | null` (las ventas no siempre tienen cliente).
- Bloque de metadatos: fecha, vendedor, cliente (solo si existe). Sin `ClientInfoBlock` — diseño propio con chips.
- Banner de cancelación: fondo `#FDECEA`, texto `#7B241C`, autorizador desde `AuthorizationRequest(tipo: CANCELACION, status: APPROVED)`.
- Métodos de pago únicos traducidos debajo de `TotalsBlock` (`CASH` → "Efectivo", `CARD` → "Tarjeta de débito/crédito", etc.).
- Items mixtos: `ProductVariant` → `"${modelo} - ${color} - ${voltaje.label}"`; `SimpleProduct` → `item.description ?? sp.nombre`; freeForm → `item.description`.
- `PDFItem.discount` = fracción: `discountAmt / (unitPrice × qty)` (el campo `SaleItem.discount` es monto, no porcentaje).
- Endpoint `GET /api/sales/[id]/ticket-pdf` (`.ts`) — mismo scoping + `React.createElement(TicketPDF, {...}) as unknown as React.ReactElement<DocumentProps>` para satisfacer el tipo de `renderToBuffer` sin JSX en archivo `.ts`.
- Botón "Descargar Ticket" en `sale-detail.tsx` (top bar, junto a "Imprimir póliza").

### Archivos clave P6-S2
- `src/lib/pdf-client.ts` ✅ (helper client-side)
- `src/lib/pdf/components/totals-block.tsx` ✅ (prop `descuento` opcional)
- `src/lib/pdf/components/document-footer.tsx` ✅ (lineHeight 1.3)
- `src/lib/pdf/templates/cotizacion-pdf.tsx` ✅
- `src/lib/pdf/templates/ticket-pdf.tsx` ✅
- `src/app/api/cotizaciones/[id]/pdf/route.tsx` ✅
- `src/app/api/sales/[id]/ticket-pdf/route.ts` ✅
- `src/app/(pos)/cotizaciones/[id]/_components/quotation-actions-bar.tsx` ✅ (botón PDF)
- `src/app/(pos)/ventas/[id]/sale-detail.tsx` ✅ (botón Ticket)

---

### P6-A — PDF Cotización (formato Alegra) ✅ (ver P6-S2)

### P6-B — PDF Recibo de Pedido / Apartado ✅ (ver P6-S3)

### P6-C — PDF Ticket de venta ✅ (ver P6-S2)

### P6-D — PDF Póliza de garantía ✅ (ver P6-S3)

### P6-E — PDF Comprobante de cierre de corte ✅ (2026-04-15)
- Migración `denominationsJson Json?` en `CashRegisterSession` — nullable para sesiones legacy.
- PATCH `/api/cash-register/session` persiste el desglose de billetes en el mismo UPDATE de cierre.
- Template `CortePDF` en `src/lib/pdf/templates/corte-pdf.tsx`: bloque de sesión, resumen financiero con diferencia coloreada (verde sobrante / rojo faltante), tabla de denominaciones (o texto "Desglose no disponible" para sesiones legacy), bloque amber de autorización si aplica.
- `GET /api/cash-register/session/[id]/pdf`: 403 para SELLER/TECHNICIAN, 409 si sesión abierta, 412 sucursal sin config. Recalcula resumen desde transacciones (misma fórmula canónica que el endpoint de cierre).
- `DocumentFooter`: `terminos` ahora opcional — corte no incluye términos legales; PDFs anteriores no afectados.
- Botón "Imprimir comprobante" activado en `close-corte-dialog.tsx` tras cierre exitoso.
- **Pendiente deuda técnica**: botón en historial de cortes → ver P10-F.

### P6-S3 — Templates Pedido y Póliza ✅ (2026-04-14)

**P6-B — PDF Recibo de Pedido / Apartado** ✅
- Componente `AbonosTimeline` en `src/lib/pdf/components/abonos-timeline.tsx` — tabla Fecha/Monto/Método/Cobrador + filas resumen total abonado (verde) y saldo restante (rojo si > 0, verde si liquidado).
- Template `PedidoPDF` + interface `PedidoPDFData` en `src/lib/pdf/templates/pedido-pdf.tsx`.
- Badge de status inline sobre el bloque cliente: PENDIENTE/ABONADO PARCIAL/LIQUIDADO/CANCELADO con colores propios.
- Bloque cliente simplificado (sin RFC, sin domicilio, sin vencimiento): CLIENTE | TELÉFONO / CORREO | FECHA.
- Endpoint `GET /api/pedidos/[id]/pdf` (`.tsx`) — scoping por rol, mapeo de `CashTransaction(PAYMENT_IN)` como abonos con `session.user.name` como cobrador, cálculo de status efectivo desde `sale.status` + balance.
- `documentType` = "Apartado" o "Backorder" según `sale.orderType`.
- Botón "Descargar Recibo" en `pedido-detalle.tsx` (top bar, junto a la acción principal).

**P6-D — PDF Póliza de Garantía** ✅
- Componente `VehicleInfoBlock` en `src/lib/pdf/components/vehicle-info-block.tsx` — MODELO/COLOR/VOLTAJE/VIN con mismo estilo chip que bloque cliente.
- Template `PolizaPDF` + interface `PolizaPDFData` en `src/lib/pdf/templates/poliza-pdf.tsx`.
- Sin tabla de items ni totales — solo datos del vehículo + baterías + términos legales.
- Tabla baterías inline: No. / Serial / Lote de procedencia / Fecha de recepción.
- `GET /api/sales/[id]/warranty-pdf` reemplazado completamente: ahora devuelve PDF. **Preserva el 409** con `{ success: false, error, pendingAssemblyOrders: N }` si `warrantyDocReady = false`.
- Lookup de `CustomerBike` via `customerId + productVariantId` donde `modelo.requiere_vin = true`; baterías via `BatteryAssignment.isCurrent = true`.
- `handlePrintWarranty` en `sale-detail.tsx` actualizado: async, maneja 409 con toast (muestra conteo de ensambles), 412 para sucursal sin configurar.

### Archivos clave P6-S3
- `src/lib/pdf/components/abonos-timeline.tsx` ✅
- `src/lib/pdf/components/vehicle-info-block.tsx` ✅
- `src/lib/pdf/templates/pedido-pdf.tsx` ✅
- `src/lib/pdf/templates/poliza-pdf.tsx` ✅
- `src/app/api/pedidos/[id]/pdf/route.tsx` ✅
- `src/app/api/sales/[id]/warranty-pdf/route.ts` ✅ (reemplazado — ahora PDF)
- `src/app/(pos)/pedidos/[id]/pedido-detalle.tsx` ✅ (botón Descargar Recibo)
- `src/app/(pos)/ventas/[id]/sale-detail.tsx` ✅ (handlePrintWarranty async + 409)

### Archivos clave P6-E
- `prisma/migrations/20260415061254_add_denominations_json_to_cash_session/` ✅
- `src/lib/pdf/templates/corte-pdf.tsx` ✅
- `src/app/api/cash-register/session/[id]/pdf/route.ts` ✅
- `src/lib/pdf/components/document-footer.tsx` ✅ (terminos opcional)
- `src/app/(pos)/cash-register/close-corte-dialog.tsx` ✅ (botón activado)

---

## FASE P7 — Cotizaciones mejoradas ✅ Completo (2026-04-15)
**Modelo: Sonnet | Dependencias: P6-A**

### P7-A — Rediseño de `QuotationStatus` ✅ (2026-04-15)
Enum reemplazado:
```
DRAFT → EN_ESPERA_CLIENTE → EN_ESPERA_FABRICA → PAGADA → FINALIZADA
                                               → RECHAZADA
```
Migración `20260415_redesign_quotation_status`: mapeo `SENT` → `EN_ESPERA_CLIENTE`, `CONVERTED` → `FINALIZADA`, `CANCELLED` → `RECHAZADA`. `EXPIRED` es estado computado (no persiste en DB) — se deriva en runtime via `getEffectiveStatus()` solo para `DRAFT` y `EN_ESPERA_CLIENTE` con `validUntil < now`. `EN_ESPERA_FABRICA`, `PAGADA`, `FINALIZADA` y `RECHAZADA` no expiran (hay compromiso activo o son estados terminales).

### P7-B — Máquina de transiciones + endpoint unificado ✅ (2026-04-15)
`PATCH /api/cotizaciones/[id]/status` con Zod + `superRefine`. Transiciones válidas:
- `DRAFT` → `EN_ESPERA_CLIENTE` | `EN_ESPERA_FABRICA` | `RECHAZADA`
- `EN_ESPERA_CLIENTE` → `EN_ESPERA_FABRICA` | `PAGADA` | `RECHAZADA`
- `EN_ESPERA_FABRICA` → `PAGADA` | `RECHAZADA`
- `PAGADA` → `FINALIZADA` | `RECHAZADA`

### P7-C — Ajustes al PDF de cotización ✅ (2026-04-15)
- RFC y domicilio fiscal del cliente eliminados del PDF. `ClientInfoBlock` renderiza RFC solo si `client.rfc !== undefined` (no rompe otros PDFs que sí lo pasan).
- `branch.terminosCotizacion` ya se usaba desde P6-A; `DocumentFooter` omite la sección si está vacío/null.
- No hay badge de status en el PDF — C3 no aplica.

### P7-D — Cotizaciones en perfil del cliente ✅ (2026-04-15)
- Tab "Cotizaciones" agregado a `/customers/[id]` (4 tabs: Ventas · Taller · VIN · Cotizaciones).
- Query `Quotation.findMany({ where: { customerId }, take: 20, orderBy: createdAt desc })`.
- `getEffectiveStatus()` aplicado antes de renderizar cada badge.
- `QuotationStatusBadge` movido a `src/components/quotation-status-badge.tsx` (compartido); `quotations-table.tsx` actualizado al nuevo import.

### Archivos clave P7
- `prisma/schema.prisma` ✅ (enum `QuotationStatus`)
- `src/app/api/cotizaciones/[id]/status/route.ts` ✅
- `src/lib/quotations.ts` ✅ (`getEffectiveStatus`, `getDaysRemaining`, `formatMXN`, `formatDate`)
- `src/components/quotation-status-badge.tsx` ✅ (movido desde `_components/`)
- `src/app/(pos)/cotizaciones/_components/quotations-table.tsx` ✅ (import actualizado)
- `src/lib/pdf/templates/cotizacion-pdf.tsx` ✅ (sin RFC/domicilioFiscal del cliente)
- `src/lib/pdf/components/client-info-block.tsx` ✅ (RFC condicional)
- `src/app/api/cotizaciones/[id]/pdf/route.tsx` ✅ (cliente sin campos fiscales)
- `src/app/(pos)/customers/[id]/page.tsx` ✅ (tab Cotizaciones)

---

## FASE P8 — Vista de historial de abonos ✅ Completo (2026-04-15)
**Modelo: Sonnet | Dependencias: ninguna nueva**

### Estado al iniciar la sesión
El timeline visual ya existía en `pedido-detalle.tsx:438-508` (commits previos): punto + ícono por método, fecha, vendedor que cobró, monto y última fila destacada con gradient. El PDF P6-B (`abonos-timeline.tsx`) también ya incluía la tabla de abonos con totales.

### Cierre P8
- **Saldo restante por abono** — `DetallePayment.remainingAfter` calculado server-side en `page.tsx` con `reduce` (purity-safe). Microtexto bajo el monto: "Restante tras este abono: $X,XXX.XX" (10px, `var(--on-surf-var)`, alineado a la derecha).
- **Contador de exhibiciones** — header pasa de "Historial de abonos (N)" a "Historial de abonos · N exhibiciones realizadas" (singular `exhibición realizada` cuando N=1).
- **Decisión de modelo** — `CashTransaction` y `Sale` no distinguen enganche vs exhibición. El `downPayment` de `POST /api/sales` solo nombra el monto inicial de un LAYAWAY pero persiste como `CashTransaction` idéntica al resto. Label uniforme; si en el futuro se requiere "1 enganche + N exhibiciones", se necesita migración (campo en `CashTransaction` o convención "primer pago = enganche").
- **Mini-fix colateral** (commit aparte) — `pedido-detalle.tsx:110` clampea `pending` con `Math.max(0, …)` para evitar negativos por sobreabono manual.

### Archivos modificados
- `src/app/(pos)/pedidos/[id]/page.tsx` — nuevo `remainingAfter` en `DetallePayment`.
- `src/app/(pos)/pedidos/[id]/pedido-detalle.tsx` — microtexto, nuevo label del header y clamp del `pending`.
- PDF P6-B (`abonos-timeline.tsx`) — intacto.

---

## FASE P9 — Tesorería ✅ (2026-04-15)
**Modelo: Sonnet | Dependencias: ninguna**

Ruta: `/tesoreria` (MANAGER + ADMIN).

### Schema aplicado (migración `20260415074752_add_operational_expense_and_bank_balance`)
- `OperationalExpense` con enum `ExpenseCategory` (RENTA, SERVICIOS, NOMINA, PUBLICIDAD, TRANSPORTE, MANTENIMIENTO_INMUEBLE, IMPUESTOS, COMISIONES_BANCARIAS, OTRO) y anulación inmutable (`isAnulado + anuladoPor + anuladoAt + motivoAnulacion`). Índices por `branchId+fecha` y `branchId+categoria`.
- `BankBalanceSnapshot` **sin `branchId`** — es saldo de empresa, no de sucursal. Historial inmutable; el "saldo actual" es siempre el último `createdAt`.

### APIs (`/api/tesoreria/`)
- `expenses` POST/GET — MANAGER (su sucursal) + ADMIN (cross-branch vía `branchId` en body). Zod rechaza `CASH` (los cash viven en `CashTransaction`). `superRefine` exige `comprobanteUrl` cuando `metodoPago === "TRANSFER"`.
- `expenses/[id]` PATCH — solo `descripcion/categoria/comprobanteUrl`. Mandar `monto/fecha/metodoPago` responde **422** explícito. MANAGER solo su sucursal + mismo día. Bloqueado si `isAnulado` (409).
- `expenses/[id]/anular` POST — **solo ADMIN**, motivo min 5, idempotente (409 si ya anulado).
- `expenses/[id]/comprobante` POST/DELETE — upload multipart patrón P4-A (PDF 10MB raw, imagen via sharp → WebP 2000px 5MB), `/public/comprobantes/{branchId}-{expenseId}-{ts}.{ext}`. Valida gasto antes de `formData`.
- `bank-balance` GET (MANAGER+ADMIN, `?historial=true` paginado) + POST (**solo ADMIN**, siempre INSERT).
- `summary` GET — ingresos = ventas completadas, egresos = `gastosEfectivo + gastosOperativos + comprasProveedor`, `gastosPorCategoria` unificado con denominador `gastosEfectivo + gastosOperativos`, saldo efectivo vía `summarizeSession().expectedCash`, saldo bancario del último snapshot.

### UI `/tesoreria/page.tsx` (Server Component)
3 secciones tonales (sin `border-b`): saldos (2 cards), gastos (filtros URL-params + tabla mixta operational+cash), reportes (barras CSS sin librería de charts). Tabla mixta usa badge "Efectivo" para filas de `CashTransaction` (no editables — link a `/cash-register`). Botón "Actualizar saldo" disabled para MANAGER con tooltip.

### Helpers (`src/lib/tesoreria.ts`)
- `mapCashExpenseToOperational()` — mapeo MENSAJERIA→TRANSPORTE, PAPELERIA/LIMPIEZA→SERVICIOS, MANTENIMIENTO→MANTENIMIENTO_INMUEBLE, resto→OTRO. Solo para agregado del summary; NO muta `CashTransaction`.
- `getActiveBankBalance`, `getExpensesInRange`, `getCashExpensesInRange`, `getDefaultMonthRange`, `OPERATIONAL_EXPENSE_METHODS`.

### Archivos tocados
- `prisma/schema.prisma` + `prisma/migrations/20260415074752_add_operational_expense_and_bank_balance/`
- `src/lib/tesoreria.ts` (nuevo)
- `src/app/api/tesoreria/**` (7 archivos nuevos)
- `src/app/(pos)/tesoreria/**` (10 archivos nuevos)
- `src/app/(pos)/sidebar.tsx` (agregada entrada "Tesorería" icono `Landmark`, roles `MANAGER+ADMIN`, después de "Caja")

### Deuda conocida
- **Create-then-upload** (compartida con P4-A) — el modal envía placeholder URL (`https://placeholder.local/tmp`) al crear con `metodoPago=TRANSFER` y lo sobrescribe con el upload posterior. Blast radius bajo (filtro "Solo sin comprobante" lo detecta). Refactor consolidado a upload-first con token diferido a **Fase 6** (hardening) — ver sección "Create-then-upload → upload-first con token" en FASE 6.

---

## FASE P10 — Reportes expandidos
**Modelo: Sonnet | Dependencias: P4 para rentabilidad**

### Infraestructura compartida P10 ✅ (Lote 1 — 2026-04-16)

`src/lib/reportes/` — 6 módulos:
- `csv.ts` — `downloadCSV(rows: Record<string, unknown>[], filename)`, BOM UTF-8 para Excel.
- `money.ts` — `serializeDecimal(d)`, `formatMXN(n)`.
- `branch-scope.ts` — `branchWhere(session, filterBranchId?)` → `{ branchId?: string }`.
- `date-range.ts` — `parseDateRange`, `getDefaultDateRange`, `toDateString`. El `to` se ajusta a 23:59:59.999.
- `types.ts` — `ReportKPI`, `ReportFilters`, `ReportRow`.
- `cost-resolver.ts` — `resolveCostsBatch(variantIds, simpleIds)`: resolución global en 3 pasos (PURCHASE_RECEIPT desc → catálogo → NONE). Implementado en Lote 5.
- `line-revenue.ts` — `computeLineRevenues(sale)`: prorrateo de `Sale.discount` proporcional al peso de cada línea. `revenueNeto = revenueConIva / 1.16`. Implementado en Lote 5.
- `money.ts` — agrega `IVA_RATE = 0.16` (Lote 5).

`src/app/(pos)/reportes/_components/` — 6 componentes:
- `ReportHeader` — título + icono + filtros + acciones.
- `ReportKpiCards` — grid `2/3/5 cols`; primera card con Velocity Gradient.
- `ReportTable<T>` — genérica con `TableColumn<T>[]`, `keyExtractor`, `isLoading`, `emptyMessage`.
- `ReportEmptyState` — icono `FileSearch` + mensaje.
- `ReportDateFilter` — inputs fecha con `router.replace()` reactivo.
- `ReportBranchFilter` — select de sucursales, retorna `null` si `role !== "ADMIN"`.

### P10-A — Ventas por vendedor ✅ (Lote 1 — 2026-04-16)
- Ruta: `/reportes/ventas-vendedor` (MANAGER + ADMIN).
- Columnas: folio, cliente, modelo, voltaje, fecha, total, método de pago, estado.
- KPIs (solo ventas COMPLETED): total vendido, tickets, ticket promedio, unidades, vendedores activos.
- Resumen por vendedor (tabla ordenada por revenue desc) + detalle individual exportable.
- Filtros URL: rango de fechas, vendedor (`userId`), sucursal (ADMIN), método de pago, status (completed/all).
- CSV doble: resumen por vendedor + detalle de ventas.
- `getModeloVoltaje()`: discrimina por número de `productVariantId` únicos (mixto → "Mixto").
- `getPaymentLabel()`: un método → label español; varios → "MIXTO".

### P10-B — Estado de cuenta por cliente ✅ (Lote 4 — 2026-04-16)
- Dos niveles: **Nivel 1** `/reportes/clientes` (lista agregada) + **Nivel 2** `/reportes/clientes/[id]` (detalle por cliente). Roles: `SELLER + MANAGER + ADMIN`.
- **Branch scoping para clientes globales**: `Customer` no tiene `branchId`. Para SELLER/MANAGER se resuelve el universo de clientes vía subqueries `Sale.findMany({ distinct: ["customerId"], where: branchFilter })` + equivalente en `Quotation`, union en `Set<string>`. ADMIN puede filtrar por sucursal. No se exponen compras del cliente en otras sucursales.
- **Nivel 1 — Lista agregada**:
  - Filtros URL: `q` (nombre/teléfono/email/phone2 con `contains insensitive`), `branchId` (ADMIN), `hasPending` (solo saldo pendiente > 0).
  - Ordenado por saldo pendiente desc, desempate por última actividad desc.
  - KPIs: clientes con actividad, apartados activos, saldo pendiente total, saldo a favor acumulado.
  - Agregados N+1-safe: `Sale.groupBy by customerId` (COMPLETED count + sum total), `Sale.findMany LAYAWAY` con `payments: { where: { type: "PAYMENT_IN" } }` para saldo pendiente, `Sale.groupBy _max createdAt` para última actividad. 3 queries constantes, no N queries por cliente.
  - CSV client-side con `downloadCSV` (Lote 1).
  - `Customer.creditLimit` **no se muestra** — campo sin flujo activo; exponerlo confunde. Se deja en schema sin tocar.
- **Nivel 2 — Detalle por cliente**:
  - Cabecera: nombre, teléfono(s), email, RFC, saldo a favor (badge verde solo si > 0).
  - Secciones: **Compras** (COMPLETED + CANCELLED, link a `/ventas/[id]`) y **Apartados activos** (LAYAWAY, link a `/pedidos/[id]`).
  - Cancelaciones: visibles con badge "Cancelada" + monto tachado; **no suman** en summary de compras ni en KPIs. Nota al pie explica la regla.
  - Apartados: `pendiente = Math.max(0, total - Σ CashTransaction(PAYMENT_IN).amount)` — patrón de `pedido-detalle.tsx:110`. Último abono = `max(createdAt)` de los PAYMENT_IN.
  - `getItemsResumen()`: polimórfico variant/simple/free-form — un variant → `modelo voltaje`, varios → "Mixto", simple único → `simpleProduct.nombre`, varios simples → "Varios productos", free-form → `description`.
  - Filtro rango de fechas con `parseDateRange` (Lote 1). **Default sin filtro** — solo se aplica si la URL trae `from`/`to`; el botón "Limpiar rango" reinicia.
  - CSV combinado (compras + apartados) con shape uniforme: columna `Sección` discrimina, campos no aplicables quedan vacíos. Nombre del archivo = `estado-cuenta-{cliente}-{rango|historial}.csv`.
- **Fuera de alcance v1** (decisiones cerradas): cotizaciones (ya viven en `/customers/[id]` P7-D), `creditLimit` (sin flujo), `ServiceOrder` (las cobradas son Sales con `serviceOrderId` y aparecen en compras).
- Sidebar: "Estado de cuenta" → `/reportes/clientes`, icon `Wallet`, **todos los roles** (SELLER+MANAGER+ADMIN).

### P10-C — Rentabilidad por producto ✅ (Lote 5 — 2026-04-16)
- Ruta: `/reportes/rentabilidad` (MANAGER + ADMIN).
- Fuente: `Sale(COMPLETED)` + `SaleItem` en el rango de fechas + `resolveCostsBatch` global (último RECEIPT → catálogo).
- Procesamiento: `computeLineRevenues(sale)` por cada venta → prorrateo de `Sale.discount` → `revenueNeto = revenueConIva / 1.16`. Agrega por producto (key `v:{id}` / `s:{id}`). Líneas libres (`isFreeForm` o sin FK) → excluidas del margen, contadas en KPI.
- KPIs: revenue neto total, costo total, margen bruto ($), margen % ponderado, líneas libres (informativo).
- Columnas: tipo (badge), código, nombre, unidades, revenue neto, costo total + badge fuente (RECEIPT verde / CATALOG amarillo / NONE rojo), margen $ (coloreado), margen %, ticket promedio.
- Filtros URL: `from`, `to` (default mes actual), `branchId` (ADMIN), `kind`, `sort` (margen-desc/asc, revenue-desc, unidades-desc). Búsqueda `q` en cliente.
- Disclaimer en header: "Estimación operativa — costo resuelto por último precio pagado a proveedor, con fallback al costo de catálogo. Líneas libres excluidas del margen."
- CSV client-side `rentabilidad-productos.csv`.
- Sidebar: "Rentabilidad por producto", icon `TrendingUp`, roles MANAGER+ADMIN.
- **Diagnóstico de descuentos** (`prisma/diagnostic-p10c-discount.ts`): BD actual tiene 1 venta COMPLETED, 0 con `Sale.discount > 0`, 0 `SaleItem.discount > 0`. Prorrateo neutral en datos actuales.

### P10-D — Valor de inventario ✅ (Lote 5 — 2026-04-16)
- Ruta: `/reportes/inventario/valor` (MANAGER + ADMIN).
- Fuente: `Stock(quantity > 0)` + `resolveCostsBatch` global. Incluye productos inactivos si tienen stock.
- KPIs: valor total (Velocity Gradient), valor vehículos, valor simples, productos distintos, sucursales con stock (ADMIN).
- Columnas: sucursal (ADMIN), tipo, código, nombre, stock, costo unitario + badge fuente, valor total.
- Filtros URL: `branchId` (ADMIN), `kind`, `costSource` (receipt/catalog/none/all), `q`. Todos client-side excepto `branchId`.
- Orden default: valor total desc. `<tfoot>` con total del subconjunto filtrado.
- CSV client-side `valor-inventario.csv`.
- Sidebar: "Valor de inventario", icon `Coins`, roles MANAGER+ADMIN.

### P10-E — Movimientos de inventario ✅ (Lote 3 — 2026-04-16)
- Ruta: `/reportes/inventario/movimientos` (MANAGER + ADMIN).
- Fuente: `InventoryMovement` — **sin** `include: { user, branch }` (no existen relaciones Prisma en el modelo); sucursales y usuarios resueltos con queries batch separadas en `Promise.all`.
- Convención de signo confirmada por código existente: `quantity > 0` → Entrada (`PURCHASE_RECEIPT`, `RETURN`, `TRANSFER_IN`); `quantity < 0` → Salida (`SALE`, `WORKSHOP_USAGE`, `TRANSFER_OUT`); `quantity === 0` → Neutro (ajuste sin cambio neto).
- Polimorfismo variant/simple: discriminación explícita (`productVariantId != null` → nombre = `modelo + color + voltaje`, código = `sku`; `simpleProductId != null` → `simpleProduct.nombre` + `codigo`). Caso ambos null maneja defensivamente con `"—"`.
- Batch N+1-safe: 1 query principal → 5 queries batch en `Promise.all` (branches, users, sales, serviceOrders, branchesForFilter) → mapas `Map<string, string>` para lookup O(1).
- Referencias amigables por tipo: PURCHASE_RECEIPT usa FK directa `purchaseReceipt.proveedor + folio`; SALE/RETURN resuelven `Sale.folio` desde batch; WORKSHOP_USAGE resuelve `ServiceOrder.folio`; TRANSFER_OUT/IN muestran id corto `#xxxxxxxx` (patrón de `referenceId` no documentado en codebase v1 — pendiente enriquecer en v2); ADJUSTMENT muestra `referenceId` tal cual.
- KPIs: total movimientos, entradas totales (`sum qty > 0`), salidas totales (`abs(sum qty < 0)`), ajustes (`count ADJUSTMENT` con neto `±X u.` en trend), productos distintos (IDs únicos con prefijo `v:` / `s:`).
- Filtros URL: `from`, `to`, `branchId` (ADMIN), `type` (7 valores + `all`), `kind` (`variant/simple/all`), `sign` (`in/out/all`), `q` (búsqueda SKU/código/nombre server-side vía OR nested).
- Sidebar: "Movimientos de inventario" en grupo Reportes, icon `ArrowUpDown`, roles `MANAGER+ADMIN`.
- CSV client-side con `downloadCSV` del Lote 1.
- Mini-fix aplicado en este lote: orden de resolución del autorizador en `historial/page.tsx` corregido — `closeAuthorization.approver.name` (fuente canónica P5) tiene prioridad sobre `authorizedBy.name` (campo legacy pre-P5).

### P10-F — Historial de cortes de caja ✅ (Lote 2 — 2026-04-16)
- Ruta: `/reportes/caja/historial` (MANAGER + ADMIN).
- Filtros: rango de fechas (cierre), sucursal (ADMIN), operador.
- KPIs: total cortes, efectivo esperado acumulado, efectivo contado acumulado, diferencia neta, cortes con diferencia.
- Columnas: folio, sucursal (ADMIN), operador, apertura, cierre, ef. esperado, ef. contado, diferencia (badge coloreado), autorizador (badge con `ShieldCheck`), botón "Imprimir".
- Botón "Imprimir comprobante" por fila — reutiliza `GET /api/cash-register/session/[id]/pdf` (P6-E).
- CSV export.
- Sidebar: `hasSpecificSibling` fix para que `/reportes/caja` no quede activo cuando la ruta es `/reportes/caja/historial`.

### P10-G — Compras al proveedor (reporte agregado)
Historial desde `inventory/receipts` enriquecido.
**Alcance reducido post P4-C**: el listado operativo de cuentas por pagar (filtros por estadoPago, proveedor, rango vencimiento) ya lo cubre `/inventario/recepciones`. P10-G queda como reporte agregado: totales mensuales por proveedor, análisis de vencimientos por período, export CSV.

### P10-H — Reporte de stock mínimo ✅ (Lote 2 — 2026-04-16)
- Ruta: `/reportes/inventario/stock-minimo` (MANAGER + ADMIN).
- Snapshot de todos los `Stock` con `quantity < stockMinimo`. Filtro in-memory (cross-model `quantity ≤ productVariant.stockMinimo` no es expresable en Prisma where).
- Polimorfismo: `ProductVariant` (`kind: "variant"`) y `SimpleProduct` (`kind: "simple"`). Double null-guard antes de serializar.
- Severidad: `critical` si `quantity ≤ stockMinimo/2`, `warning` en otro caso.
- KPIs: total alertas, críticos, advertencias, unidades faltantes, sucursales afectadas.
- Filtros client-side: tipo (variant/simple), severidad, búsqueda de texto (SKU/nombre).
- Filtro server-side: sucursal (ADMIN, URL param).
- Botón "Crear recepción" → `/inventario/recepciones/nuevo?variantId=X` o `?simpleProductId=X`.
- CSV export.
- Ordenado por `quantity − stockMinimo` asc (más urgente primero).

### P10-I — Reporte anual
KPIs por mes: ingresos, gastos operativos, compras al proveedor, margen neto.
Comparativa entre sucursales (solo ADMIN).

### Archivos clave
- `src/app/api/reportes/` (nuevas sub-rutas)
- `src/app/(pos)/reportes/` (ampliar existente)

---

## FASE P11 — Seguimiento de mantenimientos
**Modelo: Sonnet | Sin schema nuevo | Dependencias: ninguna**

Ruta: `/mantenimientos` (TECHNICIAN + MANAGER + ADMIN).

> ⚠️ **Antes de empezar:** evaluar fusionar con Taller Mecánico (tab "Mantenimientos" dentro de `/workshop`) en lugar de módulo independiente. Ambos viven sobre `ServiceOrder` + `CustomerBike` y comparten audiencia. Si se fusiona, no se agrega ítem al sidebar — queda como tab junto al Kanban actual.

### Lógica
- Query cruza `CustomerBike` + `Sale` (fecha de compra) + `ServiceOrder` (último servicio `DELIVERED`)
- Regla: primer mantenimiento a 6 meses de la venta; subsecuentes a 6 meses del último `ServiceOrder` completado
- Sin mantenimiento en 6 meses = póliza en riesgo

### UI
- Tabla con semáforo:
  - 🔴 Vencido — más de 6 meses sin mantenimiento
  - 🟡 Por vencer — faltan ≤ 30 días
  - 🟢 Al corriente — mantenimiento reciente
- Por unidad: cliente, teléfono, modelo, VIN, fecha compra, último mantenimiento, próximo estimado
- Botón "Crear orden de taller" directo desde la tabla
- Filtros: sucursal, estado del semáforo, rango de fechas

### Archivos clave
- `src/app/(pos)/mantenimientos/page.tsx` (nueva)
- No requiere API Route nueva — query en Server Component

---
## P12 — Inventario cross-branch + Transferencias entre sucursales
  P12-A: Visibilidad de stock global en POS (lectura)
  P12-B: Flujo de transferencias (modelo, API, UI)
  P12-C: Reportes de movimientos cross-branch

  ---

## FASE 6 — Hardening y Producción
**Modelo: Opus | Dependencias: TODO lo anterior**

### Tareas
- Tests de integración: flujos de caja, ventas, montaje, autorización
- Rate limiting en API Routes
- Headers de seguridad: CSP, HSTS, X-Frame-Options
- Migración a Prisma v7 (breaking changes a evaluar)
- Connection pooling: PgBouncer o Prisma Accelerate
- Script de sincronización de `BatteryLots` sin contrapartida contable (diferido desde 2H-D)
- **Race condition al abrir caja (post-refactor per-branch)** — no hay unique parcial en `CashRegisterSession(branchId) WHERE status='OPEN'`. Si dos usuarios de la misma sucursal hacen POST a `/api/cash-register/session` en simultáneo, ambos pasan el `findFirst` y ambos INSERT crean sesión. Fix: migración manual `CREATE UNIQUE INDEX cash_session_one_open_per_branch ON "CashRegisterSession"("branchId") WHERE status = 'OPEN';` (Prisma no soporta índices parciales declarativamente — editar el `.sql` post `migrate dev --create-only`). Alternativa: advisory lock `pg_advisory_xact_lock(hashtext(branchId))` en la `$transaction` del POST. Bajo riesgo operativo (2 usuarios por sucursal, acción rara) pero corrige el data integrity.
- **Cron proactivo de caja huérfana (diferido desde refactor per-branch)** — hoy el "night audit" es lazy: banner al cargar el layout `(pos)/` + bloqueo 409 al mutar. Falta la notificación proactiva: job nocturno (ej. 23:30) que detecta sesiones OPEN cuyo `openedAt.toDateString()` ≠ hoy y envía alerta (email al manager, push al navegador, webhook a Slack/WhatsApp) para que el turno no termine con caja sin cuadrar. Requiere decisión sobre el canal de notificación y dónde corre el cron (Vercel Cron / worker externo / pg_cron).
- **Create-then-upload → upload-first con token (P4-A + P9)** — El patrón actual de uploads de archivos (factura en `/api/inventory/receipts/[id]/invoice` y comprobante en `/api/tesoreria/expenses/[id]/comprobante`) es: (1) create del registro padre con URL null/placeholder, (2) el cliente recibe el `id`, (3) segundo request con el archivo, (4) server actualiza la URL. Si la red cae entre (2) y (3), queda un registro con URL inválida. En P9 con `metodoPago === "TRANSFER"` el problema es peor porque el superRefine exige `comprobanteUrl` desde el create — la UI manda `https://placeholder.local/tmp` y lo sobrescribe. Blast radius actual es bajo: los gastos sin comprobante aparecen en el filtro "Solo sin comprobante"; las recepciones sin factura son visibles en el listado de `/inventario/recepciones`. El patrón correcto (Stripe, S3 multipart) es: (a) `POST /uploads` sube el archivo a `/tmp` y retorna un token opaco, (b) el create del registro principal recibe el token, (c) el server mueve el archivo de `/tmp` a su destino final dentro del `$transaction`. Consolidar ambos módulos (P4-A + P9) en un helper único en el mismo refactor — el costo marginal de unificar es bajo frente a mantener dos implementaciones divergentes. Incluir limpieza del placeholder `https://placeholder.local/tmp` y relajar la superRefine a "required cuando TRANSFER y token presente".
- **Persistir breakdown de denominaciones en cierre de corte** — el `PATCH /api/cash-register/session` (P5.7) ya recibe `denominaciones: Record<string, number>` en el body pero lo **descarta** server-side (no hay campo en `CashRegisterSession`). Es dato de auditoría útil (forense en diferencias de caja, análisis de mezcla de efectivo, PDF P6-E). **Fix sugerido:** `CashRegisterSession.denominacionesJson Jsonb?` — `Jsonb` (no `Json`) persiste el `Record<string, number>` del body tal cual sin tabla hija ni normalización, y permite query server-side si se necesita en reportes. Al cerrar, escribir el mismo objeto que ya llega en el body; el PDF P6-E lo lee directo. Backfill opcional — sesiones cerradas antes del cambio quedan `null` (se muestra "No registrado" en el PDF).
- Deploy: variables de entorno de producción, SSL, dominio
- Build limpio final: cero `any`, cero `TODO`, cero `console.log`
- Revisión final de `refacciones_revisar.csv` y carga completa
- **Tech-debt UI: migrar `rgba(178,204,192,0.X)` hardcoded → `var(--ghost-border)`** — cada uso hardcoded rompe dark mode porque no adapta a `rgba(45,74,58,0.30)`.
  - **Parte 1 ✅ (2026-04-15)** — 59 instancias con alpha `0.15` (el valor exacto del token) migradas en 27 archivos, incluyendo `pos-terminal.tsx`, `layout.tsx`, tabs de `configuracion/catalogo`, recepciones de inventario, cotizaciones públicas, reportes y sidebar. Identity-replace en light; en dark las borders dejan de ser invisibles (pasan a `rgba(45,74,58,0.30)`).
  - **Parte 2 — pendiente** — quedan 47 instancias con alphas no-estándar: **26** con `0.2`, **12** con `0.08`, **3** con `0.18`, **1** con `0.22/0.35/0.4/0.45` cada una, más dos con espacios: `0.08` y `0.1`. No se migraron porque `var(--ghost-border)` es fijo en `0.15 / 0.30` y la sustitución cambia la opacidad visible. Dos caminos posibles: (a) aceptar el shift visual y replace_all (rápido pero requiere verificación visual en light+dark por archivo) o (b) introducir tokens `--ghost-border-weak` / `--ghost-border-strong` con pares light/dark y routear cada alpha a su token. Decisión diferida.
- **Tech-debt lint (snapshot 2026-04-14, pre-Caja P5.6 ampliada) ✅ (2026-04-15)** — `npx eslint src/` reportaba **10 errors + 12 warnings** pre-existentes que el React Compiler bloqueaba en compile-skip. Ahora `eslint src/` retorna `Exit: 0`.
  - **Purity resuelta** — `Date.now()` en `workshop/page.tsx:28,219` (async server component) hoisted a `const nowMs = Date.now()` con `// eslint-disable-next-line react-hooks/purity` anotando que corre por request, no en render. `CountdownLabel` de `authorization-inbox.tsx` y `discount-authorization-panel.tsx` reescritos con **reloj externo compartido** (`subscribeNow`/`getNowSnapshot`) consumido via `useSyncExternalStore` — un único `setInterval` mientras haya ≥1 suscriptor, ningún componente llama `Date.now()` en render ni hace `setState` sync en `useEffect`.
  - **Ref en render resuelto** — `use-authorization-polling.ts:51` movió la asignación `onTerminalRef.current = onTerminal` a un `useEffect([onTerminal])` para cumplir `react-hooks/refs`.
  - **Reasignación post-render resuelta** — `reportes/comisiones/page.tsx:116` reescrito con `rows.reduce(...)` en vez de `let + .map()` con side-effect (también purity-safe, mismo patrón que P8 `remainingAfter`).
  - **Warnings resueltos** — `react-hook-form.watch()` → `useWatch({ control })` en `entrada-efectivo-dialog.tsx` y `expense-dialog.tsx` (mismo patrón que P9). Variables no usadas limpiadas en `catalogo-client.tsx`, `recepcion-detail.tsx`, `cash-report.tsx`, `deliver-modal.tsx`, `workshop/[id]/page.tsx`, `api/auth-requests/pending/route.ts`, `api/comisiones/reglas/[id]/route.ts`, `discount-authorization-panel.tsx`. `prefer-const` en `api/inventory/receipts/route.ts`.
  - **Efectos colaterales limpios** — `theme-toggle.tsx` reescrito con `useSyncExternalStore` (evita `setState` sincrónico en `useEffect` para el flag `mounted`). `vin-selector-dialog.tsx` pasa a `useReducer` + `defer` para evitar cascada de setState en `useEffect`. `authorization-inbox.tsx` deferred inicial via `setTimeout(0)` + interval.
- **DISTINCT ON en cost-resolver (diferido desde P10 Lote 5)** — `resolveCostsBatch` trae todos los `PURCHASE_RECEIPT` relevantes y descarta duplicados en memoria (`Map + primera aparición`). Funciona bien en volumen actual, pero si el historial de recepciones crece, la query trae filas innecesarias. Optimización: `SELECT DISTINCT ON (productVariantId) … ORDER BY productVariantId, createdAt DESC` (y equivalente para `simpleProductId`) — dos queries en paralelo, cero trabajo en memoria. Bloqueante: `DISTINCT ON` con dos columnas polimórficas requiere dos queries separadas (no se puede hacer en una sola sin CTE compleja). Evaluar en Fase 6 cuando el volumen lo justifique; la semántica del resolver no cambia.
- **Seed de ventas con descuentos para QA de P10-C (diferido desde P10 Lote 5)** — El diagnóstico `prisma/diagnostic-p10c-discount.ts` confirmó que la BD de QA tiene 1 venta COMPLETED y 0 descuentos. El prorrateo de `computeLineRevenues` nunca se ejercita con datos reales. Agregar en `prisma/seed-transactional.ts`: (a) al menos 1 venta con `Sale.discount > 0`, (b) al menos 1 venta con `SaleItem.discount > 0` en alguna línea, (c) 1 venta con ambos para probar el caso combinado. Verificar que el reporte P10-C muestre margen correcto en los 3 casos.
- **Bug sistémico de zona horaria en filtros de fecha** — Detectado durante review de P10-A (2026-04-16). El patrón `new Date("YYYY-MM-DD")` interpreta el string como UTC medianoche, no local. En `America/Merida` (UTC−6) esto corre el día un pelo, incluyendo ventas del día anterior y perdiendo las del último día del rango. **Afecta:** `src/app/(pos)/ventas/page.tsx`, `src/app/api/reportes/caja/route.ts`, `src/app/(pos)/reportes/caja/page.tsx`, `src/app/(pos)/reportes/comisiones/page.tsx`, `src/app/(pos)/reportes/caja/historial/page.tsx`, `src/app/api/tesoreria/summary/route.ts`, `src/app/(pos)/autorizaciones/page.tsx`. **Fix:** reemplazar con `parseDateRange` o `parseLocalDate` de `src/lib/reportes/date-range.ts`. El workaround actual de concatenar `"T23:59:59.999Z"` también es UTC y tiene el bug espejo. **Impacto financiero:** comisiones, KPIs y cortes potencialmente desfasados en ±1 día.

---

## Archivos de datos listos en prisma/data/

| Archivo | Contenido | Estado |
|---|---|---|
| `accesorios.csv` | 35 productos: accesorios, cargadores, baterías, refacciones básicas | ✅ Listo |
| `refacciones.csv` | 2,632 refacciones por modelo, 40 modelos cubiertos | ✅ Listo |

---

## Orden de dependencias resumido

```
P0  SimpleProduct schema          ← Opus, PRIMERO
P1  Configuración                 ← Opus+Sonnet (necesita P0)
P2  Datos de prueba               ← Sonnet (necesita P0+P1)
P3  Fixes POS                     ← Sonnet (necesita P0+P2)
P4  Inventario enriquecido        ← Sonnet (necesita P0)
P5  Flujo autorización            ← Opus (independiente)
P6  PDFs                          ← Sonnet (necesita P1-A)
P7  Cotizaciones mejoradas        ← Sonnet (necesita P6-A)
P8  Historial de abonos           ← Sonnet (independiente)
P9  Tesorería                     ← Sonnet (independiente)
P10 Reportes expandidos           ← Sonnet (necesita P4)
P11 Mantenimientos                ← Sonnet (independiente)
6   Hardening + Deploy            ← Opus (todo lo anterior)
```

---

## Regla de negocio — Refacciones por modelo

Las refacciones tienen un campo `modelo_aplicable` que restringe dónde pueden usarse:

- `modelo_aplicable = 'GLOBAL'` → disponible en cualquier contexto
- `modelo_aplicable = 'AGUILA'` → solo cuando el contexto es modelo Águila

Esta regla aplica en tres flujos:

**1. POS (venta directa de refacción)**
- Si hay un vehículo en la transacción: filtrar refacciones por `modelo_aplicable = modelo del vehículo OR GLOBAL`
- Si es venta de refacción sola (sin vehículo): mostrar todas pero requerir selección del modelo al que aplica para trazabilidad

**2. Taller (ServiceOrder)**
- Al agregar `ServiceOrderItem` con refacción: filtrar por `modelo_aplicable` que coincida con el modelo del `CustomerBike` vinculado a la orden, más las `GLOBAL`
- Si la orden no tiene `CustomerBike` vinculado: mostrar todas con selección obligatoria de modelo

**3. API validation**
- `POST /api/service-orders/[id]/items` debe validar que la refacción es compatible con el modelo del `CustomerBike` de la orden
- Error 422 si `refaccion.modelo_aplicable !== 'GLOBAL' && refaccion.modelo_aplicable !== customerBike.modelo`

Esta validación va en P0 (diseño del modelo) y P3 (UI del POS y taller).

---

## Reglas que nunca romper (resumen)

- Mutaciones SIEMPRE via API Routes en `src/app/api/`
- Consultas en páginas SIEMPRE en Server Components async
- Operaciones multi-tabla SIEMPRE en `prisma.$transaction()`
- Prohibido `any` en TypeScript
- Migraciones: SIEMPRE `prisma migrate dev --name <name>`, NUNCA `db push`
- Filtrar por `branchId` del JWT en todo query, excepto ADMIN
- `npm run build` y `npm run lint` limpios antes de cualquier commit
- Leer `DESIGN.md` antes de cualquier trabajo de UI
- No modificar `pos-terminal.tsx` sin advertir riesgo de regresión
