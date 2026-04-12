# Fase 4 — Taller completo + Integración POS-Montaje

## 1. Resumen

Fase 4 cierra el ciclo operativo del POS conectando cuatro módulos que hoy viven aislados: **POS, Taller, Inventario y Montaje**. Habilita el cobro de servicios de taller, descuento automático de stock por refacciones, asignación obligatoria de VIN al vender vehículos, y un flujo de cambio de voltaje pre-venta sin costo extra para el cliente que preserva trazabilidad completa de baterías y pólizas de garantía.

Es la fase de mayor riesgo del proyecto: toca `pos-terminal.tsx` (archivo crítico) y debe preservar el flujo de venta actual sin regresiones.

---

## 2. Decisiones rectoras

| # | Decisión | Razón |
|---|---|---|
| D1 | Cobro de servicio = `Sale` tipo `SERVICE` con folio propio | Unifica reportes, comisiones y caja. Un solo modelo financiero. |
| D2 | Cobro puede ser anticipado o al entregar (no parcial) | Operativamente simple para el taller; evita lógica de Layaway en servicios. |
| D3 | Descuento de stock por refacciones ocurre **al entregar**, dentro de `$transaction` con el cobro | Atómico. Evita reservas fantasma y stock negativo por cancelaciones. |
| D4 | VIN obligatorio en POS para vehículos ensamblables, **seleccionado** de `CustomerBike` sin dueño | Elimina error humano de tipeo. Reutiliza datos del montaje. |
| D5 | POS bloquea venta si no hay `CustomerBike` disponible del modelo | Forza disciplina operativa. Sugiere generar BACKORDER. |
| D6 | Cambio de voltaje pre-venta = inline en POS, sin salir al módulo de montaje | UX en una sola pantalla. Atomicidad. Reensamble dura 5 min. |
| D7 | Cambio de voltaje pre-venta no tiene costo. Solo genera trazabilidad. | Decisión de negocio del usuario. |
| D8 | Póliza de garantía se difiere hasta que `AssemblyOrder` de reensamble esté `COMPLETED` | El recibo fiscal se imprime al cerrar venta; la póliza espera la batería real. |
| D9 | Si no hay baterías del nuevo voltaje en stock al cerrar venta, la `AssemblyOrder` queda `PENDING` esperando recepción | Permite cerrar venta sin bloquear operación. La póliza espera. |
| D10 | Cambio de voltaje **post-venta** (cliente regresa) = `ServiceOrder` normal con cobro | Flujo distinto al pre-venta. Es una operación de taller con mano de obra y baterías facturadas. |

---

## 3. Cambios de schema

### 3.1 Nuevos enums

```prisma
enum SaleType {
  // existentes
  DIRECT
  LAYAWAY
  BACKORDER
  SERVICE      // NUEVO — venta originada en taller
}

enum VoltageChangeReason {
  PRE_SALE     // cambio antes de entregar al cliente, sin cobro
  POST_SALE    // upgrade pagado por cliente existente
}
```

### 3.2 Modificaciones a modelos existentes

**`Sale`**
```prisma
model Sale {
  // ... existentes
  serviceOrderId       String?       @unique
  serviceOrder         ServiceOrder? @relation(fields: [serviceOrderId], references: [id])
  warrantyDocReady     Boolean       @default(true)
  // true en ventas normales; false en ventas con cambio de voltaje pendiente de reensamble
}
```

**`ServiceOrder`**
```prisma
model ServiceOrder {
  // ... existentes
  sale         Sale?    @relation
  prepaid      Boolean  @default(false)
  // true si se cobró antes del servicio
}
```

**`ServiceOrderItem`**
```prisma
model ServiceOrderItem {
  // ... existentes
  inventoryMovementId String? @unique
  // FK al InventoryMovement(WORKSHOP_USAGE) generado al entregar
}
```

**`VoltageChangeLog`**
```prisma
model VoltageChangeLog {
  // ... existentes
  saleId         String?              // venta que originó el cambio
  serviceOrderId String?              // orden de taller que originó el cambio
  reason         VoltageChangeReason
}
```

**`AssemblyOrder`**
```prisma
model AssemblyOrder {
  // ... existentes
  voltageChangeLogId String?  @unique
  // si esta orden vino de un cambio de voltaje, apunta al log
}
```

### 3.3 Migración

```bash
npx prisma migrate dev --name phase_4_workshop_pos_assembly
```

No hay backfill necesario: `warrantyDocReady` arranca en `true` para ventas existentes (correcto, ninguna está en estado pendiente de reensamble).

---

## 4. API Routes nuevas y modificadas

### 4.1 Taller — cobro y entrega

**`POST /api/service-orders/[id]/charge`** (NUEVO)
Cobra una `ServiceOrder` antes de entregarla. Crea `Sale` tipo `SERVICE` con folio propio, `CashTransaction`, marca `prepaid = true`. Requiere caja abierta. NO descuenta stock todavía.

**`POST /api/service-orders/[id]/deliver`** (REFACTOR)
Entrega la orden. Dentro de `$transaction`:
1. Si NO está `prepaid`: crea `Sale` + `CashTransaction` (requiere caja abierta).
2. Para cada `ServiceOrderItem` con `productVariantId`: descuenta `Stock`, crea `InventoryMovement(WORKSHOP_USAGE)`, vincula `inventoryMovementId`.
3. Cambia status a `DELIVERED`.
4. Genera comisiones si aplica.

Validación: si algún ítem no tiene stock suficiente, error 422 con detalle.

**`POST /api/service-orders/[id]/cancel`** (REFACTOR)
Si estaba `prepaid`, debe revertir el cobro: marca `Sale` como `CANCELLED`, genera `CashTransaction` inversa. Solo MANAGER/ADMIN.

### 4.2 POS — VIN obligatorio y cambio de voltaje

**`GET /api/customer-bikes/available`** (NUEVO)
Query params: `productVariantId`, `branchId` (auto del token).
Retorna `CustomerBike[]` donde `customerId IS NULL` AND `productVariantId = ?` AND `branchId = ?` AND no tiene `Sale` asociada.
Usado por el selector de VIN en POS.

**`POST /api/sales`** (REFACTOR — compatible hacia atrás)
Acepta nuevos campos opcionales por ítem:
- `customerBikeId` — obligatorio si el ítem es vehículo ensamblable.
- `voltageChange` — objeto opcional `{ targetVoltajeId, batteryLotId? }` para cambio de voltaje pre-venta.

Dentro del `$transaction` existente, agrega:
1. Validar que cada `customerBikeId` existe, está sin dueño, y pertenece a la sucursal.
2. Vincular `CustomerBike.customerId = sale.customerId` y `CustomerBike.saleId = sale.id`.
3. Si hay `voltageChange`:
   - Crear `VoltageChangeLog(reason: PRE_SALE)`.
   - Actualizar `CustomerBike.voltajeId` al target.
   - Crear `AssemblyOrder` de **desinstalación** (PENDING) — vinculada al `saleId` y `voltageChangeLogId`.
   - Crear `AssemblyOrder` de **reensamble** (PENDING) — vinculada al `saleId`, `voltageChangeLogId` y `customerBikeId`.
   - Marcar `Sale.warrantyDocReady = false`.

### 4.3 Montaje — trigger de póliza

**`POST /api/assembly/[id]/complete`** (REFACTOR)
Al final del `$transaction` existente, agregar:
- Si `assemblyOrder.saleId` existe, contar `AssemblyOrder` PENDING restantes para ese `saleId`.
- Si el conteo es 0, actualizar `Sale.warrantyDocReady = true`.

### 4.4 Pólizas

**`GET /api/sales/[id]/warranty-pdf`** (NUEVO)
Retorna PDF de póliza de garantía. Si `warrantyDocReady = false`, retorna 409 con mensaje "Póliza pendiente de reensamble".

---

## 5. Páginas y componentes

### 5.1 Taller (`/taller`)

- **Vista de detalle de orden** (`/taller/[id]`): nuevos botones "Cobrar ahora" y "Entregar y cobrar" según estado. Modal de cobro reutiliza componentes de pago de POS (`PaymentMethodSelector`, `SplitPaymentDialog`).
- Badge "Pre-pagado" cuando `prepaid = true`.
- En `DELIVERED`: muestra link al `Sale` generado.

### 5.2 POS (`/pos`)

⚠️ **Cambios a `pos-terminal.tsx` — máxima precaución.**

- Al agregar un vehículo ensamblable al carrito → se abre `VinSelectorDialog` (componente nuevo, aislado). Lista `CustomerBike` disponibles del modelo. Si la lista está vacía, muestra CTA "Generar pedido BACKORDER".
- Una vez seleccionado el VIN, el ítem del carrito muestra serie + voltaje actual.
- Botón "Cambiar voltaje" en el ítem del carrito → abre `VoltageChangeDialog` (nuevo). Muestra voltajes disponibles según `BatteryConfiguration` para ese modelo. Al confirmar, marca el ítem con `voltageChange` (no se ejecuta hasta cerrar venta).
- Validación al cerrar venta: todos los vehículos ensamblables tienen `customerBikeId`.
- Tras cerrar venta exitosa con cambio de voltaje: toast informa "Venta cerrada. Reensamble pendiente — la póliza estará disponible al completar el reensamble."

### 5.3 Vista de venta (`/ventas/[id]`)

- Si `warrantyDocReady = false`: badge amarillo "Póliza pendiente de reensamble" + lista de `AssemblyOrder` pendientes con link al Kanban de montaje.
- Si `warrantyDocReady = true`: botón "Imprimir póliza".

### 5.4 Kanban de montaje (`/assembly`)

- Las `AssemblyOrder` originadas en cambio de voltaje pre-venta muestran un chip distintivo (color `tertiary` — Electric Blue, según DESIGN.md) con texto "Reensamble por venta".
- Click en el chip → link a la venta originadora.

---

## 6. Interacciones con módulos existentes

| Módulo | Interacción |
|---|---|
| **Caja (CashRegisterSession)** | Cobro de taller exige caja abierta del usuario que cobra, igual que POS. |
| **Comisiones** | Ventas SERVICE generan `CommissionRecord` igual que ventas DIRECT, según `CommissionRule`. El técnico que entregó es el `userId` de la comisión. |
| **Inventario** | Refacciones de taller generan `InventoryMovement(WORKSHOP_USAGE)`. Reportes de inventario deben incluir este tipo. |
| **Pedidos (BACKORDER)** | Si POS bloquea por falta de VIN, redirige a "Crear pedido BACKORDER" pre-llenando modelo/cliente. |
| **Montaje** | El selector de VIN solo lista `CustomerBike` con `AssemblyOrder COMPLETED` (es decir, que pasaron por el flujo de montaje). |

---

## 7. Trade-offs y decisiones no obvias

**T1 — Cambio de voltaje inline vs. salir al módulo de montaje.** Inline gana en UX (1 pantalla) y atomicidad ($transaction única), pierde en simplicidad de `pos-terminal.tsx`. Mitigación: aislar toda la lógica en `VoltageChangeDialog` + endpoint, sin contaminar la lógica del carrito.

**T2 — Póliza diferida vs. póliza con datos provisionales.** Diferir es más limpio: la póliza siempre refleja la realidad física. Provisional invitaría a errores de garantía. Costo: el cliente espera 5 min por su póliza, pero ya tiene su recibo fiscal y su bici.

**T3 — Cobro al entregar vs. cobro anticipado de taller.** Permitir ambos es flexibilidad operativa real (algunos clientes pagan al dejar la bici, otros al recogerla). El costo es lógica de cancelación más compleja (revertir cobro). Aceptable.

**T4 — Stock al entregar vs. al agregar refacción.** Al entregar es más seguro (cancelaciones no fugan stock) pero un técnico podría agregar refacciones que no existen. Mitigación: la UI del taller debe consultar stock en tiempo real al agregar refacciones (advertencia, no bloqueo) y bloquear duro al intentar entregar.

**T5 — VIN bloqueante en POS.** Es disciplina operativa fuerte. Si el técnico no registró bien una unidad en montaje, el vendedor no puede vender. Mitigación: vista rápida en POS de "unidades pendientes de ensamble" para que el vendedor pida prioridad al técnico.

---

## 8. Riesgos

| Riesgo | Severidad | Mitigación |
|---|---|---|
| Regresión en `pos-terminal.tsx` que rompa flujo de venta básico | 🔴 Crítica | Sub-fase 4-A aislada solo para refactor de pos-terminal. QA manual completo del flujo de venta normal antes y después. Feature flag para activar/desactivar VIN obligatorio durante rollout. |
| Race condition en `warrantyDocReady` | 🟡 Media | Toda actualización dentro de `$transaction`. Recomputar contando AssemblyOrder PENDING en cada complete, no decrementar contador. |
| Cancelación de venta con cambio de voltaje en curso | 🟡 Media | Definir endpoint `POST /api/sales/[id]/cancel` que también cancele AssemblyOrders pendientes y revierta `CustomerBike.voltajeId` al original (requiere guardar voltaje original en `VoltageChangeLog`). |
| Cancelación de servicio prepagado | 🟡 Media | Solo MANAGER/ADMIN. CashTransaction inversa. Auditoría obligatoria. |
| Stock negativo al entregar servicio | 🟢 Baja | Validar dentro de `$transaction`, error 422 si insuficiente. |

---

## 9. Sub-fases de implementación

| Sub-fase | Alcance | Toca pos-terminal | QA crítico |
|---|---|---|---|
| **4-A** | Schema + migración + endpoint `available customer-bikes` | No | No |
| **4-B** | Cobro y entrega de taller (sin tocar POS) | No | Flujo taller completo |
| **4-C** | `VinSelectorDialog` + integración mínima en pos-terminal (VIN obligatorio, sin cambio de voltaje) | **Sí** | Flujo venta completo, regresión total |
| **4-D** | `VoltageChangeDialog` + lógica pre-venta + póliza diferida | **Sí** | Reensamble end-to-end, póliza diferida |
| **4-E** | Cancelación de venta con voltage change + cancelación de servicio prepagado | Parcial | Cancelaciones |

Cada sub-fase es un PR independiente con `lint` + `build` limpios.

---

## 10. Checklist de implementación

### Sub-fase 4-A
- [ ] Migración Prisma con todos los campos nuevos
- [ ] `GET /api/customer-bikes/available` con tests manuales
- [ ] Tipos TypeScript actualizados

### Sub-fase 4-B
- [ ] `POST /api/service-orders/[id]/charge`
- [ ] Refactor `POST /api/service-orders/[id]/deliver` con descuento de stock atómico
- [ ] Refactor `POST /api/service-orders/[id]/cancel` con reversión de cobro
- [ ] UI de cobro/entrega en `/taller/[id]`
- [ ] QA: cobrar antes, entregar, cancelar prepagado, entregar con stock insuficiente

### Sub-fase 4-C
- [ ] `VinSelectorDialog` componente aislado
- [ ] Integración en `pos-terminal.tsx` (mínima invasiva)
- [ ] Validación en `POST /api/sales` de `customerBikeId` obligatorio
- [ ] Vinculación `CustomerBike ↔ Sale` en transacción
- [ ] QA regresión completa: venta normal, layaway, backorder, devoluciones

### Sub-fase 4-D
- [ ] `VoltageChangeDialog` componente aislado
- [ ] Endpoint `POST /api/sales` acepta `voltageChange`
- [ ] Trigger en `assembly/[id]/complete` para `warrantyDocReady`
- [ ] `GET /api/sales/[id]/warranty-pdf` con bloqueo si pendiente
- [ ] Badge en `/ventas/[id]` y chip en Kanban
- [ ] QA: venta con cambio de voltaje end-to-end, póliza diferida, sin stock de baterías

### Sub-fase 4-E
- [ ] Cancelación con reversión de voltaje
- [ ] Auditoría de cancelaciones de servicio prepagado

---

## 11. Fuera de scope

- Reportes y dashboards de taller (Fase 5).
- Comisiones diferenciadas para servicios vs ventas (Fase 5).
- Integración de pólizas con sistema externo de garantías del proveedor.
- Cobro parcial de servicios (anticipo + saldo). Decisión D2.
- Re-venta o segunda mano de `CustomerBike` (caso aparte).
- Cambio de voltaje en `ServiceOrder` post-venta — usa el flujo normal de taller (refacciones + mano de obra), sin lógica especial. La trazabilidad ya queda en `VoltageChangeLog(reason: POST_SALE)` que se crea desde el endpoint de service order delivery cuando se detecta cambio de voltaje en el ítem.

---
