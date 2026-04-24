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

### 1.5 Gaps cross-módulo — Fase 0 (infra pre-cluster, ~15h)

Barridos que benefician a todos los módulos de Fase A. Se hacen **antes** de tocar cualquier módulo del cluster para que cada sesión arranque con tokens limpios.

| # | Gap | Fix | Estimado |
|---|---|---|---|
| 1 | `--velocity-gradient` hardcoded en ~55 archivos | Crear token CSS `--velocity-gradient: linear-gradient(135deg, #1b4332, #2ecc71)` en `globals.css`. grep+replace sobre `linear-gradient(135deg, #1b4332, #2ecc71)` → `var(--velocity-gradient)` | 8-10h |
| 2 | `rgba(178,204,192,0.X)` hardcoded (47 instancias con alphas no-estándar) | Evaluar 2 caminos: (a) aceptar shift visual y replace_all, o (b) introducir tokens `--ghost-border-weak` / `--ghost-border-strong` con pares light/dark. **Decisión pendiente** en la sesión de Fase 0 | 2-3h |
| 3 | Tipos `SessionUser`, `BranchComparisonRow`, `SerializedPedido`, etc. duplicados inline en 110+ archivos | Consolidar en `src/types/{dashboard,pos,pedidos,quotations,auth}.ts` por módulo. No sustitución 1:1: tipo canónico + `Pick<>` en handlers que solo necesitan subset | 3-4h |
| 4 | `var(--font-heading)` — token inexistente | Reemplazar por `var(--font-display)` en `configuracion/page.tsx:91,128` | 0.5h |
| 5 | Primitivos sin barrel export | Crear `src/components/primitives/index.ts` exportando `Chip`, `Delta`, `Sparkline`, `SparkBars`, `ProgressSplit` + barrel para `src/components/reportes/shell/*` (`DetailHeader`, `FilterPanel`, `KpiGrid`, `ReportTable`) | 1h |

**Regla:** Fase 0 no toca código de módulos — es solo infra de tokens, tipos y barrels. Ningún fix cosmético de módulo entra aquí.

---

### 1.6 Mapa de fases y orden de ejecución

**Fase 0 — Infra pre-cluster** (~15h)
Los 5 gaps cross-módulo de §1.5. Secuencial, una sola sesión.

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
10. **POS Terminal** (ÚLTIMO, regla invariante) — 25-35h + Fase S4 (selector config V·Ah). **Candidato a Claude Design.**

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

### 1.8 Interlocks abiertos — pendientes de cierre en packs A / B1 / B2

**Estado al 2026-04-24:** 10 interlocks abiertos, divididos en 3 packs por dependencia y densidad de decisión. Los packs se cierran en sesiones dedicadas de chat (no implementación) con formato **una frase por ítem** (2-4 líneas, no "I1a=a").

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
- POS ↔ Catálogo (Fase S4 selector V·Ah) — aterriza con POS

**Preservar patrón actual (no son decisión):**
- Imagen de producto: `variant.imageUrl > modelo.imageUrl > icono fallback` (status quo)
- Convert cotización → pedido/venta (P7-B)
- Assembly reserva batería en recepción (S3)
- Stock remoto POS (P12-A)
- Cancelación venta ↔ reversión stock (E.5)
- Link bidireccional Pedido ↔ Sale COMPLETED

---

#### Pack A — Upstream shape de data (~35-45 min, 5 items)

Afectan cómo los módulos del cluster se comunican entre sí. Cerrarlos primero evita rework de contratos al tocar packs B.

| # | Interlock | Opciones |
|---|---|---|
| **I1a** | ¿`displayName` de producto se canonicaliza server-side para consistencia cross-módulo, o cada módulo compone a su manera? | (a) Canonicalizar (una fuente para todo el cluster) · (b) Status quo (cada módulo libre) |
| **I1b** | Si I1a=canonicalizado: fuente técnica del helper | (a) Helper puro `src/lib/products/display.ts` · (b) Campo derivado Prisma · (c) View SQL · (d) Trigger |
| **I3a** | Visualización buckets de stock en UI | (a) Buckets separados (disponible + en tránsito + reservado) · (b) Solo disponible con tooltip hover · (c) Total único sin discriminar (status quo) |
| **I6** | Multi-branch transversal. Define firma de queries para 4 casos: POS al buscar stock · Devoluciones cross-branch sí/no · Transferencias 2 branches · Cotizaciones/Pedidos filtran por branch del cliente vs del operador. Consume los cambios pendientes en `src/lib/branch-filter.ts` | (a) Regla única cross-cluster (helper canónico consumible con opciones) · (b) Cada módulo decide · (c) 4-5 reglas específicas por caso |
| **I7** | Diccionario de estados compartido cross-módulo (`Sale.status` + `Order.status` + `SaleReturn.status` + `Quotation.status` + `ServiceOrder.status` + `StockTransfer.status` + etc.) | (a) Registry único central con mapeo chips/colores/i18n · (b) Status quo (cada módulo mantiene los suyos) · (c) Híbrido: primarios centralizados, sub-estados locales |

---

#### Pack B1 — Comportamiento / integración (~35 min, 2 items)

Dispara **después del respiro post Pack A** (mínimo 1 sesión distinta).

| # | Interlock | Opciones |
|---|---|---|
| **I3b** | Comportamiento al consumir stock reservado: POS intenta vender variante reservada por Assembly o comprometida en pedido con abono parcial | (a) Bloquea hard · (b) Advierte con confirmación · (c) Permite (status quo) |
| **I9** | Notificaciones/realtime entre módulos. Casos: Devolución → Caja (arqueo) · Transferencia recibida → POS (stock nuevo) · Pedido pagado → Inventario (reserva) | (a) Polling (patrón workshop-mobile 60s) · (b) Invalidación manual por navegación (`router.refresh()`) · (c) Realtime con canal |

---

#### Pack B2 — Producto / UX + permisos (~55 min, 3 items)

Después de B1. **I8 depende de I7** cerrado en Pack A.

| # | Interlock | Opciones |
|---|---|---|
| **I4** | Inventario ↔ Transferencias: ¿visualización de transfers pendientes? | (a) Inventario con tab propio + link profundo a `/transferencias` · (b) Separación estricta (transfers sólo en `/transferencias`) |
| **I5** | POS ↔ Cotizaciones: guardar carrito actual como cotización desde POS | (a) Preservar flujo actual (hoy parcial) · (b) Eliminar (cotizaciones sólo desde `/cotizaciones/nueva`) · (c) Convertir a "compartir carrito via WhatsApp + PDF" |
| **I8** | Matriz de permisos inter-módulo. **Descuento POS excluido — permanece en consulta cliente #8**. Casos cubiertos: autorización devolución post-ventana · cancelación pedido con abonos · refund efectivo sin sesión abierta (excepción) · anulación transferencia ya despachada | (a) Matriz única cross-cluster · (b) Reglas per-módulo |

---

**Próximo paso operacional:** disparar Pack A en sesión siguiente con el formato "frase por ítem". Fase 0 (§1.5) puede arrancar en paralelo sin bloqueo — es puro CSS/tokens/barrel sin decisiones de producto.

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
