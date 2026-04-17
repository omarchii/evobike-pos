# Rediseño del Módulo de Taller — Brief Consolidado

> **Estado:** Diseño cerrado · Implementación pendiente (Sub-fase A en adelante)
> **Última actualización:** 2026-04-17
> **Ubicación de mocks:** `docs/workshop-redesign/mocks/`
> **Owner:** Omar — evobike-pos2

---

## 1. Objetivo

Elevar el Módulo de Taller existente (Fase 4 + P11 completadas) al nivel operativo esperado, cubriendo los flujos que hoy son ambiguos o inexistentes en UI:

- Recepción guiada con evidencia y firma del cliente.
- Kanban con estados intermedios, asignación explícita, aging visual y bandeja de pausadas.
- Ficha técnica con QA obligatorio, filtro inteligente de refacciones, mano de obra mixta (fija/por hora) y chip de tipo de orden.
- Pantalla dedicada de entrega con cobro integrado, firma digital y soporte para pre-pago/garantía/cortesía.
- Flujo de aprobación de trabajo extra con portal público del cliente (WhatsApp link sin backend).
- Dashboard móvil para técnico y vista de ocupación para gerente.

No se reemplaza lógica probada: se respeta el descuento de stock al entregar, el flag `prepaid`, la reutilización de `Sale` con folio propio, y la integración con caja (`assertSessionFreshOrThrow`).

---

## 2. Decisiones arquitectónicas cerradas

| # | Tema | Decisión |
|---|------|----------|
| 1 | Asignación de técnico | **Explícita.** `ServiceOrder.assignedTechId String?` nullable, FK a `User`. Reasignable en cualquier momento por MANAGER/ADMIN; el propio técnico puede tomarla si está sin asignar. |
| 2 | Trazabilidad de ejecución (Opción A) | `userId` = quién registró la orden (ya existe); `assignedTechId` = a quién se asignó; `servicedByUserId String?` nueva = quién efectivamente transicionó a COMPLETED (autollenado). Los tres pueden ser distintos. Reportes de productividad usan `servicedByUserId`. |
| 2b | Reserva de refacciones | **Mantener descuento al entregar** (regla Fase 4, probada). Sumar chip de disponibilidad actual al agregar ítem (🟢/🟡/🔴) sin apartar stock. Órdenes canceladas no generan stock fantasma. |
| 3 | Mano de obra | **Mixta por servicio.** `ServiceCatalog.chargeModel ChargeModel @default(FIXED)` (enum nuevo `FIXED | HOURLY`) + `estimatedMinutes Int?` + `Branch.hourlyRate Decimal?`. En ítems `HOURLY` la UI captura minutos trabajados; precio final siempre se persiste como snapshot en `ServiceOrderItem.price`. |
| 4 | Comunicación con cliente | **WhatsApp sin backend**, patrón `wa.me/52{phone}?text={encoded}` idéntico a cotizaciones públicas. Plantilla editable por sucursal: `Branch.whatsappTemplateTaller String?` con placeholders `{folio}`, `{estado}`, `{total}`, `{linkPublico}`. |
| 5 | Portal público del cliente | **Sí, v1 con aprobación de trabajo extra.** Ruta `/taller/public/[token]` fuera de `(pos)/`, light mode forzado. Incluye timeline, fotos, card de aprobación/rechazo. Sin chat, sin pago en línea. |
| 6 | Control de calidad (QA) | **Checkbox dentro de COMPLETED, no estado nuevo.** Aditivo a `ServiceOrder`: `qaPassedAt DateTime?`, `qaPassedByUserId String?`, `qaNotes String?`. Sin QA marcado, la transición a DELIVERED queda bloqueada. |
| 7 | Tipo de orden | **Nuevo enum `ServiceOrderType`:** `PAID | WARRANTY | COURTESY | POLICY_MAINTENANCE`. Afecta si genera cobro, si aparece en ingresos del taller, y el comprobante que imprime. WARRANTY/COURTESY no cobran; POLICY_MAINTENANCE genera venta con total cero para traza. |
| 8 | Estados del flujo | Se mantiene el enum `ServiceOrderStatus` existente (`PENDING → IN_PROGRESS → COMPLETED → DELIVERED → CANCELLED`). Los sub-estados intermedios (Esperando Refacciones, Esperando Aprobación, Pausada) viven en un enum nuevo `ServiceOrderSubStatus?` nullable, solo aplicable durante IN_PROGRESS. |

---

## 3. Delta de schema propuesto (Sub-fase A)

### 3.1 Enums nuevos

```prisma
enum ChargeModel {
  FIXED
  HOURLY
}

enum ServiceOrderType {
  PAID
  WARRANTY
  COURTESY
  POLICY_MAINTENANCE
}

enum ServiceOrderSubStatus {
  WAITING_PARTS
  WAITING_APPROVAL
  PAUSED
}

enum ServiceOrderApprovalStatus {
  PENDING
  APPROVED
  REJECTED
}

enum ServiceOrderApprovalChannel {
  WHATSAPP_PUBLIC
  PHONE_CALL
  IN_PERSON
  OTHER
}
```

### 3.2 Campos aditivos en modelos existentes

```prisma
model ServiceOrder {
  // ... campos existentes
  assignedTechId       String?
  assignedTech         User?    @relation("ServiceOrderAssignedTech", ...)
  servicedByUserId     String?
  servicedByUser       User?    @relation("ServiceOrderServicedBy", ...)

  type                 ServiceOrderType        @default(PAID)
  subStatus            ServiceOrderSubStatus?  // solo relevante cuando status = IN_PROGRESS

  qaPassedAt           DateTime?
  qaPassedByUserId     String?
  qaPassedByUser       User?    @relation("ServiceOrderQaPassedBy", ...)
  qaNotes              String?

  publicToken          String?  @unique
  publicTokenEnabled   Boolean  @default(true)

  approvals            ServiceOrderApproval[]
}

model ServiceCatalog {
  // ... campos existentes
  chargeModel          ChargeModel @default(FIXED)
  estimatedMinutes     Int?        // informativo en FIXED; base de cálculo en HOURLY
}

model ServiceOrderItem {
  // ... campos existentes
  laborMinutes         Int?        // solo cuando serviceCatalog.chargeModel = HOURLY
}

model Branch {
  // ... campos existentes
  hourlyRate              Decimal? @db.Decimal(10, 2)
  whatsappTemplateTaller  String?
}
```

### 3.3 Modelo nuevo

```prisma
model ServiceOrderApproval {
  id              String                       @id @default(uuid())
  serviceOrderId  String
  itemsJson       Json                         // snapshot de ítems extra propuestos [{nombre, cantidad, precio, subtotal}]
  totalEstimado   Decimal                      @db.Decimal(10, 2)
  status          ServiceOrderApprovalStatus   @default(PENDING)
  channel         ServiceOrderApprovalChannel?
  requestedAt     DateTime                     @default(now())
  respondedAt     DateTime?
  respondedNote   String?
  createdByUserId String

  serviceOrder    ServiceOrder @relation(fields: [serviceOrderId], references: [id], onDelete: Cascade)
  createdBy       User         @relation(fields: [createdByUserId], references: [id])

  @@index([serviceOrderId, status])
}
```

### 3.4 Reglas cruzadas a validar en superRefine / API

- Si `status = COMPLETED` y se intenta transicionar a `DELIVERED`, exigir `qaPassedAt != null`. Sin QA, 422.
- Si `type IN (WARRANTY, COURTESY)`, el flujo de cobro en `deliver` no crea `CashTransaction`; crea `Sale(total=0, type=SERVICE)` para traza.
- Si `type = POLICY_MAINTENANCE`, verificar vigencia de póliza del `CustomerBike` antes de permitir creación (en API, no schema).
- Si `subStatus` está seteado pero `status != IN_PROGRESS`, rechazar.
- Si un `ServiceOrderItem` tiene `serviceCatalog.chargeModel = HOURLY`, exigir `laborMinutes > 0`; calcular `price = round(branch.hourlyRate * laborMinutes / 60, 2)` server-side.
- `publicToken` se genera solo una vez con `crypto.randomBytes(16).toString('base64url')` al crear la orden.

---

## 4. Correcciones críticas de los mocks (ajustar en implementación, no volver a Stitch)

Al portar los mocks a Next.js, corregir estas 5 inconsistencias. Los archivos HTML en `mocks/` son referencia visual, no código fuente.

1. **Pantalla de Entrega pre-pagada** — el caso A del brief no se representó. Cuando `prepaid = true`, la columna derecha de cobro debe reemplazarse por card con surface `--secondary-container` mostrando "Ya pagado el [fecha] vía [método]" sin selector. Además agregar caso C (WARRANTY/COURTESY) que oculta cobro con mensaje correspondiente.
2. **Ficha QA duplicada y fuera de contexto** — la sección QA aparece dos veces en el mock `ficha_de_orden_t_cnica_detallada_2`. En implementación: solo una instancia, visible únicamente en `status = COMPLETED` o al transicionar desde IN_PROGRESS. En IN_PROGRESS la sección no se renderiza.
3. **Wizard Paso 4 sin "Mantenimiento en Póliza"** — agregar el 4to tipo de orden al selector con token `--warn-container` variante suave. Los tipos mapean al enum `ServiceOrderType`: `PAID | WARRANTY | COURTESY | POLICY_MAINTENANCE`.
4. **Portal Público sin retoques v2** — agregar footer con logo de sucursal, dirección abreviada (solo colonia + ciudad), teléfono enmascarado (`55** **67 89`), botón "Contactar por WhatsApp". Agregar estado visual "Lista para recoger" con hero en `--primary-container` cuando `status = COMPLETED` + QA aprobado.
5. **Kanban con 7 columnas + bandeja Pausada** — el mock solo muestra 3 columnas. En implementación: scroll horizontal con header sticky, columnas colapsables (default colapsada: "Entregada" solo las del día). Bandeja lateral "Pausada" fuera del flujo principal.

### 4.1 Correcciones de localización (México)

Stitch usó templates LATAM genéricos. Ajustar estos strings al portarlos:

| Dónde | Error en mock | Correcto |
|---|---|---|
| Wizard Paso 1, buscador | "DNI" | "RFC" o "teléfono" |
| Drawer aprobación, teléfono | `+54 ...` | `+52 ...` |
| Drawer aprobación, montos | `$12.500`, `$5.950`, `$18.450,00` | `$12,500`, `$5,950`, `$18,450.00` |
| Entrega y Cobro, métodos de pago | "Pago QR", "Vale/Cupón" | Usar el enum real del sistema: `CASH | CARD | TRANSFER | CREDIT_BALANCE | ATRATO` |
| Dashboard móvil, chip de estado | "En Banco" | Usar valores del enum `ServiceOrderStatus` o `ServiceOrderSubStatus`; "En Banco" no existe |

### 4.2 Correcciones funcionales menores

- **Wizard Paso 1, banner de mantenimiento P11:** cambiar CTA "Ver Detalles" por toggle inline "¿Agregarlo al diagnóstico inicial?".
- **Wizard Paso 1, semáforo P11:** reemplazar 3 puntos de color por chip legible con label ("🔴 Vencido", "🟡 Por vencer en X días", "🟢 Al día").
- **Wizard Paso 2, checklist:** expandir los 4 puntos del mock a los 10 preconfigurados (luces, frenos delanteros, frenos traseros, llantas, batería, cargador, manillar y controles, pedales y propulsión, chasis, accesorios). Los puntos son editables por sucursal (a futuro, no v1).
- **Wizard Paso 3, tamaño:** ajustar de 20MB a 10MB por foto (alineado con pipeline existente de sharp/webp).
- **Ficha técnica v2:** agregar chip de `ServiceOrderType` en el header. Agregar chip de semáforo P11 con color + fecha del próximo mantenimiento.

---

## 5. Inventario de mocks

Ubicación: `docs/workshop-redesign/mocks/`

| Carpeta | Ruta destino en app | Notas |
|---|---|---|
| `wizard_de_recepci_n_cliente_y_bici/` | `/workshop/recepcion` (paso 1) | Paso 1 del wizard — Cliente y Bici |
| `wizard_de_recepci_n_checklist_e_inspecci_n/` | `/workshop/recepcion` (paso 2) | Paso 2 — Checklist + firma canvas |
| `wizard_de_recepci_n_fotos_de_recepci_n/` | `/workshop/recepcion` (paso 3) | Paso 3 — Evidencia fotográfica |
| `wizard_de_recepci_n_diagn_stico_y_promesa/` | `/workshop/recepcion` (paso 4) | Paso 4 — Diagnóstico, tipo, promesa, asignación |
| `tablero_kanban_de_taller_detallado_2/` | `/workshop` | Kanban principal (v2 retocada) |
| `tablero_kanban_de_taller_detallado_1/` | — | Descartada, usar v2 |
| `ficha_de_orden_t_cnica_detallada_2/` | `/workshop/[id]` | Detalle de orden (v2 retocada) |
| `ficha_de_orden_t_cnica_detallada_1/` | — | Descartada, usar v2 |
| `ficha_de_orden_aprobaci_n_de_trabajo_extra/` | Drawer dentro de `/workshop/[id]` | Modal/drawer para solicitar aprobación |
| `pantalla_de_entrega_y_cobro_redise_o/` | `/workshop/[id]/entregar` | Pantalla dedicada de entrega |
| `pantalla_de_entrega_y_cobro/` | — | Descartada, usar la rediseñada |
| `dashboard_del_t_cnico_mobile_2/` | `/workshop` vista móvil | Dashboard técnico (v2) |
| `dashboard_del_t_cnico_mobile_1/` | — | Descartada, usar v2 |
| `vista_de_ocupaci_n_del_gerente_2/` | `/workshop/ocupacion` | Vista gerente (v2) |
| `vista_de_ocupaci_n_del_gerente_1/` | — | Descartada, usar v2 |
| `portal_del_cliente_light_mode/` | `/taller/public/[token]` | Fuera de `(pos)/`, light mode forzado |
| `kinetic_precision/DESIGN.md` | — | Referencia de Stitch (no vinculante, ver `/DESIGN.md` del repo) |
| `evoflow_editorial/DESIGN.md` | — | Referencia de Stitch (no vinculante) |

**Regla:** al portar cada mock, extraer la estructura visual y aplicar tokens reales de `globals.css`. **Nunca** copiar clases Tailwind con colores literales (`bg-[#1a1c1a]`, `text-[#a5d0b9]`) — todo debe ser `var(--surf-low)`, `var(--on-surf)`, etc., siguiendo la regla documentada en `AGENTS.md §Estilos`.

---

## 6. Plan de sub-fases

| Sub-fase | Alcance | Modelo | Depende de |
|---|---|---|---|
| **A** | Schema aditivo + migración + API Routes (asignación, QA, tipo de orden, sub-estado, aprobaciones, portal público token) | Opus diseño → Sonnet implementación | — |
| **B** | Kanban rediseñado (7 columnas + Pausada lateral + aging visual + chips tipo/pre-pagado + filtros URL-sync) | Sonnet | A |
| **C** | Wizard de recepción (4 pasos, ruta dedicada) con stepper, checklist, firma canvas, uploader, asignación | Sonnet | A |
| **D** | Ficha técnica rediseñada (QA gating, chip tipo orden, filtro refacciones por modelo, mano de obra mixta, timeline, drawer aprobación) + historial de bici | Sonnet | A |
| **E** | Pantalla de Entrega dedicada + PDFs del taller (orden de entrada, etiqueta QR, estimate, comprobante de entrega) | Sonnet | A, D |
| **F** | Portal público del cliente (timeline, galería, aprobación/rechazo, footer sucursal, estado "Lista para recoger") | Sonnet | A |

**Cada sub-fase es una sesión de Claude Code independiente.** Al terminar cada una, revisión en chat + commit + actualización de `ROADMAP.md` y `AGENTS.md`.

---

## 7. Non-goals (no tocar en este rediseño)

- `pos-terminal.tsx` — sigue siendo el archivo de más alto riesgo.
- Regla de descuento de stock al entregar (`WORKSHOP_USAGE` en `deliver`) — probada, se mantiene.
- `Sale.prepaid` flow — se mantiene. El rediseño lo respeta y expone visualmente.
- Integración con cambio de voltaje (`VoltageChangeLog`, `AssemblyOrder`) — se mantiene.
- Regla de P11 mantenimientos (`ServiceCatalog.esMantenimiento`, semáforo 6 meses) — se consume en el Wizard, no se modifica.
- Lógica de comisiones — servicios de taller no comisionan (política operativa existente, no cambia).

---

## 8. Reglas heredadas aplicables

Todas las reglas del repo siguen vigentes. Las más críticas para este módulo:

- **Mutaciones vía API Routes** en `src/app/api/`. Cero Server Actions.
- **Consultas iniciales en Server Components async** directamente con Prisma.
- **`prisma.$transaction()`** para toda operación multi-tabla (entrega genera venta + cash tx + movimientos de stock).
- **Filtro por `branchId` del JWT** en todas las queries excepto ADMIN.
- **`assertSessionFreshOrThrow`** antes de cualquier mutación que genere `CashTransaction`.
- **`requireActiveUser`** antes de mutaciones (defensa ante usuarios desactivados).
- **Enums de Prisma en Client Components** → tupla local `as const` + `z.enum(...)`.
- **`useWatch` del `control`**, no `form.watch()` (React Compiler).
- **Inputs en modales siempre con `--surf-low`** como fondo.
- **Glassmorphism oficial** para modales/drawers: `color-mix(in srgb, var(--surf-bright) 88%, transparent)` + `backdrop-filter: blur(20px)`.
- **Regla No-Line:** separación tonal por surface, nunca `border-b` sólido (excepción: headers de tabla con `--ghost-border`).
- **Tokens antes que valores literales** — prohibido hardcodear colores, radii, etc.
- **Archivos de upload** siguen el patrón sello/factura: validar entidad padre antes de parsear formData, sharp → WebP 2000px 5MB pre-sharp para imágenes, DELETE simétrico.
- **Todo string visible en español de México.**
- **`npm run lint` y `npm run build`** deben pasar limpios antes de commit.

---

## 9. Archivos de referencia en este directorio

```
docs/workshop-redesign/
├── BRIEF.md                          ← este archivo
└── mocks/                            ← 14 pantallas + 2 design tokens de Stitch
    ├── wizard_de_recepci_n_cliente_y_bici/
    │   ├── screen.png
    │   └── code.html
    ├── wizard_de_recepci_n_checklist_e_inspecci_n/
    ├── wizard_de_recepci_n_fotos_de_recepci_n/
    ├── wizard_de_recepci_n_diagn_stico_y_promesa/
    ├── tablero_kanban_de_taller_detallado_2/
    ├── ficha_de_orden_t_cnica_detallada_2/
    ├── ficha_de_orden_aprobaci_n_de_trabajo_extra/
    ├── pantalla_de_entrega_y_cobro_redise_o/
    ├── dashboard_del_t_cnico_mobile_2/
    ├── vista_de_ocupaci_n_del_gerente_2/
    ├── portal_del_cliente_light_mode/
    ├── kinetic_precision/DESIGN.md   ← referencia Stitch, no vinculante
    └── evoflow_editorial/DESIGN.md   ← referencia Stitch, no vinculante
```

Los mocks v1 (`*_1/`) quedaron descartados tras la iteración 2. Se pueden archivar o eliminar.

---

**Fin del brief.** Siguiente paso: Sub-fase A — diseño de schema y APIs con Opus.
