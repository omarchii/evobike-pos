# ROADMAP evobike-pos2 — Post Fase 5

Última actualización: 2026-04-21 (Shell 1-E sidebar colapsable ✅; Dashboard D1 ✅; Exportación contable scaffold ✅; Fase S — S1/S2/S3 completos; S4/S5 diferidos a rediseño POS/Taller)  
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

## FASE P10 — Reportes expandidos ✅ (Completo — 2026-04-17)
**Modelo: Sonnet | Dependencias: P4 para rentabilidad**

> **Rediseño v1 (2026-04-18):** Decisiones cerradas → [`docs/reportes-redesign/REPORTES_V1_DECISIONS.md`](docs/reportes-redesign/REPORTES_V1_DECISIONS.md)

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

### P10-G — Compras al proveedor ✅ (Lote 6 — 2026-04-17)
- Ruta: `/reportes/compras-proveedor` (MANAGER + ADMIN).
- Fuente: `PurchaseReceipt` — todas las del rango (PAGADA + PENDIENTE + CREDITO). Filtro por `createdAt`.
- KPIs: total comprado (Velocity Gradient), total pagado, cuentas por pagar, cuentas vencidas (count + monto en trend), proveedores distintos.
- **Vista principal — agregado por proveedor**: normalización `proveedor.trim().toLowerCase()` en memoria, nombre canónico por frecuencia (desempate alfabético), columnas: proveedor (link drill-down), recepciones, total comprado, pagado, pendiente (ámbar/rojo según estado vencimiento), próximo vencimiento (badge coloreado).
- **Vista secundaria — serie mensual**: tabla con barras CSS proporcionales al mes de mayor compra (gradiente #1b4332 → #2ecc71). Columnas: mes, total comprado, recepciones, proveedores distintos.
- **Drill-down**: click en proveedor abre `/inventario/recepciones?proveedor=<nombre>&branchId=<...>&from=...&to=...` (vista operativa existente).
- Filtros URL: `from`, `to`, `branchId` (ADMIN), `estadoPago` (`all/pagada/pendiente`), `q` (búsqueda text en proveedor). KPIs excluyen el filtro `q` — solo aplican `estadoPago`.
- CSV doble: `compras-por-proveedor-{rango}.csv` + `compras-por-mes-{rango}.csv`, botones separados por sección.
- Sidebar: "Compras al proveedor", icon `Truck`, roles MANAGER+ADMIN. Insertado entre "Rentabilidad por producto" y "Stock mínimo".
- **Deuda conocida (P10-G — Lote 6):**
  - **Normalización de proveedor sin ejercitar en QA**: la BD de QA usa seeds consistentes; los casos reales de `"Refaccionaria Luz"` vs `"refaccionaria luz"` vs `"Refaccionaria LUZ "` probablemente no aparecen. Al cargar datos reales de producción, abrir el reporte y verificar que no haya grupos duplicados por inconsistencia de trim/case. Si aparecen → la normalización server-side en `POST /api/inventory/receipts` sube a alta prioridad en Fase 6.
  - **Drift timezone en KPIs de vencimiento**: `fechaVencimiento < now()` se evalúa server-side en UTC. En `America/Merida` (UTC−6) puede haber 1 día de drift en la franja 18:00–23:59 local. No es bug de Lote 6 — es el bug sistémico de timezone ya rastreado. Al hacer el fix mecánico global de Fase 6 incluir este punto.

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

### P10-I — Reporte anual ✅ (Lote 7 — 2026-04-17)
**Ruta:** `/reportes/anual` — ADMIN only. Sin filtro de sucursal (cross-branch siempre).

**Fuentes (sin doble conteo):**
- Ingresos: `Sale(status=COMPLETED)` → `total`
- Gastos no-efectivo: `OperationalExpense(metodoPago IN CARD|TRANSFER|CREDIT_BALANCE, isAnulado=false)` → `monto`
- Gastos efectivo: `CashTransaction(type=EXPENSE_OUT)` → `amount`
- Compras (informativo): `PurchaseReceipt` → `totalPagado`

**Margen operativo** = Ingresos − (Gastos no-efectivo + Gastos efectivo). Compras NO restan del margen (CapEx, no OpEx).

**UI:** 5 KPI cards · toggle comparativa/consolidado · gráfica de barras CSS · tabla con tfoot TOTAL · CSV export.

**Filtros URL:** `?year=2026&view=comparativa|consolidado`.

- **Deuda conocida (P10-I — Lote 7):**
  - **Agregación en memoria (opción A)**: `findMany` + `Map` en lugar de `$queryRaw` con `DATE_TRUNC`. Correcto hasta ~10k registros/año. Si el volumen crece, migrar a raw SQL con `DATE_TRUNC('month', "createdAt") AT TIME ZONE 'America/Merida'`.
  - **Años disponibles hardcodeados**: los últimos 5 años se calculan desde el año actual, no desde datos reales. Si se necesita más granularidad, derivar con `SELECT DISTINCT EXTRACT(YEAR FROM "createdAt") FROM "Sale"`.
  - **ATRATO excluido de OperationalExpense**: gastos con `metodoPago=ATRATO` no se incluyen en gastos operativos del reporte. Si el cliente usa ATRATO para gastos op., agregar `ATRATO` al filtro `metodoPago`.

### Archivos clave
- `src/app/api/reportes/` (nuevas sub-rutas)
- `src/app/(pos)/reportes/` (ampliar existente)

---

## FASE P11 — Seguimiento de mantenimientos ✅ 2026-04-17
**Modelo: Sonnet | Schema: `ServiceCatalog.esMantenimiento` (aditivo) | Dependencias: ninguna**

> **Decisión de fusión:** integrado como tab dentro de `/workshop`, NO módulo independiente. Sin ítem nuevo en sidebar. Diseño cerrado con Opus.

### Ruta final
`/workshop/mantenimientos` (TECHNICIAN + MANAGER + ADMIN). SELLER es redirigido a `/workshop`.

### Lógica implementada
- Solo `CustomerBike` con `AssemblyOrder.saleId` → `Sale` (no CANCELLED). Bicis sin venta origen no aparecen.
- Solo cuenta como mantenimiento: `ServiceOrder` con `status = DELIVERED` + al menos un `ServiceOrderItem` con `serviceCatalog.esMantenimiento = true`.
- `base = último mantenimiento ?? fecha de compra`. `próximo = base + 6 meses`.
- 🔴 Vencido: `hoy > próximo`. 🟡 Por vencer: `0 ≤ diff ≤ 30d`. 🟢 Al corriente: `diff > 30d`.
- Ordenado por `diasRestantes` ASC (más urgente primero).

### Archivos creados / modificados
- `prisma/schema.prisma` — `ServiceCatalog.esMantenimiento Boolean @default(false)` (nueva columna)
- `prisma/migrations/20260417063503_add_mantenimiento_flag_to_service_catalog/migration.sql`
- `src/app/api/configuracion/servicios/route.ts` — POST acepta `esMantenimiento`
- `src/app/api/configuracion/servicios/[id]/route.ts` — PATCH acepta `esMantenimiento`
- `src/app/(pos)/configuracion/servicios/servicios-manager.tsx` — checkbox + badge Mtto
- `src/app/(pos)/workshop/layout.tsx` — tabs Kanban | Mantenimientos (nuevo)
- `src/app/(pos)/workshop/mantenimientos/page.tsx` — Server Component con query + post-procesamiento
- `src/app/(pos)/workshop/mantenimientos/mantenimientos-table.tsx` — Client Component (KPIs, filtros, tabla, CSV)

> **Mejora 2026-04-17:** `NewOrderDialog` ahora acepta `initialCustomerBikeId` vía query param; el botón "Crear orden de taller" de `/workshop/mantenimientos` navega a `/customers/[id]?customerBikeId=X` y pre-selecciona cliente + bici directamente.

---
## FASE P12 — Transferencias entre sucursales

### P12-B — Schema + API + UI ✅ (2026-04-17)
**Modelo: Opus diseño → Sonnet implementación (3 sesiones CC separadas)**

**Schema aditivo** (migración `20260417075847_add_stock_transfer`):
- `StockTransfer` con cabecera (folio único, fromBranchId, toBranchId, status, 5 pares de audit: creado/autorizado/despachado/recibido/cancelado por+at, motivoCancelacion, notas)
- `StockTransferItem` polimórfico 4-way (productVariantId XOR simpleProductId XOR batteryId XOR customerBikeId, enforced con CHECK en SQL)
- `BatteryStatus` extendido con `IN_TRANSIT` (aditivo al final del enum)
- CHECKs adicionales: `fromBranchId <> toBranchId`, cantidades válidas

**Enum `StockTransferStatus`:** SOLICITADA | BORRADOR | EN_TRANSITO | RECIBIDA | CANCELADA

**Máquina de estados:**
```
SOLICITADA (SELLER pull) ──autorizar──► BORRADOR ──despachar──► EN_TRANSITO ──recibir──► RECIBIDA
     ▲                        │
BORRADOR direct           CANCELADA
(MANAGER push)         (con reversa si venía de EN_TRANSITO)
```

**Roles (regla oro):** cualquier SELLER+ crea `SOLICITADA` con `toBranchId = su branch`; solo MANAGER+ADMIN transicionan BORRADOR/EN_TRANSITO/CANCELADA (excepto auto-cancelación del creador en SOLICITADA). Solo MANAGER+ADMIN del `toBranchId` reciben.

**APIs (`/api/transferencias/`):**
- `POST /` — crear (SELLER→SOLICITADA, MANAGER/ADMIN→BORRADOR con opción `enviarAhora`)
- `GET /` — lista paginada con scoping por rol, filtros `?status/?direccion/?desde/?hasta`
- `GET /[id]` — detalle con visibility check
- `PATCH /[id]` — editar items/notas (solo BORRADOR)
- `POST /[id]/autorizar` — SOLICITADA → BORRADOR|EN_TRANSITO (body: `despacharInmediato`)
- `POST /[id]/despachar` — BORRADOR → EN_TRANSITO
- `POST /[id]/recibir` — EN_TRANSITO → RECIBIDA (body: items con cantidadRecibida; enforce coverage completo)
- `POST /[id]/cancelar` — * → CANCELADA (motivo min 5 chars; reversa automática si venía de EN_TRANSITO)

**Contabilidad de inventario:**
- Despacho: `TRANSFER_OUT` + decrement Stock (variant/simple), Battery muta a destino con IN_TRANSIT, CustomerBike muta con su Battery asignada (INSTALLED se conserva)
- Recepción: `TRANSFER_IN` + upsert Stock destino. **NO genera ADJUSTMENT por recepción parcial** — la merma es visible en `cantidadEnviada > cantidadRecibida` y el neto contable ya está cubierto por `TRANSFER_OUT(n) + TRANSFER_IN(m)`. Battery→IN_STOCK; CustomerBike no-op.
- Reversa (cancelar EN_TRANSITO): `ADJUSTMENT` positivo en origen + restore Battery/CustomerBike a fromBranchId
- Invariante: todos los movimientos llevan `referenceId = transfer.id` para reconstrucción histórica

**Folio:** `TRF-{branchCode}-{seq4}` con seq único por fromBranchId.

**UI `/transferencias`:**
- Lista con tabs Solicitudes / Borradores / En tránsito / Historial, badges de count para acciones pendientes del usuario
- Detalle con timeline de eventos, tabla de items, barra de acciones sticky contextual por rol + estado
- Modal crear polimórfico (4 tipos), `useFieldArray` para items, fetch lazy de disponibles por branch
- Modales separados: autorizar (2 opciones), recibir (cantidades editables con warning de faltante), cancelar (motivo + warning reversa)
- Sidebar: ítem "Transferencias" con icono `ArrowLeftRight`, visible SELLER+MANAGER+ADMIN

### P12-A — Integración POS ✅ (2026-04-17)
**Modelo: Opus diseño → Sonnet implementación (CC-4 con advertencia pos-terminal.tsx)**

Cambios puramente aditivos a `pos-terminal.tsx`:
- Icon `ArrowLeftRight` en cada card (variants + simples) abre `RemoteStockPopover`
- Cuando `stockLocal === 0 && remoteStock.length > 0`: botón primario del card cambia a "Solicitar transferencia" con tono accent
- `RequestTransferDialog` crea siempre `SOLICITADA` desde el POS (SELLER pull hacia su branch)
- Warning no-bloqueante de duplicados vía `GET /api/transferencias/solicitudes-activas` (guard: `targetBranchId === session.branchId` excepto ADMIN; además el where de Prisma filtra por `toBranchId` — doble barrera)
- Query paralela en `page.tsx` del POS: `Stock` con `branchId: { not: session.branchId }`, filtrada por IDs visibles en el grid

**Scope explícitamente excluido:** baterías con serial y customer-bikes ensambladas NO se solicitan desde el POS (no existen como tiles en el grid y los casos de uso son raros). Para esos, `/transferencias` con modal 4-way.

**Zero cambios** en: `handleAddToCart`, `handleCheckout`, `handlePayment`, lógica de carrito, VIN selector, free-form items, tab switcher, búsqueda, comisiones.

### P12-C — Reportes cross-branch ✅ (2026-04-17)

Dos reportes de solo-lectura sobre la data ya modelada en P12-B. Sin schema nuevo, sin mutaciones.

**`/reportes/transferencias`** — transferencias por rango con filtros de status, sucursal origen/destino (ADMIN) y folio. KPIs: total en rango, en tránsito, recibidas, canceladas. Tabla paginada (50/página) con link al detalle. CSV exportable.

**`/reportes/transferencias/mermas`** — ítems con `cantidadRecibida < cantidadEnviada` en transferencias RECIBIDA. Vistas "detalle", "por producto" y "por sucursal" computadas client-side. Drill-down sin round-trip al servidor. CSV siempre en vista detalle completa.

Archivos creados:
- `src/lib/reportes/transferencias.ts` — `formatProducto`, `computeMermaUnidades`
- `src/app/(pos)/reportes/transferencias/page.tsx`
- `src/app/(pos)/reportes/transferencias/transferencias-report-client.tsx`
- `src/app/(pos)/reportes/transferencias/mermas/page.tsx`
- `src/app/(pos)/reportes/transferencias/mermas/mermas-report-client.tsx`
- `src/app/(pos)/sidebar.tsx` — entradas de navegación añadidas

---

## FASE P13 — Rediseño del módulo de Taller

**Estado:** A ✅ | B ✅ | C ✅ | Hotfix.1 ✅ | Hotfix.2 ✅ | Hotfix.3 ✅ | D ⏳ | E ⏳ | F ⏳ | G ⏳

Ver `docs/workshop-redesing/BRIEF.md` para las 8 decisiones cerradas
y el alcance completo. Las decisiones de Sub-fase A están documentadas
en `AGENTS.md §Decisiones clave`.

**Ajuste de scope (2026-04-22):** tras pruebas en vivo sobre A+B+C se detectaron
bugs críticos (fuga cross-branch, Decimal sin serializar, DnD a sub-estados,
wizard con validación laxa) y una lista de mejoras funcionales. Se inserta
**Sub-fase Hotfix** antes de D (ver más abajo). También se amplían los scopes
de D/E/F y se suma **Sub-fase G — Dashboard móvil del técnico** que estaba
en los mocks pero fuera del plan original.

### Sub-fase A — Schema y APIs ✅
Schema aditivo + migración `workshop_redesign_schema` + helpers en
`src/lib/workshop*.ts` + 7 endpoints nuevos + 5 modificados + backfill
idempotente. Sin UI.

### Sub-fase B — Kanban rediseñado ✅ Completo (2026-04-21, commit b687807)
Tablero con 7 columnas derivadas de `status + subStatus`. DnD con
transiciones validadas server-side. Chip de `type` y avatar de
`assignedTech`. Filtros URL-sync (técnico, antigüedad, mine, tipo).
Aging semántico por columna. S5 integrado: display `{modelo} · {V}V · {Ah}Ah`.
Bandeja lateral "Pausada". Responsive con acordeón móvil.
**Donde diseñar:** chat ligero (Sonnet) + Code.
**Subagentes:** no. **Sesiones estimadas:** 2.
**Riesgo:** alto (UI en uso diario).
- **Rediseño del Taller Sub-fase B (P13-B) — Decisiones de diseño (2026-04-21)** ✅ Implementado (2026-04-21, commit b687807)
  Diseño cerrado en chat con Opus. Todas las decisiones implementadas:
  ✅ (1) 7 columnas: PENDING · IN_PROGRESS sin sub · WAITING_PARTS · WAITING_APPROVAL
      · COMPLETED · DELIVERED (hoy, colapsada default) · CANCELLED (hoy, colapsada default).
  ✅ (2) Bandeja lateral "Pausada" separada de las 7, IN_PROGRESS + PAUSED.
  ✅ (3) Aging semántico por columna, no universal:
      PENDING 0-4h/4-24h/>24h · IN_PROGRESS vs updatedAt+48h proxy ·
      COMPLETED 0-1d/1-2d/>2d · PAUSED 0-1d/1-3d/>3d.
      (Nota: `fechaPromesa` no existe en schema — se usó `updatedAt+48h` como especificado en el fallback.)
  ✅ (4) Tarjeta: folio + aging / cliente / bikeInfo·V·Ah inline / chip tipo solo si ≠ PAID /
      separador tonal / avatar + técnico o `-- Sin asignar`. S5 liviano vive inline, no chip.
  ✅ (5) Filtros URL-sync: tech, aging, mine (TECHNICIAN-only), type multi-select.
      "Prioridad" del mock renombrada a "Antigüedad".
  ✅ (6) 8 phantoms del mock NO implementados: En Diagnóstico (status fake), URGENTE
      (redundante), FLOTILLA (sin flag B2B), barra progreso (sin dato), batería %
      (pendiente P13-C), Stock OK (S5 pesado en P13-D), ribbon PRE-PAG (requiere
      decisión arquitectónica en P13-E), Prioridad (renombrada).
  ✅ (7) Responsive fallback < md: acordeón vertical, DnD deshabilitado, filtros en sheet glassmorphism.
  ✅ (8) S5 parte pesada confirmada en P13-D (batteryAvailabilityMap al agregar ítems)
      y P13-E (assertPolicyActive al entregar). NO implementado en B.
- **Deuda arquitectónica identificada en P13-B (2026-04-21) → resuelta 2026-04-22 con opción (a)**
  Ribbon "Pre-pagado" en tarjetas del Kanban requiere saber si hay pre-pago antes de
  DELIVERED. Hoy `Sale` se crea solo al entregar, así que no hay dato. **Decisión:**
  opción (a) — agregar `ServiceOrder.prepaid Boolean @default(false) + prepaidAt DateTime? +
  prepaidAmount Decimal? @db.Decimal(10,2) + prepaidMethod PaymentMethod?` como schema
  aditivo en Sub-fase Hotfix (migración, sin UI) y consumir en D (ficha técnica) + E
  (pantalla de entrega, card "Ya pagado el X vía Y") + F (portal público "Pagado").
  Se descartan (b) por romper la invariante "Sale al entregar" (probada en Fase 4) y
  (c) por no atender el caso de negocio real (apartado con anticipo).


### Sub-fase C — Wizard de recepción ✅ Completo (2026-04-22)

- **C.1 — Capa de datos** (commit `4906e28`): schema con `checklist Json?`, `signatureData String?`, `signatureRejected Boolean @default(false)`, `photoUrls Json?`, `expectedDeliveryDate String?`. Constantes + tipos en `workshop-checklist.ts`/`workshop-types.ts`. Helper `getBranchMaintenanceServices` en `workshop-maintenance.ts`. Endpoint `GET /api/workshop/technicians`. Validaciones Zod en `POST /api/workshop/orders` (checklist exacto 10 ítems, coherencia firma, POLICY_MAINTENANCE exige `customerBikeId`, `photoUrls` max 5).

- **C.2 — UI del wizard** (commit `8e6edee`):
  - Tab "Recepción" entre Kanban y Mantenimientos en `layout.tsx`.
  - Server Component `recepcion/page.tsx` (`force-dynamic`): prefetch paralelo técnicos + servicios + mantenimientos; si `?customerBikeId=X`, prefetch de cliente + bici + estado P11.
  - Client wizard 4 pasos (archivos separados per React Compiler): `step-1-cliente` (búsqueda cliente debounced + selector bici + banner P11 con 3 ramas), `step-2-checklist` (10 ítems tri-state + `signature_pad` dynamic import), `step-3-fotos` (upload drag-drop, POST a `/api/workshop/drafts/photos`, thumbnails), `step-4-tipo` (4 cards tipo + técnico select + useFieldArray items + date + summary sticky + dialog glassmorphism).
  - Endpoint `POST /api/workshop/drafts/photos`: sharp → WebP q85 1920px, escribe a `public/workshop/drafts/{userId}-{uuid}.webp`.
  - Helpers `moveDraftToOrder` + `cleanupOrderPhotos` en `workshop-photos.ts`; move pre-transacción en `POST /api/workshop/orders` con `id: orderId` generado antes del `$transaction` y cleanup en catch.
  - Corrección validación `photoUrls` Zod: `/public/workshop/` → `/workshop/drafts/`.
  - APIs auxiliares: `GET /api/workshop/customers/search?q=` y `GET /api/workshop/bikes/[id]/maintenance-status`.

- **C.3 — Etiqueta imprimible + cierre** (commit `<hash>`):
  - `diagnosis` ahora opcional en `POST /api/workshop/orders` (`z.string().max(2000).optional().nullable()`) y en la UI del wizard — label y placeholder actualizados, validación client-side eliminada.
  - Ruta `/taller/etiqueta/[id]` (`src/app/taller/etiqueta/[id]/page.tsx`) — Server Component fuera de `(pos)/`: auth con `getServerSession`, filtro por `branchId` salvo ADMIN, QR generado server-side con `qrcode` (192×192, apunta a `/taller/public/{publicToken}`), light mode forzado via `.evobike-public-doc`, layout letter landscape, auto-print `setTimeout(300ms)`, botones "Imprimir"/"Cerrar" en `LabelActions` (Client Component, `.no-print`).
  - Submit del wizard: abre `/taller/etiqueta/{id}` en nueva ventana antes del `router.push`; fallback toast con botón si popup blocker cancela.
  - Botón "Imprimir etiqueta" en ficha técnica (`/workshop/[id]/page.tsx`) — link `<a target="_blank">` junto al folio.
  - Commit: `b15b97d`.

- **Deudas cerradas en C.3:** `diagnosis` optional ✅, etiqueta imprimible ✅.
- **Deudas abiertas identificadas 2026-04-22 (tras pruebas en vivo) → atacar en Sub-fase Hotfix:**
  - **Validación por paso en el wizard:** hoy "Siguiente" avanza aunque el paso no esté completo. Fix: schemas Zod parciales `step1Schema`/`step2Schema`/`step3Schema`/`step4Schema` + `form.trigger([...])` antes de avanzar.
  - **Cliente nuevo desde el wizard:** el combobox solo permite seleccionar existente — no hay modal de creación. Reutilizar el modal "Nuevo cliente" del POS (extraer a `src/components/customers/customer-create-dialog.tsx` si hace falta), CTA "+ Nuevo cliente" en el combobox cuando no hay match, auto-selección post-create.
  - **Selector de bici Evobike vs. otra marca:** hoy lista libre sin distinguir. Dos modos: (1) Bici Evobike existente del cliente, (2) Agregar nueva con toggle Evobike (selector catálogo S2 + V·Ah + color + **VIN obligatorio**) / Otra marca (marca+modelo texto libre, VIN opcional).
  - **Firma no renderiza:** el canvas `signature_pad` no muestra trazo al firmar. Investigar causas típicas (dimensiones del canvas sin DPR, color trazo igual a fondo en dark, `toDataURL` no persistiéndose en `signatureData`) antes de parchear.
  - **Modo express del wizard (diferido a D o Fase 6):** para `type=COURTESY` o importe estimado bajo, los pasos 2 (checklist 10 ítems + firma) y 3 (fotos) son fricción innecesaria. Permitir bypass con toggle "Saltar evidencia" que exija nota de motivo. No entra en Hotfix — requiere decisión de política (¿qué umbral de importe? ¿permitir a SELLER o solo MANAGER?).
- **Deuda abierta → Fase 6:**
  - `Branch.ivaPct` no modelado — IVA hardcodeado a 16% en `step-4-tipo.tsx`. Ver tech-debt en FASE 6.

### Sub-fase Hotfix — Bugs críticos + wizard + audit DESIGN.md (pre-D)

**Justificación (2026-04-22):** pruebas en vivo sobre A+B+C revelaron bugs que
bloquean producción y deuda cosmética acumulada contra `DESIGN.md`. Arrancar D
sin cerrar esto garantiza que el patrón roto (p. ej. fuga cross-branch) se
replique en la ficha técnica. Tres sub-sesiones Sonnet; 2-3 días totales.

**Donde diseñar:** chat con Sonnet + Code (son fixes, no diseño nuevo).
**Subagentes:** sí — 1 para audit DESIGN.md en paralelo. **Riesgo:** medio
(cross-branch es incidente de seguridad — ver §Hotfix.1).

#### Hotfix.1 — Críticos ✅ Completo (2026-04-22)

**Alcance ejecutado** (commits `dfe9049` + `18e6eee` + `fdefb5f` + `26518ab`):

1. **🔴 Fuga cross-branch — RESUELTO.** Nuevo helper canónico
   `src/lib/branch-scope.ts#operationalBranchWhere` + `resolveOperationalBranchId`.
   ADMIN honra la cookie `admin_branch_id` del topbar (ya escrita por
   `BranchSwitcher` via Server Action `switchAdminBranch`); fallback a
   `session.branchId`. NUNCA devuelve `{}` — no hay vista global cross-branch
   en operativos. `branchWhere` de `/reportes/*` se mantiene intacto y se
   re-exporta desde el root. Dashboard `manager-dashboard.tsx` sincroniza la
   cookie al cambiar de branch (llama `switchAdminBranch`). Pages migradas:
   `/workshop`, `/workshop/[id]` (+ ownership gate contra fuga por URL),
   `/workshop/recepcion`, `/workshop/mantenimientos`. Endpoints migrados:
   `workshop/orders` POST, `orders/[id]/status`, `orders/[id]/items` POST+DELETE
   (el DELETE no tenía ownership check — bug aparte), `deliver`, `customers/search`,
   `technicians`, `bikes/[id]/maintenance-status` (nuevo ownership gate por
   `bike.branchId` — otra fuga aparte), `service-orders/[id]/{sub-status,qa,
   approvals,cancel,charge}`, `approvals/[approvalId]/respond`. Excepción:
   `/api/workshop/drafts/photos` no aplica scope (files per-user).

2. **Schema aditivo prepaid — RESUELTO.** Migración
   `20260422071027_add_prepaid_tracking_fields` aplicada: `prepaidAt DateTime?`,
   `prepaidAmount Decimal?`, `prepaidMethod PaymentMethod?`. Sin UI, sin endpoints.
   Órdenes existentes con `prepaid=true` quedan con NULL en los 3 campos nuevos.

3. **Cleanup post-Hotfix (commit `fdefb5f`):**
   - `/api/workshop/deliver` alineado con `operationalBranchWhere` (antes era
     excepción JWT-only; ambos endpoints de cobro ahora se comportan igual —
     ver decisión 2026-04-22 más abajo).
   - `mantenimientos-table.tsx` sin dropdown "Sucursal" para ADMIN: el servidor
     ya filtra por branch efectivo, el selector cliente-side no filtraba nada.
     Se quitaron también columna "Sucursal", props `role`/`branches`/
     `scopedBranchId` y el pre-fetch de sucursales en la page.

4. **Decisión de política (2026-04-22)** — **charge y deliver ambos aceptan
   override cookie.** Se evaluó tratar `deliver` como excepción JWT-only
   (caja atada al user autenticado), pero se descartó: la caja es por branch,
   no por user. Mantener la excepción bloqueaba a ADMIN en cookie=LEO de
   entregar órdenes LEO con caja LEO abierta por otro usuario. Ambos endpoints
   creaban `CashTransaction` y exigían caja — era inconsistente.

5. **Extras identificados durante la auditoría** (cerrados en el mismo ciclo):
   - `DELETE /api/workshop/orders/[id]/items` no tenía ownership check
     (cualquier sesión autenticada podía borrar ítems cross-branch). Agregado.
   - `GET /api/workshop/bikes/[id]/maintenance-status` no verificaba
     `bike.branchId` (fuga de estado de mantenimiento). Agregado gate.

**Pendientes del scope original que migran a Hotfix.2:**
- 🔴 **Decimal serialization en `/workshop/[id]`** — `customer.creditLimit` y
  `customer.balance` siguen cruzando Server → Client sin convertir. Error en
  consola confirmado 2026-04-22: `Only plain objects can be passed to Client
  Components from Server Components. Decimal objects are not supported.` Fix
  planeado: `src/lib/serialize/customer.ts` con `serializeCustomer(c)` +
  reemplazar en `page.tsx:98` + grep preventivo de `customer={` en props
  server→client. **No bloqueó Hotfix.1** porque la ficha carga visualmente,
  sólo spamea la consola.
- 🔴 **DnD a WAITING_PARTS / WAITING_APPROVAL → "error de red"** — raíz
  identificada: `workshop-board.tsx:482` llama `/api/service-orders/[id]/sub-status`
  con `PATCH`, pero el endpoint exporta `POST`. Fix: cambiar el verbo HTTP en
  el cliente (una línea). No se aplicó en Hotfix.1 por ser fuera del prompt
  del commit de seguridad.

**Infra pendiente (una sola vez, local):** `npx prisma generate` falló con
`EPERM` por DLL lockeado. Cerrar todos los `node.exe` (VS Code TS server,
dev server) y correr manualmente. ✅ resuelto antes de Hotfix.2.

#### Hotfix.2 ✅ — Wizard de recepción + Decimal + DnD (2026-04-22)

7 commits en `main`: `7a6f144` DnD verb · `82298c4` Decimal select ·
`ad9245f` firma · `638ba43` Zod partido · `fc709c4` extracción
customer-create-form/dialog · `2c12da3` CTA crear cliente desde wizard ·
`4bb4a52` selector Evobike/VIN + creación atómica de bici.

**Entregado:**

1. **Validación por paso (✅ commit `638ba43`):** `step1Schema` /
   `step2Schema` / `step3Schema` / `step4Schema` más `stepSchemas` y un
   `safeParse` en `handleNext`. Errores por campo vía `form.setError`;
   banner `step2Error` para los cross-field de checklist/firma.
   `wizardSchema` queda laxo (resolver no se queja mid-edit); el servidor
   sigue siendo la validación autoritativa. `form.trigger` quedó
   innecesario porque `safeParse` sobre schemas dedicados cubre ambos
   casos.

2. **Cliente nuevo desde combobox (✅ commits `fc709c4` + `2c12da3`):**
   - `src/components/customers/customer-create-form.tsx` (form body
     reusable con `formId` para submit externo y `onSavingChange`).
   - `src/components/customers/customer-create-dialog.tsx` (Dialog
     wrapper standalone con header/footer propios).
   - El selector del POS (`customer-selector-modal.tsx`) ahora consume
     `CustomerCreateForm` y re-exporta `CustomerOption` para no romper
     `pos-terminal`, `cotizaciones/*`, etc.
   - Step1 del wizard muestra CTA "+ Nuevo cliente con nombre '{query}'"
     cuando query≥2 sin resultados; abre el dialog con `defaultName=query`
     y auto-selecciona el cliente creado.

3. **Selector bici Evobike / otra marca + creación atómica (✅ commit
   `4bb4a52`):**
   - Segmented control en Step1 cuando no hay bici registrada. Evobike
     exige VIN; Otra marca exige marca y VIN opcional.
   - Payload `newBike { brand, model, color, serialNumber }`.
     `bikeInfo` queda opcional y no se envía cuando viaja `newBike` o
     hay `customerBikeId` — la ficha arma el texto desde la relación.
   - Servidor: `newBikeSchema` con superRefine (VIN requerido si
     brand=Evobike case-insensitive) + top-level superRefine que exige
     uno de `{customerBikeId, newBike, bikeInfo}`. `CustomerBike` se
     crea dentro del mismo `prisma.$transaction` que la orden, por lo
     que una falla posterior rollbackea la bici.
   - `service-order-details.tsx` gana fallback de brand/model/color/VIN
     para cubrir el caso Otra marca sin VIN.

4. **Firma render (✅ commit `ad9245f`):**
   - `penColor` ya no usa `var()` literal (el canvas no lo interpretaba,
     caía a `#131b2e` invisible en dark). Ahora lee el valor computado
     de `--on-surf` al mount y un `MutationObserver` sobre `<html>`
     repinta al toggle `.dark` (next-themes con `attribute="class"`).
   - Nuevo prop `value` → `fromDataURL` en mount/resize. Ir al paso 3 y
     volver al 2 ya no borra la firma; rotar el tablet tampoco.

5. **Decimal serialization (✅ commit `82298c4`):** decisión final
   **opción C** (en vez de helper `serializeCustomer`): restringir el
   `include` de Prisma a `{ customer: { select: { name, phone } } }`.
   Elimina el Decimal en origen y no deja superficie para que el bug
   regrese vía futuros `customer={order.customer}`.

6. **DnD verb mismatch (✅ commit `7a6f144`):** `workshop-board.tsx:482`
   `PATCH → POST` para `/api/service-orders/[id]/sub-status`. One-liner.

**Deuda nombrada en el commit `4bb4a52` — resolver en Hotfix.3 o D:**
`src/app/(pos)/workshop/new-order-dialog.tsx` sigue armando el
`bikeInfo` con el formato viejo y sigue siendo el flujo "+ Nueva Orden"
alterno al wizard. Candidato natural para consolidar con el wizard, y
además se alinea con el bug cosmético del doble botón "+ Nueva Orden"
del §Hotfix.3. Verificar al migrarlo que el payload envíe
`newBike` (o bien `bikeInfo` con `min(1)` client-side, porque el
servidor ahora lo acepta opcional).

#### Hotfix.3 ✅ — Audit DESIGN.md `/workshop` (2026-04-22)

4 commits secuenciales: `724e1e5` consolidar "+ Nueva Orden" →
`fe0fb25` "Volver al Tablero" → `527a1da` `--err`→`--ter` en wizard
→ `dbe08e1` `var(--shadow)` en OrderCard.

**Entregado:**
- Eliminado `src/app/(pos)/workshop/new-order-dialog.tsx` y migrado el
  caller en `customers/[id]/page.tsx` a `Link` con deeplink
  `/workshop/recepcion?customerBikeId=X` (el wizard ya soporta prefill
  server-side en `recepcion/page.tsx:39-129`). CTA único en el Kanban
  (`workshop-board.tsx:761`) con Velocity Gradient.
- `[id]/page.tsx:138` "Volver al Tablero": `text-slate-500/900` →
  `text-[var(--on-surf-var)] hover:text-[var(--on-surf)]`.
- Wizard: reemplazado `var(--err)` (token inexistente) por `var(--ter)`
  en `step-1-cliente.tsx` (chip del MaintenanceBanner + 3 errores
  inline), `step-2-checklist.tsx` (STATE_OPTIONS FAIL + botón rechazar +
  banner step2Error) y `step-4-tipo.tsx:325` (error de diagnosis).
  Fallbacks `#d32f2f`, `rgba(211,47,47,...)`, `rgba(245,124,0,...)`,
  `rgba(46,204,113,...)` → `color-mix(in srgb, var(--ter|--warn|--p-bright) X%, transparent)`.
- `workshop-board.tsx:266` OrderCard: `rgba(19,27,46,0.06)` → `var(--shadow)`
  (dark mode cambia automáticamente a `rgba(0,0,0,0.4)`).

**Checklist DESIGN.md — estado final:**
- Regla No-Line: ✅ limpia (divisores con tinta al 6% vía color-mix).
- Glassmorphism mobile filter sheet: ✅ patrón oficial.
- Tipografía display/body KPIs/board/detalles: ✅ respetada.

**Deudas diferidas (fuera de scope Hotfix):**
1. **Densidad de KPIs** — `--density-{card,row,cell-y}` existen
   (`globals.css:108-144`) pero `workshop-kpis.tsx` usa `p-5` igual que
   ventas/cotizaciones/reportes. Tokenizar solo taller crearía
   inconsistencia; tokenizar todos es scope de **D** o Fase 6.
2. **Glassmorphism en `DialogContent` base** — `src/components/ui/dialog.tsx:64`
   usa `bg-background border shadow-lg`, sin `color-mix + blur(20px)`.
   Fix centralizado de alto blast radius (POS, cotizaciones,
   autorizaciones, formularios). Abrir como item independiente.
3. **`var(--err)` fuera de taller** — 6 hits restantes en
   `reportes/compras-proveedor-client.tsx` (3, incluye `--err-container`)
   y `configuracion/catalogo/tab-baterias.tsx` (3). Reemplazar cuando
   esos módulos se aborden visualmente.

**Cambio intencional de UX:** clic en "+ Nueva Orden" desde ficha de
cliente ya no abre modal — navega al wizard con prefill de bici. El
modal era compromiso del scope inicial; el wizard es estrictamente
superior (crea cliente/bici al vuelo, checklist, fotos, firma, semáforo
de mantenimiento, Zod por paso).

**Deuda menor anotada:** el wizard solo soporta prefill por
`customerBikeId`, no por `customerId`. Si entras a `customers/[id]` sin
query param, navegas a recepción sin cliente pre-seleccionado. Extender
wizard con `?customerId=X` → diferir a D.

---

#### Hotfix.3 — spec original (referencia histórica)

**Alcance:** **TODAS** las pantallas del módulo de taller ya implementadas
(`/workshop`, `/workshop/[id]`, `/workshop/recepcion`, `/workshop/mantenimientos`
y el detalle de orden). Foco explícito en **tipografía** — detectadas
inconsistencias donde letras no aplican Inter/Space Grotesk según `DESIGN.md`.

**Checklist obligatorio (por pantalla):**
- **Tipografía:** toda clase `font-*` y `text-*` aplicada respeta la jerarquía
  de `DESIGN.md §Tipografía` (display / heading / body / caption / number).
  Cero `font-family` hardcoded; cero `font-sans` genérico donde el token
  especifica Space Grotesk (números/KPIs/folios).
- **Colores:** cero literales (`text-[#...]`, `bg-[#...]`, `rgba(...)`). Todo
  vía tokens (`--surf-*`, `--on-surf-*`, `--primary-*`, `--ter-*`,
  `--ghost-border`). Verificar light+dark mode para cada estado.
- **Regla No-Line:** separación tonal por surface, nunca `border-b` sólido
  (excepción: headers de tabla con `--ghost-border`).
- **Glassmorphism oficial** en modales/drawers:
  `color-mix(in srgb, var(--surf-bright) 88%, transparent)` + `blur(20px)`.
- **Bugs cosméticos específicos identificados:**
  - "Volver al Tablero" usa color hardcoded / inadecuado en dark mode.
  - Dos botones "+ Nueva Orden" en el Kanban (header + filtros) lanzan flujos
    distintos. Consolidar a uno → `/workshop/recepcion` y eliminar el legacy.
  - **[Deuda Hotfix.2]** `src/app/(pos)/workshop/new-order-dialog.tsx` sigue
    armando `bikeInfo` con el formato viejo (ver líneas ~88 y ~164) y sigue
    siendo el flujo legacy de "+ Nueva Orden". Tras Hotfix.2 el servidor
    acepta `bikeInfo` opcional; conviene o migrar el dialog al payload
    `newBike` (alineándolo con el wizard) o eliminarlo al consolidar los
    dos botones "+ Nueva Orden" en el Kanban, lo que cierre primero.
- **Tokens de densidad** (`density-{compact,normal,comfortable}`) aplicados en
  KPIs y cards (definidos en reportes, pendientes en taller).
- **Responsive:** móvil funcional en ficha y Kanban (DnD deshabilitado en <md
  ya implementado en B — validar no romper con los fixes).

**Delegar a subagente Explore** para levantar la lista de violaciones por
archivo; main thread aplica fixes según prioridad y token correcto.

#### Schema aditivo dentro de Hotfix

Agregar en la migración del Hotfix.1 (resuelve la deuda del ribbon pre-pago):

```prisma
model ServiceOrder {
  // ... campos existentes
  prepaid        Boolean        @default(false)
  prepaidAt      DateTime?
  prepaidAmount  Decimal?       @db.Decimal(10, 2)
  prepaidMethod  PaymentMethod?
}
```

Sin UI ni lógica en Hotfix (eso vive en D+E). Sólo schema para desbloquear D.

---

### Sub-fase D — Ficha técnica + drawer de aprobación
Rediseño de ficha existente + componente nuevo de aprobación con cálculo
en vivo, disparador de WhatsApp y lógica de `subStatus`. Gate del botón
"Marcar entregada" por `qaPassedAt != null` salvo `COURTESY`. Sección QA
solo visible con `status = COMPLETED`.

**Scope ampliado 2026-04-22:**
- **QA second-checker opcional:** agregar `Branch.requireQaSecondChecker Boolean @default(false)`.
  Cuando está en `true`, validar que `qaPassedByUserId != servicedByUserId` al
  transicionar a DELIVERED (422 si falla). Permite talleres 1-2 técnicos con
  self-check y fuerza segundo validador donde haya plantilla suficiente.
- **Chip disponibilidad stock con SWR revalidate:** el 🟢/🟡/🔴 al agregar
  ítem se revalida cada 30s mientras la ficha esté abierta (no reserva stock
  — regla Fase 4 intacta). Evita mentir al técnico si otra orden compra la
  última pieza mientras él trabaja.
- **`expiresAt` en `ServiceOrderApproval`:** `DateTime @default(now() + 48h)`
  (interval hardcoded por ahora; si hace falta configurable, `Branch.
  approvalTtlHours Int? @default(48)` diferido). Cron o lazy-check al abrir la
  ficha marca aprobaciones vencidas como `REJECTED` y libera subStatus.
- **Consumir `ServiceOrder.prepaid` del Hotfix:** mostrar en header de la
  ficha si la orden fue pre-pagada (lectura, sin permitir editar — eso vive
  en E).

**Donde diseñar:** chat con **Opus** (lógica de negocio entrelazada) + Code.
**Subagentes:** sí — 1 para el drawer standalone, main para ficha.
**Sesiones estimadas:** 2-3. **Riesgo:** alto.

### Sub-fase E — Pantalla de entrega + PDFs
UI que oculta panel de cobro cuando `type ∈ {WARRANTY, COURTESY,
POLICY_MAINTENANCE}`. PDF de comprobante con leyenda según `type`.

**Scope ampliado 2026-04-22:**
- **`Sale.excludeFromRevenue Boolean @default(false)` aditivo:** al generar
  `Sale(total=0, type=SERVICE)` para `POLICY_MAINTENANCE`, marcar
  `excludeFromRevenue=true`. Los reportes de ventas filtran por esta flag en
  vez de usar filtros ad-hoc por tipo. Migración con backfill:
  `UPDATE "Sale" SET "excludeFromRevenue" = true WHERE "total" = 0`
  (aproximación: tickets con total cero no cuentan para ingreso).
- **UI de ribbon pre-pagado:** consumir `ServiceOrder.prepaid/prepaidAt/
  prepaidAmount/prepaidMethod` del Hotfix. Panel derecho muestra card
  `--secondary-container` "Ya pagado el {date} vía {method} por ${amount}"
  sin selector de cobro. Al `DELIVERED`, la lógica server-side sabe que no
  debe crear nueva `CashTransaction` (ya existe la del pre-pago) y genera
  `Sale(prepaid=true)` como hoy.

**Donde diseñar:** chat (estructura PDF) + Code. **Subagentes:** sí si
son plantillas separadas por tipo; no si es una con leyenda dinámica
(cerrar esto en el chat de diseño). **Sesiones estimadas:** 2.

### Sub-fase F — Portal público
Página `/taller/public/[token]` fuera de `(pos)/`, mobile-first, light
mode forzado. Consume endpoints públicos ya creados en Sub-fase A.

**Scope ampliado 2026-04-22:** mostrar chip "Pagado el {date}" en el header
cuando `ServiceOrder.prepaid = true` (lectura del campo aditivo del Hotfix).
Consumir `ServiceOrderApproval.expiresAt` (de D) para mostrar contador
regresivo "Esta solicitud expira en Xh" en la card de aprobación pendiente.

**Donde diseñar:** chat (layout + UX) + Code. **Subagentes:** no.
**Sesiones estimadas:** 1-2. **Riesgo:** bajo.

### Sub-fase G — Dashboard móvil del técnico (aditivo, 2026-04-22)

Identificado como hueco durante diseño: los mocks incluyen
`dashboard_del_t_cnico_mobile_2/` pero no estaba en las sub-fases A-F. En piso,
un técnico usa el celular — hoy solo tiene el Kanban desktop responsive en
acordeón. Scope mínimo v1:

- Ruta `/workshop/mobile` (o reuso del Kanban con breakpoint específico,
  decidir al implementar).
- Lectura: órdenes asignadas a `assignedTechId = session.user.id` en estado
  activo (PENDING + IN_PROGRESS + subStatus activos), agrupadas por status.
- Acciones mínimas: tomar orden sin asignar (si está en su sucursal),
  soltar orden asignada a sí mismo, cambiar subStatus (WAITING_PARTS /
  WAITING_APPROVAL / PAUSED) sin DnD — botones tap-friendly.
- Sin ficha técnica completa en móvil (eso se abre como deeplink al desktop
  si hace falta).

**Vista de ocupación del gerente (mock `vista_de_ocupaci_n_del_gerente_2/`)**
se difiere a Fase 6 — no es crítica para el piloto y depende de métricas de
productividad que maduran con uso real.

**Donde diseñar:** chat ligero (Sonnet) + Code. **Subagentes:** no.
**Sesiones estimadas:** 1-2. **Riesgo:** bajo. **Depende de:** A, B, Hotfix.

### Testing de P13 completo
Se integra al scope de Fase 6 (hardening de producción). Tests por flujo
con subagentes: recepción, aprobación interna, aprobación pública,
entrega con cada `type`, QA gating.

---

## FASE S — Expansión catálogo canónico de baterías (18 configs V×Ah)

Decisión tomada 2026-04-18. El catálogo real de Evobike tiene 18 configuraciones V+Ah de batería y ~48 modelos en 7 categorías — el schema anterior solo manejaba `(Modelo, Color, Voltaje)` sin eje de capacidad (Ah). Plan original en `memoria/project_battery_catalog_expansion.md`.

### S1 — Schema aditivo + seed canónico ✅ (2026-04-19, commit `6cc3e8c`)
Eje `Capacidad` (Ah) en `ProductVariant` (nullable); `@@unique` ampliado a 4 campos. `Modelo.categoria` nullable + `ModeloCategoria` con BASE/PLUS/CARGA_PESADA (BICICLETA deprecated). Seed: 12 capacidades, 1 modelo `BATERIA EVOBIKE` con 18 variants, 51 modelos vehículo categorizados, 87 `BatteryConfiguration`. Rename legacy `ECLIPSE → ECLIPCE`. Modelos nuevos: NUBE, CIELO, SCOOTER S7, RYDER PRO, EVOTANK 160/180 HIBRIDO.

### S1-followup — Fix seed de variants y configs faltantes ✅ (2026-04-19, commit `fbe73a2`)
39 variants nuevos en `modelo_configuracion.csv` para los 6 modelos recién creados; fix de `voltaje_id=N/A` en SCOOTER M1-S6 y JUGUETE (EVOKID/FOXY/CROSS KID → 24V; RICOCHET/PHYTON/M3/M4/M5 → 36V; M1/M2/S6 → 48V). AGUILA (60V+72V) y FAMILY (48V+60V) agregados a `BATTERY_ROWS`. `prisma.productVariant.upsert` ahora actualiza `modelo/color/voltaje` (antes solo precio). Resultado: 494 variants activos, 91 BatteryConfigurations, 0 gaps. Utilidad `scripts/check_gaps.mjs` para validar.

### S2 — UI catálogo con matriz V×Ah + modelos por categoría ✅ (2026-04-19, commit `fc08de2`)
Tab Modelos: chips por 7 categorías + agrupación visual; dialog oculta select de esBateria. Tab Baterías nuevo: matriz 5V × 12Ah con celdas precio+stock; endpoint dedicado `/api/configuracion/baterias`. Tab Config. Baterías: selector filtrado por voltaje + label `{V}V · {Ah}Ah · {SKU}`; API valida match voltaje batería vs. config. Tab Variantes filtra baterías (solo vehículos).

### S3 — Recepción acoplada vehículo+batería ✅ (2026-04-19, commits `45be6fd` + `35d78d6`)
Schema: `AssemblyOrder.batteryConfigurationId` + `Battery.assemblyOrderId` (ambos FK nullable). API recepción resuelve `BatteryConfiguration` por `(modeloId, voltajeId, capacidadId)`, crea `AssemblyOrder PENDING` con reserva de lote de baterías; soporta "batería llega después" que difiere la reserva. UI form: panel "Acoplamiento batería por unidad" aparece cuando la variante tiene configs; selector V·Ah·SKU cuando hay >1 config; checkbox "llega después" por línea. API assembly: `available-batteries` respeta config reservada; `cancel` revierte reserva. Cierra deuda de Fase 2H-D. **Fix `35d78d6`:** ScrollArea de Radix sustituido por `overflow-y-auto` nativo (no propagaba altura con contenido dinámico).

**Deuda diferida en S3 (aterrizar con rediseño de Inventario — Paso 2 módulo 6):**
- Validación UI completa end-to-end pausada por rediseño pendiente del módulo. Pruebas parciales: Caso A (1 config) funcional; Casos B (multi-Ah), C (llega después) y D (cancelación libera reserva) sin validar en navegador.
- La UI actual del form de recepción funciona pero está destinada a rediseño — evitar seguir parchando cosméticos.

### S4 — POS: selector de config al vender ⏸️ (aterrizar con rediseño del POS Terminal — Paso 2 módulo 11)
Cuando el vendedor cierra venta de un modelo con >1 config (ej. EVOTANK 180 72V → 45Ah o 52Ah), hoy el sistema asigna la primera arbitrariamente. Scope:
- UI del POS: selector inline de `BatteryConfiguration` cuando el variant tiene >1 config para su voltaje.
- Schema: ampliar `VoltageChangeLog` a "cambio de config completa" (V+Ah) para trazar cambios pre-venta.
- API de venta: validar que la config elegida corresponda al variant vendido.

**Por qué se pospone:** el POS Terminal es el último módulo del rediseño (riesgo máximo de regresión). Meter el selector antes implica reescribir UI dos veces.

### S5 — Taller: Kanban por capacidad de batería ⏸️ (aterrizar con rediseño de Taller — Paso 2 módulo 4 / P13 Sub-fase B)
Hoy el chip Kanban agrupa por `(modelo, voltaje)`. Con S1, dos EVOTANK 72V con baterías distintas (45Ah vs 52Ah) se ven idénticos — el técnico no sabe cuál montar. Scope:
- Ampliar key del chip a `(modeloId, voltajeId, capacidadId)`.
- Actualizar `assertPolicyActive` (validación de stock de batería específica) y `batteryAvailabilityMap`.
- Filtrado/agrupación en UI Kanban.

**Por qué se pospone:** P13 Sub-fase B (rediseño del Kanban) ya está planeado y va a reescribir la UI del tablero completo. S5 se integra como parte del rediseño, no como parche aparte.

---

## PRE-FASE 6 — Orden de trabajo acordado

Decisión tomada 2026-04-17. El orden correcto antes de entrar a Fase 6 es:

**Paso 1 — Fix timezone global ✅ (2026-04-17)**
Resolvimos ANTES del rediseño UI para no reverificar datos dos veces.
- `parseLocalDate` exportado desde `src/lib/reportes/date-range.ts`
- 7 archivos migrados a `parseLocalDate(param, false/true)`: `src/app/(pos)/ventas/page.tsx`, `src/app/api/reportes/caja/route.ts`, `src/app/(pos)/reportes/caja/page.tsx`, `src/app/(pos)/reportes/comisiones/page.tsx`, `src/app/(pos)/reportes/caja/historial/page.tsx`, `src/app/api/tesoreria/summary/route.ts`, `src/app/(pos)/autorizaciones/page.tsx`
- `npm run build` y `npx eslint src/` limpios (un warning pre-existente en `/reportes/rentabilidad/page.tsx` sin relación)

**Paso 1.5 — Fix `fechaVencimiento` de PurchaseReceipt ✅ (2026-04-17)**
Cerrado con la **opción (a)**: `fechaVencimiento` migrado de `DateTime?` a `String?` ("YYYY-MM-DD") — fecha calendario sin tz. El bug original era de persistencia: input local + `z.coerce.date()` guardaba UTC medianoche que en `America/Merida (UTC-6)` retrocedía un día al leerse como local.
- Migración `20260417200000_fecha_vencimiento_to_string/migration.sql` con cast `TO_CHAR(... AT TIME ZONE 'UTC', 'YYYY-MM-DD')` para preservar el día original capturado
- Schema: `fechaVencimiento String?` (índice B-tree sigue válido; lex order en YYYY-MM-DD = cronológico)
- POST `/api/inventory/receipts`: `z.coerce.date()` → `z.string().regex(/^\d{4}-\d{2}-\d{2}$/)`
- Filtros `vencimientoDesde`/`vencimientoHasta`: comparación directa de strings, sin `new Date()`
- Lecturas (`/reportes/compras-proveedor`): `todayYMD = toDateString(new Date())` y comparaciones de string; `proximoVencimiento` ahora es `string | null`
- Parsers de display (`recepcion-detail.tsx`, `recepciones-list.tsx`, `receipt-status-badge.tsx`, `compras-proveedor-client.tsx`): `formatDate`/`daysUntil`/`vencBadge` usan `parseLocalDate(value, false) ?? new Date(value)` para aceptar tanto YYYY-MM-DD (sin tz) como ISO datetime (`createdAt`, `fechaPago`, `receivedAt`)
- `seed-transactional.ts` emite `toYMD(...)` en vez de `new Date(...)`
- `npm run build` y `npx eslint src/` limpios

**Paso 2 — Rediseño UI (múltiples sesiones Sonnet)**
Consultar `DESIGN.md` antes de cada sesión.
La deuda de ghost-border Parte 2 (47 instancias) se resuelve naturalmente módulo a módulo durante este paso, no requiere sesión separada.

Orden de módulos (shell → adentro, riesgo ascendente):
1. Layout shell: `(pos)/layout.tsx` + `sidebar.tsx`
   - **Sub-sesión 1-A ✅ (2026-04-17)** — CSS-puro + a11y. Topbar plano `var(--surf-bright)` sin border ni blur (No-Line rule); eliminados botones huérfanos del topbar (Search decorativo, Bell sin handler, Settings ruta inexistente, Help sin handler); iconos: Cog→Bike (Montaje), ArchiveRestore→BookmarkCheck (Pedidos); skip link "Saltar al contenido" + `id="main-content"`; `aria-current="page"` en sidebar links activos; `data-shell` attrs + `@media print` (oculta shell) y `prefers-reduced-motion` (cancela transiciones sidebar); ghost-border hardcoded del submenú Reportes eliminado (Opción 3 — sin sustituto). **No se commiteó cambio funcional**: bell/notifications/feed se diseñan en 1-B.
   - **Sub-sesión 1-B ✅ (2026-04-17) — UX del shell** — entregada en dos pasos: (Paso 1) `next/font/google` Inter + Space Grotesk cargados en `src/app/layout.tsx` con CSS vars (deuda detectada: self-hostear, ver Fase 6:913); consolidación de `formatRelative` en `src/lib/format-relative.ts` consumido por `notifications/feed/route.ts` y `tesoreria/saldos-cards.tsx`; (Paso 2, commit `40133d3`) feed real de notificaciones en topbar (`NotificationBell` + `GET /api/notifications/feed`), `OrphanedSessionBanner` arriba del topbar, `CashSessionManager` fuera de `<main>` renderizando en portal, sub-agrupar Reportes (Ventas/Inventario/Operación/Ejecutivo), labels de sección (Operación/Gestión/Admin), `UserMenu` con signOut. **Chore de cierre (commits `99437dc` y `e3da95c`):** `SessionUser` extraído a `src/lib/auth-types.ts`, `roleLabel` a `src/lib/auth-labels.ts`; resolver dinámico de breadcrumb agrega `StockTransfer.folio` (`/transferencias/[id]`); sidebar item "Inicio" usa icono `Home` (alineado con primer crumb). Deuda 1-B remanente: SessionUser inline en 110+ archivos (ver Fase 6). Conteo de Velocity Gradient resuelto en Sesión 4 (límite subido a 3 instancias por vista).
   - **Sub-sesión 1-C ✅ (2026-04-17) — Command Palette (Cmd+K / Ctrl K)** — trigger centrado en topbar entre chip BRANCH y campanita; atajo global con `navigator.platform.includes('Mac')` resuelto vía `useSyncExternalStore` (SSR-safe). Endpoint `GET /api/search` (`src/app/api/search/route.ts`) unifica 8 entidades: Customer, ServiceOrder, Sale, Producto (merge `ProductVariant` + `SimpleProduct`), Quotation, PurchaseReceipt, OperationalExpense, AuthorizationRequest (últimos 30 días, solo MANAGER/ADMIN). Patrón híbrido: raw SQL `$queryRaw` con `LOWER(unaccent(col))` para matching + ranking (score 0=exact, 1=starts-with, 2=contains) y `COUNT(*) OVER()` para `hasMore`; Prisma ORM para hidratación type-safe. Filtro por `branchId` via fragmentos `Prisma.sql` condicionales (ADMIN → `Prisma.empty`); `Customer` y productos son globales (sin `branchId`). Migración `20260418015524_enable_unaccent_extension` agrega `CREATE EXTENSION IF NOT EXISTS unaccent`. Cliente (`src/app/(pos)/command-palette.tsx`) usa `cmdk` primitive con `shouldFilter={false}` para no doble-filtrar los resultados server-side; debounce 200ms + `AbortController`; glassmorphism oficial (`color-mix in srgb var(--surf-bright) 88% transparent` + `blur(20px)`) y `z-[100]`. Apertura desde el trigger vía `window.dispatchEvent(new CustomEvent('command-palette:open'))` (cero provider extra). Default state muestra "Acciones" (Nueva venta → `/point-of-sale`, Nueva cotización → `/cotizaciones/nueva`, Nueva recepción → `/inventario/recepciones/nuevo` MANAGER+, Ir a cerrar caja → `/cash-register`) + "Navegación" (14 items filtrados por rol). **Deudas detectadas durante la sesión (ver Fase 6):** no existe detalle de producto en catálogo (`/configuracion/catalogo/[id]`) — productos usan fallback `/configuracion/catalogo?search=<sku|codigo>`; tampoco existen rutas `/customers/new` ni `/workshop/new` (creación vía diálogo) — acciones omitidas del default state, el usuario entra al listado y abre el diálogo desde ahí.
   - **Sub-sesión 1-D ✅ (2026-04-17) — Breadcrumbs** — commit `8ac9906`. `src/middleware.ts` inyecta `x-pathname` para lectura desde Server Components; `<Breadcrumbs />` (Server Component async en `src/app/(pos)/breadcrumbs.tsx`) se monta debajo del topbar en `(pos)/layout.tsx`. Config: `src/lib/breadcrumbs/route-labels.ts` mapea rutas estáticas a labels en español + `HIDDEN_ROUTES` para `/` y `/point-of-sale`. Resolver `src/lib/breadcrumbs/resolve-dynamic.ts` devuelve folio/nombre con filtro por `branchId` (salvo ADMIN) para Customer, ServiceOrder, Sale, Quotation, PurchaseReceipt y StockTransfer; fallback determinístico `#xxxxxx`. Prioridad de resolución: static match → dynamic resolve → segment label fallback.
   - **Sub-sesión 1-E ✅ (2026-04-21) — Sidebar colapsable** — Botón `PanelLeft` (lucide) en el topbar oculta/muestra el sidebar completamente. Estado persistido en cookie `sidebar-open` leída en el Server Component layout (`cookies()` de `next/headers`) para evitar flash en recarga. Archivos: `src/app/(pos)/shell-context.tsx` (`ShellClient` Client Component + `ShellContext` + `useShell()` hook), `src/app/(pos)/sidebar-toggle-button.tsx` (botón cliente que consume el contexto). El layout pasa el sidebar como prop `sidebar: React.ReactNode` a `ShellClient`; el wrapper transiciona `w-64 ↔ w-0 overflow-hidden` con `transition-[width] duration-200`. Cookie: `sidebar-open=0|1; path=/; max-age=31536000; SameSite=Lax`. Default: abierto (`!== "0"`).
   - **Refactor complementario `/dashboard` → `/` ✅ (2026-04-17)** — commit `06eabff`. `src/app/page.tsx` (redirect raíz) eliminado; dashboard ahora vive en `src/app/(pos)/page.tsx` (ruta `/`) y sus componentes por rol se reubicaron a `src/app/(pos)/_components/dashboard/`. El legacy `src/app/(pos)/dashboard/page.tsx` es un `permanentRedirect('/')` (HTTP 308 para bookmarks). 27 literales `/dashboard` migrados a `/` (sidebar, login, command palette, close-corte-dialog, 22 fallbacks defensivos en páginas protegidas). **No es el rediseño UI del módulo 3 "Dashboard / Home"** — ese sigue pendiente; este refactor solo consolida la ruta raíz.
2. Módulo de referencia: `/reportes/*` (subagentes OK, uno por reporte)
  > **Rediseño v1 (2026-04-18):** Decisiones cerradas → [`docs/reportes-redesign/REPORTES_V1_DECISIONS.md`](docs/reportes-redesign/REPORTES_V1_DECISIONS.md)
  - **Sesión 0 ✅ (2026-04-18) — Port primitivos del handoff** — Portados mecánicamente del handoff de diseño. `src/lib/format/index.ts` (formatters `formatMXN`, `formatNumber`, `formatPercent`, `formatDate`, `formatDateRange`, `formatRelative`; locale `es-MX`, timezone `America/Merida`). Primitivos en `src/components/primitives/`: `icon.tsx` (41 glyphs tipados, union `IconName`), `chip.tsx` (5 variantes semánticas), `delta.tsx` (indicador de cambio con color y glyph, 3 formatos), `sparkline.tsx` (SVG manual sin deps), `spark-bars.tsx` (SVG manual), `progress-split.tsx` (barra segmentada). Paleta datavis `--data-1..8` (light + dark WCAG AA) y tokens faltantes mergeados en `globals.css`. `DESIGN.md §6` y `§8` actualizados. **Deuda diferida (Sesión 13 — V10 Stock Crítico):** `<Chip>` cubre 5 variantes; el handoff define una 6.ª `nostock` con fondo sólido `--ter` + texto blanco (distinto de `error` que usa `--ter-container`). Agregar variante `critical` a `ChipVariant` solo cuando V10 lo requiera.
  - **Sesión 1 ✅ (2026-04-18) — Infra de charts: Recharts + wrapper con tokens EvoFlow** — `recharts@3.8.0` instalado vía `npx shadcn@latest add chart` (compat verificada: React 19 nativo, ESM, sin conflictos Turbopack Next 16). `src/components/ui/chart.tsx` generado por shadcn — no editar. `--chart-1..5` hardcoded por shadcn reemplazados en `globals.css` → `var(--data-1..5)` en `:root` y `.dark`. Wrapper `src/components/primitives/chart.tsx`: re-exports del shadcn chart, `buildChartConfig(SeriesSpec[])` (asigna `--data-1..8` cíclico), `ChartTooltipContentGlass` (glassmorphism oficial), constantes `CHART_AXIS_TICK_STYLE` / `CHART_AXIS_LINE_STYLE` / `CHART_GRID_STYLE` tipadas como atributos SVG (no CSS — Recharts renderiza SVG). **Regla:** reportes NUNCA importan de `"recharts"` ni `"@/components/ui/chart"` directos — siempre vía `@/components/primitives/chart`. `DESIGN.md §3` y `§6` actualizados. `npx prisma validate` + `npm run lint` + `npm run build` limpios (Exit 0).
  - **Sesiones 2-7 ✅ (2026-04-18/19) — Fases A-C completas** — Detalle en [`REPORTES_V1_DECISIONS.md §10`](docs/reportes-redesign/REPORTES_V1_DECISIONS.md). Resumen: S2 schema (`User.pinnedReports`, `User.uiPreferences`, `AlertThreshold` + APIs); S3 hub `/reportes` + pinned dinámicos en sidebar; S4 V1 Ventas e ingresos piloto + shell reutilizable (`DetailHeader`/`FilterPanel`/`KpiGrid`) + helper `previousComparableRange`; S5 ExportDrawer universal (CSV/XLSX/PDF, `exceljs@4.4.0`, endpoint `POST /api/reportes/[slug]/export`); S6 ThresholdsModal + `ThresholdBadge` inline + vista global `/configuracion/umbrales`; S7 TweaksPanel con densidad persistida (`density-{compact,normal,comfortable}` tokens en `globals.css`, consumido por KPI cards y Power Grid).
  - **Sesión 9 ✅ (2026-04-21) — V15 Exportación contable placeholder** — commit `5dfb63a`. S8 Builder eliminado del alcance v1. Página dedicada en `src/app/(pos)/reportes/exportacion-contable/` (server page con role-gate ADMIN vía `REPORTS_BY_SLUG` + client view `ExportacionContableView`). Aviso superior sobre integración PAC pendiente, wizard visual de 4 pasos (Tipo · Período · Formato · Confirmar) con cards deshabilitadas mostrando opciones contempladas (`STEPS: WizardStep[]`), y CTA que enlaza a `/reportes/ventas-e-ingresos` como alternativa disponible hoy. Sin backend — `status: "placeholder"` permanece en `reports-config.ts`. `npm run lint` + `npm run build` limpios.
  - **Sesión 10 ✅ (2026-04-20) — V12 Estado de resultados** — `/reportes/estado-resultados` ADMIN-only. `fetchEstadoResultados` con COGS vía `resolveCostsBatch`, comisiones PAID por `updatedAt` proxy (TODO paidAt), `PAGO_PROVEEDOR` excluido de gastos de caja. 4 KPIs (Ingresos, Margen bruto %, Margen operativo featured, Top gasto). Tabla P&L colapsable con 2 sub-bloques (opex bancario × 9 categorías, caja × 7 categorías), filas subtotal con `var(--surf-low)`. Banner gerencial IVA. ExportDrawer + ThresholdBadge con `MARGEN_BRUTO_PCT` / `MARGEN_OPERATIVO_MXN` en `ALERT_METRICS`. Comparativos × 3 modos + vista consolidado/comparativa por sucursal. Helper `getSparklineGranularity` exportado para V13/V14. `npx prisma validate` + `npm run lint` + `npm run build` limpios (Exit 0).
3. Dashboard / Home
  - **Sesión D1 ✅ (2026-04-21) — Gráfico real, selector de sucursal ADMIN y panel colapsable** — commit `81012e6`. Archivos: `src/app/(pos)/page.tsx`, `_components/dashboard/manager-dashboard.tsx`, `attention-panel.tsx`, `seller-dashboard.tsx`, `technician-dashboard.tsx`. Cambios principales:
    - **`revenueByDay`** — query sobre `CashTransaction` que devuelve `{ label, revenue }[]` con granularidad automática: barras por hora (period=today), por día (period=week) o por semana (period=month). El `BarChart` vía primitivo `chart.tsx` lo consume directamente.
    - **Selector de sucursal ADMIN** — ADMIN puede filtrar el dashboard por sucursal vía `?branch=` (query param validado contra `prisma.branch.findMany` prefetch). MANAGER/SELLER/TECHNICIAN quedan bloqueados a su `branchId`. Variable `viewBranchId: string | null` (null = global) controla toda la lógica de filtrado server-side y se pasa como prop al `ManagerDashboard`. Función cliente `handleBranchChange` sincroniza la URL.
    - **Períodos redefinidos** — "week" → rolling 7 días (hoy + 6 anteriores, antes era lun→hoy del calendario); "month" → 4 semanas corridas (lunes de semana actual + 3 semanas previas completas, antes era 1º del mes → hoy). Comparativos actualizados en consecuencia (window desplazado -7 días / -28 días respectivamente).
    - **`AttentionPanel` colapsado por defecto** — `useState(false)` para `isExpanded`; stock crítico y reensambles pendientes se muestran como fila-resumen con count cuando está colapsado (escalable a N items).
    - **Chips de tendencia** — íconos `TrendingUp` / `TrendingDown` / `Minus` de lucide-react en los tres dashboards (manager, seller, technician) según delta positivo/negativo/neutro. `calcCountTrend` helper interno.
4. Taller `/workshop` (incluye sub-layout de tabs) — **NOTA**: P13 sub-fases B-F construyen UI nueva sobre tokens. Si P13 se ejecuta primero, este módulo del Paso 2 se omite. Coordinar antes de empezar. **Aterrizar aquí Fase S5 (Kanban por capacidad de batería).**
5. Clientes
6. Inventario (recepciones, stock, movimientos) — **Aterrizar aquí el backlog de normalización de catálogo de baterías + refactor de ingreso/mostrado.** Ver `memoria/project_inventario_refactor_backlog.md` para los 9 ítems (CSVs por nombre en vez de ID, `PriceHistory`, costeo por lote, importar facturas, scan de seriales, vista por modelo colapsable, heatmap stock bajo, filtro reverse batería compatible).
7. Tesorería
8. Autorizaciones
9. Configuración
10. Catálogo
11. POS Terminal — ÚLTIMO, sesión aislada, sin subagentes, máximo riesgo de regresión. **Aterrizar aquí Fase S4 (selector de config de batería al vender + VoltageChangeLog ampliado).**

Regla por módulo: una sesión de Claude Code por módulo. No mezclar dos módulos en la misma sesión.
UI = solo CSS/tokens. Si el cambio requiere lógica, orden de pasos o datos distintos, es UX — documentar como ítem separado antes de implementar.

**Deuda detectada en Sesión 1-A (diferida, no resolver hasta tener decisión):**
- `text-white` y `color: "#ffffff"` hardcoded sobre Velocity Gradient en chip BRANCH (`layout.tsx`), avatar topbar (`layout.tsx`) y avatar footer sidebar (`sidebar.tsx`). Token correcto `--on-p` existe (light `#ffffff`, dark `#131313`). Migración directa a `var(--on-p)` flipea texto a oscuro sobre gradient verde-oscuro→verde-brillante en dark, lo cual probablemente NO es lo deseado (DESIGN.md §10 dice que el blanco sobre gradient es excepción permanente). Decidir antes de migrar.
- `ThemeToggle` (`(pos)/theme-toggle.tsx`) usaba `text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300` (violaba anti-pattern §10). ✅ resuelto durante 1-B — hoy usa surface tokens.
- `BranchSwitcher` botón sin `aria-haspopup`/`aria-expanded`. Tiene texto visible así que es usable, pero no semánticamente correcto. Pasada de a11y de componentes (no en scope del shell).
- Shell es desktop-first; **no hay drawer móvil**. Ausencia de estrategia mobile en el proyecto. Decisión para Fase 6 o post-launch.

**Paso 3 — Fase 6 completa (Opus + deploy)**
Una vez que el código UI esté estable y limpio.
Ver sección FASE 6 más abajo para el detalle completo.

---

## FASE 6 — Hardening y Producción
**Modelo: Opus | Dependencias: TODO lo anterior**

> **Nota 2026-04-17:** El timezone fix y el ghost-border Parte 2 se ejecutan en el bloque Pre-Fase 6 (ver sección anterior). Fase 6 arranca con esas dos deudas ya cerradas.

### Tareas
- Fix timezone global ✅ (resuelto en Pre-Fase 6 Paso 1 y Paso 1.5)
- Ghost-border Parte 2 ✅ (resuelto durante rediseño UI)
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
- **Normalización server-side de `PurchaseReceipt.proveedor` (pendiente P4-C + P10-G)** — el campo es `String` libre; P10-G normaliza en memoria con `trim().toLowerCase()` para agrupar. Con datos reales del cliente puede haber grupos duplicados si el operador escribe "Refaccionaria Luz", "refaccionaria luz" o "Refaccionaria LUZ ". Fix: normalizar en `POST /api/inventory/receipts` antes de persistir (similar a `normalizeModeloAplicable()` de P1-E). Verificar en el reporte `/reportes/compras-proveedor` al cargar primeros datos reales — si aparecen grupos duplicados, esta tarea sube a alta prioridad.
- **Fix timezone global (`America/Merida` UTC−6)** — varios filtros de fecha usan `new Date("YYYY-MM-DD")` que interpreta UTC midnight. En `America/Merida` corre el día ±1 en la franja 18:00–23:59 local. Rutas afectadas: `ventas/page.tsx`, `api/reportes/caja/route.ts`, `reportes/caja/page.tsx`, `reportes/comisiones/page.tsx`, `reportes/caja/historial/page.tsx`, `api/tesoreria/summary/route.ts`, `autorizaciones/page.tsx`. Fix: migrar todos a `parseDateRange`/`parseLocalDate` de `src/lib/reportes/date-range.ts`. P10 (Lotes 1-6) ya usa el helper correcto. También afecta: KPIs `cuentasVencidas` y `proximoVencimiento` en `reportes/compras-proveedor/page.tsx` (compara `fechaVencimiento < now()` server-side — drift de 1 día en la franja nocturna). El fix es global: cuando se haga la pasada de timezone, incluir también los dos campos de vencimiento en P10-G.
- Deploy: variables de entorno de producción, SSL, dominio
- Build limpio final: cero `any`, cero `TODO`, cero `console.log`
- Revisión final de `refacciones_revisar.csv` y carga completa
- **Rutas de detalle de producto en catálogo (pendiente desde 1-C)** — detectado al implementar el Command Palette (2026-04-17). `/configuracion/catalogo` tiene tabs (modelos, variantes, simples, battery-configs, alertas) pero no ruta de detalle por id. El palette resuelve los resultados de producto con fallback `href = /configuracion/catalogo?search=<sku|codigo>` — el tab de variantes/simples debe leer `searchParams.search` y autofiltar. Dos caminos: (a) implementar la ruta de detalle (`/configuracion/catalogo/variantes/[id]` y `/configuracion/catalogo/simple/[id]`) + actualizar el palette para usar `href = /.../[id]`, (b) mantener el fallback actual y ampliar `catalogo-client.tsx` para consumir el query param. La opción (b) es menor esfuerzo y cubre el caso (ver el producto en el listado ya filtrado). Alinear con 1-C el día que se decida.
- **Rutas `/customers/new` y `/workshop/new` como páginas dedicadas (pendiente desde 1-C)** — hoy la creación de cliente y de orden de taller vive detrás de diálogos (`new-order-dialog.tsx` y el dialog de nuevo cliente en el listado). El Command Palette omite esas acciones porque no hay ruta de destino. Si se decide crear rutas dedicadas, agregar las acciones "Nuevo cliente" y "Nueva orden de taller" a `ACTION_ITEMS` en `src/app/(pos)/command-palette.tsx`. Alternativa: mantener diálogos (flujo actual es bueno para el cajero) y no tocar el palette — en ese caso, cerrar esta línea como no-deuda.
- **Skip link vs `OrphanedSessionBanner` (a11y, pendiente desde 1-B Paso 2)** — el skip link "Saltar al contenido" en `(pos)/layout.tsx` usa `focus:top-2`; cuando el banner de caja huérfana está visible arriba del topbar, el skip link se traslapa con el banner al enfocarse (Tab desde la URL). Opciones: (a) ajustar `focus:top-[calc(var(--banner-height)+0.5rem)]` con variable CSS condicional desde el banner, (b) subir z-index del skip link sobre el banner, (c) esconder/colapsar banner cuando el skip link tiene foco. Decidir en la pasada de a11y de Fase 6.
- **Consolidar tipo `SessionUser` cross-módulo (pendiente desde 1-B/1-D chore)** — `SessionUser` está declarado como `interface`/`type` inline en 110+ archivos (API routes + pages + helpers), con al menos 3 variantes de shape: (a) mínima `{ id, role, branchId }` usada por handlers de mutación, (b) extendida `{ + name, email, branchName }` usada por layout y componentes de UI, (c) variante estrecha en `src/lib/transferencias.ts:46`. El canonical vive en `src/lib/auth-types.ts` (creado en commit `99437dc`) pero hoy solo lo consume el shell del POS (`(pos)/layout.tsx`). **Estrategia sugerida**: no sustitución 1:1 sino tipo canónico extendido + `Pick<SessionUser, 'id' | 'role' | 'branchId'>` en handlers que solo necesitan el subset — evita crear N tipos derivados. Migración por módulo (`api/auth-requests`, `api/sales`, `api/cash-register`, etc.) en sesiones dedicadas una vez que el proyecto se estabilice. Mientras tanto `SessionUser` canónico sigue siendo fuente de verdad para shell + autenticación. No bloquea releases.
- **Self-hostear fuentes `next/font/google` (Inter + Space Grotesk)** — detectado en 1-B Paso 1 (2026-04-17). `next/font/google` descarga las fuentes en build time desde `fonts.googleapis.com`; si el entorno de CI/deploy no tiene red saliente (sandboxes de agentes, redes corporativas), el build falla con `Failed to fetch Inter/Space Grotesk from Google Fonts`. Fix: bajar las fuentes una vez, commitear a `public/fonts/`, migrar `src/app/layout.tsx` de `next/font/google` a `next/font/local`. Conserva las ventajas de `next/font` (self-hosting automático + CSS vars + layout shift fix) sin dependencia de red en build. Baja prioridad en desarrollo local con red, pero bloqueante para pipelines sin internet.
- **IVA configurable por sucursal** — hoy `16%` hardcoded en el wizard de recepción (`step-4-tipo.tsx`, P13-C.2 2026-04-22) y probablemente en otros módulos. Cuando se abra sucursal fronteriza (zona 8%) o cambien tasas fiscales, migrar a `Branch.ivaPct Decimal @default(16.00)` y propagar. Sin urgencia mientras LEO+AV135 sean las únicas sucursales.
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
- **Escala del Kanban de Taller (diferido desde P13-B, sumado 2026-04-22)** — `/workshop` hoy hidrata 7 columnas con `force-dynamic` + DnD sin paginación ni virtualización. En P13-Hotfix se añade `take: 100` por columna ordenado por `updatedAt desc` más SWR revalidate de 30s para el chip de disponibilidad; DELIVERED/CANCELLED siguen filtradas a "solo hoy". Cuando una sucursal mantenga > 50 órdenes activas sostenidas, agregar: (a) virtualización con `@tanstack/react-virtual` en columnas largas, (b) índice compuesto `(branchId, status, subStatus, updatedAt desc)` en `ServiceOrder` si EXPLAIN muestra seq scan, (c) paginación cursor en endpoints `/api/workshop/orders` con `?cursor=&limit=`. No bloqueante mientras el volumen sea bajo; validar con un EXPLAIN al abrir piloto con volumen real.
- **Política ADMIN branch-scope (formalizar, sumado 2026-04-22)** — Incidente detectado en P13 pre-Hotfix: órdenes de otras sucursales visibles desde sesión filtrada por branch en el topbar, incluso para ADMIN. La regla "filtrar por `branchId` del JWT excepto ADMIN" es too blunt — ADMIN necesita scope respetado cuando trabaja en un branch específico. **Patrón canónico:** `viewBranchId` = branch del topbar (siempre honrado) en módulos operativos (`/workshop`, `/point-of-sale`, `/inventario`, `/tesoreria`, `/autorizaciones`); **global-only** en `/reportes/*` (ejecutivo) y `/configuracion/*`. Documentar en `AGENTS.md §Reglas` como extensión de la regla branchId. Audit cross-módulo al cerrar Hotfix.1 — probablemente hay más endpoints con el mismo patrón roto.
- **Vista de ocupación del gerente (diferida desde P13-G, 2026-04-22)** — El mock `vista_de_ocupaci_n_del_gerente_2/` existe pero no se prioriza en P13. Requiere métricas de productividad (horas facturables vs. efectivas, OT/subutilización por técnico) que sólo maduran con uso real post-piloto. Retomar tras ~60 días de operación con datos reales; evaluar si vale o se reduce a dashboard KPI simple en `/workshop/ocupacion`.

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
