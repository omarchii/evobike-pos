# Spec — Módulo Cotizaciones (Fase 3)

> Ubicación final: `docs/superpowers/specs/cotizaciones.md`
> Estado: diseño aprobado, pendiente de implementación
> Modelo de diseño: Opus (decisiones de arquitectura no triviales)
> Modelo sugerido para implementación: Sonnet (módulo por módulo)

---

## 1. Resumen

El módulo de Cotizaciones permite a cualquier rol generar un documento con precios congelados, vigencia limitada y vínculo opcional a un cliente, que el cliente final puede recibir como PDF imprimible y que posteriormente se convierte (one-shot) en **Venta directa**, **Pedido Layaway** o **Pedido Backorder** respetando los precios pactados.

**Decisiones rectoras (cerradas con el negocio):**

| Decisión | Valor |
|---|---|
| Reserva de stock al cotizar | **No reserva.** Stock se descuenta hasta venta/pedido. |
| Vigencia por defecto | **7 días.** Al expirar pasa a `EXPIRED`, terminal, no convertible. |
| Quién puede crear | **Todos los roles.** Descuentos siguen reglas del POS (fijos requieren MANAGER). |
| Cliente | **Opcional al crear**, **obligatorio al convertir**. |
| Conversión | **One-shot.** Una cotización → una sola venta/pedido. |
| Lock de precios | **Sí.** PDF lleva leyenda "precio válido solo el día de emisión". Al convertir se alerta (no bloquea) si el catálogo cambió. |
| Multi-sucursal | **Sí.** Cotización de LEO puede convertirse en AV135. Folios independientes. |
| Líneas libres fuera de catálogo | **Sí permitidas** (instalación especial, accesorio bajo pedido, etc.). |
| Editabilidad | **DRAFT/SENT editables libremente.** Al convertir/expirar/cancelar quedan inmutables. |
| Entregable PDF | Ruta pública print-optimizada → navegador imprime a PDF. Cero deps nuevas. |

---

## 2. Estados y flujo de vida

### 2.1 Máquina de estados

```
            ┌──────────┐  marcar enviada   ┌─────────┐
   crear ──▶│  DRAFT   │ ─────────────────▶│  SENT   │
            └────┬─────┘                   └────┬────┘
                 │                              │
                 │ convertir         convertir  │
                 ├──────────┬───────────────────┤
                 │          ▼                   │
                 │     ┌──────────┐             │
                 │     │CONVERTED │ (terminal)  │
                 │     └──────────┘             │
                 │                              │
                 │ cancelar         cancelar    │
                 ├──────────┬───────────────────┤
                 │          ▼                   │
                 │     ┌──────────┐             │
                 │     │CANCELLED │ (terminal)  │
                 │     └──────────┘             │
                 │                              │
                 │ now > validUntil             │
                 └──────────┬───────────────────┘
                            ▼
                       ┌──────────┐
                       │ EXPIRED  │ (terminal, permite duplicar)
                       └──────────┘
```

**Reglas:**

- `DRAFT` y `SENT` son **editables** (ítems, precios, cliente, descuento, nota). La edición no cambia el estado.
- `SENT` es solo señalética: marca que la cotización ya se compartió con el cliente. No bloquea nada técnicamente.
- La conversión funciona desde `DRAFT` o `SENT` indistintamente.
- `EXPIRED` se evalúa **en lectura y al intentar convertir** comparando `now > validUntil`. No requiere cron. El campo `status = 'EXPIRED'` es best-effort, opcional como housekeeping nocturno (Fase 6).
- `EXPIRED`, `CANCELLED` y `CONVERTED` permiten la acción **Duplicar**, que crea una nueva cotización en `DRAFT` con los mismos ítems y nueva vigencia (sin arrastrar precios congelados — los re-toma del catálogo actual).

### 2.2 Vigencia

- `validUntil` se calcula al crear: `createdAt + 7 días` (configurable por sucursal en Fase 6 si se requiere).
- En la conversión, la API valida `now <= validUntil` **dentro de la transacción**, sin confiar en el campo `status`. Esto cierra la ventana de race condition entre el job nocturno y una conversión simultánea.

### 2.3 Conversión a Venta directa / Pedido

La conversión es **one-shot**: una cotización solo puede generar una venta o pedido. Después queda en `CONVERTED` con referencia a `Sale.id`.

Tipos de conversión disponibles desde la UI:

| Destino | Requisitos | Resultado |
|---|---|---|
| **Venta directa** | Sesión de caja abierta en sucursal de conversión, cliente asignado, pago completo | `Sale (status=COMPLETED)` + descuento de Stock + `CashTransaction(s)` + `CommissionRecord` |
| **Pedido Layaway** | Cliente asignado, pago inicial (mínimo configurable), sesión de caja abierta | `Sale (status=LAYAWAY)` + `CashTransaction` del anticipo |
| **Pedido Backorder** | Cliente asignado, pago inicial, sesión de caja abierta | `Sale (type=BACKORDER, status=LAYAWAY)` + `CashTransaction` + `AssemblyOrder` PENDING (vía flujo 2H-D si aplica) |

La conversión reutiliza la lógica existente de `POST /api/sales` (venta directa) y `POST /api/pedidos` (layaway/backorder). El endpoint de conversión es **un coordinador** que valida estado, congela precios, llama a la API correspondiente, y al final marca la cotización.

---

## 3. Schema (Prisma)

### 3.1 Modelos nuevos

```prisma
model Quotation {
  id                       String           @id @default(cuid())
  folio                    String           // "LEO-COT-0001"

  branchId                 String           // sucursal de origen
  branch                   Branch           @relation("QuotationBranch", fields: [branchId], references: [id])

  userId                   String           // creador
  user                     User             @relation("QuotationCreator", fields: [userId], references: [id])

  customerId               String?          // opcional al crear, obligatorio al convertir
  customer                 Customer?        @relation(fields: [customerId], references: [id])

  // Snapshot para cotizaciones anónimas (walk-ins sin cliente capturado)
  anonymousCustomerName    String?
  anonymousCustomerPhone   String?

  status                   QuotationStatus  @default(DRAFT)
  validUntil               DateTime

  subtotal                 Decimal          @db.Decimal(12, 2)
  discountAmount           Decimal          @default(0) @db.Decimal(12, 2)
  total                    Decimal          @db.Decimal(12, 2)

  // Autorización de descuento fijo (regla del POS)
  discountAuthorizedById   String?
  discountAuthorizedBy     User?            @relation("QuotationDiscountAuth", fields: [discountAuthorizedById], references: [id])

  internalNote             String?

  // Token público para vista print/PDF (sin auth)
  publicShareToken         String           @unique @default(cuid())

  // Trazabilidad de conversión
  convertedToSaleId        String?          @unique
  convertedToSale          Sale?            @relation("SaleFromQuotation", fields: [convertedToSaleId], references: [id])
  convertedAt              DateTime?
  convertedByUserId        String?
  convertedByUser          User?            @relation("QuotationConverter", fields: [convertedByUserId], references: [id])
  convertedInBranchId      String?          // puede diferir de branchId origen
  convertedInBranch        Branch?          @relation("QuotationConvertedInBranch", fields: [convertedInBranchId], references: [id])

  cancelledAt              DateTime?
  cancelledByUserId        String?
  cancelReason             String?

  items                    QuotationItem[]

  createdAt                DateTime         @default(now())
  updatedAt                DateTime         @updatedAt

  @@unique([branchId, folio])
  @@index([branchId, status])
  @@index([customerId])
  @@index([validUntil])
  @@map("cotizaciones")
}

model QuotationItem {
  id                String         @id @default(cuid())
  quotationId       String
  quotation         Quotation      @relation(fields: [quotationId], references: [id], onDelete: Cascade)

  // Nullable para soportar líneas libres ("instalación especial", "accesorio bajo pedido")
  productVariantId  String?
  productVariant    ProductVariant? @relation(fields: [productVariantId], references: [id])

  // Descripción siempre presente:
  // - Catálogo: snapshot del nombre al momento de cotizar
  // - Línea libre: descripción manual
  description       String

  quantity          Int
  unitPrice         Decimal        @db.Decimal(12, 2)  // precio congelado
  lineTotal         Decimal        @db.Decimal(12, 2)

  isFreeForm        Boolean        @default(false)

  createdAt         DateTime       @default(now())

  @@index([quotationId])
  @@map("cotizacion_items")
}

enum QuotationStatus {
  DRAFT
  SENT
  CONVERTED
  EXPIRED
  CANCELLED
}
```

### 3.2 Cambios a modelos existentes

```prisma
model Branch {
  // ... campos existentes
  lastQuotationFolioNumber  Int  @default(0)  // contador atómico para folios COT
}

model Sale {
  // ... campos existentes
  quotationId   String?     @unique
  quotation     Quotation?  @relation("SaleFromQuotation")
}

model SaleItem {
  // ... campos existentes
  productVariantId  String?  // ⚠️ DEBE volverse nullable
  description       String?  // ⚠️ NUEVO: snapshot/línea libre
  isFreeForm        Boolean  @default(false)
}
```

⚠️ **El cambio más delicado del módulo** es `SaleItem.productVariantId` → nullable. Ver sección 7.1 (Riesgos) para el plan de auditoría.

### 3.3 Migración

```bash
npx prisma migrate dev --name add_quotations_module
```

La migración debe:
1. Crear tablas `cotizaciones` y `cotizacion_items` + enum `QuotationStatus`.
2. Agregar `Branch.lastQuotationFolioNumber` con default 0.
3. Agregar `Sale.quotationId` nullable + unique.
4. Volver `SaleItem.productVariantId` nullable + agregar `description` y `isFreeForm`.
5. **No backfill destructivo** — todos los `SaleItem` existentes mantienen su `productVariantId` actual.

---

## 4. API Routes

Todas en `src/app/api/cotizaciones/`. Todas validan sesión con `getServerSession(authOptions)` y filtran por `branchId` del JWT salvo ADMIN. Todas las multi-tabla en `prisma.$transaction()`. Respuesta estándar: `{ success: boolean, data?: T, error?: string }`.

### 4.1 Endpoints

| Método | Ruta | Propósito |
|---|---|---|
| `POST` | `/api/cotizaciones` | Crear cotización (DRAFT). Genera folio, calcula `validUntil`, valida descuentos. |
| `PATCH` | `/api/cotizaciones/[id]` | Editar (solo DRAFT/SENT). Recalcula totales. |
| `POST` | `/api/cotizaciones/[id]/send` | DRAFT → SENT. |
| `POST` | `/api/cotizaciones/[id]/cancel` | DRAFT/SENT → CANCELLED. Body: `{ reason }`. |
| `POST` | `/api/cotizaciones/[id]/duplicate` | Clona en nuevo DRAFT, re-toma precios actuales del catálogo. |
| `GET` | `/api/cotizaciones/[id]/price-check` | Compara `unitPrice` congelado vs catálogo actual. Retorna lista de drifts. |
| `POST` | `/api/cotizaciones/[id]/convert` | Conversión one-shot. Body: `{ targetType, customerId, paymentData, branchOverride? }`. |
| `GET` | `/api/cotizaciones/search` | Búsqueda por folio cross-branch (para conversión en sucursal distinta). |

> **Nota:** Las pantallas de listado y detalle son Server Components y leen Prisma directo. Los `GET` arriba existen solo para flujos de cliente (búsqueda en modal de conversión, refresh post-acción).

### 4.2 Validaciones críticas por endpoint

**`POST /api/cotizaciones`**
- Schema Zod: `customerId?` o `(anonymousCustomerName + anonymousCustomerPhone)?` (al menos uno permitido o ninguno).
- Cada item: si `productVariantId` provisto, verificar que existe; si `isFreeForm`, exigir `description` y `unitPrice > 0`.
- Si `discountAmount > 0` y es **descuento fijo**, exigir `discountAuthorizedById` con rol MANAGER+.
- Folio: `Branch.lastQuotationFolioNumber` incrementado dentro de `$transaction`, formato `${branchCode}-COT-${number.padStart(4, '0')}`.
- `validUntil = now + 7 días`.

**`PATCH /api/cotizaciones/[id]`**
- Bloquear si `status NOT IN ('DRAFT', 'SENT')`.
- Re-validar todo el body (mismo schema que POST).
- Recalcular `subtotal`, `discountAmount`, `total`.
- `updatedAt` automático.

**`POST /api/cotizaciones/[id]/convert`** ← el más complejo
1. Lock fila con `prisma.$transaction(async tx => {...})` y `tx.quotation.findUnique({ where: { id } })`.
2. Validar `status IN ('DRAFT', 'SENT')` Y `now <= validUntil`. Rechazar con 422 si expiró aunque el `status` aún sea SENT.
3. Validar `customerId` presente en body (si la cotización es anónima, el body debe traerlo).
4. Determinar `targetBranchId`:
   - Si rol del usuario tiene acceso a sucursal distinta, usar `branchOverride` o `session.user.branchId`.
   - Para venta directa: validar sesión de caja abierta en `targetBranchId`.
5. Para cada item con `productVariantId`: validar Stock disponible en `targetBranchId`. Las líneas `isFreeForm` no consultan stock.
6. Llamar a la lógica de creación correspondiente (`createSale` / `createPedido`) **dentro del mismo `tx`**, pasando los precios congelados y forzando `quotationId` en el `Sale` resultante.
7. Marcar cotización: `status=CONVERTED, convertedToSaleId, convertedAt, convertedByUserId, convertedInBranchId`.
8. Retornar `{ saleId, saleFolio }`.

**`GET /api/cotizaciones/[id]/price-check`**
- Para cada item con `productVariantId`: comparar `quotation.unitPrice` vs `productVariant.precioPublico` (o `precioDistribuidor` según tipo de cliente).
- Retornar `[{ itemId, frozenPrice, currentPrice, drift: 'higher'|'lower'|'none' }]`.
- Se llama desde el dialog de conversión para mostrar alertas amarillas, **no bloquea**.

---

## 5. Páginas y componentes

### 5.1 Rutas

Todas bajo grupo `(pos)` (autenticadas) salvo la pública.

| Ruta | Tipo | Roles | Función |
|---|---|---|---|
| `/cotizaciones` | Server Component | Todos | Listado con filtros (estado, sucursal — solo ADMIN, fecha, búsqueda por folio o cliente). |
| `/cotizaciones/nueva` | Client form | Todos | Formulario de creación. RHF + Zod. |
| `/cotizaciones/[id]` | Server Component | Todos | Detalle + acciones (editar, enviar, cancelar, duplicar, convertir, abrir vista pública). |
| `/cotizaciones/[id]/edit` | Client form | Todos (si DRAFT/SENT) | Edición. |
| `/cotizaciones/public/[token]` | Public Server Component | **Sin auth** | Vista print-optimizada con leyenda de validez. |

### 5.2 Componentes principales

```
src/app/(pos)/cotizaciones/
├── page.tsx                          # listado (RSC)
├── _components/
│   ├── quotations-table.tsx          # tabla con power-grid pattern
│   ├── quotations-filters.tsx        # client component
│   └── quotation-status-badge.tsx
├── nueva/
│   ├── page.tsx                      # RSC carga catálogo + clientes
│   └── quotation-form.tsx            # client component (RHF + Zod)
├── [id]/
│   ├── page.tsx                      # detalle (RSC)
│   ├── _components/
│   │   ├── quotation-actions-bar.tsx
│   │   ├── convert-quotation-dialog.tsx   # ← el más crítico
│   │   ├── price-drift-alert.tsx
│   │   └── duplicate-button.tsx
│   └── edit/
│       ├── page.tsx
│       └── edit-form.tsx
└── public/
    └── [token]/
        └── page.tsx                  # print view, sin auth
```

### 5.3 `convert-quotation-dialog.tsx` — flujo

1. Al abrir, llama a `GET /api/cotizaciones/[id]/price-check`.
2. Si hay drifts, muestra `price-drift-alert.tsx` con tabla de cambios.
3. Selector de tipo: Venta directa / Pedido Layaway / Pedido Backorder.
4. Si la cotización es anónima → modal de selección de cliente (reutiliza `customer-selector-modal.tsx` de Fase 2F.6).
5. Si el usuario logueado no está en la sucursal de origen → aviso "Esta cotización se generó en LEO. Será convertida en AV135 (sucursal actual)".
6. Componente de pago según tipo (reutiliza modales existentes de Fase 2F).
7. Submit → `POST /api/cotizaciones/[id]/convert`. Toast + redirect a la venta/pedido resultante.

### 5.4 Vista pública / PDF

`/cotizaciones/public/[token]` es una página **sin auth** que:

- Renderiza el branding del negocio, datos del cliente (si aplica), tabla de ítems, totales.
- Lleva la leyenda obligatoria al pie:
  > _"Los precios mostrados son válidos únicamente el día de emisión de esta cotización. Vigencia: 7 días."_
- Tiene CSS print-optimizado (`@media print`).
- Botón "Imprimir / Guardar como PDF" que dispara `window.print()`.
- **Cero dependencias nuevas.** El navegador del usuario genera el PDF.
- Aplica DESIGN.md: Space Grotesk en headers, Inter en body, sin bordes 1px sólidos, glassmorphism solo en pantalla (desactivado en `@media print`).

> Trade-off: el cliente debe imprimir manualmente vs descarga automática. Se acepta porque ahorra adjuntar `puppeteer` o `react-pdf` al bundle, y la URL es compartible directamente por WhatsApp/email — el cliente puede verla en su teléfono sin necesidad de PDF.

---

## 6. Interacciones con módulos existentes

### 6.1 POS Terminal (`pos-terminal.tsx`)

**Sin cambios en Fase 3.** La conversión a venta directa NO usa `pos-terminal.tsx`; llama internamente al mismo helper que usa el endpoint de venta. Esto evita tocar el archivo de mayor riesgo del proyecto.

> ⚠️ Si más adelante se quiere "abrir cotización en POS para editar carrito", eso es Fase 4+ y requiere análisis aparte.

### 6.2 Pedidos (Fase 2G)

`POST /api/pedidos` debe aceptar un parámetro opcional `quotationId` y, si está presente:
- Usar los precios congelados de la cotización en lugar de re-leer del catálogo.
- Persistir `Sale.quotationId`.

Cambio mínimo, additivo, sin romper llamadas existentes desde el modal Nuevo Pedido.

### 6.3 Inventario

- **Stock no se toca al cotizar** (decisión #1).
- En la conversión, el descuento de Stock pasa por el flujo normal de venta/pedido. Las líneas `isFreeForm` no generan `InventoryMovement`.

### 6.4 Catálogo (`ProductVariant`)

- Lectura de precios al crear/editar cotización.
- `price-check` lee precios actuales para detectar drift.
- No se modifica nada del catálogo.

### 6.5 Caja (`CashRegisterSession`)

- Cotizar **no requiere caja abierta**.
- Convertir a venta o pedido **sí requiere** sesión abierta en la sucursal de conversión (regla heredada del POS y Pedidos).

### 6.6 Comisiones

- Cotizar no genera comisión.
- Al convertir, la comisión va al **usuario que convierte** (`convertedByUserId`), no al creador original. Esto es coherente con la realidad del negocio (quien cierra cobra) y se documenta explícitamente en el detalle de la cotización para evitar disputas.

> ⚠️ Si Omar prefiere que la comisión vaya al creador original, basta con cambiar una línea en el endpoint de conversión. La decisión por defecto es "el que convierte cobra".

---

## 7. Decisiones arquitectónicas con trade-offs

### 7.1 `SaleItem.productVariantId` nullable

**Decisión:** volver el campo nullable + agregar `description` y `isFreeForm`.

**Por qué:** las líneas libres son requisito de negocio y la conversión cotización→venta debe poder propagar líneas como "instalación especial $500" sin inventarse un `ProductVariant` ficticio.

**Trade-off:** se pierde la garantía de FK estricta a catálogo en `SaleItem`. Mitigación:
- Regla de negocio: solo se crean SaleItems sin `productVariantId` cuando `isFreeForm = true`.
- Las líneas libres **nunca** generan `InventoryMovement` (validación en el endpoint de venta).
- Reportes de inventario filtran `WHERE productVariantId IS NOT NULL` explícitamente.
- Reportes de ingresos suman todo (las líneas libres también facturan).

**Auditoría necesaria antes de la migración:** localizar todos los queries que asumen `SaleItem.productVariantId NOT NULL` y agregar el filtro. Lista preliminar de archivos a revisar:
- `src/app/api/sales/**/*.ts`
- `src/app/api/reports/**/*.ts` (cuando exista, Fase 5)
- `src/app/(pos)/inventario/**/*.tsx`
- Cualquier `include: { productVariant: true }` en `SaleItem`.

### 7.2 Multi-sucursal con folios independientes

**Decisión:** la cotización guarda `branchId` (origen) y `convertedInBranchId` (destino). El folio de la cotización usa el código de la sucursal origen; el folio de la venta usa el código de la sucursal destino.

**Por qué:** mantiene clean los contadores secuenciales por sucursal sin colisiones, y deja trazabilidad explícita de "cotizado en LEO, vendido en AV135".

**Trade-off:** un usuario distraído podría no notar que la cotización pertenece a otra sucursal. Mitigación: el dialog de conversión muestra un aviso visible cuando origen ≠ destino, y el detalle de la venta resultante muestra el folio de la cotización origen.

### 7.3 No reservar stock

**Decisión:** cotizar es informativo, no toca Stock.

**Por qué:** evita el problema de reservas huérfanas en cotizaciones expiradas/canceladas y simplifica drásticamente el modelo. El negocio confirmó que esto refleja la operación real (los vendedores cotizan rápido, no esperan que el cliente compre el 100% de las cotizaciones).

**Trade-off:** existe la posibilidad de cotizar lo que ya se vendió. El dialog de conversión valida Stock al momento de convertir y muestra el problema con claridad. Las cotizaciones de bicis (pieza única por VIN) son las más sensibles, pero el negocio acepta resolverlo en conversación con el cliente cuando ocurra.

### 7.4 Expiración como cómputo en lectura

**Decisión:** `validUntil` es la fuente de verdad. El campo `status = 'EXPIRED'` es housekeeping opcional.

**Por qué:** elimina dependencia de cron/scheduler para Fase 3. La validación dura está en el endpoint de conversión.

**Trade-off:** una cotización con `status = 'SENT'` puede estar lógicamente expirada en el listado. Mitigación: la UI calcula y muestra "Expirada" si `validUntil < now`, independientemente del campo. Job nocturno de housekeeping puede agregarse en Fase 6 sin cambiar nada de Fase 3.

### 7.5 PDF vía vista pública print-optimizada

**Decisión:** ruta pública con `@media print` + `window.print()`. Cero deps nuevas.

**Por qué:** cumple la necesidad de negocio (PDF compartible con leyenda de validez) sin sumar `puppeteer` (~150MB), `react-pdf` (~500KB extra al bundle) ni un microservicio aparte. La URL es compartible directamente por WhatsApp/email — los clientes en realidad prefieren el link al PDF adjunto en muchos casos.

**Trade-off:** el cliente debe ejecutar "Imprimir → Guardar como PDF" manualmente si quiere el archivo. Aceptable para Fase 3. Si más adelante se necesita generación server-side automática, se agrega `@react-pdf/renderer` en una sub-fase aparte sin romper nada.

### 7.6 Comisión al convertir, no al crear

**Decisión:** `CommissionRecord` se genera en la conversión, no en la creación de la cotización. El crédito va a `convertedByUserId`.

**Por qué:** una cotización no es venta. Cobrar comisión sobre cotizaciones generaría incentivo perverso (inflar cotizaciones que nunca cierran). El que materializa la venta cobra.

**Trade-off:** el creador original puede sentirse "robado" si otro vendedor convierte su cotización. Mitigación: el detalle de la cotización muestra creador y convertidor explícitamente. El negocio puede definir reglas internas de split fuera del sistema si lo desea.

---

## 8. Riesgos identificados

| # | Riesgo | Impacto | Mitigación |
|---|---|---|---|
| 1 | `SaleItem.productVariantId` nullable rompe queries existentes | Alto | Auditoría exhaustiva pre-migración (sección 7.1). Agregar filtros explícitos. |
| 2 | Race condition: dos usuarios convierten la misma cotización | Medio | Lock de fila + revalidación de status en `$transaction`. El segundo recibe 409. |
| 3 | Conversión en sucursal distinta sin stock | Medio | Validación de Stock en el endpoint de conversión, antes de crear el `Sale`. |
| 4 | Cotización editada después de "enviada al cliente" sin que el cliente lo sepa | Medio | El `publicShareToken` apunta a la versión vigente, no a un snapshot. Mitigación: en Fase 4 se puede agregar versionado si el negocio lo pide. Por ahora, regla de proceso: "si edita después de SENT, debe re-enviar el link". |
| 5 | Comisión al convertidor genera disputas internas | Bajo | Decisión documentada y visible en UI. Cambiable con una línea de código. |
| 6 | El job de housekeeping de expiración nunca se implementa | Bajo | No bloquea nada. La validación dura está en el endpoint de conversión. |
| 7 | Líneas libres usadas para vender productos del catálogo "por la libre" saltándose el control de inventario | Medio-Alto | Validación en el endpoint: si la `description` de una línea libre coincide exactamente con un nombre de modelo del catálogo, rechazar con 422 sugiriendo usar el catálogo. (Implementación opcional Fase 3.5.) |
| 8 | Vista pública sin auth puede ser scrapeada con tokens enumerados | Bajo | `publicShareToken` es `cuid()` (entropía suficiente). No incluir info sensible más allá de la cotización misma. |

---

## 9. Checklist de implementación (sugerido para Sonnet)

**Sub-fase 3A — Schema y endpoints base**
- [ ] Auditoría de queries que asumen `SaleItem.productVariantId NOT NULL`.
- [ ] Migración `add_quotations_module`.
- [ ] Endpoints CRUD: POST, PATCH, send, cancel, duplicate.
- [ ] Helper de generación de folio `LEO-COT-NNNN`.

**Sub-fase 3B — UI básica**
- [ ] `/cotizaciones` listado.
- [ ] `/cotizaciones/nueva` formulario.
- [ ] `/cotizaciones/[id]` detalle.
- [ ] `/cotizaciones/[id]/edit`.

**Sub-fase 3C — Conversión**
- [ ] `GET /price-check`.
- [ ] `POST /convert`.
- [ ] `convert-quotation-dialog.tsx`.
- [ ] Modificación additiva a `POST /api/sales` y `POST /api/pedidos` para aceptar `quotationId`.

**Sub-fase 3D — Vista pública / PDF**
- [ ] `/cotizaciones/public/[token]`.
- [ ] CSS print-optimizado.
- [ ] Botón "Compartir link" en detalle.

**Sub-fase 3E — Pulido y validación**
- [ ] `npm run lint` limpio.
- [ ] `npm run build` limpio.
- [ ] Pruebas manuales del flujo completo en LEO y AV135.
- [ ] Commit único: `feat: módulo de cotizaciones (Fase 3)`.

---

## 10. Lo que NO está en este spec (fuera de scope)

- Versionado de cotizaciones (snapshots históricos al editar).
- Aprobación multi-nivel (cotización requiere visto bueno de gerente antes de enviarse).
- Plantillas de cotización reutilizables.
- Envío automático por email/WhatsApp desde el sistema.
- Reportes de tasa de conversión cotización → venta (Fase 5).
- Job nocturno de expiración (Fase 6, opcional).
- Generación server-side de PDF (sub-fase posterior si se requiere).
- Edición de cotización abriendo el carrito en `pos-terminal.tsx` (Fase 4+, alto riesgo).

Cualquier de estos puntos puede agregarse en una sub-fase aparte sin romper el diseño actual.
