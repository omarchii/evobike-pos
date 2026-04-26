# Cluster Decisions — Pre-Fase 6 Rediseño UI

> **Estado:** Decisiones cerradas · 0 bloqueantes del doc
> **Última actualización:** 2026-04-24
> **Owner:** Omar — evobike-pos
> **Próximo paso:** Fase 0 (infra pre-cluster) → Fase A (cluster interconectado)
> **Uso:** contexto obligatorio para prompts a Claude Design / Stitch y para sesiones de Claude Code que toquen módulos de Fase A o C. No reemplaza `DESIGN.md`; lo complementa con decisiones de producto.

---

## 0. Cómo usar este documento

**Qué es:** fuente de verdad de las decisiones de producto/arquitectura que cerramos antes de rediseñar visualmente los 14 módulos vivos del app.

**Cuándo pegarlo:**
- Como anexo al starter-pack del prompt de Claude Design / Stitch, para cualquier módulo de Fase A o Fase C.
- Como contexto inicial de sesiones de Claude Code que impacten módulos clasificados (b) o (c).
- Como referencia entre sesiones espaciadas, para no reabrir decisiones.

**Cuándo NO aplica:**
- Módulos ya rediseñados (Shell, Clientes, Taller P13, Reportes S0-S10). Esos ya tienen sus propios BRIEFs vigentes.
- Fase 6 (hardening/producción). Esas decisiones viven en `ROADMAP.md §FASE 6`.

**Regla de actualización:** si una decisión se reabre, marcarla con ⚠️ y citar la sesión que la revisó. No borrar — deja pista.

---

## 1. Decisiones cerradas

### 1.1 Módulos fuera de scope

| Módulo | Resolución | Razón |
|---|---|---|
| **Proveedores** | Diferido (featured próximo) | Sin requisito explícito del cliente. `PurchaseReceipt.proveedor` queda como string libre normalizado server-side (commit `4e01b7a`) |
| **Compras / Órdenes de compra (PO)** | Diferido | Evobike **no emite ningún documento al proveedor antes de recibir mercancía** (confirmado 2026-04-24). Primera evidencia documental es la factura/recepción al llegar — PO sin trigger de negocio |
| **Facturación / CFDI** | Fuera de scope **permanente** | Cliente especifica que no es necesario. `/reportes/exportacion-contable` (V15) queda como placeholder visual sin backend PAC |

**Implicación operativa:** cero nuevos módulos CRUD se crean en este ciclo. Si aparece la necesidad, se abren como features Fase 6+ con sus propios BRIEFs.

---

### 1.2 Composición del cluster interconectado (Fase A)

El cluster son los módulos que comparten entidades (producto, stock, sale, saleItem, customer) y que si se rediseñan desacopladamente generan regresiones visuales o de shape de data. Se trabajan como bloque con decisiones compartidas.

```
                    ┌─────────────────┐
                    │    CATÁLOGO     │  ← sale de /configuracion al cluster
                    │ (Modelos,       │    (opción A aprobada 2026-04-24)
                    │  Variants,      │
                    │  SimpleProducts,│
                    │  BatteryConfig) │
                    └────────┬────────┘
                             │ define entidades
                ┌────────────┼────────────┐
                ▼            ▼            ▼
       ┌──────────────┐ ┌─────────┐ ┌──────────────┐
       │  INVENTARIO  │ │   POS   │ │ COTIZACIONES │
       │ (recepciones,│ │ Terminal│ │ app + público│
       │  stock,      │ │         │ │              │
       │  movimientos)│ │         │ │              │
       └──────┬───────┘ └────┬────┘ └──────┬───────┘
              │              │             │
              │              ▼             ▼
              │         ┌─────────┐   ┌─────────┐
              │         │ VENTAS  │◄──┤ PEDIDOS │
              │         │ + Devol.│   │(apartados│
              │         └────┬────┘   │ backord.)│
              │              │        └─────────┘
              ▼              ▼
       ┌──────────────┐ ┌─────────────┐
       │TRANSFERENCIAS│ │CASH REGISTER│
       │ (cross-branch│ │  (caja      │
       │  stock)      │ │  operativa) │
       └──────────────┘ └─────────────┘
                │
                ▼
         ┌──────────────┐
         │  ASSEMBLY    │ (montaje post-compra)
         └──────────────┘
```

**10 módulos en el cluster** (Fase A):
Catálogo · Inventario · POS Terminal · Cotizaciones app · Cotizaciones portal público · Ventas (+Devoluciones) · Pedidos · Transferencias · Cash Register · Assembly.

**4 módulos independientes** (Fase C, no cluster):
Dashboard · Tesorería · Autorizaciones · Configuración (sin Catálogo).

**Regla de fusión Catálogo:** vive físicamente en `/configuracion/catalogo/*` pero se rediseña como parte del cluster, NO como sub-ruta de Configuración. Las otras sub-rutas de Configuración (usuarios, servicios, comisiones, umbrales, sucursal) se quedan en Fase C.

---

### 1.3 Decisiones de diseño — cluster

| Tema | Decisión | Implicación |
|---|---|---|
| **Caja operativa** (`/cash-register`) | **Cluster, junto a POS Terminal** | POS escribe en caja (cobros, descuentos, cancelaciones). Se mueven como unidad. Tesorería (Fase C) queda coordinando tokens "no cerrar puertas" con Caja para heredar sin fricción |
| **Assembly / Ensambles** (`/assembly`) | Mantener ruta propia + reusar primitivos del POS **sin fusión formal** | Ya está en (a) limpia. Cero trabajo visual. Solo verificación |
| **Portal público de Cotizaciones** (`/cotizaciones/public/[token]`) | Rediseño para **paridad total con `/taller/public/[token]`** | Timeline de conversión análogo al taller (5-step), hero reactivo por estado, glassmorphism oficial. Portales del mismo negocio se ven como primos |
| **Caja — refund en efectivo** | Requiere sesión de Caja abierta. Si no hay sesión, único método disponible = `Customer.balance` (nota de crédito) | Regla de negocio explícita para el flujo de Devoluciones |

---

### 1.3.5 Interlocks cerrados — Pack A.1 (2026-04-25)

5 decisiones de shape de data upstream cerradas en sesión dedicada de chat (~30 min, formato frase por ítem). Evidencia concreta del problema verificada contra código antes de decidir.

| Interlock | Decisión |
|---|---|
| **I1a** | **Canonicalizar `displayName` server-side**. Una fuente para todo el cluster. Razón: 4 composiciones distintas hoy (`(pos)/page.tsx:665` espacios · `cotizaciones/public/[token]/page.tsx:463` middots con orden distinto · `api/pedidos/[id]/pdf/route.tsx:117` guiones · `workshop/[id]/page.tsx:133` espacios) garantizan drift mañana. Agregar `capacidad.label` post-S1 será 1 cambio en lugar de 8. |
| **I1b** | **Helper puro `src/lib/products/display.ts`**. Patrón establecido del repo (`branch-filter.ts`, `format.ts`, `workshop.ts`), type-safe vía inputs, grep-able trivial, sin migración de schema. Las otras 3 opciones (Prisma derived / view SQL / trigger) son sobreingeniería para el tamaño del problema. |
| **I3a** | **Solo "disponible" con desglose discoverable**. Tooltip-on-hover en desktop; **tap-to-expand o ícono "i" siempre visible en touch** (no asumir hover — Workshop Mobile cerrado en G3 commit `00e403a` es el caso obvio). `/inventario` mantiene los 3 buckets visibles en su detail view. **Implica fix de datos, no solo UI:** la query debe devolver `disponible = total − reservado − en_tránsito` — no basta cambiar la UI sobre `stocks[0].quantity` (`inventario/page.tsx:40`); ese es el bug actual del vendedor sobrevendiendo reservados de Assembly. |
| **I6** | **Helpers nombrados por caso de producto** (no god-helper con flags). 4 casos = 4 helpers explícitos sobre `branchWhere` existente: stock-read POS · return-lookup cross-branch · scope transferencias 2-branches · scope cotización (operador vs cliente). Razón: cada flujo es una decisión de producto, no un flag de query — meter todo en un helper único termina en 6 parámetros opcionales y oculta la semántica. |
| **I7** | **Híbrido seed minimal**. Registry universal arranca con exactamente **3 valores: `EN_CURSO`, `TERMINADO`, `CANCELADO`**. Sub-estados quedan locales por defecto. **Regla de promoción explícita:** un sub-estado asciende al registry solo si se repite en **2+ módulos**. La regla corta el debate ahora ("¿`DELIVERED` cuenta como terminal? ¿`PAGADA` es lo mismo que `COMPLETED`?") posponiéndolo hasta evidencia de reuso. Mezcla EN/ES de los enums actuales NO se resuelve acá — diferido a Fase 6 §rename. |

**Refinamientos pinned (al implementar):**

- **I3a fix de datos** → al rediseñar Inventario (módulo 2 del cluster, post-Catálogo), la query del dashboard de stock debe devolver `disponible` neto (`total − reservado − en_tránsito`), no `stocks[0].quantity` bruto. Anotar en `BRIEF_inventario.md` cuando se arme.
- **I3a touch-friendly** → componente de stock (probablemente nuevo en barrel de primitivos) expone prop `interaction: "hover" | "tap"` o detecta `pointer: coarse` via media query. No bloquea decisión, es plumbing del componente.
- **I7 regla de promoción** → cuando un sub-estado aparezca en 2+ módulos, se evalúa promoción al registry. Hasta entonces vive local en su módulo.

**Implicaciones cross-cluster:**

- Helper de `displayName` aterriza al **inicio del módulo Catálogo** (módulo 1 del cluster, donde se introducen las entidades). Migración de los ~8 callsites identificados como evidencia entra como one-shot del propio módulo Catálogo, no se difiere.
- 4 helpers de I6 viven en `src/lib/branch-filter.ts` extendiendo el módulo existente (no crear archivos nuevos).
- Registry I7 vive en `src/lib/status-registry.ts` (nuevo). Cada módulo del cluster importa los 3 primarios; sub-estados se definen junto al módulo.
- Estimado distribuido cross-cluster: **~6-10h** (helper `displayName` ~2h al introducirse en Catálogo · 4 helpers branch ~2h al primer módulo que los toque · registry I7 + chips primarios cross-cluster ~2-6h distribuido).

**Pack A.2 cerrado 2026-04-25** — ver §1.3.6 más abajo. Las 6 sub-decisiones acopladas de I10 (helper · signatures · API axis · forma · sweep · backfill `VoltageChangeLog`) integradas en sesión dedicada con verificación 3-for-3.

---

### 1.3.6 Interlocks cerrados — Pack A.2 (2026-04-25)

1 interlock con 6 sub-decisiones acopladas (**I10 — lookup canónico de `BatteryConfiguration`**) cerrado en sesión dedicada de chat. Verificación 3-for-3: cada round (seed callsites · schema axis · routing real · seed data multi-config) cambió o refinó la dirección preliminar.

#### Decisiones finales

| Sub-decisión | Resultado |
|---|---|
| **I10.1** | Helper canónico (no status quo per-módulo). 3 refuerzos al ADR: (a) los 4 huérfanos Assembly empujan al helper — status quo deja bug latente indefinidamente; (b) **type-safety vía `BatteryConfigKey` 3-axis** es el argumento más fuerte (compile-time vs runtime 5 meses después); (c) sweep atómico single-PR o no se hace. |
| **I10.2** | **2 funciones públicas finales:** `findConfigsByModelVoltage(m, v)` plural (escape hatch para listings, JSDoc explícito "no `[0]`") + `resolveConfigForBike(BatteryConfigKey)` singular. `resolveConfigForBatteryVariant` **eliminada** post-verificación de schema (mismo `batteryVariantId` puede aparecer en `BatteryConfiguration` de 2 bicis distintas → firma raw reproduce S1 con otra cara). `findConfigByDimensions({m,v,c})` también descartada (los 3 callsites de seed tienen variant en mano, flujo 1). |
| **I10.3** | **A1' — `BatteryConfigKey = {modeloId, voltajeId, batteryCapacidadId}`**. La capacidad NO es atributo de la bici (en `ProductVariant` de bici es `null` — `schema.prisma:204`); es selección runtime del usuario al armar/vender. Política unificada **throw-on-2+ matches** (0→null, 1→único, 2+→Error con mensaje accionable). JSDoc plural reframed: "no es default — es escape hatch para listings, prohibido `[0]`/`find()` por shape único". Distribución routing-table 9 listing + 3 con caveat S4 + 0 raw, documentada en commit body. |
| **I10.4** | **Pure lib `src/lib/battery-configurations.ts`** server-only (espejo `branch-filter.ts`/`workshop.ts`). Type alias `Tx = Prisma.TransactionClient \| PrismaClient` (espejo `customers/service.ts:8` — único alias del repo). Param `db: Tx = prisma` opcional con default — primer read helper cross-tx en repo. Implementación con **relation filter 1-shot** (`batteryVariant: { capacidad_id }`) en `resolveConfigForBike` (no 2 round-trips). **`unsafePickArbitraryConfig` eliminada** post-verificación de seed (Opción 3d) — 0 callers reales tras re-routing de los 3 callsites S4-dependientes. |
| **I10.5** | **Migración 10/12 atómica + 2 deferred visibles** (re-scope explícito vs I10.1 "atómico o no se hace"). PR del helper independiente, **antes de cualquier módulo del cluster** (bug ACTIVO desde 2026-04-19 no espera a Catálogo). 9 callsites listing → `findConfigsByModelVoltage`. `seed-transactional.ts:529` → `resolveConfigForBike` con capacidad **deterministic** (sorted ascending por `valor_ah`, `[0]`). 2 endpoints prod (`api/assembly/route.ts:205` POST + `api/assembly/[id]/complete:141`) **DEFERRED** con `findFirst({m,v})` raw + `console.warn` cuando detecte multi-config + `// TODO I10 deferred` apuntando a `resolveConfigForBike` post-S4. **Bug colateral `quantity` colapsado en `pedidos:178`** diferido a deuda separada (lógica de aggregation requiere reescritura S4-driven). Test plan: smoke + `npm run seed`. Grep audit post-sweep con **allowlist explícita** (2 ocurrencias esperadas, file:line documentadas en commit body). |
| **I10.6** | **Forward-looking S4-prep** (NO se materializa en PR I10). Schema change con S4, no con I10. **Convención A** — full snapshot 4 axes siempre (post-S4 los 4 fields siempre populated, incluso si solo cambió 1 axis; backwards-compat con consumers actuales de `fromVoltage/toVoltage`). 2 fields nuevos: `fromCapacidad/toCapacidad: String?` snapshot label (espejo patrón existente, sin FK). **Sin script de backfill, sin flag `legacyMissingCapacity`**: regla `WHERE fromCapacidad IS NULL` filtra legacy trivialmente porque post-S4 NULL nunca pasa. Naming-rename `VoltageChangeLog → ConfigChangeLog` sigue diferido a Fase 6 §rename post-launch. |

#### Hallazgos críticos surgidos en la verificación 3-for-3

Cada round de verificación cambió o refinó la decisión:

1. **I10.2 — seed callsites tienen variant en mano (`flujo 1`)**, no IDs sueltos. Confirma que `resolveConfigForBike` cubre los 3 callsites de seed sin necesidad de `findConfigByDimensions` (eliminada del API).
2. **I10.3 — `capacidad_id` en bici es NULL siempre** (`schema.prisma:204`, comentario explícito `:232`). Capacidad es atributo de **batería seleccionada runtime**, no de bici. Invalidó A1 ingenuo, llevó a A1' con `batteryCapacidadId` business explícito.
3. **I10.4 — `resolveConfigForBatteryVariant` materializa S1 con otra cara**. Mismo `batteryVariantId` puede aparecer en configs de 2 bicis distintas (mismo pack 48V sirviendo a Modelo A y Modelo B). Función eliminada; callsite `api/batteries/lots:141` migrado a `findConfigsByModelVoltage(m,v).find(c => c.batteryVariantId === incomingId)` por shape de los 3 axes.
4. **I10.5 — seed source crea 8 filas Evotank multi-config** (`seed.ts:638-645`, 4 modelos × 45Ah/52Ah). **Bug ACTIVO** desde 2026-04-19, no latente. Migración de los 2 endpoints prod a `unsafePickArbitraryConfig` (con throw-on-2+) rompería `assembly create` y `complete` para Evotank inmediatamente post-merge en cualquier ambiente seedeado. Re-scope de I10.1 forzado: 10/12 atómico + 2 deferred con `console.warn`.

#### API final consolidada

```ts
// src/lib/battery-configurations.ts
import "server-only";
import type { Prisma, PrismaClient, BatteryConfiguration } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type Tx = Prisma.TransactionClient | PrismaClient;
export type BatteryConfigKey = {
  modeloId: string;
  voltajeId: string;
  batteryCapacidadId: string;
};

/**
 * Devuelve TODAS las configs candidatas para un (modelo, voltaje).
 * Usar SOLO para selectores UI o listings que iteran configs candidatas.
 * NO uses [0] ni find() por shape único — eso reproduce S1.
 * Si tenés capacidad seleccionada → resolveConfigForBike.
 */
export async function findConfigsByModelVoltage(
  modeloId: string,
  voltajeId: string,
  db: Tx = prisma,
): Promise<BatteryConfiguration[]>;

/**
 * Resuelve la config única para una bici dada la capacidad de batería seleccionada
 * por el usuario. Throws si 2+ matches (axis insuficiente — falta color?).
 */
export async function resolveConfigForBike(
  key: BatteryConfigKey,
  db: Tx = prisma,
): Promise<BatteryConfiguration | null>;
```

Política unificada throw-on-2+. Relation filter 1-shot. 9 callers reales en sweep + 1 caller post-sweep (`seed:529` deterministic). 2 endpoints prod deferred a S4 con visibilidad explícita.

#### Implicaciones cross-cluster

- PR del helper aterriza **independiente, antes del cluster** — bug ACTIVO desde 2026-04-19 no espera a Catálogo.
- Distribución 9 listing + 1 deterministic seed + 2 deferred prod + bug `pedidos:178` como deuda separada.
- Estimado del bundle: **~22-30h distribuido cross-cluster**.
- S4 (selector V·Ah POS) hereda 2 callsites a re-migrar (`assembly/route:205`, `assembly/complete:141`) + schema migration `VoltageChangeLog` con Convención A.
- S5.b (`assertPolicyActive` real + `batteryAvailabilityMap` por capacidad) sigue como sub-fase P13-H follow-up post-cluster, ahora desbloqueada técnicamente por el helper.

#### Refinamientos pinned (al implementar PR del helper)

- Selects de seed (`prisma/seed-transactional.ts:475-483` y `:700-708`) deben extenderse para incluir `capacidad: { select: { id: true } }` — sin esto, `seed:529` no tiene `batteryCapacidadId` para pasar a `resolveConfigForBike`.
- `resolveConfigForBike` shippea con caveat operacional documentado en commit body: "0 callers iniciales — primera validación end-to-end vía `seed:529` post-sweep. Si N semanas sin caller real, decisión defendible es eliminar y reintroducir cuando S4 conecte".
- Commit body del helper debe citar `feedback_grep_before_declaring_closed.md` con los 12 callsites listados, distribución 9/3, y los 2 deferred file:line para grep allowlist.
- `console.warn` en los 2 endpoints deferred convierte deuda en forenses: `"[I10-deferred] N configs para (m, v) en {endpoint}, picking arbitrary. Bug S1 ACTIVO. Migrar a resolveConfigForBike post-S4."`

---

### 1.3.7 Interlocks cerrados — Pack B1 (2026-04-25)

2 interlocks de comportamiento/integración cerrados en sesión dedicada de chat (~50 min, formato frase por ítem). El framing inicial fue refinado vía pushback del user: I3b se descompuso en 4 sub-decisiones acopladas (política raíz · granularidad · momento · concurrencia técnica) tras detectar 3 gaps (granularidad parcial · timing add-cart vs checkout · concurrencia sin lock); I9 se limpió sacando caso (1) del scope (devolución→arqueo es invalidación local del mismo cajero, no cross-actor). Acoplamiento I3b ↔ I9-(3) resuelto por orden: I3b primero, I9-(3) heredando contexto.

#### Decisiones finales

| Sub-decisión | Resultado |
|---|---|
| **I3b.1** | **Hard block** — POS no permite vender stock reservado por `BatteryAssignment` (Assembly) o pedidos con abono parcial. Razón: failure mode "cliente pagó anticipo y se vende su batería" es asimétricamente caro (daño de confianza, no de inventario). **(b)** warn requiere construir la maquinaria de (a) igual (`disponible − reservas` para mostrar el modal) + suma I3b.5 + bajo presión real degrada a (c) por click reflejo. **(c)** status quo usa al técnico del taller como detector de conflictos cuando la bici ya está parcialmente armada — peor lugar para descubrir el error. En baja-media concurrencia los falsos positivos están acotados; el costo asimétrico justifica el bloqueo. |
| **I3b.2** | **Solo excedente** — `max(0, disponible − reservas)` con clamp UX in-line ("3 disponibles, 2 reservadas para Assembly #X, ¿vender 3?"). Razón: el propósito de (a) es precisión, no castigo. **(t)** total bloquearía 3 ventas legítimas para proteger 2 reservadas — incoherente con el principio y crea incentivo a desactivar el sistema. UX de quantity-clamp es patrón e-commerce estándar, no diseño nuevo; costo de implementación acotado a `max(0, …)` + toast con justificación. |
| **I3b.3** | **Ambos** — best-effort al agregar (extensión `use-stock-availability.ts` cacheado) + autoritativo al cobrar (transacción protegida por I3b.4). Razón: con .1=hard, checkout-only convierte al cajero en mensajero del fracaso frente al cliente esperando con tarjeta en la mano. Add-cart provee feedback temprano para descubrir el bloqueo ANTES de armar el ticket completo. Dos capas, dos propósitos; único combo que no penaliza al cajero por intentar trabajar. |
| **I3b.4** | **Optimistic concurrency** — `version Int @default(0)` en `ProductVariant` + write condicional `WHERE version = X` + retry bounded (3 intentos con backoff exponencial 50/100/200ms) + surface al cajero al agotar (`"El inventario cambió, reintenta"`). Razón: Prisma-idiomático, sin infra nueva, zero overhead en happy path; manejo explícito en el caso raro. **(s)** serializable Postgres cascadea retry wrapper en cada callsite POS y lanza serialization failures bajo concurrencia (no es "BEGIN ISOLATION LEVEL SERIALIZABLE y listo"). **(l)** advisory lock introduce semántica de locking global que el repo no usa, sumando opacidad y riesgo de deadlock por orden de adquisición. **(o)** descartado por incoherencia con .1. |
| **I3b.5** | **SKIP** — solo aplicaba si I3b.1=(b). Cerramos .1=(a) → no entra al pack. |
| **I9 (1)** | **Sale del scope** — Devolución → Caja (arqueo) es invalidación local del mismo cajero, no notificación cross-módulo. `router.refresh()` post-mutación o re-fetch del componente `CashSession` basta. No es decisión, es default. |
| **I9 (2)** | **Polling 60s** — extender `use-stock-availability.ts` con cadencia 60s para "transferencia → POS sucursal receptora". Razón: bajo el perfil supuesto **<10 transferencias/día/sucursal** (consulta cliente #10 — default revisable), 30s desperdicia ~2880 fetches/día por ~10 eventos sin razón clara; 300s abre ventana de 5min donde vendedor responde "no hay" estando ya disponible; 60s cabe en el "déjame verificar un momento" natural de interacción presencial y reutiliza cadencia workshop-mobile (DRY de patrón). **(b)** descartado: vendedor mirando POS no navega. **(c)** realtime con canal: ROI negativo bajo perfil supuesto + infra sin precedente repo, justificable solo si cliente confirma >50/día. |
| **I9 (3)** | **Heredar 60s del mismo hook** — `use-stock-availability.ts` extendido para devolver `{disponibleNeto, reservadoAssembly, reservadoPedido}`; cada consumidor lee lo que necesita (addcart check → `disponibleNeto`, catálogo → breakdown para badge "reservado para Pedido #N"). Razón: simetría con I3b.3=(ambos) — feedback temprano > sorpresa tardía con cliente esperando. **(n)** sin polling revive ese error una capa más arriba (catálogo en lugar de addcart). **(d)** cadencia diferenciada optimiza costo marginal: incluir breakdown en el mismo fetch ya extendido a 60s para (2) tiene delta computacional cercano a cero vs duplicar hook+endpoint. **(c)** descartado por mismo argumento que en (2). |

#### Bundle ghost-reservation hygiene (scope que arrastra I3b.1)

El bloqueo duro genera deuda de **ghost reservations** (Assembly cancelado sin cerrar `BatteryAssignment`, abono caducado sin liberar). Sin tratamiento, (a) degrada a (c) en 3 meses porque el operador desactiva el bloqueo de facto creando ventas en negativo o aprendiendo workarounds. El entregable hard-block incluye:

1. **TTL configurable** en reservas por abono parcial (`Pedido.expiresAt`).
2. **Acción admin "force-release"** en `BatteryAssignment` huérfanos (panel admin con justificación obligatoria).
3. **Job nightly** que detecte huérfanos (Assembly cancelado con `BatteryAssignment` activo · pedido con `expiresAt < now()` y reserva activa) y notifique al operador del origen.

Sin estos 3, I3b.1 no es defensible operativamente.

#### Refinamientos pinned (al implementar)

- **Schema migration** previa al hard-block: `ALTER TABLE ProductVariant ADD COLUMN version INT NOT NULL DEFAULT 0;`. Toda escritura de stock incrementa `version`; reads del check de venta capturan el valor actual y el write condicionado a `WHERE version = X` rebota si otra TX modificó entre medias.
- **Retry bounded explícito**: 3 intentos con backoff exponencial 50/100/200ms; al cuarto, surface al cajero `"El inventario cambió, reintenta"`. Sin límite explícito, retry infinito en hot path. Sin surface al cajero, degrada silenciosamente a (o) oversell.
- **Hook unificado** `use-stock-availability.ts` extendido devuelve `{disponibleNeto, reservadoAssembly, reservadoPedido}`; cadencia 60s consistente para casos (2) y (3). Cada consumidor lee solo lo que necesita.
- **Audit revisable pre-implementación del 30s actual** en `use-stock-availability.ts`: ¿es razón explícita (workshop hot-path donde 30s ya se siente lento) o default del primer caso? El JSDoc actual del hook dice "único consumo de polling en el proyecto" — comentario desactualizado (4 hooks con `setInterval` en repo: `use-stock-availability:52` · `use-authorization-polling:72,129` · `use-polling-refresh:26` · `notification-bell:94`). Probablemente default sin pensar. Si lo segundo, unificar a 60s globalmente reduce carga sin perder UX. Si workshop justifica 30s, conservar y agregar variante 60s para el caso transferencia. Audit antes de tocar el hook; no bloquea la decisión.

#### Preguntas latentes pre-implementación

- **Scope de reserva por pedido — sucursal vs global** (consulta cliente **#10**, agregada 2026-04-25): si Evobike permite pago de abono en sucursal A con recogida en sucursal B, la reserva es global (todos los POS deben verla). Si la reserva queda atada a la sucursal donde se cobró, POS-B la ignora porque ese stock no es suyo. Cambia la query de `disponibleNeto` (filtrar reservas por sucursal del POS o no) pero **no la cadencia 60s**. Resolver en próxima reunión cliente Evobike.

#### Implicaciones cross-cluster

- I3b aterriza al **inicio del módulo POS Terminal** del cluster (Fase A, módulo 4 según §1.6). Hard block + bundle ghost-hygiene + optimistic concurrency en `ProductVariant` — schema migration `version Int @default(0)` entra como pre-step antes de tocar UI POS.
- I9-(2)/(3) extienden `use-stock-availability.ts` existente — sin archivo nuevo. Coordinar con rediseño Workshop (mantiene 30s o unifica) y POS Terminal (incorpora 60s con breakdown).
- Bundle ghost-hygiene es trabajo distribuido: TTL en `Pedido.expiresAt` (~1h) · force-release admin panel (~3h) · job nightly con notificación (~3h). **~7-8h adicional al estimado base de I3b.**
- Estimado distribuido cross-cluster: **~12-18h** (hard-block + clamp UX + addcart-cache extension + checkout-tx con optimistic concurrency + retry surface + bundle ghost-hygiene + extensión hook 60s con breakdown).

---

### 1.3.8 Interlocks cerrados — Pack B2 (2026-04-26)

3 interlocks de producto/UX + permisos cerrados en sesión dedicada de chat (~60 min, formato frase por ítem). El framing inicial fue refinado vía 2 rondas de pushback que añadieron 4 gaps al pack v1: (1) orden interno I4→I5→I8 para que I4=(a) no obligue a revisitar I8; (2) I8 no contemplaba P13 — workshop tiene 2 ejes de autorización propios (`ServiceOrderApproval` cliente + per-rol técnico) verificados por grep, distintos de `AuthorizationRequest` (PIN manager), forzando agregar I8.0 scope antes de I8.1; (3) I8 caso #4 cruza con consulta cliente #9 (cap diario transferencias), forzando I8.2; (4) I5=(a) requería sub-decisiones igual que I3b en B1 (vencimiento · estado carrito · reserva inventario). Una vez incorporados los 4 gaps, una tercera ronda añadió 3 refinamientos de framing: anotar coste migración Prisma de I8.1=(a), formalizar carve-out como **regla 3-ejes** (no excepción ad-hoc), y anclar el TODO de I8.2 en cross-link a consulta #9 existente.

#### Decisiones finales

| Sub-decisión | Resultado |
|---|---|
| **I4** | **Separación estricta** — transferencias viven solo en `/transferencias`. Fix incluido: convertir el botón muerto de `inventario/page.tsx:51-53` ("Traslados" sin `onClick`) en deep-link real al módulo. **Sub-decisión TECHNICIAN: N/A** (con (b) no se introduce nueva superficie en `/inventario` que requiera definir visibilidad para el rol). Razón: `/transferencias` ya es módulo completo (tabs por status `solicitudes/borradores/transito/historial` + 4 dialogs `autorizar/cancelar/recibir/despachar` + API completa). Embed en inventario duplica UI sin añadir capacidad operativa real. **(a)** seguía abierta como override-bait si el almacenista vive en `/inventario` y "qué viene en camino" es contexto crítico — no hay signal operacional de eso. Caso #4 de I8 (anular transferencia despachada) dispara desde `/transferencias` (surface natural del módulo). |
| **I5 (hallazgo previo)** | El doc cluster mintió en §1.8 cuando dijo "(a) preservar flujo actual (hoy parcial)". Verificado: **grep en repo no encuentra `saveAsQuotation`/`fromCart`/`guardarComoCotizacion` ni equivalente** — el flujo POS→cotización **no existe hoy**. Existe el reverso (P7-B `cotizaciones/[id]/_components/convert-quotation-dialog.tsx`, preservado). Eso reescribe I5.1 como "construir desde cero", no como "consolidar parcial". |
| **I5.1** | **Construir** — botón "Guardar como cotización" en POS → genera `Quotation` con líneas del carrito + cliente + vencimiento. Razón: workflow común retail "lo voy a pensar" merece path nativo en POS. **(b)** elimina el flujo y fuerza al cajero a salir de POS y abrir `/cotizaciones/nueva` (form completo) repitiendo selección de items — fricción innecesaria para algo común. **(c)** PDF + WhatsApp del carrito sin `Quotation` pierde traceability/conversion analytics y rompe simetría con `convert-quotation-dialog` (no hay nada que convertir después). Build acotado: botón + endpoint que crea `Quotation` con shape conocido. |
| **I5.2** | **Configurable por sucursal con fallback (d30)** — lee de `Configuracion`/`umbrales` existente. Si la config no está poblada, default 30 días. Razón: bici eléctrica gama alta puede tomar 60-90d de decisión; walk-in de refacción 30d. Hardcoded global castiga uno u otro. (cfg) reutiliza tabla que ya existe; el fallback evita bloquear el lanzamiento si Evobike no configura nada el día 1. |
| **I5.3** | **Limpia** — el carrito POS se vacía tras crear cotización. Razón: el caso "guardo cotización" implica "el cliente se va a pensarlo" — mantener el carrito es ruido para el siguiente cliente. **(mantiene)** confunde al cajero ("¿este carrito sigue activo o ya se cotizó?"). **(pregunta)** suma modal en hot path por un edge case no observado. Si el cliente decide al momento, el flujo natural es seguir cobrando sin guardar cotización. |
| **I5.4** | **No reserva stock** + nota P7-B documentada. Razón: cotización = intención, no compromiso. **(sí)** extiende hard-block de I3b a una entidad más liviana sin el bundle ghost-hygiene (TTL · force-release · job nightly) que justifica el bloqueo en `Pedido`; reservar acá crea ghost-stock sin red de seguridad. **(opt-in)** suma decisión cognitiva al cajero por edge case ("¿reservo o no?") sin guía clara. **Nota P7-B preservada:** conversión tardía vía `cotizaciones/[id]/_components/convert-quotation-dialog.tsx` re-valida stock al momento de convertir, no en la cotización original. Stock cambiado durante ventana de cotización es expectativa documentada, no bug. |
| **I8.0** | **Carve-out con regla 3-ejes formal** (extiende I7, no lo contradice). Workshop opera fuera de la matriz porque sus 2 sistemas de autorización (`ServiceOrderApproval` cliente + per-rol técnico) divergen en los 3 ejes. Verificado por grep: `service-orders/[id]/approvals/route.ts` + `approvals/[approvalId]/respond` + variante pública en `service-orders/public/[token]/approvals/.../respond` (cerrado P13-D/F/G), más gating per-rol propio en `workshop/orders/[id]/status/route.ts:76`, `service-orders/[id]/sub-status:31,73`, `qa-panel.tsx:111`. Razón: subsumir genera abstracción artificial; carve-out documentado con regla genérica establece precedente sólido para futuros módulos. Ver "Regla de carve-out" abajo. |
| **I8.1** | **Matriz única cross-cluster** en `src/lib/permissions/matrix.ts`. Tabla `{accion, rol, contexto}` → `permitido | requiere_autorizacion(tipo) | bloqueado`. Reutiliza infra `AuthorizationRequest` extendiendo `AuthorizationType` con 4 valores nuevos: `DEVOLUCION_POST_VENTANA`, `CANCELACION_CON_ABONOS`, `REFUND_SIN_CAJA`, `ANULACION_TRANSFERENCIA_DESPACHADA`. **Coste único migración Prisma +1-2h aceptado.** Razón: los 4 casos spanean POS/Caja/Pedidos/Transferencias — cumplen umbral I7 (≥2 módulos). **(b)** per-módulo replica patrón actual (`transferencias/page.tsx:36`) y deja drift cross-módulo como coste continuo: cada nueva regla negocia contexto en cada handler. Trade favorable: migración única vs entropía persistente. |
| **I8.2** | **Diferir con cross-link a consulta cliente #9**. La interacción "anular transferencia despachada libera slot del cap diario" no se especula en la matriz hoy. Cross-link bidireccional: `memory/project_cliente_consultas_pendientes.md` ítem #9 anota "interactúa con I8 caso #4 — re-evaluar lugar de la regla (matriz vs handler) si se confirma cap"; reciprocidad acá. Razón: cap sin confirmar = especulación; matriz no debe asumir slots que pueden no existir. **(en matriz)** preferible cuando llegue confirmación; mientras tanto la regla vive en `transferencias/[id]/cancelar/route.ts` (donde está hoy) sin cambios. |

#### Regla de carve-out (extiende I7, derivada de I8.0)

> Un módulo puede operar fuera del registry/matriz compartido cuando su sistema difiere en los **3 ejes** (actor, canal, trigger) **Y** vive solo en un módulo (no cumple umbral 2+ de I7). Workshop hoy califica: actor=cliente externo (vs manager interno), canal=WhatsApp/portal (vs PIN local), trigger=cambio de scope/presupuesto (vs acción inmediata). Futuros módulos que pidan carve-out deben argumentar contra los 3 ejes; si dos módulos comparten un sistema, deja de calificar y se promueve.

Esta regla extiende I7 simétricamente: I7 promueve por **umbral** (2+ módulos comparten → registry compartido); el carve-out se justifica por **divergencia** (3 ejes distintos + módulo único → permitido fuera). Sin esta regla, "workshop es especial" sería precedente débil que cualquier módulo puede invocar; con ella, hay criterio falsificable.

#### Refinamientos pinned (al implementar)

- **PR de I8.1 (matriz única):**
  1. `prisma/schema.prisma:1117` extender `enum AuthorizationType` con 4 valores nuevos: `DEVOLUCION_POST_VENTANA`, `CANCELACION_CON_ABONOS`, `REFUND_SIN_CAJA`, `ANULACION_TRANSFERENCIA_DESPACHADA`. Migración Prisma alter-enum sin backfill.
  2. Crear `src/lib/permissions/matrix.ts` con tipo `{accion, rol, contexto} → 'permitido' | { requiereAutorizacion: AuthorizationType } | 'bloqueado'`.
  3. Migrar los 4 callsites ad-hoc al consumo central: `sales/[id]/cancel/route.ts`, `transferencias/[id]/cancelar/route.ts`, refund efectivo handler en sales/POS, devolución handler. Audit grep `requireRole|allowedRoles|isAdmin` antes del PR para no dejar callsites huérfanos.
  4. Patrón `transferencias/page.tsx:36-38` (per-page redirect) **se preserva** para gating de ruta — la matriz cubre acciones, no acceso de página.
- **PR de I5.1 (POS → cotización):** botón en carrito POS Terminal + endpoint `/api/cotizaciones/from-cart` que reusa shape de `/api/cotizaciones/route.ts:POST`. Dependencia: POS Terminal está **último** en orden de Fase A (regla invariante §1.6). Implementación entra cuando ese módulo se redisene.
- **PR de I4 (fix botón muerto):** cambio mecánico en `inventario/page.tsx:51-53` — convertir `Button` con icon `ArrowRightLeft` en `<Link href="/transferencias">`. Puede aterrizar en el rediseño del módulo Inventario (§1.6 ítem 2) o como pre-step si se quiere desacoplar. **No es Fase 0** — toca código del módulo.
- **Sub-decisión TECHNICIAN re-abrible:** si en algún punto Evobike pide que TECHNICIAN vea transferencias entrantes a su sucursal (read-only), reabrir como mini-pack independiente. Hoy `transferencias/page.tsx:36` lo redirige a `/`; ese comportamiento queda como default explícito.

#### Preguntas latentes pre-implementación

- **Override-bait de I4** (nota del user al votar): si en operación real el almacenista vive en `/inventario` y "qué viene en camino" es contexto crítico para su día, (a)+T2 (read-only entrantes para TECHNICIAN) gana. Sin signal operacional aún. Re-evaluable cuando arranque BRIEF de Inventario.
- **Cross-link bidireccional con consulta cliente #9** (I8.2): la decisión sobre dónde vive la regla "anular transferencia libera slot" se reabre cuando el cliente confirme el cap diario. Sin cap, no hay slot; con cap, evaluar matriz vs handler.

#### Implicaciones cross-cluster

- **I4** aterriza en módulo Inventario (Fase A, §1.6 ítem 2). Cambio mecánico ~0.25h.
- **I5** aterriza en módulo POS Terminal (Fase A, último, §1.6 ítem 10). Botón + endpoint + lectura de `Configuracion` para vencimiento default. Estimado: ~3-5h sumados al base de POS Terminal.
- **I8** aterriza distribuido: helper central + migración Prisma como pre-step (~2-3h), refactor de los 4 callsites (~3-4h cada uno). Estimado: **~14-18h**, incluyendo audit grep de gating ad-hoc.
- **Estimado bundle Pack B2 distribuido cross-cluster: ~17-23h.**
- **Carve-out workshop preservado**: el rediseño de workshop ya cerrado (P13-D/F/G) **no se toca**. Cualquier intento futuro de "unificar" autorización workshop→matriz debe invalidar primero la regla 3-ejes.

---

### 1.4 Devoluciones — 8 dimensiones cerradas (D1-D8)

Devoluciones entra **in-scope** con el siguiente diseño:

| # | Dimensión | Resolución |
|---|---|---|
| **D1** | **Dónde vive** | **`/ventas/[id]`** con botón "Devolución" en listado `/ventas` + búsqueda por ticket/cliente/fecha (+2h entry UX). **NO** inline POS, **NO** ruta top-level |
| **D2** | **Nota de crédito** | Método de refund en la misma UI que efectivo (radio button). Reusa `Customer.balance` + endpoint `/api/customers/[id]/balance` existentes |
| **D3** | **Cambio de producto** | v2. **Trigger concreto:** "después de 60d de volumen real de devoluciones en prod" |
| **D4** | **Autorización** | Paralela. **2 triggers:** umbral monto + fuera de ventana. Reusa módulo `/autorizaciones` existente |
| **D5** | **Ventana de tiempo** | Default **30 días** + override MANAGER fuera de ventana ([consulta cliente] P1) |
| **D6** | **Motivo obligatorio** | Enum: `DEFECTUOSO / CLIENTE_SE_ARREPINTIO / ERROR_VENDEDOR / OTRO`. **`GARANTIA` queda fuera** → ruta a Taller con `ServiceOrderType.WARRANTY` (ya existe en schema, verificado `schema.prisma:605-610`) |
| **D7** | **Destino del stock** | **Minimal:** `returnedDefective Boolean` en `SaleReturnItem`. Producto marcado defectuoso **NO re-entra a stock vendible** (queda en limbo físico). Cuarentena/merma formal → Fase A-bis ([consulta cliente] P3) |
| **D8** | **Sin venta original** | Rechazar **solo si la venta NO existe en sistema**. "Sin papelito físico" pero venta buscable = se permite. Copy UX: "Busca la venta en el sistema; si no está, contacte MANAGER" |

**Implicación crítica sobre el mapa de módulos:**

Con D1 decidido en `/ventas/[id]`, **Ventas se reclasifica de (a) 0h → (b) 20-25h** y absorbe Devoluciones. Se trabaja como **un solo entregable** — no se dispara "pase de tokens de Ventas" aislado.

---

### 1.5 Gaps cross-módulo — Fase 0 (infra pre-cluster, 18-24h)

Barridos que benefician a todos los módulos de Fase A. Se hacen **antes** de tocar cualquier módulo del cluster para que cada sesión arranque con tokens limpios.

> **Re-conteo 2026-04-26** — auditoría previa al PR de Fase 0 detectó scope subestimado en 3 de 5 gaps. Conteos abajo son los reales del repo, no los originales de 2026-04-24. Estimado total subió de "~15h" a 18-24h.

| # | Gap | Fix | Estimado |
|---|---|---|---|
| 1 | `--velocity-gradient` hardcoded — **82 instancias del literal exacto en 48 archivos + 51 variantes en 80 archivos totales** (ángulos distintos, alpha wrappers, casing). Doc 2026-04-24 decía "~55 archivos" | (a) Crear token CSS `--velocity-gradient: linear-gradient(135deg, #1b4332, #2ecc71)` en `globals.css`. (b) **Auditoría grep previa obligatoria** sobre las 51 variantes para triage manual: cuáles colapsan al token, cuáles preservan ángulo/opacidad propios. (c) replace_all del literal exacto. (d) Migración manual de las variantes que sí entran al token | 10-14h |
| 2.a | `rgba(178, 204, 192, 0.X)` hardcoded — clusters dominantes 0.08 (~17) + 0.15 (~4) + 0.20 (~22) = **~43 instancias mecánicas**. Distribución bimodal con tail concentrado en 3 pantallas (portal taller, portal cotizaciones, reporte anual) | **(b') decidido 2026-04-26**: 2 tokens nuevos en `globals.css` siguiendo el patrón existente de `--ghost-border` (cada token duplica su alpha al pasar a dark, replicando el ratio 0.15→0.30 ya validado): `--ghost-border-soft` (0.08 light / 0.16 dark) para tabla row separators · `--ghost-border-strong` (0.20 light / 0.40 dark) para card/input/panel borders. `--ghost-border` (0.15 / 0.30) ya existe — sin cambios. replace_all mecánico de los 3 clusters (~43 instancias). **Spot check obligatorio light+dark en 4 pantallas:** `pos-terminal.tsx` (mayor consumidor de 0.20, 14×) · una lista con 0.08 (`autorizaciones-history.tsx` o `tab-modelos.tsx`) · `anual-client.tsx` (mezcla 0.04 + 0.15 + 0.30 — verifica si el tail diferido grita) · un diálogo con 0.20 (`free-form-dialog.tsx` o `convert-quotation-dialog.tsx`) | 3-5h |
| 2.b | Tail diferido — **22 instancias post-migración Fase 0** con 11 alphas raros (0.04 / 0.10 / 0.18 / 0.22 / 0.25 / 0.30 / 0.35 / 0.40 / 0.45 / 0.50 / 0.60). Conteo verificado 2026-04-26 tras correr el bulk replace — el estimado pre-migración de "~48" estaba inflado. Concentradas en `taller/public/[token]/page.tsx`, `cotizaciones/public/[token]/page.tsx` y `reportes/anual/anual-client.tsx` | **NO migrar en Fase 0.** Son decisiones de diseño locales de 3 pantallas concretas. Se tocan módulo a módulo al rediseñar el portal cotizaciones (Fase A módulo 5) y reporte anual (Fase B); el portal taller (Fase F ya cerrada) solo si se rediseña en una iteración futura. **Política para código nuevo:** prohibido añadir literales `rgba(178,204,192,X)` con alphas fuera del set canónico — ver `AGENTS.md` §Tokens. Sub-decisión registrada para evitar que sesiones futuras crean que #2 está cerrado al 100% | Diferido a Fase A/B |
| 3 | Tipos `SessionUser`, `BranchComparisonRow`, `SerializedPedido`, etc. duplicados inline. **237 ocurrencias en 87 archivos `.ts`** solo de esos 3 nombres (sin contar el resto de tipos duplicados) | Fase de discovery primero (1-2h): inventariar shapes únicos por dominio antes de consolidar. Después: consolidar en `src/types/{dashboard,pos,pedidos,quotations,auth}.ts`. No sustitución 1:1: tipo canónico + `Pick<>` en handlers que solo necesitan subset | 4-6h |
| 4 | `var(--font-heading)` — token inexistente. **28 ocurrencias en 16 archivos** (patrón `var(--font-heading, 'Space Grotesk')` con fallback). Doc 2026-04-24 decía "configuracion/page.tsx:91,128" (2 líneas) | Replace_all `var(--font-heading, 'Space Grotesk')` → `var(--font-display)`. Verificar que ningún archivo dependa del fallback literal | 1-1.5h |
| 5 | Primitivos sin barrel export | Crear `src/components/primitives/index.ts` exportando `Chip`, `Delta`, `Sparkline`, `SparkBars`, `ProgressSplit` + barrel para `src/components/reportes/shell/*` (`DetailHeader`, `FilterPanel`, `KpiGrid`, `ReportTable`) | 1h |

**Regla:** Fase 0 no toca código de módulos — es solo infra de tokens, tipos y barrels. Ningún fix cosmético de módulo entra aquí.

**Gate de verificación entre #1 y #3:** correr `tsc --noEmit` + `next build` después de cerrar #1 (token CSS, sin riesgo de tipos) y antes de arrancar #3 (consolidación de tipos, alto riesgo). Sin gate, blame se mezcla si #3 rompe build.

**Helper canónico de `BatteryConfiguration` (decisión I10 Pack A.2 ✅ cerrado 2026-04-25) NO va aquí** — es lógica de dominio, no infra. **PR del helper aterriza independiente, antes del cluster** (re-scope post Pack A.2: bug ACTIVO Evotank multi-config desde 2026-04-19 no espera a Catálogo — ver §1.3.6). Ver §1.3.6 "Decisiones finales" para API consolidada y §1.3.6 "Implicaciones cross-cluster" para bundle ~22-30h distribuido.

---

### 1.6 Mapa de fases y orden de ejecución

**Fase 0 — Infra pre-cluster** (18-24h, re-estimado 2026-04-26)
Los 5 gaps cross-módulo de §1.5. Secuencial, varias sesiones (no cabe en una). Ver §1.5 para conteos auditados.

**Fase A — Cluster interconectado** (~175-210h orientativas)
Orden upstream → downstream:

1. **Catálogo** (sale de `/configuracion`) — ~15h
2. **Inventario** (sin backlog 9 ítems) — 28-35h
3. **Transferencias** — 0h (verificación)
4. **Cotizaciones app** — ~40h
5. **Cotizaciones portal público** — 24-32h
6. **Pedidos** — 22-28h
7. **Ventas + Devoluciones** (un solo entregable) — 20-25h
8. **Assembly** — 0h (verificación)
9. **Cash Register / Caja** — 0h (verificación, pero mover como unidad con POS)
10. **POS Terminal** (ÚLTIMO, regla invariante) — 25-35h base + **S4 ampliada (11-15h, audit 2026-04-25)**: selector config V·Ah ~6-8h + migración `VoltageChangeLog` con `fromCapacidad`/`toCapacidad` en 6 archivos ~4-5.5h + migración de `pos-terminal.tsx:710` y `point-of-sale/page.tsx:110` al helper canónico de `BatteryConfiguration` (decisión I10 Pack A.2) ~1-2h. **Candidato a Claude Design.**

**Fase B — Reportes restantes (paralelo permitido con Fase A tardía)**
S11-S17 del plan `docs/reportes-redesign/REPORTES_V1_DECISIONS.md`. S13/S14 (Stock crítico, Stock rotación) consumen decisiones de Catálogo e Inventario — correr al final o después de Fase A.

**Fase C — Independientes** (~85-110h)
1. **Tesorería** — 0h (verificación, coordinar tokens con Caja)
2. **Autorizaciones** — 18-24h. Cadena **paralela (status quo)**, no jerárquica
3. **Dashboard** — 32-40h. D1 ya resolvió lógica; falta barrido tokens
4. **Configuración** (sin Catálogo) — 20-30h. Bulk import parqueado

**Fase A-bis — Backlog Inventario** (post Fase C, ~30-50h)
Los 9 ítems de `memoria/project_inventario_refactor_backlog.md` (`PriceHistory`, costeo por lote, heatmap stock bajo, scan seriales, CSVs por nombre, importar facturas, vista por modelo colapsable, filtro reverse batería compatible). Ejecutar **post Fase C** por bandwidth secuencial, no paralelo.

---

### 1.7 Clasificación a/b/c — 12 módulos auditados

Ref: audit masivo 2026-04-24. Horas orientativas; no calendario comprometido.

| Módulo | Fase | Clase | Horas | Gotchas principales |
|---|---|---|---|---|
| Catálogo | A | (b) | ~15h | Ya en Config audit; sale al cluster. Tabs complejos con grupos A/B de variantes |
| Inventario | A | (b) | 28-35h | border-b en tabla, falta `ReportTable`/`DetailHeader`. Backlog 9 ítems → Fase A-bis |
| Transferencias | A | (a) | 0h | ✅ Limpio |
| Cotizaciones app | A | (b) | ~40h | Velocity gradient duplicado inline ×5, KPI hero hardcoded, falta migrar a `KpiGrid`/`ReportTable`/`DetailHeader` |
| Cotizaciones portal público | A | (b) | 24-32h | `daysChipStyle` hardcoded, falta paridad con taller público (timeline + hero reactivo) |
| Pedidos | A | (b) | 22-28h | border-b sólido en abono-modal, tipos dispersos, falta `ProgressSplit` para cuotas |
| Ventas + Devoluciones | A | (b) | 20-25h | Reclasificado de (a). ~3-5h de schema `SaleReturn`, ~2h entry UX |
| Assembly | A | (a) | 0h | ✅ Limpio |
| Cash Register | A | (a) | 0h | ✅ Limpio, glassmorphism oficial |
| POS Terminal | A | (b) | 25-35h | `colorToCSS()` hardcoded ×13, Velocity gradient inline. Candidato Claude Design |
| Tesorería | C | (a) | 0h | ✅ Limpio, 1 KPI featured con Velocity OK |
| Autorizaciones | C | (b) | 18-24h | Status badges hardcoded, shell inconsistente |
| Configuración (sin Catálogo) | C | (b) | 20-30h | `--font-heading` fix (Fase 0), 8 archivos con violaciones |
| Dashboard | C | (b) | 32-40h | Velocity gradient hardcoded en múltiples archivos (cuantía exacta pendiente de verificar) |

---

### 1.8 Interlocks cerrados — packs A.1 / A.2 / B1 / B2 (todos cerrados)

**Estado al 2026-04-26:** ✅ **0 interlocks abiertos**. Los 4 packs cerrados:
- Pack A.1 — 5 decisiones — ver §1.3.5 (cerrado 2026-04-25)
- Pack A.2 — 1 interlock con 6 sub-decisiones (I10) — ver §1.3.6 (cerrado 2026-04-25)
- Pack B1 — 2 interlocks con 8 sub-decisiones (I3b, I9) — ver §1.3.7 (cerrado 2026-04-25)
- Pack B2 — 3 interlocks con 8 sub-decisiones (I4, I5, I8) — ver §1.3.8 (cerrado 2026-04-26)

Esta sección queda como referencia histórica de las opciones consideradas. Los packs se cerraron en sesiones dedicadas de chat (no implementación) con formato **una frase por ítem** (2-4 líneas, no "I1a=a").

**Gate 0 (cero red de seguridad de tests):** verificado 2026-04-25 — el repo no tiene harness Jest/Vitest (`find src -name "*.test.*"` → 0 archivos, `package.json` sin deps de testing). Cualquier sweep cross-callsite (helper canónico I10, migración de patrón, etc.) procede sin red de seguridad. Si en el futuro se introduce harness, los bundles ya cerrados no se re-ejecutan; los nuevos sí deben sumar tests al estimado.

**Formato esperado de respuesta (ejemplo):**
> **I1a** — Sí, canonicalizar. Razón: 8+ módulos muestran el mismo producto y hoy lo arman distinto. Es la fuente #1 de drift visual silencioso. Cambiar fórmula después se vuelve cacería.
>
> **I1b** — Helper puro en `src/lib/products/display.ts`. Razón: patrón del repo, sin migración, type-safe, grep-able. Prisma derived agrega complejidad; view y trigger son sobre-ingeniería.

---

**Interlocks cerrados antes del pack (referencia rápida):**

| Interlock | Resolución |
|---|---|
| Caja ↔ POS | Cluster confirmado (§1.3) |
| Refund efectivo ↔ Caja | Requiere sesión abierta; si no, solo `Customer.balance` (§1.3) |
| Devoluciones ↔ `Customer.balance` | D2: nota crédito reusa endpoint existente (§1.4) |
| Portal público cotizaciones ↔ taller | Paridad total (§1.3) |
| Ventas + Devoluciones | Un solo entregable (§3.6) |
| Devoluciones ↔ Taller (garantía post-ventana) | `ServiceOrderType.WARRANTY` existente (D6) |

**Bloqueados por consulta cliente (ver §2):**
- POS ↔ Autorizaciones (umbral descuento) — memoria consulta #8

**Aterrizajes acoplados al rediseño (no requieren cliente):**
- **S4** (selector V·Ah POS) → módulo POS Terminal del cluster (§1.6 ítem 10) — 11-15h ampliado (audit 2026-04-25).
- **Helper canónico `BatteryConfiguration`** (decisión I10 Pack A.2) → inicio del módulo Catálogo del cluster + one-shot migration de 4 huérfanos (3 endpoints assembly server-side + `api/batteries/lots/route.ts:141`).
- **S5.b** (`assertPolicyActive` real + `batteryAvailabilityMap` por capacidad) → sub-fase **P13-H follow-up** post-cluster (NO en POS — vive en territorio Taller/Assembly). Independiente de S4 una vez I10 cerrado. ~4-5h.

**Preservar patrón actual (no son decisión):**
- Imagen de producto: `variant.imageUrl > modelo.imageUrl > icono fallback` (status quo)
- Convert cotización → pedido/venta (P7-B)
- Assembly reserva batería en recepción (S3)
- Stock remoto POS (P12-A)
- Cancelación venta ↔ reversión stock (E.5)
- Link bidireccional Pedido ↔ Sale COMPLETED

---

#### Pack A.1 ✅ Cerrado 2026-04-25 — Upstream shape de data, parte general (5 items)

5 interlocks cerrados en sesión dedicada (~30 min). **Decisiones integradas en §1.3.5** — esta tabla queda como referencia histórica de las opciones consideradas.

| # | Interlock | Opciones consideradas | Decisión |
|---|---|---|---|
| **I1a** | ¿`displayName` de producto se canonicaliza server-side, o cada módulo compone a su manera? | (a) Canonicalizar · (b) Status quo | **(a)** — ver §1.3.5 |
| **I1b** | Si I1a=canonicalizado: fuente técnica | (a) Helper puro · (b) Prisma derived · (c) View SQL · (d) Trigger | **(a)** — ver §1.3.5 |
| **I3a** | Visualización buckets de stock | (a) Buckets separados · (b) Disponible + tooltip · (c) Total único (status quo) | **(b)** + fix de datos + tap-to-expand en touch — ver §1.3.5 |
| **I6** | Multi-branch transversal (4 casos: POS stock · Devoluciones cross-branch · Transferencias · Cotizaciones/Pedidos) | (a) Regla única con flags · (b) Cada módulo decide · (c) Helpers específicos por caso | **(c)** — ver §1.3.5 |
| **I7** | Diccionario de estados compartido cross-módulo | (a) Registry único · (b) Status quo · (c) Híbrido | **(c)** seed minimal (3 primarios) + regla de promoción 2+ módulos — ver §1.3.5 |

---

#### Pack A.2 ✅ Cerrado 2026-04-25 — Lookup canónico de `BatteryConfiguration` (1 interlock con 6 sub-decisiones)

1 interlock cerrado en sesión dedicada con verificación 3-for-3 (~90 min — más del estimado original ~50-60 min porque cada round de verificación reabrió decisiones ya tomadas; las verificaciones cambiaron el outcome 4/4 veces, validando empíricamente la regla operativa de `feedback_grep_before_declaring_closed.md`). **Decisiones integradas en §1.3.6** — esta tabla queda como referencia histórica de las opciones consideradas.

| # | Interlock | Sub-decisiones consideradas | Resultado |
|---|---|---|---|
| **I10** | Lookup canónico de `BatteryConfiguration` cross-módulo. Schema unique es `(modeloId, voltajeId, batteryVariantId)`; 12 callsites (9 producción + 3 seed, recuento corregido vs original "11 = 9+2") lo ignoran y componen `${modeloId}:${voltajeId}` 2-axis causando ambigüedad multi-Ah desde S1 (migration `20260419060000_add_battery_capacity_axis`, 2026-04-19). | **(1)** Helper canónico vs status quo per-módulo. **(2)** Signatures (`resolveConfigForVariant`, `findConfigsByModelVoltage`, `findConfigByDimensions`). **(3)** API axis (A1/A2/A3 capacidadId business vs batteryVariantId raw). **(4)** Forma (pure lib / extension / server action). **(5)** Migración 4 huérfanos vs sweep total atómico. **(6)** Backfill `VoltageChangeLog` histórico. | **API final 2 funciones públicas** (`findConfigsByModelVoltage` + `resolveConfigForBike`); **A1' con `batteryCapacidadId` business**; **pure lib `src/lib/battery-configurations.ts`** server-only con `db: Tx = prisma` opcional; **sweep 10/12 atómico + 2 deferred** con `console.warn`; **Convención A full snapshot 4 axes** sin script ni flag. Ver §1.3.6. |

Naming de `VoltageChangeLog → ConfigChangeLog` **NO entra en I10** — diferido a §FASE 6 ROADMAP §rename post-launch (toca FK columns en `BatteryAssignment` que vive en Workshop ya rediseñado, fuera del cluster, riesgo de regresión en zona estable; naming preexistente ya inconsistente entre `voltageChangeLogId` con "Log" y `installedAtVoltageChangeId`/`removedAtVoltageChangeId` sin "Log").

---

#### Pack B1 ✅ Cerrado 2026-04-25 — Comportamiento / integración (2 items, 8 sub-decisiones)

2 interlocks cerrados en sesión dedicada (~50 min). **Decisiones integradas en §1.3.7** — esta tabla queda como referencia histórica de las opciones consideradas.

| # | Interlock | Opciones consideradas | Decisión |
|---|---|---|---|
| **I3b** | Comportamiento al consumir stock reservado: POS intenta vender variante reservada por Assembly o comprometida en pedido con abono parcial. Tras pushback del user, descompuesto en 5 sub-decisiones (.1 política · .2 granularidad · .3 momento · .4 concurrencia técnica · .5 manejo origen tras override) | .1 (a) hard · (b) warn · (c) permit · .2 (t) total · (e) excedente · .3 (addcart) · (checkout) · (ambos) · .4 (s) serializable · (v) optimistic · (l) advisory · (o) oversell · .5 (libera) · (mantiene) · (notifica) | **.1=(a)** + bundle ghost-hygiene · **.2=(e)** clamp UX · **.3=(ambos)** · **.4=(v)** + retry bounded 3× + surface · **.5=SKIP** (solo aplicaba a .1=b). Ver §1.3.7. |
| **I9** | Notificaciones/realtime entre módulos. Caso (1) devolución→arqueo sale del scope (invalidación local del mismo cajero, no cross-actor); quedan caso (2) transferencia→POS receptora y caso (3) pedido pagado→otros vendedores. **Acoplamiento I3b ↔ I9-(3)** resuelto por orden | (a) Polling 30/60/300s · (b) `router.refresh()` por navegación · (c) Realtime con canal · (n) Sin polling | **(1)=fuera del scope · (2)=(a) polling 60s · (3)=(a) heredar 60s del mismo hook** con breakdown `{disponibleNeto, reservadoAssembly, reservadoPedido}`. Ver §1.3.7. |

---

#### Pack B2 ✅ Cerrado 2026-04-26 — Producto / UX + permisos (3 items, 8 sub-decisiones)

3 interlocks cerrados en sesión dedicada (~60 min). **Decisiones integradas en §1.3.8** — esta tabla queda como referencia histórica de las opciones consideradas. Pushback del user añadió 4 gaps al framing v1 (orden interno I4→I5→I8 · I8 no contemplaba P13 → split I8.0/I8.1/I8.2 · I8 caso #4 cruza consulta cliente #9 → I8.2 · I5=(a) requería sub-decisiones igual que I3b → split I5.1/.2/.3/.4) y una tercera ronda 3 refinamientos (anotar coste migración Prisma · formalizar regla 3-ejes · anclar TODO en cross-link a #9).

| # | Interlock | Opciones consideradas | Decisión |
|---|---|---|---|
| **I4** | Inventario ↔ Transferencias: ¿visualización de transfers pendientes? | (a) Tab propio en Inventario + deep-link · (b) Separación estricta · sub-T (T1/T2/T3) si (a) | **(b)** separación estricta + fix botón muerto `inventario/page.tsx:51-53`. Sub-T N/A. Ver §1.3.8. |
| **I5** | POS ↔ Cotizaciones: guardar carrito como cotización (verificado: hoy NO existe). Descompuesto en .1 política · .2 vencimiento · .3 estado carrito · .4 reserva inventario | .1 (a) construir · (b) eliminar · (c) reframe WhatsApp · .2 (d30/d60/d90/cfg) · .3 (limpia/mantiene/pregunta) · .4 (no/sí/opt-in) | **.1=(a) construir · .2=(cfg) configurable + fallback (d30) · .3=(limpia) · .4=(no)** + nota P7-B preservada. Ver §1.3.8. |
| **I8** | Matriz de permisos inter-módulo. **Descuento POS excluido — permanece en consulta cliente #8**. 4 casos: devolución post-ventana · cancelación pedido con abonos · refund efectivo sin sesión · anulación transferencia despachada. Descompuesto en .0 scope (P13 subsume vs carve-out) · .1 forma · .2 cruce con consulta #9 | .0 (subsume/carve-out) · .1 (a) matriz única · (b) per-módulo · .2 (en matriz/diferir) | **.0=(carve-out con regla 3-ejes formal) · .1=(a) matriz única** con migración Prisma +1-2h · **.2=(diferir con cross-link a #9)**. Ver §1.3.8. |

---

**Próximo paso operacional:** todos los packs cerrados. Disparar:
1. **Fase 0** (§1.5) — infra pre-cluster 18-24h (CSS tokens, tipos, barrels). Sin dependencia de packs.
2. **PR del helper canónico (I10)** — independiente del cluster, bug ACTIVO desde 2026-04-19 (ver §1.3.6 "Implicaciones cross-cluster").
3. **BRIEFs JIT por módulo** del cluster Fase A — empezando por Catálogo (sale de Configuración, §1.6 ítem 1).

Pack A.1 cerrado 2026-04-25 (§1.3.5). Pack A.2 cerrado 2026-04-25 (§1.3.6). Pack B1 cerrado 2026-04-25 (§1.3.7). Pack B2 cerrado 2026-04-26 (§1.3.8).

---

## 2. Consulta cliente pendiente (3)

**Marca:** bloquea implementación de módulos afectados, **NO bloquea este doc**.

| # | Pregunta | Default provisional | Módulo que bloquea | Cuándo consultar |
|---|---|---|---|---|
| **P1** | Ventana de devolución estándar | 30d + override MANAGER | Ventas + Devoluciones | Antes de arrancar la sesión de Ventas/Devoluciones |
| **P2** | Umbral de monto que dispara autorización | $2,000 o 3× ticket promedio histórico | Ventas + Devoluciones | Antes de arrancar la sesión de Ventas/Devoluciones |
| **P3** | ¿El cliente acepta que Evobike registre mermas en inventario por productos defectuosos devueltos? | Sí, con política manual de aceptación/rechazo por MANAGER | Inventario + Fase A-bis | Antes de arrancar Fase A-bis (post Fase C) |

**Protocolo:** si P1/P2 no llegan antes de la sesión de Ventas/Devoluciones, arrancar con los defaults y marcar en el código TODO `// [cluster-consulta:P1]` para swap posterior.

---

## 3. Parqueado para implementación

Decisiones y notas que NO bloquean este doc pero deben emerger cuando arranque la sesión del módulo correspondiente.

### 3.1 Schema de Devoluciones
**Tabla nueva `SaleReturn` + `SaleReturnItem`** (FK a `Sale` y `SaleItem`) **vs** `Sale.status = PARTIAL_RETURNED`. Voto inclinado a tabla aparte: status en `Sale` no captura items parciales. Cerrar en sesión de Ventas/Devoluciones.

### 3.2 Regla operativa: refund efectivo + sesión de caja cerrada
Venta fue ayer (sesión A cerrada), devolución hoy (sesión B abierta). **Regla:** el efectivo sale de la sesión B abierta; si no hay sesión B, único método disponible = `Customer.balance`. UX debe deshabilitar "Efectivo" con tooltip explicativo.

### 3.3 Reporte "defectuosos en limbo"
Con `returnedDefective Boolean` y sin re-entry a stock, no existe reporte para saber cuántos productos hay en limbo físico. **Anotar como reporte futuro en Fase A-bis** junto con cuarentena/merma formal. Sin esto, el limbo puede crecer silencioso.

### 3.4 Validación UX: `ServiceOrderType.WARRANTY` absorbe "garantía post-ventana"
Schema ya soporta (`schema.prisma:605-610`). WARRANTY no exige diagnóstico previo en el schema actual. Validar en sesión de Ventas/Devoluciones que el flujo operativo "cliente llega con producto fuera de ventana → ruteo a Taller con `type=WARRANTY`" es natural para el operador. Si no, considerar sub-estado dedicado.

### 3.5 D3 v2 — trigger concreto
"Cambio de producto" entra en v2 **después de 60 días de volumen real de devoluciones en prod**. Re-evaluar con data, no por fecha calendario. Interconexión con Pedidos (cuando no hay stock del nuevo producto) debe considerarse al abrir v2.

### 3.6 Ventas + Devoluciones — un solo entregable
**Regla dura:** no se arranca sesión de "rediseño visual de Ventas" sin tocar Devoluciones. La reclasificación (a) → (b) se debe al scope Devoluciones. Si alguien separa, el código queda coherente visualmente pero Devoluciones sin shell → retrabajo.

### 3.7 Entry UX de Devoluciones
Botón "Devolución" en listado `/ventas` + búsqueda por ticket/cliente/fecha (+2h). Sin esto, la UX de D1 está coja porque asume que el operador ya encontró la venta.

### 3.8 Backlog Inventario — 9 ítems
Lista en `memoria/project_inventario_refactor_backlog.md`. Ejecutar **post Fase C**, como Fase A-bis. Por bandwidth secuencial, NO paralelo.

### 3.9 Cambio de producto — sub-flujos (diferido con D3 v2)
Cuando se abra v2:
- Stock disponible + precio nuevo > precio viejo → cobrar diferencia
- Stock disponible + precio nuevo < precio viejo → refund diferencia
- Sin stock → entrada a Pedidos (apartar nuevo producto)

---

## 4. Mapa de referencias cruzadas

Para que Claude Design / Code sepa qué archivos citar como vara visual:

**Rediseños más recientes del repo (calca estos, no inventes):**
- `src/app/(pos)/customers/[id]/page.tsx` + `src/components/customers/profile/*` — perfil cliente (6 sesiones, Abr 2026)
- `src/app/(pos)/workshop/[id]/*` — ficha técnica taller (P13-D, Abr 2026)
- `src/app/taller/public/[token]/page.tsx` + `_components/*` — portal público moderno (P13-F)
- `src/app/(pos)/reportes/ventas-e-ingresos/*` — shell reportes V1 piloto

**Primitivos disponibles (reusar, no reimplementar):**
- `src/components/primitives/chip.tsx` (5 variantes semánticas)
- `src/components/primitives/delta.tsx`
- `src/components/primitives/sparkline.tsx`
- `src/components/primitives/spark-bars.tsx`
- `src/components/primitives/progress-split.tsx`
- `src/components/primitives/icon.tsx` (41 glyphs tipados)
- `src/components/primitives/chart.tsx` (wrapper Recharts)
- `src/components/reportes/shell/detail-header.tsx`
- `src/components/reportes/shell/filter-panel.tsx`
- `src/components/reportes/shell/kpi-grid.tsx`
- `src/components/reportes/shell/report-table.tsx`
- `src/components/reportes/shell/kpi-card.tsx`

**Docs vigentes que deben acompañar este archivo en prompts:**
- `DESIGN.md` — tokens, tipografía, primitivos, reglas duras
- `AGENTS.md` — reglas de negocio + convenciones de código
- `docs/workshop-redesign/BRIEF.md` — referencia de patrón de BRIEF firmado
- `docs/customers-redesign/BRIEF.md` — referencia de patrón de BRIEF firmado
- `docs/reportes-redesign/REPORTES_V1_DECISIONS.md` — decisiones de Reportes

---

## 5. Changelog

| Fecha | Cambio |
|---|---|
| 2026-04-24 | Versión inicial. 11 decisiones cerradas, 3 [consulta cliente] pendientes, 12 módulos clasificados, Catálogo sale de Configuración al cluster |
| 2026-04-24 | §1.8 agregado — 10 interlocks abiertos divididos en Pack A (5) / B1 (2) / B2 (3). Formato de respuesta "frase por ítem". Pendientes de cierre en sesiones siguientes |
| 2026-04-25 | **Audit S4/S5/BatteryConfiguration:** se detecta deuda cross-módulo de 11 callsites con key 2-axis ignorando capacidad (pre-data S1 migration `20260419060000`). S5 marcada falsamente como cerrada en `ROADMAP.md:823-824` (verificación contra código: `assertPolicyActive` sigue no-op). Cambios al doc: §1.6 ítem 10 amplía S4 a 11-15h; §1.5 documenta que helper canónico va en Catálogo, no Fase 0; §1.8 agrega **I10** (con 6 sub-decisiones), parte Pack A en **A.1 (5 originales) + A.2 (I10 sola)** por riesgo de fatiga decisional, agrega Gate 0 (cero test harness) y sub-sección "Aterrizajes acoplados al rediseño" (S4 / helper / S5.b). Bundle distribuido cross-cluster ~22-30h. Naming `VoltageChangeLog → ConfigChangeLog` diferido a FASE 6 §rename post-launch |
| 2026-04-25 | **Pack A.1 cerrado** (§1.3.5). 5 decisiones: I1a canonicalizar `displayName` · I1b helper puro `src/lib/products/display.ts` · I3a disponible + desglose discoverable (tap en touch) + fix de datos `disponible = total − reservado − en_tránsito` · I6 helpers nombrados por caso de producto sobre `branchWhere` · I7 híbrido seed minimal (3 primarios `EN_CURSO/TERMINADO/CANCELADO` + regla de promoción 2+ módulos). Estimado distribuido cross-cluster ~6-10h. §1.8 marcado ✅ y header actualizado a 6 abiertos. Pack A.2 (I10) sigue pendiente — respiro entre packs |
| 2026-04-25 | **Pack A.2 cerrado** (§1.3.6). 6 sub-decisiones de I10: helper canónico · 2 funciones públicas (`findConfigsByModelVoltage` plural + `resolveConfigForBike` singular) · A1' `BatteryConfigKey` con `batteryCapacidadId` business · pure lib `src/lib/battery-configurations.ts` server-only con `db: Tx` opcional · sweep 10/12 atómico + 2 deferred (`assembly/route:205`, `assembly/complete:141`) con `console.warn` · Convención A full snapshot 4 axes en `VoltageChangeLog` (S4-prep). Verificación 3-for-3: cada round (seed callsites · schema axis · routing real · seed data multi-config Evotank) cambió o refinó la decisión preliminar. **`resolveConfigForBatteryVariant` y `unsafePickArbitraryConfig` eliminadas** durante la iteración — ambas reproducían S1 con otra cara. **Bug `seed:529` ACTIVO confirmado** vía `seed.ts:638-645` (8 filas Evotank multi-config) — no latente. PR del helper se libera de aterrizar en Catálogo y arranca **independiente, antes del cluster**. Estimado bundle ~22-30h distribuido. §1.8 header actualizado a 5 abiertos, próximo paso operacional cambiado a Pack B1 |
| 2026-04-25 | **Pack B1 cerrado** (§1.3.7). 2 interlocks con 8 sub-decisiones tras 2 rondas de pushback que reframearon el pack: I3b descompuesto en .1 política raíz · .2 granularidad · .3 momento · .4 concurrencia técnica · .5 manejo origen (gaps detectados: granularidad parcial · timing addcart vs checkout · concurrencia sin lock); I9 limpio sacando caso (1) devolución→arqueo del scope (invalidación local del mismo cajero, no cross-actor); acoplamiento I3b↔I9-(3) resuelto por orden de cierre. Decisiones: **I3b.1=(a) hard block** + bundle ghost-hygiene (TTL pedidos · force-release admin · job nightly) · **I3b.2=(e) solo excedente** con clamp UX · **I3b.3=(ambos)** addcart best-effort + checkout autoritativo · **I3b.4=(v) optimistic concurrency** con `version Int @default(0)` explícito + retry bounded 3× backoff 50/100/200ms + surface al cajero · **I3b.5=SKIP** · **I9-(1)=fuera del scope** · **I9-(2)=(a) polling 60s** extendiendo `use-stock-availability.ts` · **I9-(3)=(a) heredar 60s del mismo hook** con breakdown `{disponibleNeto, reservadoAssembly, reservadoPedido}`. **Consulta cliente #10 capturada** (scope reserva sucursal vs global). **Audit revisable pre-implementación** del 30s actual en `use-stock-availability.ts` (JSDoc desactualizado, 4 hooks con `setInterval` en repo). Estimado bundle ~12-18h distribuido. §1.8 header actualizado a 3 abiertos, próximo paso operacional cambiado a Pack B2 |
| 2026-04-26 | **Pack B2 cerrado** (§1.3.8). 3 interlocks con 8 sub-decisiones tras 2 rondas de pushback que añadieron 4 gaps al pack v1 (orden interno I4→I5→I8 · I8 no contemplaba P13 → split I8.0 scope antes de .1 forma · I8 caso #4 cruza consulta #9 → I8.2 · I5=(a) requería sub-decisiones igual que I3b → split .1/.2/.3/.4) y una tercera ronda 3 refinamientos (anotar coste migración Prisma · formalizar carve-out como **regla 3-ejes** · anclar TODO en cross-link a consulta #9 existente). Decisiones: **I4=(b) separación estricta** + fix botón muerto `inventario/page.tsx:51-53` (sub-T N/A) · **I5 hallazgo:** verificado por grep que POS→cotización **no existe hoy** (doc cluster mintió en §1.8) → I5.1 reescrita a "construir desde cero" · **I5.1=(a) construir** botón POS · **I5.2=(cfg)** configurable por sucursal con fallback (d30) · **I5.3=(limpia)** carrito · **I5.4=(no)** reservar stock + nota P7-B preservada · **I8.0=(carve-out con regla 3-ejes formal)** que extiende I7 simétricamente (workshop califica: actor cliente externo · canal WhatsApp/portal · trigger cambio scope) · **I8.1=(a) matriz única** en `src/lib/permissions/matrix.ts` con migración Prisma `enum AuthorizationType` + 4 valores nuevos (`DEVOLUCION_POST_VENTANA`, `CANCELACION_CON_ABONOS`, `REFUND_SIN_CAJA`, `ANULACION_TRANSFERENCIA_DESPACHADA`), coste +1-2h aceptado · **I8.2=(diferir con cross-link a consulta #9)** — interacción "anular transferencia libera slot" se reabre cuando el cliente confirme cap diario. Estimado bundle ~17-23h distribuido. **§1.8 colapsada a referencia histórica** (0 abiertos, todos los packs cerrados). Próximo paso operacional cambia a: Fase 0 (§1.5) + PR helper I10 + BRIEFs JIT por módulo del cluster |
