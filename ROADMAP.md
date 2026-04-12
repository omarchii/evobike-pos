# ROADMAP evobike-pos2 — Post Fase 5

Última actualización: 2026-04-12 (P4-C)  
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

## FASE P3 — Fixes y mejoras POS
**Modelo: Sonnet | Dependencias: P0 + P2**

### Tareas
- Labels en español en compra guiada:
  - `"SYSTEM VOLTAGE"` → `"Voltaje del sistema"`
  - `"FRAME COLOR"` → `"Color del cuadro"`
- Separar baterías del grid de unidades — flujo de venta directo sin compra guiada
- Actualizar filtros/tabs del POS con categorías reales: `Bicicletas | Triciclos | Scooters | Juguetes | Carga`
- Mejorar UX de cambio de voltaje: al seleccionar voltaje distinto al ensamblado, mostrar mensaje claro "Esta unidad requiere reensamble a [X]V. Se creará una orden de montaje automáticamente." con confirmación explícita
- Sección de `SimpleProduct` en grid del POS (separada de unidades, sin compra guiada)
- Botón "Agregar concepto libre" en POS: descripción manual + precio (`isFreeForm` ya existe en backend)
- Sidebar: agregar item "Reportes" con sub-items (Fase 5-H pendiente desde antes)

### Archivos clave
- `src/app/(pos)/pos/pos-terminal.tsx` ⚠️ RIESGO DE REGRESIÓN — modificar con cuidado
- `src/components/pos/guided-purchase/` (labels en español)
- `src/app/(pos)/pos/page.tsx`

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

## FASE P5 — Flujo de autorización (PIN + remoto)
**Modelo: Opus — decisión de arquitectura con tiempo real | Dependencias: ninguna**

Aplica a: cancelaciones de venta y descuentos sobre precio.

### Modelo nuevo `AuthorizationRequest`
```prisma
model AuthorizationRequest {
  id          String   @id @default(cuid())
  tipo        AuthorizationType  // CANCELACION | DESCUENTO
  status      AuthorizationStatus // PENDING | APPROVED | REJECTED
  saleId      String?  // referencia a la venta afectada
  requestedBy String   // userId del vendedor
  approvedBy  String?  // userId del manager
  pin         String?  // hash del PIN usado (modo presencial)
  monto       Decimal? // para descuentos: monto solicitado
  motivo      String?
  createdAt   DateTime @default(now())
  resolvedAt  DateTime?
}
```

### Flujos
- **Modo presencial**: campo PIN de manager en POS → validación inmediata → ejecutar acción
- **Modo remoto**: crear `AuthorizationRequest(PENDING)` → bandeja en sesión del manager → POS polling cada 3s hasta resolución
- Decisión técnica (Opus): polling simple vs WebSockets para el modo remoto
- Bandeja de solicitudes pendientes visible en dashboard de manager como notificación urgente
- Historial de autorizaciones consultable

### Archivos clave
- `prisma/schema.prisma`
- `src/app/api/auth-requests/route.ts` (nueva)
- `src/app/(pos)/pos/pos-terminal.tsx` ⚠️
- Dashboard de manager

---

## FASE P6 — Documentos PDF
**Modelo: Sonnet | Librería: @react-pdf/renderer | Dependencias: P1-A obligatorio**

IVA 16% fijo en todos los documentos. Todos usan datos de sucursal + sello de `Branch`.

### P6-A — PDF Cotización (formato Alegra)
Estructura:
- Header: Logo Evobike (izq) + datos sucursal (centro) + badge "Cotización No. XX" (der)
- Datos cliente: solo nombre, teléfono, fecha expedición, fecha vencimiento (sin RFC ni domicilio fiscal)
- Tabla: Producto | Unidad de medida | Precio unitario | Cantidad | Descuento | Total
- Total en letra (ej. "Ciento cincuenta pesos M.N.")
- Subtotal + IVA 16% + Total
- Términos precargados desde `Branch.terminosCotizacion`
- Sello de sucursal (imagen) + "Elaborado por: [nombre del usuario]"

### P6-B — PDF Recibo de Pedido / Apartado
Estructura:
- Header: logo + datos sucursal
- Datos cliente: nombre, teléfono, correo
- Tabla producto: modelo, color, voltaje, cantidad, precio unitario, total
- Timeline de abonos: fecha · monto · método de pago · quién cobró
- Total abonado + saldo restante
- Condiciones desde `Branch.terminosPedido` + sello

### P6-C — PDF Ticket de venta
Estructura:
- Folio, fecha, vendedor, sucursal, cliente
- Productos vendidos con subtotales
- Subtotal + IVA 16% + Total
- Método(s) de pago usados
- Si fue cancelado: quién autorizó y cuándo

### P6-D — PDF Póliza de garantía (auto-generada)
- Se activa cuando `Sale.warrantyDocReady = true`
- VIN desde `CustomerBike.serialNumber`
- Seriales de baterías instaladas desde `BatteryAssignment.where(isCurrent: true)`
- Lote de procedencia desde `BatteryLot`
- Condiciones desde `Branch.terminosPoliza` + sello
- Endpoint ya existe: `GET /api/sales/[id]/warranty-pdf` — solo falta el documento visual

### Archivos clave
- `src/app/api/sales/[id]/warranty-pdf/route.ts` (modificar para generar PDF)
- `src/app/api/cotizaciones/[id]/pdf/route.ts` (nueva)
- `src/app/api/pedidos/[id]/pdf/route.ts` (nueva)
- `src/lib/pdf/` (nueva carpeta con templates)

---

## FASE P7 — Cotizaciones mejoradas
**Modelo: Sonnet | Dependencias: P6-A**

### Cambios de schema
Rediseño de `QuotationStatus` enum:
```
DRAFT → EN_ESPERA_CLIENTE → EN_ESPERA_FABRICA → PAGADA → FINALIZADA
                                               → RECHAZADA
```
Migración cuidadosa: mapear `SENT` → `EN_ESPERA_CLIENTE`, `CONVERTED` → `FINALIZADA`, `CANCELLED` → `RECHAZADA`.

### Cambios en UI y documento
- Quitar RFC y domicilio fiscal del cliente en el documento generado
- Términos precargados desde `Branch.terminosCotizacion` (no hardcodeados)
- Vincular cotizaciones al perfil del cliente — visibles desde `/clientes/[id]`
- Panel de cotizaciones muestra nuevo semáforo de estados

### Archivos clave
- `prisma/schema.prisma` (enum `QuotationStatus`)
- `src/app/api/cotizaciones/[id]/route.ts`
- `src/app/(pos)/cotizaciones/`

---

## FASE P8 — Vista de historial de abonos
**Modelo: Sonnet | Dependencias: ninguna nueva**

### Tareas
- En `/pedidos/[id]`: agregar timeline visual de cada abono
  - Fecha · monto · método de pago · quién cobró
  - Saldo restante actualizado
  - Contador "X exhibiciones realizadas"
- Esta vista alimenta el PDF P6-B cuando se imprime
- Datos ya existen en `CashTransaction` — solo falta la UI

### Archivos clave
- `src/app/(pos)/pedidos/[id]/page.tsx`
- Componente nuevo: `abonos-timeline.tsx`

---

## FASE P9 — Tesorería
**Modelo: Sonnet | Dependencias: ninguna**

Ruta: `/tesoreria` (MANAGER + ADMIN).

### Gastos operativos (nuevo modelo `OperationalExpense`)
```prisma
model OperationalExpense {
  id          String    @id @default(cuid())
  branchId    String
  categoria   ExpenseCategory // RENTA | SERVICIOS | NOMINA | PUBLICIDAD | TRANSPORTE | OTRO
  descripcion String
  monto       Decimal
  fecha       DateTime
  metodoPago  PaymentMethod
  comprobanteUrl String?
  registradoPor  String  // userId
  createdAt   DateTime @default(now())
}
```

### Saldos
- Efectivo en caja: calculado automáticamente desde `CashRegisterSession` activa
- Cuenta bancaria: registro manual con historial de actualizaciones

### Reportes de tesorería
- Ingresos vs. gastos por período
- Gastos por categoría (pie chart)
- Balance general del período

### Archivos clave
- `prisma/schema.prisma`
- `src/app/api/tesoreria/` (nueva)
- `src/app/(pos)/tesoreria/` (nueva)

---

## FASE P10 — Reportes expandidos
**Modelo: Sonnet | Dependencias: P4 para rentabilidad**

### P10-A — Ventas por vendedor (completo)
Columnas: folio, cliente, modelo, voltaje, fecha, precio, método de pago.
Filtros: rango de fechas, vendedor, sucursal.
Exportable a CSV.

### P10-B — Estado de cuenta por cliente
Historial completo de compras por cliente.
Saldo pendiente de apartados activos.
Cotizaciones vinculadas.

### P10-C — Rentabilidad por producto
Precio venta vs. precio mayorista de compra (desde `inventory/receipts` enriquecido P4).
Margen por unidad y por categoría.

### P10-D — Valor de inventario
Cantidad en stock × precio mayorista = costo del inventario actual por sucursal.
Requiere `precioMayorista` en `SimpleProduct` y `ProductVariant`.

### P10-E — Movimientos de inventario
Entradas, salidas, ajustes, devoluciones por período.
Útil para auditoría y cuadre con inventario físico.

### P10-F — Compras al proveedor (reporte agregado)
Historial desde `inventory/receipts` enriquecido.
**Alcance reducido post P4-C**: el listado operativo de cuentas por pagar (filtros por estadoPago, proveedor, rango vencimiento) ya lo cubre `/inventario/recepciones`. P10-F queda como reporte agregado: totales mensuales por proveedor, análisis de vencimientos por período, export CSV.

### P10-G — Reporte de stock mínimo
Productos donde `stockActual ≤ stockMinimo` → lista de reabastecimiento.
Ordenado por urgencia (qué tan debajo del mínimo está).

### P10-H — Reporte anual
KPIs por mes: ingresos, gastos operativos, compras al proveedor, margen neto.
Comparativa entre sucursales (solo ADMIN).

### Archivos clave
- `src/app/api/reportes/` (nuevas sub-rutas)
- `src/app/(pos)/reportes/` (ampliar existente)

---

## FASE P11 — Seguimiento de mantenimientos
**Modelo: Sonnet | Sin schema nuevo | Dependencias: ninguna**

Ruta: `/mantenimientos` (TECHNICIAN + MANAGER + ADMIN).

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
- Deploy: variables de entorno de producción, SSL, dominio
- Build limpio final: cero `any`, cero `TODO`, cero `console.log`
- Revisión final de `refacciones_revisar.csv` y carga completa

---

## Archivos de datos listos en prisma/data/

| Archivo | Contenido | Estado |
|---|---|---|
| `accesorios.csv` | 35 productos: accesorios, cargadores, baterías, refacciones básicas | ✅ Listo |
| `refacciones.csv` | 2,632 refacciones por modelo, 40 modelos cubiertos | ✅ Listo |
| `refacciones_revisar.csv` | 940 filas con nombre inválido por PDF con imágenes — revisar manualmente | ⚠️ Revisar |

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
