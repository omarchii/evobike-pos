# BRIEF — Rediseño del módulo de Clientes

**Creado:** 2026-04-22
**Scope:** Paso 2, módulo 5 (rediseño UI + reestructura funcional)
**Dependencias:** DESIGN.md (v1), primitivos EvoFlow, reportes shell (`DetailHeader` / `KpiGrid` / `FilterPanel`), infraestructura P6 (react-pdf 4.4.1)
**Modelo recomendado:** Sonnet para sub-fases A–I, Opus para J+K+L (merge multi-FK + PDFs).

---

## 1. Resumen ejecutivo

El módulo de Clientes hoy es pre-design-system (32 violaciones 🔴 de DESIGN.md), subutiliza la data que ya existe en schema, y vive separado de `/reportes/clientes/[id]` generando duplicación funcional.

El rediseño hace tres cosas en paralelo:

1. **Pase completo de DESIGN.md** — tokens, primitivos, glassmorphism, formatters, No-Line rule.
2. **Reestructura por valor operativo** — directorio con alertas activas, perfil 360° con timeline unificado, tab Bicis como centro del dominio e-bike, fusión con el estado de cuenta financiero gated por rol.
3. **Exposición de data latente** — todo lo que el schema captura pero nunca se ve (RFC, phone2, dirección de envío, historial de baterías, voltajes, prepaid, warrantyDocReady, checklists de taller).

**Customer es global / multi-sucursal.** Sin `branchId` owner. SELLER ve todos los clientes del sistema y todas sus actividades cross-sucursal (un cajero en Sucursal A atiende clientes que compraron en B). "Sucursal preferida" = cómputo de actividad.

---

## 2. Decisiones cerradas

### Las 6 grandes

| # | Decisión | Resolución |
|---|---|---|
| 1 | Portal público del cliente | ❌ NO — se pospone hasta existir membresía |
| 2 | Fusionar `/customers` ↔ `/reportes/clientes/[id]` | ✅ SÍ, con tab Finanzas gated por rol. `/reportes/clientes` mantiene solo análisis cross-customer |
| 3 | WhatsApp | ✅ Deep-link `wa.me` (no API oficial) |
| 4 | Permisos de edición | ✅ SELLER edita contacto + dirección + notas + fiscales (con confirmación + audit). **`creditLimit` = MANAGER+ siempre** |
| 5 | Segmentación | ✅ Automática (derivada) + tags manuales (MANAGER) superpuestos |
| 6 | Timeline con recargas | ✅ Migrar `CashTransaction.customerId` |

### Adiciones posteriores (decididas durante iteración)

- Búsqueda omni (nombre / teléfono / email / VIN / RFC / folio)
- Entrada por bici (VIN → dueño)
- Detección de duplicados **al crear** (no solo merge post-hoc)
- Merge de clientes con soft-merge + undo 30d (MANAGER+)
- Soft-delete de Customer (MANAGER+, con enum de motivo)
- Flag B2B (`isBusiness`) + contacto secundario
- PDF de ficha (por cliente y por bici)
- Consentimiento de comunicación (LFPDPPP)
- Audit log de ediciones sensibles — visible a SELLER (sus propios edits) y MANAGER+ (todos)
- Quick-create mid-venta desde POS

### Schema opinion-based

- Odómetro por bici: ✅
- Fecha de nacimiento: ✅
- Foto de modelo: ✅ (ya existe en catálogo)
- Split `firstName`/`lastName`: ❌ **DESCARTADO** — se conserva `Customer.name` canónico; el form presenta dos inputs visuales (`Nombre(s)` + `Apellidos`) que concatenan con `.trim()` al guardar. Búsqueda por apellido funciona con `ILIKE %{term}%` sobre el campo completo. Helper `splitDisplayName(name)` para display segmentado puntual.

---

## 3. Cambios de schema

Todo aditivo (nullable o con default). Cero breaking changes. Blast radius: bajo.

### 3.1 Nuevos campos en `Customer`

```prisma
birthday               DateTime?
isBusiness             Boolean  @default(false)
communicationConsent   Boolean  @default(false)
tags                   String[] @default([])
phonePrevious          String?      // soft-save antes de editar phone (guardrail dec. 4)
mergedIntoId           String?      // FK a Customer — target de fusión
mergedAt               DateTime?
deletedAt              DateTime?
deletedReason          CustomerDeleteReason?

@@index([mergedIntoId])
@@index([deletedAt])
```

```prisma
enum CustomerDeleteReason {
  DUPLICATE
  REQUEST
  ERROR
}
```

### 3.2 Nuevos campos en `CustomerBike`

```prisma
odometerKm   Int?   // capturable en recepción de taller y editable inline desde el perfil
```

### 3.3 Nuevo campo en `CashTransaction`

```prisma
customerId   String?   // FK a Customer, nullable

@@index([customerId])
```

Script de backfill: para transacciones vinculadas a una `Sale`, copiar `sale.customerId`. Recargas standalone sin vínculo inferible quedan `null` (no aparecerán en timeline).

### 3.4 Tablas nuevas

```prisma
model CustomerNote {
  id          String        @id @default(cuid())
  customerId  String
  customer    Customer      @relation(fields: [customerId], references: [id])
  authorId    String        // User.id
  author      User          @relation(fields: [authorId], references: [id])
  kind        CustomerNoteKind
  body        String        @db.Text
  pinned      Boolean       @default(false)
  createdAt   DateTime      @default(now())

  @@index([customerId, createdAt(sort: Desc)])
}

enum CustomerNoteKind {
  NOTE
  PHONE_CALL
  WHATSAPP_SENT
  EMAIL_SENT
}

model CustomerEditLog {
  id              String    @id @default(cuid())
  customerId      String
  customer        Customer  @relation(fields: [customerId], references: [id])
  customerBikeId  String?   // opcional — para ediciones sobre CustomerBike (ej. odómetro)
  userId          String
  user            User      @relation(fields: [userId], references: [id])
  field           String    // "rfc" | "creditLimit" | "razonSocial" | "phone" | "odometerKm" | ...
  oldValue        String?
  newValue        String?
  reason          String?   // textarea del dialog de confirmación (fiscales, creditLimit)
  createdAt       DateTime  @default(now())

  @@index([customerId, createdAt(sort: Desc)])
  @@index([customerBikeId, field])
}
```

### 3.5 Backfills requeridos (Sub-fase A)

1. **Normalización de `Customer.phone`** — helper `normalizePhoneMX` aplicado a todos los registros existentes antes de añadir índice estricto.
2. **Normalización de `Customer.rfc`** — `UPDATE customer SET rfc = UPPER(TRIM(rfc))` antes de añadir unique constraint/índice.
3. **`CashTransaction.customerId`** — join inverso desde `Sale` cuando exista vínculo.
4. **`Customer.tags`** — default `[]` para todos los existentes.

### 3.6 Índices nuevos

- `CustomerBike.serial` o `CustomerBike.vin` (búsqueda por VIN en omni-search — verificar si ya existe)
- `Customer.rfc` (unique + búsqueda)
- `Customer.phone` (búsqueda)
- `Customer.email` (búsqueda)

---

## 4. Normalización y validación

### 4.1 Teléfono (`src/lib/customers/phone.ts`)

```ts
normalizePhoneMX(input: string): string          // "+52 (55) 1234-5678" → "5512345678"
formatPhoneDisplay(raw: string): string           // "5512345678" → "(55) 1234 5678"
formatPhoneForWhatsApp(raw: string): string      // "5512345678" → "5255512345678" (con code 52)
```

Aplicar en `zod.preprocess` para `customerCreateSchema`/`customerUpdateSchema`. Almacenar siempre raw 10 dígitos.

### 4.2 RFC

`z.string().trim().toUpperCase().regex(/^[A-ZÑ&]{3,4}\d{6}[A-Z0-9]{3}$/)` en el zod schema. Valida física (13) o moral (12).

### 4.3 `emailFiscal` default = `email`

En form Sub-fase D: checkbox "Mismo que email de contacto" encima del campo `emailFiscal`, default ✅. Autocompleta y bloquea el input si marcado.

### 4.4 Validación compartida (Sub-fase D precondición)

`src/lib/customers/validation.ts`:

```ts
export const customerCreateSchema = z.object({ /* full: name, phone, email, rfc, ... */ })
export const customerQuickCreateSchema = customerCreateSchema.pick({
  name: true, phone: true, communicationConsent: true
})
export const customerUpdateSchema = customerCreateSchema.partial()
```

Sub-fase L (quick-create POS) consume `customerQuickCreateSchema`. Cero duplicación de reglas.

### 4.5 Helper `splitDisplayName`

```ts
/**
 * Divide un nombre completo en token principal y resto.
 * NO es una descomposición nombre/apellidos — es un split cosmético.
 * Para nombres compuestos ("María José García López") el caller decide.
 * @returns { first: string, rest: string }
 */
splitDisplayName(name: string): { first: string; rest: string }
```

Uso exclusivo para display puntual (ej. saludo `"Hola, {first}"`). **No usar para lógica de negocio.**

---

## 5. Semántica de saldos (nomenclatura canónica)

Estandarizada en todo el brief, endpoints y UI. Nunca más "Saldo total pendiente" ambiguo.

| Concepto | Nombre canónico | Campo / cómputo |
|---|---|---|
| Dinero que el cliente tiene **con nosotros** (positivo) | **Saldo a favor** | `Customer.balance` |
| Dinero que el cliente **nos debe** (apartados pendientes) | **Saldo por cobrar** | `sum(Sale.total - payments.sum) WHERE Sale.type = 'LAYAWAY'` |
| Límite de crédito autorizado | **Límite de crédito** | `Customer.creditLimit` |
| Crédito disponible = límite − saldo por cobrar | **Crédito disponible** | derivado |

La card de Finanzas se titula **"Saldo por cobrar"** con chip `Vencido por X días` cuando aplica.

---

## 6. Soft-merge y soft-delete (políticas explícitas)

### 6.1 Soft-merge

**Flujo:**
- Merge reasigna FKs (Sale, ServiceOrder, Quotation, Payment, CashTransaction, CustomerNote, etc.) desde `source` a `target` en `$transaction`.
- Source NO se borra — se marca `source.mergedIntoId = target.id` y `source.mergedAt = now()`.
- Listado global filtra `WHERE mergedIntoId IS NULL AND deletedAt IS NULL`.
- Acceso directo a URL del source (`/customers/{sourceId}`) → redirect 308 al target.

**Reglas antichain (endpoint rechaza con 409):**
- `source.mergedIntoId !== null` → ❌ source ya está mergeado
- `target.mergedIntoId !== null` → ❌ target está mergeado (evita cadena A→B→C)
- `exists(customer WHERE mergedIntoId = source.id)` → ❌ source es target de otro merge previo (evita orfandad si fuera mergeado hacia otro lado)

UI desactiva el botón "Fusionar con…" con tooltip `"Este cliente ya participó en una fusión reciente"` cuando aplica.

**Undo window (30 días):**
- `POST /api/customers/[id]/unmerge` — solo MANAGER+, solo si `mergedAt > now - 30d`.
- Reverte reasignación en `$transaction`; limpia `mergedIntoId` y `mergedAt`.
- Botón "Deshacer fusión" visible en tab Datos del target cuando hay fuentes recientes apuntando a él.

### 6.2 Soft-delete

**Política:**
- `DELETE /api/customers/[id]` → set `deletedAt = now()` y `deletedReason = enum`.
- Hard-delete nunca (FKs en Sale/ServiceOrder/etc. lo impedirían).
- MANAGER+ only.

**Scope del filtro global — CRÍTICO:**
El filtro `WHERE deletedAt IS NULL` se aplica **SOLO** a queries top-level sobre Customer:
- `/api/customers` (listado)
- `/api/customers/search` (omni + detección duplicados)
- `/api/customers/stats` (KPIs)
- Power grid `/customers`

**NO se aplica en relaciones.** Los siguientes paths SIEMPRE ven el Customer (incluso soft-deleted):
- `Sale.customer` relation (tickets, estado de cuenta, PDFs de venta)
- `ServiceOrder.customer` relation (fichas de taller, etiquetas, PDFs)
- `Quotation.customer` relation (PDFs de cotización)
- `CashTransaction.customer` relation (reportes de caja)
- `Payment.customer` relation (si aplica)
- `CustomerEditLog.customer` relation
- Command Palette search (para no perder resultados históricos)
- Todos los endpoints de reportes agregados

**Razón:** un Customer soft-deleted que tiene Sale históricas no debe hacer que esas Sales pierdan su referencia — rompería reportes históricos, reimpresión de CFDIs y auditoría.

**Implementación:** NO usar Prisma `$extends` con filtro global. Aplicar filtro explícito en helpers `listCustomers()`, `searchCustomers()`, `customerStats()`. Relaciones vía `include` heredan sin filtro por default.

**UI:** cuando se renderiza un Customer desde una relación y `deletedAt !== null`, chip gris `<Chip variant="neutral">Cliente eliminado</Chip>` junto al nombre.

**Restauración:** MANAGER+ puede visitar `/customers?showDeleted=1` para ver soft-deleted y restaurar (`PATCH /api/customers/[id]/restore` — set `deletedAt = null`).

---

## 7. Information Architecture

### 7.1 Mapa de rutas

```
/customers                            → Directorio (SELLER+)
/customers?showDeleted=1              → Directorio incluyendo eliminados (MANAGER+)
/customers/new                        → Registro (SELLER+) — cierra deuda 1-C del roadmap
/customers/[id]                       → Perfil canónico 360°
   ?tab=resumen       (default)
   ?tab=ventas
   ?tab=taller
   ?tab=bicis         (antes "VIN / Activos")
   ?tab=cotizaciones
   ?tab=finanzas      (MANAGER+)
   ?tab=datos
/customers/[id]/editar                → Formulario de edición
/customers/[id]/ficha.pdf             → PDF ficha completa
/customers/[id]/bicis/[bikeId]/historial.pdf → PDF historial bici
/customers/[id]/merge                 → Wizard de fusión (MANAGER+)

/reportes/clientes                    → (sin cambios) ranking/agregados cross-customer
/reportes/clientes/[id]               → 308 redirect a /customers/[id]?tab=finanzas
```

### 7.2 Directorio `/customers`

**Header**
- Título "Clientes" (Space Grotesk, headline-sm)
- CTAs: `+ Nuevo cliente` (Velocity Gradient) · `Exportar CSV` (secondary)

**KPI strip (4 tarjetas, `KpiGrid`)**
1. **Clientes totales** — count + delta vs mes anterior
2. **LTV acumulado** — sum de `Sale.total` completed + delta
3. **Ticket promedio** — LTV / # compras completadas
4. **Saldo por cobrar total** — sum apartados pendientes, chip `warn` "Requiere atención" si > umbral

**Panel de filtros (`FilterPanel`)**
- Omni-search: input único "Buscar por nombre, teléfono, email, VIN, RFC o folio…" (debounce 250ms, server-side)
- Chips rápidos (toggleables): `Todos` · `Activos (últ. 90d)` · `Con saldo por cobrar` · `Mant. vencido` · `Empresas` · `En riesgo (90-180d)`
- Filtros avanzados (colapsable): sucursal de actividad reciente (ADMIN), rango de LTV, con/sin bicis, con/sin consentimiento, tag manual

**Power Grid**

| Col | Contenido |
|---|---|
| Cliente | Avatar + `name` + RFC en `--on-surf-var` + chip `Empresa` si `isBusiness` |
| Ciudad | `shippingCity, shippingState` |
| Bicis | Count + icon bike |
| Última compra | `formatRelative` |
| LTV | `formatMXN` |
| Saldo | `formatMXN`, chip `warn` si por cobrar vencido |
| Alertas | Chips derivados (hasta 2 visibles + "+N") |

**Row actions:** abrir perfil (click), WhatsApp (deep-link), copiar teléfono.

**Selección múltiple** (bulk):
- `Exportar selección CSV`
- `Generar lista WhatsApp` — filtra internamente a `communicationConsent === true`. Header del modal: "X de Y seleccionados tienen consentimiento. Z serán omitidos." Opción "Ver omitidos" abre diálogo con los excluidos para capturar consent faltante antes de enviar.
- `Agregar tag` (MANAGER+)

### 7.3 Registro `/customers/new` y edición `/customers/[id]/editar`

Layout 2 columnas (desktop), cards semánticas.

**Columna izquierda**
- **Card "Datos Personales"** — nombre(s), apellidos (dos inputs que concatenan en `name`), fecha nacimiento, toggle `Es empresa` (muestra/oculta razón social + datos adicionales)
- **Card "Contacto"** — email, teléfono principal, teléfono WhatsApp (autocompleta con principal), teléfono secundario, checkbox `Acepta recibir comunicación (WhatsApp/email)`

**Columna derecha**
- **Card "Datos Fiscales"** — RFC (validación 12/13), Régimen, Uso CFDI, Email fiscal (con checkbox "Mismo que email de contacto"), Domicilio fiscal (Calle, Num Ext, Int, CP, Colonia)
- **Card "Logística y Entregas"** — checkbox "Misma que fiscal" → autocompleta; Dirección de envío + Referencias para el transportista

**Detección de duplicados inline:** mientras el usuario escribe RFC/teléfono/email en el form de creación, fetch a `/api/customers/search?match={field}` → si hay match ≥1, banner bajo el input:
> "Existe un cliente con este {campo}: **Juan Pérez (RFC: XXX)**. ¿Es el mismo? [Usar existente] [No, es otro cliente]"

**Guardrails en edición (dec. 4):**
- Campos `rfc`, `razonSocial`, `regimenFiscal`: ícono candado + tooltip "Cambios quedan registrados en el historial". SELLER ve dialog de confirmación al guardar: "Este cambio no modifica CFDIs ya emitidos. Motivo:" + textarea. Motivo se escribe a `CustomerEditLog.reason`.
- Campo `phone`: el valor anterior se guarda en `phonePrevious` antes de sobrescribir.
- Campo `creditLimit`: oculto para SELLER, editable en card de Finanzas (MANAGER+ only) con modal de justificación obligatoria.

**CTAs:** `Limpiar formulario` (secondary) · `Guardar registro` (Velocity Gradient).

### 7.4 Perfil `/customers/[id]`

**Header sticky (`DetailHeader`)**
- Avatar + `name` en Space Grotesk headline-sm
- Chip gris `Cliente eliminado` si `deletedAt !== null` (caso raro desde relación; el listado no lo mostraría)
- Fila secundaria: `ID: CUST-XXXX · RFC · email · phone` con íconos
- Chips: `Empresa` (si `isBusiness`) + `Zona {shippingState}` + chips automáticos de segmentación + tags manuales (color diferente)
- Acciones derechas: `WhatsApp` (deep-link con template) · `Nueva venta` · `Nueva orden taller` · `···` (Editar · Descargar ficha PDF · Fusionar · Eliminar — MANAGER+)

**KPI strip (3 tarjetas, abajo del header)**
1. **LTV total** — sum `Sale.total` completed + delta vs año anterior
2. **Última visita** — `formatRelative` de la actividad más reciente
3. **Sucursal preferida** — `{branchName} · {%} de visitas` (groupBy `branchId` sobre Sale + ServiceOrder + Quotation)

*"Miembro desde" se desplaza a tab Datos como dato secundario — no ocupa slot de KPI.*

**Branch-scope de tabs:** los tabs Ventas, Taller y Cotizaciones muestran TODA la actividad del cliente en CUALQUIER sucursal, sin filtrar por `session.branchId`. Consecuencia explícita de "Customer multi-sucursal" — un cajero en Sucursal A atiende clientes que compraron en B y necesita ver la historia completa.

#### Tab Resumen (default)

**Panel izquierdo (2/3)**
- **Alertas activas** — cards compactas arriba, solo si hay:
  - Mantenimiento vencido en alguna bici → "Evo R-Series tiene 45 días vencida de mantenimiento" + botón `Agendar`
  - Saldo por cobrar vencido → "$4,500 vencidos hace 14 días" + botón `Cobrar`
  - Cotización próxima a expirar → botón `Reactivar`
  - Garantía por expirar en <30d → botón `Ver póliza`

- **Timeline unificado** — cronológico descendente, cards con dot + conector vertical. 7 fuentes:
  - `Venta` (bag) — folio, total, método, vendedor
  - `Apartado` (bookmark) — folio, total, % pagado (progress bar inline)
  - `Pago/Abono` (wallet) — monto, método, ref, venta asociada
  - `Orden taller` (wrench) — folio, bici, tipo, estado, total
  - `Cotización` (document) — folio, total, estado efectivo
  - `Recarga saldo a favor` (coin) — monto, método
  - `Nota/Interacción` (comment) — autor, texto, categoría (Note · Call · WA · Email)
- Filtro por tipo (chips togglables) + rango de fechas (server-side)
- Header del tab: "523 eventos totales" (count) + botón `Cargar más`
- Paginación: offset-based, 50 eventos por página, default últimos 12 meses. Ver §13 deuda conocida.
- Botón primario arriba: `+ Nueva nota / interacción` → modal (ver §8)

**Panel derecho (1/3) — sidebar sticky**
- Card "Saldo a favor": monto grande + botón `Recargar saldo`
- Card "Crédito": `Límite · Usado · Disponible` con `ProgressSplit`
- Card "Notas pinned" (máx 3, MANAGER+ puede pinear una nota crítica)

#### Tab Ventas (absorbe apartados)

Power Grid:

| Fecha | Folio | Tipo | Total | Descuento | Método | Vendedor | Sucursal | Estado |

- Chip tipo: `Contado` · `Apartado` · `Crédito`
- Chip estado: `Completada` · `Parcial X%` · `Cancelada`
- Row expand: ítems + notas internas + `warrantyDocReady`
- Row actions: ver venta, imprimir ticket, generar póliza
- Muestra ventas de TODAS las sucursales del cliente

#### Tab Taller

Power Grid:

| Fecha ingreso | Folio | Bici (VIN) | Tipo | Estado | Sub-estado | Fecha prometida | Total | Prepago | Sucursal |

- Chip tipo: `PAID` · `WARRANTY` · `COURTESY` · `POLICY_MAINTENANCE`
- Chip sub-estado: `WAITING_PARTS` · `WAITING_APPROVAL` · `PAUSED`
- Si `prepaid === true` → chip `Prepagada $X`
- Row click → orden completa
- Muestra órdenes de TODAS las sucursales del cliente

#### Tab Bicis

Por cada `CustomerBike` una card ancha con 3 secciones:

**Izquierda — identidad**
- Foto del modelo (`ProductVariant.imageUrl`)
- Chip de estado computado: `Operativa` · `En taller` (si hay ServiceOrder PENDING/IN_PROGRESS) · `Baja`
- Modelo + año, VIN, color, voltaje actual
- Chip de mantenimiento: `Al corriente` · `Por vencer` · `Vencido` (de `computeMaintenanceStatus`)

**Centro — datos técnicos**
- Odómetro actual (`odometerKm`, editable inline con historial en tooltip/popover)
- Batería actual: voltaje + serial (link al detalle)
- Último mantenimiento: fecha + folio

**Derecha — acciones**
- `Nueva orden taller` (prefill)
- `Historial PDF`
- `Ver ensamble` (si `assemblyOrders.length > 0`)
- kebab: `Editar odómetro` · `Cambiar voltaje` · `Cambiar batería` · `Dar de baja`

**Historial de odómetro** (popover junto al campo): lista de `CustomerEditLog` con `field='odometerKm' AND customerBikeId={bikeId}`, oldValue → newValue, autor, fecha.

**Accordion por card:**
- **Historial de baterías** — `BatteryAssignment` con serial, assignedAt, unassignedAt, voltaje, notas
- **Historial de voltaje** — `VoltageChangeLog` con fecha, voltaje anterior/nuevo, motivo, autor
- **Historial de mantenimientos** — `ServiceOrder` de esa bici con checklist expandible

**Alerta superior destacada**: "Mantenimiento Programado — Revisión de X,000 km pendiente para VIN: {VIN}" + botón `Agendar cita` → wizard recepción prefill.

#### Tab Cotizaciones

Conserva estructura P7-D — refresh de tokens y formatters. Columnas: folio, fecha, validUntil, total, estado efectivo, sucursal, acciones (ver, duplicar, convertir). Cross-sucursal.

#### Tab Finanzas (MANAGER+ only)

Absorbe `/reportes/clientes/[id]`.

**Header del tab** — `Corte al: {hoy}` · `Moneda: MXN` · botón `Descargar estado de cuenta PDF`

**Panel izquierdo (1/3)**
- Card **Saldo por cobrar**: monto grande + chip `Vencido por X días` si aplica
- Card **Crédito**: `Límite $X / Disponible $Y` + `ProgressSplit`
  - Botón `Editar límite` → modal (MANAGER+ only)
- Card **Saldo a favor** con botón `Recargar`

**Panel derecho (2/3)**
- Card **Movimientos** con toggle chips `Abonos` · `Cargos` · `Todos`:

| Fecha | Descripción (con icono) | Folio | Cargo | Abono | Saldo |

- Card **Pagos parciales** (solo apartados con pagos): timeline compacta con fecha, método, ref, monto

#### Tab Datos

Vista read-only con secciones colapsables + botón `Editar` (→ `/customers/[id]/editar`):

- **Identidad** — nombre completo, fecha nacimiento + edad derivada, "Cliente desde" (antigüedad), `isBusiness`
- **Contacto** — email, phone, phone2, chip consentimiento (verde/rojo)
- **Fiscal** — RFC, razonSocial, regimenFiscal, usoCFDI, emailFiscal, direccionFiscal
- **Dirección de envío** — 8 campos + `shippingRefs`
- **Segmentación**
  - Chips del sistema (read-only, tooltip "calculados a partir de…")
  - Tags manuales con botón `+ Agregar tag` (MANAGER+)
- **Historial de cambios** (`CustomerEditLog`) — tabla con field, oldValue → newValue, reason, autor, fecha.
  - **SELLER** ve filtrado a `WHERE userId = currentUser.id` (sus propios edits, para transparencia)
  - **MANAGER+** ve todos los edits del cliente
- **Fusiones** (si aplica) — lista de Customers con `mergedIntoId = thisCustomer.id`. Si alguno está dentro de ventana 30d → botón `Deshacer fusión` (MANAGER+).

### 7.5 Pantallas derivadas

- **Wizard de fusión `/customers/[id]/merge`** — dos paneles lado a lado (cliente actual · destino con buscador); tabla de campos con radio por fila para elegir versión ganadora; preview de FKs que se reasignan (Sales, ServiceOrders, Quotations, Payments, CashTransactions, CustomerNotes count); confirmación modal. Validación antichain server-side.
- **PDF ficha cliente** (`/customers/[id]/ficha.pdf`) — resumen en una página: header, KPIs, lista de bicis, últimas 10 ventas/servicios, saldo, datos fiscales. Reusa `react-pdf@4.4.1` + sello + fonts ya cargadas.
- **PDF historial por bici** (`/customers/[id]/bicis/[bikeId]/historial.pdf`) — para garantías de fabricante: identidad de la unidad, dueño actual, cronológico completo de `ServiceOrder`s con checklists, cambios de voltaje, cambios de batería.

---

## 8. Modales y diálogos

Todos con glassmorphism oficial (`color-mix(in srgb, var(--surf-bright) 88%, transparent)` + `blur(20px)`), focus trap, ESC para cerrar, sin `border`.

| Modal | Trigger | Shape | Rol |
|---|---|---|---|
| **Nueva nota / interacción** | botón tab Resumen | textarea + select kind (Nota · Llamada · WhatsApp · Email) + opción `Pinear` | SELLER+ |
| **Recargar saldo** | sidebar resumen / card finanzas | monto + método (efectivo/transfer/tarjeta) + nota. Sustituye `add-balance-dialog` actual con tokens, glassmorphism y `formatMXN` | SELLER+ |
| **Editar límite de crédito** | card Crédito en Finanzas | monto + justificación obligatoria (escribe a `CustomerEditLog.reason`) | MANAGER+ |
| **Confirmar edición fiscal** | submit de `editar` con cambio en RFC/razón/régimen | "Este cambio no modifica CFDIs ya emitidos. Motivo:" + textarea | SELLER+ (con audit) |
| **Cambiar voltaje de bici** | kebab card bici | nuevo voltaje + motivo → escribe `VoltageChangeLog` | TECHNICIAN+ |
| **Cambiar/asignar batería** | kebab card bici | serial existente o nueva → actualiza `BatteryAssignment` | TECHNICIAN+ |
| **Editar odómetro** | kebab card bici / inline en centro de card | nuevo valor + motivo opcional → escribe `CustomerEditLog (field='odometerKm', customerBikeId=X)` | TECHNICIAN+ |
| **Dar de baja bici** | kebab card bici | confirmación + motivo (roto/vendida/perdida) | MANAGER+ |
| **Agregar tag** | tab Datos → Segmentación | combobox de tags existentes + crear inline | MANAGER+ |
| **Eliminar cliente** | header kebab | confirmación + select `deletedReason` (DUPLICATE/REQUEST/ERROR) | MANAGER+ |
| **Deshacer fusión** | tab Datos → Fusiones | confirmación + preview de FKs que se revertirán | MANAGER+ |
| **Bulk WhatsApp** | selección múltiple listado | resumen "X con consentimiento, Y omitidos" + link `Ver omitidos` | SELLER+ |

---

## 9. Endpoints

### Nuevos

```
GET    /api/customers                        — listado con filtros (top-level, filtro soft-delete aplica)
GET    /api/customers/search                 — omni + detección duplicados (top-level)
GET    /api/customers/stats                  — KPIs del directorio (top-level)
POST   /api/customers                        — crear
PUT    /api/customers/[id]                   — editar (rol-gated por campo + audit)
DELETE /api/customers/[id]                   — soft-delete (MANAGER+)
PATCH  /api/customers/[id]/restore           — restaurar soft-deleted (MANAGER+)
POST   /api/customers/[id]/merge-into        — fusionar (MANAGER+, rechaza chains 409)
POST   /api/customers/[id]/unmerge           — deshacer fusión (MANAGER+, <30d)
GET    /api/customers/[id]/timeline          — 7 fuentes agregadas, offset-based
POST   /api/customers/[id]/notes             — crear entrada
DELETE /api/customers/[id]/notes/[noteId]    — eliminar (autor o MANAGER+)
PATCH  /api/customers/[id]/notes/[noteId]    — toggle pin (MANAGER+)
PATCH  /api/customers/[id]/tags              — add/remove tags manuales
GET    /api/customers/[id]/edit-log          — historial (filtrado por rol)
GET    /api/customers/[id]/ficha.pdf         — PDF ficha
GET    /api/customers/[id]/bicis/[bikeId]/historial.pdf  — PDF historial bici
PATCH  /api/customer-bikes/[id]              — editar odómetro / voltaje / batería (side-effects + audit)
```

### Modificados

```
/api/customers/[id]/balance        — al escribir, setea CashTransaction.customerId
/api/sales (POST)                  — al crear, propaga customerId a CashTransaction asociadas
```

### Permanecen sin cambios

```
/api/customer-bikes/available
/api/workshop/customers/search     — consolidar con /api/customers/search en pasada posterior (deferido)
```

---

## 10. Reglas de segmentación automática + caché

### 10.1 Chips derivados (no persistidos)

| Chip | Condición |
|---|---|
| `Top LTV` | LTV en top 10% de los últimos 12 meses |
| `Frecuente` | ≥3 sales COMPLETED en últimos 12 meses |
| `En riesgo` | Última actividad entre 90-180 días |
| `Inactivo` | Sin actividad >180 días |
| `Mant. vencido` | ≥1 bici con `computeMaintenanceStatus === "VENCIDO"` |
| `Saldo sin usar` | `balance > 0` y sin cambio >90 días |
| `Sin consentimiento` | `communicationConsent === false` y `phone !== null` |
| `Empresa` | `isBusiness === true` |

### 10.2 Caché

- Cache tag por cliente: `customer:{id}:segments`
- Invalidación event-driven con `revalidateTag()` en:
  - `POST /api/sales` (completed) → recalcula LTV, última actividad
  - `POST /api/customers/[id]/balance` → recalcula "Saldo sin usar"
  - `PATCH /api/service-orders/[id]` (cambio de estado) → recalcula "Mant. vencido"
  - `PATCH /api/customer-bikes/[id]` (odómetro) → recalcula "Mant. vencido"
- TTL 1h como fallback por si algún endpoint escribe sin revalidar
- Implementación: `unstable_cache` con `tags` (patrón ya usado en otros módulos)

---

## 11. Sub-fases de implementación

Cada sub-fase = un commit limpio con `prisma validate` + `npm run lint` + `npm run build` en verde.

| # | Sub-fase | Qué entrega |
|---|---|---|
| A | Schema + migraciones + backfill | Todos los campos/tablas nuevos (aditivos), backfill de phone/rfc/CashTransaction.customerId. Sin UI. |
| B | Endpoints | Todos los endpoints nuevos + modificados, con zod schemas compartidos (`validation.ts`) y audit logs. Tests de contrato mínimos. |
| C | Directorio | Rehacer `customer-list.tsx` con primitivos, KPI strip, omni-search, chips rápidos, filtros avanzados, bulk actions. DESIGN.md compliance total. |
| D | Registro + edición + duplicate detection | `/customers/new` ruta dedicada, `/customers/[id]/editar`, detección duplicados inline, guardrails campos sensibles. |
| E | Perfil: shell + header + KPIs + Resumen | `DetailHeader` + chips dinámicos + KPI strip + sidebar sticky + tab Resumen (alertas + timeline + 2 modales). |
| F | Perfil: tab Bicis | Cards amplias con foto, chip estado, accordions (baterías/voltajes/mantenimientos), 4 modales, chip `computeMaintenanceStatus` clickable. |
| G | Perfil: tabs Ventas / Taller / Cotizaciones | 3 grids con primitivos, chips estado/tipo, row expand, exposición de data invisible (discount, notes, subStatus, prepaid, warrantyDocReady). |
| H | Perfil: tab Finanzas | Absorbe P10-B detail. Card saldo/crédito con `ProgressSplit`, movimientos con toggle, pagos parciales, PDF, modal editar límite, 308 redirect desde `/reportes/clientes/[id]`. |
| I | Perfil: tab Datos + audit + tags | Secciones colapsables read-only, chips derivados + tags manuales, tabla `CustomerEditLog` filtrada por rol, sección Fusiones con undo. |
| J | Merge wizard | `/customers/[id]/merge`, preview FKs, $transaction de reasignación, validación antichain, undo 30d. |
| K | PDFs (cliente + bici) | `ficha.pdf` y `historial.pdf` con react-pdf, reusa sello/fonts, links desde header perfil y cards de bici. |
| L | Quick-create mid-venta POS | Modal mínimo en `/point-of-sale` consumiendo `customerQuickCreateSchema`, flag `customerProfileIncomplete` en listado. |

---

## 12. Agrupación en sesiones

| Sesión | Sub-fases | Riesgo | Rationale |
|---|---|---|---|
| 1 | A + B | 🟡 / 🟢 | Schema aditivo + endpoints. Backend-only, un commit sin UI visible. |
| 2 | C + D | 🟡 | Directorio + registro + edición. Comparten `/api/customers/search` y layout de forms. Reemplaza 2 rutas visibles. |
| 3 | E | 🟡 | Shell del perfil + Resumen. Alta densidad UI, sesión propia. |
| 4 | F + G | 🟡 | Bicis (pesado) + 3 grids (mecánicos). Patrones repetidos. |
| 5 | H + I | 🟢 | Finanzas + Datos. Ambas chicas, H redirige 308, I mayormente read-only. |
| 6 | J + K + L | 🟡 | Merge (multi-FK transaction) + PDFs + quick-create POS. Independientes entre sí. |

**Regla:** una sesión de Claude Code por sesión de esta tabla. No mezclar. Documentar cierre en ROADMAP.md al final de cada una.

**Pre-condición Sub-fase D:** extraer `src/lib/customers/validation.ts` con `customerCreateSchema` y `customerQuickCreateSchema` desde el arranque, para que L consuma el subset sin duplicar reglas.

---

## 13. Riesgos y deuda conocida

### Riesgos mitigados

- **Split name descartado** → Sub-fase A pierde ~40% de riesgo. Único cambio con blast radius grande queda fuera.
- **Soft-delete scope** → documentado que el filtro NO aplica en relaciones. Previene bug de "Cliente: —" en tickets/CFDIs históricos.
- **Soft-merge antichain** → endpoint valida 3 condiciones; UI desactiva con tooltip.

### Deuda conocida (documentar al implementar)

- **Timeline offset-based** → performance degrada a partir de offset ~500. Aceptable para cliente típico (≤200 eventos). Refactor a cursor opaco `base64({createdAt, source, id})` con `WHERE` por fuente cuando aparezca un cliente con >500 eventos. Tag en ROADMAP Fase 6.
- **Consolidar `/api/workshop/customers/search` con `/api/customers/search`** → diferido para no engordar Sub-fase B.
- **Notificaciones automáticas** (cumpleaños, mantenimiento próximo) → requiere cron. Fase 6.

### Decisiones diferidas

- Portal público del cliente (revisitar si aparece membresía)
- API oficial WhatsApp (revisitar cuando haya volumen de outbound automático)
- Bulk `CustomerCommunication` log → empieza como entrada de `CustomerNote` con `kind=WHATSAPP_SENT`; solo promover a tabla si el volumen lo justifica

---

## 14. Fuera de alcance (explícito)

- Programa de fidelización / tiers / puntos (descartado desde mockups de referencia)
- Telemetría de bici (firmware, battery live %, GPS, sync) — las e-bikes NO son conectadas
- Sistema de tickets de soporte (la `ServiceOrder` cubre)
- Test drives / agendamiento de pruebas de manejo
- Múltiples direcciones de envío por cliente
- Fotos del cliente (solo avatar/inicial generado)
- Recuperación de contraseña / auth del cliente (no hay login de cliente)
- SMS (solo WhatsApp)

---

## 15. Checklist de implementación

- [x] Brief firmado
- [x] BRIEF.md escrito
- [ ] ROADMAP.md actualizado bajo "Paso 2, módulo 5. Clientes" apuntando a este brief
- [ ] Verificar que `ProductVariant` (u equivalente) tiene `imageUrl` con fotos cargadas antes de Sub-fase F
- [ ] Sesión 1 (A+B) en conversación nueva de Claude Code — arrancar con: `"Implementar Sub-fases A y B de docs/customers-redesign/BRIEF.md"`
