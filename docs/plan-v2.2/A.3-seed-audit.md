# A.3 — Mini-audit seed pre-Fase A (cierre 2026-04-30)

**Status:** ✅ Cerrado como C+ · **Step:** A.3 plan v2.2 · **Modalidad:** audit read-only + ajuste de convención + schedule backstop

## Contexto

A.3 era el "mini-audit seed pre-Fase A" del plan v2.2. Objetivo: identificar gaps de cobertura en el seed que pudieran friccionar QA durante las 4-6 semanas de Catálogo (módulo 1 Fase A). Bloqueaba H.

## Método

Mapeo cruzado de los 40 modelos de `prisma/schema.prisma` vs llamadas `prisma.<model>.create/upsert/createMany` en `prisma/seed.ts` y `prisma/seed-transactional.ts`.

## Hallazgos

| Categoría | Count | Notas |
|---|---|---|
| ✅ Seeded | 30/40 | Todo el dominio crítico (catálogo, ventas, taller, baterías, simple products, purchases, customers) |
| ⚪ Event logs OK vacíos por diseño | 5 | `CustomerNote` · `CustomerEditLog` · `ServiceOrderApproval` · `VoltageChangeLog` · `AuthorizationRequest` |
| 🔴 Features pre-existentes sin seed | 5 | `AlertThreshold` (Reports v1) · `BankBalanceSnapshot` (P9) · `OperationalExpense` (P9) · `StockTransfer` + `StockTransferItem` (P12) |

**Verificación complementaria:** `tsc --noEmit` exit 0 (sanity check pre-audit).

## Decisión: C+ (sin código retroactivo)

Cuatro razones para no cerrar los 5 gaps en A.3:

1. **Criterio dispositivo.** Ninguno de los 5 módulos (P9 Tesorería, P12 Transferencias, Reports v1) entra en la ventana de trabajo de las próximas 4-6 sem. Catálogo + cluster Pack C/D no los toca. Cliente no abre esos módulos en demo. Cerrar gaps "por si acaso" es trabajo sin signal.
2. **Time estimates optimistas.** El estimate inicial de 3h era irreal; el realista (con buffer de cross-fixture debugging) era 4-5h, fuera del timebox A.3.
3. **Riesgo de scope creep.** Seedear `StockTransfer` puede destapar drift entre P12 y los movimientos legados (`Stock`, `InventoryMovement`). Fix de schema NO es scope de A.3.
4. **Fixtures sin tráfico = artificiales.** `AlertThreshold` sin data orgánica que cruce umbrales no es QA-able, es decoración. Necesita volumen real de Catálogo + módulos posteriores antes de tener sentido.

La convención de seed es **prospectiva por diseño** (PRs que tocan módulos llevan su seed delta). Aplicarla retroactiva sobre todo el legacy contradice su espíritu.

## Acciones tomadas

### 1. Convención ampliada

`prisma/seed*.ts` → trigger del rule cambió de "PR que toca schema" a **"PR que toca módulo (schema o código)"**. Cierra el hueco donde un refactor de código sin schema-touch dejaba la deuda silenciosa.

Excepciones documentadas:
- Modelo agregado vacío deliberadamente (ej. `JobRun` populado por crons).
- PRs cosméticos sin riesgo de QA (rename no-semántico, formatting, comments).

### 2. Backstop calendario

Routine one-shot programada para 2026-06-11 09:00 America/Mexico_City (~6 sem post-A.3, pre-Fase 6 Hardening):

- Routine ID: `trig_01BVqurqnFSLvJ6jCJ7Ya4jR`
- Manage: https://claude.ai/code/routines/trig_01BVqurqnFSLvJ6jCJ7Ya4jR
- Read-only (Bash + Read + Glob + Grep) — sin Edit/Write
- Acción: por cada uno de los 5 gaps, `git log` desde 2026-04-30 → si hubo actividad y no hay seed delta = violación 🔴; si actividad + seed = ✅ orgánico; si no actividad = ⚪ JIT-pendiente. Output report breve con recomendación pre-Hardening.

Si los módulos legacy quedan estáticos hasta Fase 6, este check captura la deuda sin esperar a un PR retroactivo.

### 3. Inventario JIT documentado

Los 5 gaps quedan registrados con:

- Costo estimado por gap (rango realista, no optimista).
- Trigger natural: próximo PR que toque el módulo (per convención ampliada).
- Riesgos específicos identificados (drift `StockTransfer`↔`Stock`/`InventoryMovement`, `AlertThreshold` sin tráfico, `OperationalExpense` con restricción `metodoPago` ≠ CASH).
- Probabilidad de cierre orgánico: media para módulos en Fase C planeada (Tesorería); baja para los que solo son verificación.

## Impacto en plan v2.2

| Step | Antes A.3 | Después A.3 |
|---|---|---|
| H (Sesión 4 Catálogo) | bloqueado por A.3 | ✅ DESBLOQUEADO (cuando aterrice post C/D/E/F/G.1) |

Sin cambios en C/D/E/F/G.1 (ya estaban desbloqueados por B + A.2).

## Lecciones de framing

Sub-producto del audit: meta-lección sobre cómo enmarcar audits de cobertura.

**Criterio dispositivo:** el primer filtro NO es costo, es scope window. Si el módulo afectado no entra en la ventana de trabajo, el gap es deuda JIT — no obligación retroactiva. El análisis de costo solo aplica DESPUÉS de un sí en el filtro dispositivo.

Aplicable también a audits futuros de tests, docs, tipos, feature flags.
