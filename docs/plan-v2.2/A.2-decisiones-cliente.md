# A.2 — Decisiones cliente (cierre 2026-04-30)

**Status:** ✅ Cerrado · **Step:** A.2 plan v2.2 · **Modalidad:** chat asíncrono

## Contexto

Step A.2 del plan v2.2 consolidaba 8 consultas pendientes al cliente (2 originales + 5 Pack C.1 + 1 Pack C.2). Objetivo: desbloquear D, E y G.1 antes de arrancar implementación.

Cliente respondió 7/8 ítems vía chat. Solo #2 P18 (Excel masivo) sigue diferido a JIT por instrucción previa — no se solicita hasta llegar al módulo correspondiente.

## Decisiones cerradas

### #1 Motivos válidos de devolución

Enum `motivoDevolucion` con valores acotados:

- `PRODUCTO_INCORRECTO`
- `FALTANTE_ACCESORIOS`
- `MODELO_EQUIVOCADO`

Defectos de fábrica salen del flujo de devolución y entran al canal P9 garantías taller. Gusto/arrepentimiento queda fuera del enum.

**Aplica:** módulo 7 Devoluciones (Fase A) + campo `Return.reason` Pack C.1 Q2 INT-2.

### #3 Crédito vencido al cancelar venta — Pack C.1 Q4 INT-1

**Opción (c) confirmada:** re-acreditar pero el helper detecta vencido y devuelve esa porción **en efectivo**.

**Implementación:** `applyCustomerCredit` retorna `{ refundedToCredit, refundedToCash }`. Edge B (devolución parcial multi-método) hereda la misma regla.

### #4 Refunds cross-method-to-cash — Pack C.1 Q2 INT-2

**Decisión: solo reporte, sin cap.**

- Cierre de caja muestra "egresos por refund con cambio de método" en línea separada (visibility).
- NO hay cap diario configurable.
- NO requiere autorización MANAGER por agregado (cada refund individual sigue tope SELLER $1,500).

**Simplifica implementación:** un solo agregado de reporte, no policy de cap.

### #5 Devolución parcial con ATRATO — Pack C.1 Q5 INT-2

**API Atrato NO permite reducción parcial post-aprobación.**

**Decisión:** toda devolución cuando hay ATRATO en la mezcla se procesa **vía Atrato**.

- Evobike crea `ReturnEvent` con flag `pendingAtratoCancellation`.
- Notificación a Atrato (manual o webhook según mini-audit `lib/atrato-*`).
- Evobike NO toca CASH ni CREDIT_BALANCE en su lado.
- Atrato cancela contrato y reembolsa al cliente directamente.

**Aplica tanto a `PENDING` como a `COLLECTED`.** Edge B INT-1 simplificado: si la mezcla incluye ATRATO, el flujo se desvía a Atrato sin reparto proporcional local.

### #6 Precio del apartado entre 2m y 6m — Pack C.1 Q6 INT-2

**Opción (a): reajusta a precio actual de lista.** Si subió, cliente paga la diferencia.

**Implementación:** UI de abono lee `Product.currentPrice` post-2m, calcula `delta = currentPrice - reservedPrice`, suma a saldo pendiente. Si bajó: respeta original (no reembolso).

### #7 Dos terminales POS en una venta — Pack C.1 Q7 INT-2

**NO es caso real en Evobike. YAGNI confirmado.**

**Implementación:** Zod refinement bloquea duplicados sobre `method` puro (no sobre tupla `(method, terminalId)`). Discriminated union puede mantener campo `terminalId` opcional para auditoría.

### #8 Retención legal pólizas vencidas/canceladas — Pack C.2 Q4 INT-4

**Opción (b) indefinido confirmado.**

**Implementación:** NO se implementa cron `policy-cleanup`. R2 acumula sin límite. Costo trivial (~$0.70/mes/4.5GB en 5 años).

**Razón:** mejor diferir indefinidamente que arriesgar borrar antes de tiempo legal (Profeco).

## Impacto en plan v2.2

| Step | Antes A.2 | Después A.2 |
|---|---|---|
| C (Pack D.bis Suppliers) | DESBLOQUEADO | Sin cambio |
| D (Pack C.1 INT-1) | bloqueado por Q4 | DESBLOQUEADO COMPLETO — implementar opción (c) |
| E (Pack C.1 INT-2) | bloqueado por Q2/Q5/Q6/Q7 | DESBLOQUEADO COMPLETO — 4 sub-decisiones cerradas |
| F (Pack C.2 INT-6 WhatsApp) | DESBLOQUEADO | Sin cambio |
| G.1 (Pack C.2 INT-4) | bloqueado por Q4 (cleanup) | DESBLOQUEADO + simplificado (no cron, ~2-3h menos) |
| H (Sesión 4 Catálogo) | bloqueado por A.3 | Sin cambio (A.3 cierra aparte) |
| Diferido módulo 7 (`motivoDevolucion`) | bloqueado por #1 | enum con valores definidos |

## Queue cliente residual

**1 abierta:** #2 P18 Excel masivo carga. Diferido a momento del módulo correspondiente (Catálogo / Inventario / migración masiva clientes). NO solicitar ahora.
