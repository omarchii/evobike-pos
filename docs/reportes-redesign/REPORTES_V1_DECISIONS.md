# Rediseño del Módulo de Reportes — Decisiones v1

> **Estado:** Spec de decisiones cerrado · 2026-04-18
> **Owner:** Omar — evobike-pos2
> **Fuentes:** AGENTS.md · ROADMAP.md · DESIGN.md · SPEC.md · Handoff Claude Design
> **Uso:** pegar este archivo como contexto inicial en cada sesión de Claude Code relacionada al rediseño de `/reportes`.

---

## 1. Decisiones cerradas (D1 – D11)

| # | Tema | Decisión |
|---|---|---|
| **D1** | Lista canónica de reportes | **SPEC.md V1-V14** (14 reportes en v1) + V15 Exportación placeholder + V2.1-V2.3 diferidos a v2 |
| **D2** | Alcance del HomeView `/reportes` | **Hub navegable**: índice de cards + search + pinned. No dashboard. |
| **D3** | Librería de gráficos principales | **Recharts** |
| **D4** | Saved views | **v1 = solo bookmarks** (`User.pinnedReports String[]`). Saved views completo a v1.5. |
| **D5** | Overlays con schema | **Thresholds reales** (schema `AlertThreshold`) · **Tweaks persistente** (`User.uiPreferences Json?`) · **Builder placeholder** visual |
| **D6** | Paleta datavis de 8 series | **Adoptada** (ver §3) |
| **D7** | Slugs de URL | **Aprobados** (ver §4 con redirects) |
| **D8** | Estructura del sidebar | **"Reportes" + 3-4 pinned bajo él**, configurables por usuario via `User.pinnedReports` |
| **D9** | Meta del card en el hub | **Sin meta en v1**. Meta (`Hace X min · N regs`) diferida a v1.5 |
| **D10** | Helper `previousComparableRange` | **Soporta 3 modos** via query param `compare=prev-period\|prev-month\|prev-year`. Default: `prev-period` (mismo-largo-de-días) |
| **D11** | Sparklines | **SVG manual** del handoff (40 líneas, cero deps) + Recharts solo para gráficos principales con interacción |

---

## 2. Alcance cerrado por fase

### v1 — terminable (14 pantallas + hub + overlays)

**10 reportes completos:**
- V1 Ventas e ingresos (custom) — templ. piloto
- V2 Margen bruto por producto (custom, scatter)
- V3 Comisiones por vendedor (genérico)
- V4 Apartados / Layaway (genérico + WhatsApp)
- V6 Estado de cuenta (genérico, 2 niveles — reusa P10-B)
- V9 Stock y rotación (custom, treemap + scatter)
- V10 Stock crítico (custom, priority inbox + forecast)
- V12 P&L del período (custom, tabla colapsable, reemplaza P10-I Anual)
- V13 Cashflow y tesorería (custom, waterfall + tabs)
- V14 CxP + Compras (custom, aging buckets)

**1 placeholder:**
- V15 Exportación contable (visual sin backend CFDI)

**Shell + overlays:**
- `/reportes` hub navegable
- ExportDrawer (con backend CSV ya existente + Excel si se puede agregar exceljs)
- ThresholdsModal (con schema `AlertThreshold` real)
- TweaksPanel (con `User.uiPreferences` persistente)
- Builder (placeholder visual)

### v1.5 — diferido (requiere infra/fórmulas)

- V5 Retención y recompra (cohortes + LTV — definir fórmulas antes)
- V7 Mantenimiento y fallas (tasa de retrabajos — definir criterio)
- V8 SLA del taller (requiere timestamps por subStatus — P13 Sub-fase A/D)
- Saved views completo (schema `SavedReportView` + share ADMIN→MANAGER)
- Meta del card en el hub (endpoint agregador cacheado)

### v2 — diferido (módulo o dominio nuevo)

- V11 Transferencias / Mermas (requiere módulo de transferencias + campo merma en ADJUSTMENT)
- V2.1 Funnel de cotizaciones
- V2.2 Autorizaciones y descuentos
- V2.3 NPS y satisfacción
- Comparativo multi-período libre (rango A vs rango B)
- Envío programado de reportes por email
- CFDI XML real

---

## 3. Paleta datavis (D6) — tokens

Agregar a `globals.css` bajo `:root` y `.dark`. Cumple WCAG AA sobre `--surf-lowest` en ambos modos. La primera es la identidad EvoFlow.

```css
:root {
  --data-1: #2ECC71; /* Verde EvoFlow — serie principal */
  --data-2: #1B9AAA; /* Cyan */
  --data-3: #06A77D; /* Turquesa */
  --data-4: #7FB069; /* Oliva */
  --data-5: #F39C12; /* Ámbar (alias de --warn) */
  --data-6: #E07A5F; /* Coral apagado */
  --data-7: #8E7DBE; /* Violeta apagado */
  --data-8: #4A6670; /* Gris-azulado */
}

.dark {
  --data-1: #2ECC71;
  --data-2: #5EC4CC;
  --data-3: #4DBFA1;
  --data-4: #A3C99A;
  --data-5: #F5C842;
  --data-6: #F2A58C;
  --data-7: #B5A9DA;
  --data-8: #8EA2AB;
}
```

**Reglas de uso:**
- Heatmaps e intensidad: solo `--data-1` variando opacity 10-100%.
- Comparaciones ≤3 series: `--data-1` + `--data-2` + `--data-3`.
- Rankings top 8: usar en orden.
- Nunca mezclar con `--ter` (rojo alerta) como serie — se confunde con error.
- Aging buckets: de `--data-1` (vigente) a `--ter` (vencido 90+) progresivamente. Excepción al punto anterior porque semánticamente es "mejor → peor", no categoría.

---

## 4. Slugs de URL (D7) + redirects

```
/reportes                              Hub navegable
/reportes/ventas-e-ingresos            V1   ← redirect de /reportes/ventas-vendedor
/reportes/margen-bruto                 V2   ← redirect de /reportes/rentabilidad
/reportes/comisiones                   V3   (sin cambio)
/reportes/apartados                    V4   (nueva)
/reportes/clientes                     V6   (sin cambio, P10-B)
/reportes/clientes/[id]                V6   (sin cambio, nivel 2 P10-B)
/reportes/inventario                   V9   ← redirect de /reportes/inventario/valor
                                               + /reportes/inventario/movimientos
/reportes/stock-critico                V10  ← redirect de /reportes/inventario/stock-minimo
/reportes/estado-resultados            V12  ← redirect de /reportes/anual
/reportes/tesoreria                    V13  ← redirect de /reportes/caja
                                               + /reportes/caja/historial
/reportes/cuentas-por-pagar            V14  ← redirect de /reportes/compras-proveedor
/reportes/exportacion-contable         V15  (placeholder)

/reportes/retencion                    V5   (404 en v1 — ruta reservada para v1.5)
/reportes/taller-mantenimiento         V7   (404 en v1)
/reportes/taller-sla                   V8   (404 en v1)
/reportes/transferencias-mermas        V11  (404 en v1)
```

**Redirects: permanent (308) en `middleware.ts` o `next.config.js`**. Todas las URLs P10 actuales deben resolverse sin romper bookmarks del usuario.

---

## 5. Sidebar (D8) — estructura final

Ítem "Reportes" en el grupo Gestión del sidebar actual, con **3-4 pinned del usuario** debajo (no de todos los 14 reportes).

**Default de pinned por rol** (si `User.pinnedReports === []`):
- **ADMIN**: `ventas-e-ingresos`, `estado-resultados`, `stock-critico`, `cuentas-por-pagar`
- **MANAGER**: `ventas-e-ingresos`, `stock-critico`, `tesoreria`
- **SELLER**: `clientes` (único reporte al que tiene acceso)

**Interacción:**
- Toggle bookmark 🔖 en cada card del hub → actualiza `User.pinnedReports` → se refleja en sidebar sin reload (revalidate path).
- Máximo 4 pinned en sidebar. Si el usuario marca un 5º, el más viejo se desplaza.
- Acceder a un reporte no pinned → navegar via hub o via Cmd+K (command palette ya existe).

**Schema v1 aditivo:**
```prisma
model User {
  // ... campos existentes
  pinnedReports  String[]  @default([]) // slugs de reportes
  uiPreferences  Json?
}
```

---

## 6. Hub `/reportes` — comportamiento (D9)

**Renderizado:** Server Component async con `export const dynamic = "force-dynamic"`.

**Contenido:**
- Topbar con branch selector (ADMIN), search `⌘K`, theme toggle, tweaks button.
- H1 "Reportes" + subtítulo corto.
- Sección "Pinned" si el usuario tiene pinned (4 cards).
- Secciones por grupo: VENTAS (V1, V2, V3) · CLIENTES (V4, V6) · INVENTARIO (V9, V10) · FINANCIERO (V12, V13, V14) · EXPORTACIONES (V15).
- Grupos con reportes diferidos (TALLER V7+V8, CLIENTES retención V5, INVENTARIO transferencias V11) **no aparecen en v1**.

**Lo que NO lleva v1 (diferido a v1.5):**
- Meta del card `Hace X min · N regs` (requiere endpoint agregador).
- Alertas activas.
- Widgets de branch comparison / top products / low stock embebidos.
- Vistas guardadas con schema.

**Performance:** hub sin meta = 1 query (leer `User.pinnedReports`). Carga <100ms.

---

## 7. Helper `previousComparableRange` (D10) — firma

Ubicación: **`src/lib/reportes/date-range.ts`** (agregar al módulo existente).

```typescript
export type CompareMode = "prev-period" | "prev-month" | "prev-year";

/**
 * Dado un rango, calcula el rango comparable anterior según el modo.
 * - prev-period (default): mismo largo de días inmediatamente previos.
 *   1-15 abril → 17-31 marzo
 * - prev-month: mismo calendario del mes previo.
 *   1-15 abril → 1-15 marzo
 * - prev-year: mismo rango del año previo (para YoY).
 *   1-15 abril 2026 → 1-15 abril 2025
 *
 * Respeta timezone America/Merida (UTC-6). Usar junto con parseDateRange.
 */
export function previousComparableRange(
  range: { from: Date; to: Date },
  mode: CompareMode = "prev-period"
): { from: Date; to: Date };
```

**Uso por reporte:**
- V1 Ventas e ingresos: soporta los 3 modos.
- V2 Margen bruto: `prev-period` y `prev-month`.
- V12 P&L: los 3 modos (el YoY es core para el reporte anual).
- V13 Cashflow: `prev-period` y `prev-month`.
- V14 CxP: `prev-period`.
- Resto: `prev-period` solamente.

**URL param:** cuando un reporte soporta múltiples modos, exponer toggle en UI con `?compare=prev-period|prev-month|prev-year`.

---

## 8. Sparklines (D11) — convención

**SVG manual embebido** para todo lo que va dentro de un KPI card (~60+ instancias en la app).
**Recharts** para gráficos principales que requieren interacción (tooltips, zoom, click-to-filter).

**Regla operativa:**
- Si cabe en un cuadro de ≤ 80px de alto sin ejes ni leyenda → **SVG manual** del handoff (`Sparkline`, `SparkBars`).
- Si tiene ejes, tooltip, leyenda o es el foco visual de la sección → **Recharts**.

**Portar del handoff:**
- `src/components/ui/sparkline.tsx` (port de `charts.jsx` del handoff, tipado estricto)
- `src/components/ui/spark-bars.tsx`
- `src/components/ui/progress-split.tsx` (para KPI con composición, ej. "Pagado 60% · Pendiente 40%")

Todos reciben `color?: string` (default `var(--data-1)`) y respetan tokens.

---

## 9. Mapeo canónico SPEC ↔ P10 ↔ custom/genérico

| ID | Nombre | P10 origen | Acción | Treatment | Estado v1 |
|----|--------|-----------|--------|-----------|-----------|
| V1 | Ventas e ingresos | P10-A Ventas por vendedor | Ampliar (líneas + stacked, comparativo) | **Custom — piloto** | ✅ |
| V2 | Margen bruto | P10-C Rentabilidad | Renombrar + scatter plot | Custom | ✅ |
| V3 | Comisiones | Fase 5-D existente | Reusar server-side + UI nueva | Genérico | ✅ |
| V4 | Apartados / LAYAWAY | Nuevo (hoy en `/pedidos` LAYAWAY) | Crear con donut antigüedad + WhatsApp | Genérico | ✅ |
| V5 | Retención y recompra | Nuevo | Cohortes + LTV | ⏸️ **Diferido a v1.5** | — |
| V6 | Estado de cuenta | P10-B (ya con 2 niveles) | Reusar; ajustes visuales | Genérico | ✅ |
| V7 | Mantenimiento y fallas | Nuevo | Tasa retrabajos | ⏸️ **Diferido a v1.5** | — |
| V8 | SLA del taller | Nuevo | Timestamps por subStatus | ⏸️ **Diferido a v1.5** | — |
| V9 | Stock y rotación | P10-D + P10-E | Fusionar en tabs | Custom (treemap) | ✅ |
| V10 | Stock crítico | P10-H | Ampliar con forecast | Custom (priority inbox) | ✅ |
| V11 | Transferencias / Mermas | Nuevo | Requiere módulo transferencias | ⏸️ **Diferido a v2** | — |
| V12 | P&L del período | P10-I Reporte anual | Reemplazar (P10-I desaparece como card) | Custom (tabla financiera colapsable) | ✅ |
| V13 | Cashflow y tesorería | P9 + P10-F | Fusionar en tabs | Custom (waterfall) | ✅ |
| V14 | CxP + Compras | P10-G | Ampliar con aging buckets | Custom (aging) | ✅ |
| V15 | Exportación contable | Nuevo | Placeholder visual | Placeholder | ✅ |

---

## 10. Orden de sesiones de Claude Code

**Total: 17 sesiones v1** (1 sesión 0 + 17 de trabajo).

### Sesión 0 ✅ (2026-04-18) — Port primitivos del handoff (Sonnet, sin subagentes)
Port mecánico del handoff:
- `src/lib/format/index.ts` (formatters `formatMXN`, `formatNumber`, `formatPercent`, `formatDate`, `formatDateRange`, `formatRelative`)
- `src/components/primitives/icon.tsx` (41 glyphs tipados, union `IconName`)
- `src/components/primitives/chip.tsx`, `delta.tsx`, `sparkline.tsx`, `spark-bars.tsx`, `progress-split.tsx`
- Paleta datavis `--data-1..8` (light + dark) y tokens faltantes mergeados en `globals.css`
- `DESIGN.md §6` y `§8` actualizados con subsección "Primitivos del módulo reportes"

### Fase A — Fundación (sin subagentes)
1. **Sesión 1 ✅ (2026-04-18)** — Recharts + wrapper con tokens EvoFlow. `recharts@3.8.0` instalado vía `npx shadcn add chart`. `--chart-1..5` mapeados a `var(--data-*)` en `globals.css`. Wrapper en `src/components/primitives/chart.tsx`: `buildChartConfig`, `ChartTooltipContentGlass`, constantes de eje/grid. `DESIGN.md §3` y `§6` actualizados.
2. **Sesión 2** — Schema: migración aditiva `add_reports_v1_schema`. Añadir `User.pinnedReports String[]`, `User.uiPreferences Json?`, modelo `AlertThreshold`. API CRUD mínimas. **Verificar antes: NextAuth no rompe con el campo Json en JWT** (AGENTS.md advierte).
3. **Sesión 3** — Shell del hub: `/reportes/page.tsx` + layout + sidebar update (ítem "Reportes" + 3-4 pinned computados desde `User.pinnedReports`). Toggle bookmark en cards del hub.

### Fase B — Template validado (sin subagentes)
4. **Sesión 4** — V1 Ventas e ingresos completo (custom piloto). `DetailHeader` + `FilterPanel` con popovers multi-select + 5 KPIs con Delta/Sparkline + Recharts stacked bars + tabla con modal de detalle.

### Fase C — Overlays (sin subagentes)
5. **Sesión 5** — ExportDrawer + helper `previousComparableRange` (sec. §7).
6. **Sesión 6** — ThresholdsModal sobre el schema de Sesión 2. Cada reporte custom consulta thresholds al render.
7. **Sesión 7** — TweaksPanel + persistencia en `User.uiPreferences`.
8. **Sesión 8** — Builder placeholder (3-4 cards visuales, sin backend).

### Fase D — Placeholders
9. **Sesión 9** — V15 Exportación contable placeholder (wizard vacío, link a CSV existente).

### Fase E — Reportes custom (sin subagentes, uno por sesión)
10. **Sesión 10** — **V12 P&L del período** (OPUS recomendado: complejidad financiera + reemplaza P10-I + comparativos × 3 modos × sucursales)
11. **Sesión 11** — V13 Cashflow y tesorería (waterfall + tabs, fusiona P9 + P10-F)
12. **Sesión 12** — V14 CxP + Compras (aging buckets, amplía P10-G)
13. **Sesión 13** — V10 Stock crítico (priority inbox + forecast básico)
14. **Sesión 14** — V9 Stock y rotación (treemap + scatter, fusiona P10-D + P10-E)
15. **Sesión 15** — V2 Margen bruto (scatter, reusa P10-C)

### Fase F — Reportes genéricos (CON SUBAGENTES en paralelo)
16. **Sesión 16** — 3 reportes genéricos en paralelo con subagentes (patrón P10 Lotes 1-7):
    - Subagente A: V3 Comisiones
    - Subagente B: V4 Apartados / LAYAWAY
    - Subagente C: V6 Estado de cuenta (verificar P10-B — probablemente solo ajuste visual)

### Fase G — Cierre
17. **Sesión 17** — QA cross-reporte + redirects (§4) + rutas 404 reservadas + sidebar final + smoke test light/dark × 10 reportes + overlays + actualizar ROADMAP.md marcando Paso 2 shell completo.

---

## 11. Reglas de subagentes (recordatorio desde AGENTS.md)

**USAR** para:
- Reportes independientes que no comparten FK modificados (Sesión 16 con V3/V4/V6).
- Audit cross-módulo de lint o dark mode.

**NUNCA USAR** para:
- Migraciones Prisma (Sesión 2).
- Cambios a `pos-terminal.tsx`.
- Cambios a Sale/SaleItem/AssemblyOrder/CashTransaction simultáneamente.
- Shell del hub (Sesión 3 — regresión similar a Sub-sesión 1-D).
- Reportes custom (Sesiones 10-15 — cada uno requiere juicio contra DESIGN.md).

---

## 12. Decisiones técnicas pendientes que cada sesión puede resolver

No son bloqueantes — se resuelven dentro de la sesión correspondiente:

| Sesión | Decisión |
|---|---|
| 2 | Shape exacto de `AlertThreshold` (por metricKey string libre vs enum). |
| 5 | ExcelJS o solo multi-CSV. Verificar compatibilidad con Turbopack de Next 16. |
| 10 | OPUS o SONNET — depender del grado de reuse que se logre desde P10-I. |
| 16 | Si V6 Estado de cuenta necesita cambios visuales o si P10-B ya cumple. |

---

## 13. Fuera de alcance explícito (no discutir en v1)

- Gráficos animados / TV-mode.
- Permisos granulares por columna.
- Envío programado de reportes por email.
- Editor de reporte custom tipo Metabase.
- CFDI XML real (requiere integración con PAC).
- Comparativo multi-período libre (rango A vs rango B arbitrarios).
- Mobile drawer / sheet (proyecto es desktop-first, ver AGENTS.md).

---

## 14. Reglas de implementación (NUNCA ROMPER — pegar en cada sesión)

- Mutaciones SIEMPRE via API Routes en `src/app/api/`. Cero Server Actions.
- Consultas en páginas SIEMPRE en Server Components async.
- Operaciones multi-tabla SIEMPRE en `prisma.$transaction()`.
- Prohibido `any` en TypeScript.
- `import { prisma } from "@/lib/prisma"` exclusivamente.
- Migraciones SIEMPRE `prisma migrate dev --name <name>`.
- Filtrar por `branchId` del JWT excepto ADMIN.
- `npm run lint` + `npm run build` limpios antes de commit.
- Consultar DESIGN.md antes de cualquier trabajo de UI.
- No modificar `pos-terminal.tsx` sin advertir riesgo de regresión.

---

## 15. Entregable de cada sesión

Cada sesión de Claude Code debe entregar:

1. Código en ramas/archivos según el scope de la sesión.
2. Commits separados por concern (schema / logic / UI).
3. Validación `npx prisma validate && npm run lint && npm run build` en Exit 0.
4. Smoke test light + dark mode si hay UI.
5. Sugerencia de commit en formato: `feat|fix|refactor|chore: descripción corta en español`.
6. Actualización de `ROADMAP.md` con el subpunto completado marcado ✅.

---

*Fin del documento. Este archivo es la fuente de verdad del rediseño v1 de `/reportes`.
Si cualquier decisión cambia, actualizar aquí antes de cualquier otra acción.*
