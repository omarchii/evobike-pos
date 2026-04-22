# Design System Document

## Kinetic Precision — EvoFlow Green Edition (Dual Mode)

---

## 1. Overview & Creative North Star

### Creative North Star: "Kinetic Precision — Verdant"

Este sistema toma la arquitectura visual de **Kinetic ERP** (densidad editorial, jerarquía sin líneas, profundidad tonal) y la combina con la **paleta verde EvoFlow**. El resultado evoca crecimiento, confianza y movilidad sostenible sin sacrificar la claridad técnica de un ERP de alto rendimiento.

Soporta **light mode y dark mode** de forma nativa. El colorway verde es la identidad permanente en ambos modos — solo cambian las superficies y la luminosidad de los tokens.

---

## 2. Color & Surface Architecture

### Paleta Principal — EvoFlow Green

| Token                  | Light     | Dark      | Uso                                             |
| ---------------------- | --------- | --------- | ----------------------------------------------- |
| `primary`              | `#1B4332` | `#a5d0b9` | Texto de acción, íconos activos, bordes de foco |
| `primary-mid`          | `#2D6A4F` | `#7ab89a` | Hover states en elementos primarios             |
| `primary-bright`       | `#2ECC71` | `#2ECC71` | CTAs, focus states, indicadores de progreso     |
| `primary-container`    | `#A8E6CF` | `#1B4332` | Fondos de chips, badges, pill activo            |
| `on-primary`           | `#FFFFFF` | `#131313` | Texto sobre fondos `primary` o gradiente        |
| `on-primary-container` | `#1B4332` | `#a5d0b9` | Texto sobre `primary-container`                 |

### Paleta Secundaria

| Token                    | Light     | Dark      | Uso                                               |
| ------------------------ | --------- | --------- | ------------------------------------------------- |
| `secondary`              | `#52B788` | `#52B788` | Íconos de estado positivo, etiquetas "Completado" |
| `secondary-container`    | `#D8F3DC` | `#0d3320` | Fondos suaves de secciones informativas           |
| `on-secondary-container` | `#1B4332` | `#a5d0b9` | Texto sobre `secondary-container`                 |

### Paleta de Alertas

| Token                   | Light     | Dark      | Uso                                   |
| ----------------------- | --------- | --------- | ------------------------------------- |
| `tertiary`              | `#E74C3C` | `#ff8080` | Stock crítico, errores, cancelaciones |
| `tertiary-container`    | `#FDECEA` | `#3d1515` | Fondo de paneles de alerta            |
| `on-tertiary-container` | `#7B241C` | `#ffb3b1` | Texto dentro de paneles de alerta     |
| `warning`               | `#F39C12` | `#f5c842` | Estado "Pendiente", "En proceso"      |
| `warning-container`     | `#FEF9E7` | `#3d2e00` | Fondo de chips de estado pendiente    |

### Surface Hierarchy — "No-Line" Rule

> **Regla absoluta:** Prohibido usar bordes `1px solid` para separar secciones. Las fronteras se comunican por cambio tonal, no por líneas visibles.

| Token                       | Light     | Dark      | Uso                                         |
| --------------------------- | --------- | --------- | ------------------------------------------- |
| `surface`                   | `#F8FAFA` | `#131313` | Canvas base de la aplicación                |
| `surface-container-low`     | `#F0F7F4` | `#1B1B1B` | Sidebar, paneles de utilidad                |
| `surface-container-lowest`  | `#FFFFFF` | `#222222` | Cards de contenido principal ("lifted")     |
| `surface-container-high`    | `#DCF0E8` | `#2B2B2B` | Hover state de list items, pills activos    |
| `surface-container-highest` | `#C7E6D8` | `#333333` | Estados "recessed", inputs presionados      |
| `surface-dim`               | `#D0E8DC` | `#181818` | Separación de navegación (background shift) |
| `surface-bright`            | `#FAFFFE` | `#2B2B2B` | Modales flotantes con glassmorphism         |

### Neutrales / On-Surface

| Token                | Light     | Dark      | Uso                                   |
| -------------------- | --------- | --------- | ------------------------------------- |
| `on-surface`         | `#131B2E` | `#e8f0eb` | Texto principal (nunca `#000000`)     |
| `on-surface-variant` | `#3D5247` | `#8fbfa0` | Labels técnicos, metadata, subtítulos |
| `outline-variant`    | `#B2CCC0` | `#2d4a3a` | Ghost borders al 15% de opacidad      |

---

## 3. Velocity Gradient

El gradiente de acento es idéntico en ambos modos:

```css
background: linear-gradient(135deg, #1b4332 0%, #2ecc71 100%);
```

**Usos — máximo 3 instancias por vista:**

- Fondo del KPI card más importante (ej: Ventas hoy)
- Botón Primary CTA principal
- Indicadores de progreso de alto nivel

**Charts nunca usan Velocity Gradient** como serie. La identidad es `--data-1`
(verde sólido). El gradient es exclusivo de KPI destacado y CTA primario.

---

## 4. Typography

Estrategia dual-font: **Space Grotesk** para voz "Engineered" + **Inter** para voz "Technical".

```css
/* Importar en globals.css */
@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Space+Grotesk:wght@500;700&display=swap");
```

| Rol           | Font          | Tamaño   | Peso | Letter-spacing | Uso                        |
| ------------- | ------------- | -------- | ---- | -------------- | -------------------------- |
| `display-md`  | Space Grotesk | 2.75rem  | 700  | `-0.02em`      | KPIs de alto nivel         |
| `headline-sm` | Space Grotesk | 1.5rem   | 700  | `-0.01em`      | Títulos de página          |
| `card-title`  | Inter         | 0.75rem  | 600  | `-0.01em`      | Títulos de card            |
| `body-lg`     | Inter         | 1rem     | 400  | `0`            | Descripciones, contenido   |
| `body-sm`     | Inter         | 0.75rem  | 400  | `0`            | Datos de tabla             |
| `label-md`    | Inter         | 0.75rem  | 500  | `0.05em`       | ALL-CAPS, metadata técnica |
| `label-sm`    | Inter         | 0.625rem | 500  | `0.04em`       | Chips de estado            |

---

## 5. Elevation & Depth

### Ambient Shadow

```css
box-shadow: 0px 12px 32px -4px rgba(19, 27, 46, 0.06);
/* Dark mode: */
box-shadow: 0px 12px 32px -4px rgba(0, 0, 0, 0.4);
```

### Glassmorphism (modales flotantes)

```css
background: rgba(250, 255, 254, 0.8);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
/* Dark mode: */
background: rgba(27, 27, 27, 0.85);
backdrop-filter: blur(20px);
```

### Ghost Border (fallback de accesibilidad)

```css
outline: 1px solid rgba(178, 204, 192, 0.15);
/* Dark mode: */
outline: 1px solid rgba(45, 74, 58, 0.3);
```

---

## 6. Components

### Buttons — "Engine Start"

**Primary (Velocity Gradient):**

```css
background: linear-gradient(135deg, #1b4332, #2ecc71);
color: #ffffff;
border-radius: 1.5rem;
border: none;
font-family: "Inter", sans-serif;
font-weight: 600;
```

**Secondary:**

```css
background: var(--surface-container-high);
color: var(--primary);
border-radius: 1.5rem;
border: none;
font-family: "Inter", sans-serif;
font-weight: 500;
```

**Outlined / Ghost:**

```css
background: transparent;
color: var(--primary);
border: 1.5px solid var(--primary-mid);
border-radius: 1.5rem;
```

---

### Navigation Sidebar

```css
background: var(--surface-container-low);
/* Sin borde derecho — la separación es tonal */
```

**Item activo:**

```css
background: var(--surface-container-high);
color: var(--primary);
border-radius: 0.75rem;
font-weight: 600;
```

**Item hover:**

```css
background: var(--surface-container-high);
color: var(--primary-mid);
border-radius: 0.75rem;
```

**Badge de cantidad:**

```css
background: linear-gradient(135deg, #1b4332, #2ecc71);
color: #ffffff;
font-size: 0.625rem;
font-weight: 600;
border-radius: 999px;
padding: 1px 6px;
```

---

### KPI Cards

```css
/* Card base */
background: var(--surface-container-lowest);
border-radius: 1rem;
box-shadow: 0px 12px 32px -4px rgba(19, 27, 46, 0.06);
padding: 1.5rem;

/* Card destacada — solo una por vista */
background: linear-gradient(135deg, #1b4332, #2ecc71);
color: #ffffff;
border-radius: 1rem;
```

**Estructura interna:**

```css
/* Label */
font-size: 0.625rem;
font-weight: 500;
letter-spacing: 0.05em;
text-transform: uppercase;
color: var(--on-surface-variant);
margin-bottom: 0.5rem;

/* Valor */
font-family: "Space Grotesk", sans-serif;
font-size: 2.75rem;
font-weight: 700;
letter-spacing: -0.02em;

/* Sub — tendencia */
font-size: 0.75rem;
color: var(--on-surface-variant);
margin-top: 0.35rem;
```

---

### Input Fields

**Default:**

```css
background: var(--surface-container-lowest);
border: 1px solid rgba(178, 204, 192, 0.15);
border-radius: 0.75rem;
color: var(--on-surface);
font-family: "Inter", sans-serif;
font-size: 0.75rem;
padding: 0.5rem 0.75rem;
```

**Focus:**

```css
border: 2px solid #2ecc71;
outline: none;
```

---

### Status Chips

```css
/* Base */
border-radius: 999px;
padding: 0.2rem 0.65rem;
font-size: 0.625rem;
font-weight: 500;
letter-spacing: 0.04em;
text-transform: uppercase;
font-family: "Inter", sans-serif;
```

| Estado       | Background token      | Color texto              |
| ------------ | --------------------- | ------------------------ |
| `Completado` | `secondary-container` | `on-secondary-container` |
| `En proceso` | `warning-container`   | `warning`                |
| `Pendiente`  | `warning-container`   | `warning`                |
| `Stock bajo` | `tertiary-container`  | `on-tertiary-container`  |
| `Sin stock`  | `tertiary`            | `#FFFFFF`                |
| `Atrato`     | `primary-container`   | `on-primary-container`   |

---

### The Power Grid (tablas de alta densidad)

```css
/* Header de columna */
font-size: 0.75rem;
font-weight: 500;
letter-spacing: 0.05em;
text-transform: uppercase;
color: var(--on-surface-variant);
padding: 0.5rem 0.75rem;
border-bottom: 1px solid rgba(178, 204, 192, 0.15);

/* Row data */
font-size: 0.75rem;
color: var(--on-surface);
padding: 0.5625rem 0.75rem;

/* Row hover */
background: var(--surface-container-high);

/* Sin dividers entre filas — el spacing de 0.9rem es suficiente */
```

---

## 7. Spacing & Radius Scale

| Token  | rem     | px     | Uso típico               |
| ------ | ------- | ------ | ------------------------ |
| `xs`   | 0.25rem | 4px    | Row hover radius         |
| `sm`   | 0.5rem  | 8px    | Chips, badges            |
| `md`   | 0.75rem | 12px   | Inputs, nav items        |
| `lg`   | 1rem    | 16px   | Cards, secciones         |
| `xl`   | 1.5rem  | 24px   | Botones pill, modales    |
| `2xl`  | 2rem    | 32px   | Modales grandes          |
| `full` | —       | 9999px | Pills, botones primarios |

**Padding estándar de card:** `1.5rem`
**Padding en pantalla densa:** `1.75rem`

### Densidad (v1 — Sesión 7)

Tokens CSS: `--density-row`, `--density-card`, `--density-cell-y`. Valores según
nivel aplicado como clase en un ancestro del contenido:

| Nivel       | Clase                  | `--density-row` | `--density-card` | `--density-cell-y` |
|-------------|------------------------|-----------------|------------------|--------------------|
| compact     | `.density-compact`     | 32px            | 1rem             | 6px                |
| normal      | `.density-normal`      | 40px            | 1.5rem           | 10px               |
| comfortable | `.density-comfortable` | 52px            | 2rem             | 14px               |

**Aplicación**: layout `(pos)` lee `User.uiPreferences.density` en Server Component
y pone la clase en el div raíz del shell. Los componentes consumidores usan los tokens
via `var(--density-row)` / `var(--density-card)` / `var(--density-cell-y)`.

**Alcance v1**: solo consumen los tokens las tablas de reportes (Power Grid) y los
KPI cards (excepto el featured con Velocity Gradient, que usa padding fijo para
preservar jerarquía visual). Sidebar, topbar, forms y modales no cambian con density.

---

## 8. CSS Custom Properties — Implementación

### Paleta datavis (`--data-1` a `--data-8`)

Tokens para series de gráficos. Definidos en `globals.css` bajo `:root` y `.dark`. Reglas de uso (spec §3):

- **Heatmaps e intensidad:** solo `--data-1` variando opacity 10–100%.
- **Comparaciones ≤3 series:** `--data-1` + `--data-2` + `--data-3`.
- **Rankings top 8:** usar en orden.
- **No mezclar con `--ter`** como serie (se confunde con error). Excepción: aging buckets (semántica "mejor → peor", de `--data-1` a `--ter` progresivamente).

Pegar en `globals.css`:

```css
:root {
  /* Primary */
  --p: #1b4332;
  --p-mid: #2d6a4f;
  --p-bright: #2ecc71;
  --p-container: #a8e6cf;
  --on-p: #ffffff;
  --on-p-container: #1b4332;

  /* Secondary */
  --sec: #52b788;
  --sec-container: #d8f3dc;
  --on-sec-container: #1b4332;

  /* Tertiary / Alerts */
  --ter: #e74c3c;
  --ter-container: #fdecea;
  --on-ter-container: #7b241c;
  --warn: #f39c12;
  --warn-container: #fef9e7;

  /* Surfaces */
  --surface: #f8fafa;
  --surf-low: #f0f7f4;
  --surf-lowest: #ffffff;
  --surf-high: #dcf0e8;
  --surf-highest: #c7e6d8;
  --surf-dim: #d0e8dc;
  --surf-bright: #fafffe;

  /* On-surface */
  --on-surf: #131b2e;
  --on-surf-var: #3d5247;
  --outline-var: #b2ccc0;

  /* Ghost border — para inputs, bordes sutiles en tablas y tintes al 15% */
  --ghost-border: rgba(178, 204, 192, 0.15);

  /* Elevation */
  --shadow: 0px 12px 32px -4px rgba(19, 27, 46, 0.06);

  /* Radius */
  --r-xs: 4px;
  --r-sm: 8px;
  --r-md: 12px;
  --r-lg: 16px;
  --r-xl: 24px;
  --r-full: 9999px;

  /* Typography */
  --font-display: "Space Grotesk", sans-serif;
  --font-body: "Inter", -apple-system, sans-serif;
}

.dark {
  --p: #a5d0b9;
  --p-mid: #7ab89a;
  --p-bright: #2ecc71;
  --p-container: #1b4332;
  --on-p: #131313;
  --on-p-container: #a5d0b9;

  --sec: #52b788;
  --sec-container: #0d3320;
  --on-sec-container: #a5d0b9;

  --ter: #ff8080;
  --ter-container: #3d1515;
  --on-ter-container: #ffb3b1;
  --warn: #f5c842;
  --warn-container: #3d2e00;

  --surface: #131313;
  --surf-low: #1b1b1b;
  --surf-lowest: #222222;
  --surf-high: #2b2b2b;
  --surf-highest: #333333;
  --surf-dim: #181818;
  --surf-bright: #2b2b2b;

  --on-surf: #e8f0eb;
  --on-surf-var: #8fbfa0;
  --outline-var: #2d4a3a;
  --ghost-border: rgba(45, 74, 58, 0.30);

  --shadow: 0px 12px 32px -4px rgba(0, 0, 0, 0.4);
}
```

---

## 9. Do's and Don'ts

### Do

- Usar `#2ECC71` exclusivamente para elementos de acción — CTAs, focus states, progreso. Los neutrales hacen el trabajo estructural.
- Usar `surface-container-low` como fondo del sidebar. El tinte verde acompaña la identidad sin saturar.
- Aplicar el Velocity Gradient solo en el KPI card más importante y en el botón Primary. Máximo 3 instancias por vista; la 3ª se reserva a elementos del shell (chip BRANCH non-admin y avatar footer sidebar).
- Usar `on-surface` (`#131B2E` / `#e8f0eb`) para todo texto principal. Nunca `#000000`.
- Usar `xl` (1.5rem) o `lg` (1rem) de border-radius en prácticamente todo.
- Space Grotesk exclusivamente para títulos de página y valores KPI. Inter para todo lo demás.

### Don't

- No usar `#2ECC71` como fondo de secciones grandes — es demasiado saturado para áreas de descanso visual.
- No usar bordes `1px solid` para separar sidebar del contenido. Usar el cambio tonal de `surface-container-low` → `surface`.
- No apilar más de 3 niveles de surface containers. Si se necesita un 4to nivel, usar glassmorphism.
- No usar dividers horizontales entre items de lista. El spacing de `0.9rem` es suficiente.
- No usar la paleta de alerta roja para nada que no sea un estado negativo real.
- No mezclar pesos 600/700 de Inter en cuerpo de texto — reservarlos para card titles. El peso 700 en display es solo Space Grotesk.

---

## 10. Anti-patterns que rompen dark mode

Toda violación en esta lista rompe light o dark mode silenciosamente. Los linters no las detectan — hay que revisar manualmente en ambos modos antes de commitear.

### Colores hardcoded prohibidos

| Anti-pattern | Reemplazo | Razón |
| --- | --- | --- |
| `rgba(178, 204, 192, 0.15)` / `.2` / `.08` | `var(--ghost-border)` | El token adapta a `rgba(45,74,58,0.30)` en dark; el hardcoded se mantiene verde claro sobre fondo negro |
| `text-white` como color de texto general | `text-[var(--on-surf)]` o `text-[var(--on-p)]` | Excepción única: KPI card con Velocity Gradient (la spec manda `color: #ffffff` fijo porque el gradient es identidad permanente) |
| `#dc2626` / `bg-red-500` / cualquier rojo Tailwind | `var(--ter)` + `var(--ter-container)` + `var(--on-ter-container)` | El rojo canónico es `#e74c3c` light / `#ff8080` dark — Tailwind red-500 no flipea |
| `bg-white` | `bg-[var(--surf-lowest)]` | `surf-lowest` = `#ffffff` light pero `#222222` dark |
| `#000000` / `text-black` | `text-[var(--on-surf)]` | Texto principal es `#131B2E` light / `#e8f0eb` dark |
| `bg-slate-*`, `bg-zinc-*`, `bg-gray-*` | surface tokens | Los neutrales de Tailwind no participan del dual-mode del proyecto |

### Tipografía — errores frecuentes

- **KPIs sin `tracking-[-0.02em]`** — la compresión tipográfica del valor display es parte del look. Si pones `text-[2.75rem] font-bold` + Space Grotesk sin tracking, se ve suelto.
- **Títulos de página sin Space Grotesk** — `font-bold text-xl` no basta; hay que incluir `style={{ fontFamily: "var(--font-display)" }}` o usar la clase Tailwind variable.
- **`font-semibold` en body copy** — Inter 600 es exclusivo de card titles. En párrafos/descripciones rompe la jerarquía con los títulos.
- **`tracking-wide` genérico en labels uppercase** — usar siempre `tracking-[0.05em]` (label-md) o `tracking-[0.04em]` (label-sm).
- **Referenciar tokens de fuente inexistentes** — el único token de fuente oficial es `var(--font-display)`. `var(--font-heading)` **no existe**.

### Glassmorphism — patrón oficial del proyecto

El proyecto implementa glassmorphism con `color-mix` sobre `--surf-bright` (no con `rgba` fijo) precisamente porque `--surf-bright` ya adapta a dark. El patrón canónico — úsalo tal cual:

```css
background: color-mix(in srgb, var(--surf-bright) 88%, transparent);
backdrop-filter: blur(20px);
-webkit-backdrop-filter: blur(20px);
```

Para tintes de status/alerta, `color-mix` sobre el token semántico también es la forma correcta:

```css
/* Tint suave de warn container */
background: color-mix(in srgb, var(--warn) 12%, transparent);
/* Chip activo primario */
background: color-mix(in srgb, var(--p) 10%, transparent);
```

No reemplazar estos patrones por `rgba` hardcoded.

### Velocity Gradient — usos permitidos

Máximo 3 instancias por vista (KPI destacado + CTA primario + elemento del shell). Las instancias del shell (chip BRANCH non-admin, avatar footer sidebar) cuentan como la 3ª permitida. Se aceptan usos adicionales **solo** en:
- Chips/pills de estado "activo" en toggles de filtros de rango temporal
- Barras de progreso de comparativos (branch vs branch, modelo vs modelo)

Si una vista excede el máximo y no entra en esas excepciones, usar `bg-[var(--p)]` + `text-[var(--on-p)]`.

### Checklist antes de commitear UI

1. ¿Hay algún `rgba(...)` hardcoded? → migrar a token.
2. ¿Hay colores `#` fuera del gradient oficial (`#1b4332`/`#2ecc71`)? → migrar a token.
3. ¿Los títulos de página usan Space Grotesk? ¿Los KPIs tienen `tracking-[-0.02em]`?
4. ¿Probé la vista en light y dark mode? (ver Topbar → ThemeToggle)
5. ¿Los separadores son cambio tonal de surface, no `border-b` con color?

---

### Primitivos del módulo reportes

Ubicación: `src/components/primitives/`. **No son shadcn.** Custom del proyecto,
portados del handoff del rediseño v1 de `/reportes`.

- `<Icon name />` — 41 glyphs tipados (`IconName` union). Props: `name`, `size?` (default 20), `strokeWidth?` (default 1.5), `className?`.
- `<Chip variant label icon? />` — 5 variantes semánticas: `neutral`, `success`, `warn`, `error`, `info`.
- `<Delta value format? showIcon? />` — indicador de cambio con color y glyph. `format`: `"percent"` (default) | `"currency"` | `"number"`.
- `<Sparkline data color? fill? strokeWidth? />` — SVG manual, sin deps, sin interacción. `data: number[]`.
- `<SparkBars data color? highlightLast? gap? />` — SVG manual. `data: number[]`.
- `<ProgressSplit segments height? showLabels? />` — barra segmentada para composición (ej. "Pagado 60% · Pendiente 40%").

Todos aceptan `color?: string` con default `var(--data-1)` y respetan tokens.
Para gráficos principales con tooltip/zoom/legend → Recharts (ver "Charts" abajo).

Formatters en `src/lib/format/index.ts`: `formatMXN`, `formatNumber`, `formatPercent`, `formatDate`, `formatDateRange`, `formatRelative`.
Locale: `es-MX`, timezone: `America/Merida`.

---

### Charts — Wrapper Recharts

Ubicación: `src/components/primitives/chart.tsx`. Punto único de import para
gráficos principales (Sparkline/SparkBars son distintos — ver "Primitivos").

**Regla:** los reportes NUNCA importan de `"recharts"` directo ni de
`"@/components/ui/chart"`. Siempre vía `@/components/primitives/chart`.

**Paleta automática:** `buildChartConfig([...series])` asigna `--data-1..8` en
orden, cicla si hay más de 8 series.

**Ejemplo (stacked bars V1 Ventas e ingresos):**

```tsx
"use client";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContentGlass,
  ChartLegend,
  ChartLegendContent,
  buildChartConfig,
  CHART_AXIS_TICK_PROPS,
  CHART_GRID_PROPS,
} from "@/components/primitives/chart";

const config = buildChartConfig([
  { key: "contado", label: "Contado" },
  { key: "credito", label: "Crédito" },
  { key: "apartados", label: "Apartados" },
]);

<ChartContainer config={config} className="h-72 w-full">
  <BarChart data={data}>
    <CartesianGrid stroke={CHART_GRID_PROPS.stroke} strokeDasharray={CHART_GRID_PROPS.strokeDasharray} vertical={false} />
    <XAxis dataKey="fecha" tick={CHART_AXIS_TICK_PROPS} />
    <YAxis tick={CHART_AXIS_TICK_PROPS} />
    <ChartTooltip content={<ChartTooltipContentGlass />} />
    <ChartLegend content={<ChartLegendContent />} />
    <Bar dataKey="contado"   fill="var(--color-contado)"   stackId="a" />
    <Bar dataKey="credito"   fill="var(--color-credito)"   stackId="a" />
    <Bar dataKey="apartados" fill="var(--color-apartados)" stackId="a" />
  </BarChart>
</ChartContainer>
```

Los `var(--color-<key>)` los inyecta `ChartContainer` automáticamente a partir
del config. Los tokens de eje/grid se pasan como atributos SVG directos
(no como `style={}`), ya que Recharts renderiza elementos SVG.

---

### Datos live (polling) — patrón hook custom

Para datos con **TTL humano** (stock, contadores de caja, métricas dashboard
que se ven varios segundos) el patrón es un hook custom con `useEffect` +
`setInterval` + `AbortController`. Sin dependencias externas (`swr` /
`@tanstack/react-query`) hasta que aparezca el segundo consumo concreto —
el primero solo no justifica la dependencia.

**Implementación de referencia:** `src/hooks/use-stock-availability.ts`
(P13-D.3a). Polling 30s, deduplicación por key (`ids.sort().join(",")`),
cleanup vía AbortController, fallo silencioso (siguiente tick reintenta).

**Cuándo usar:**
- El dato cambia por acciones de OTROS usuarios mientras la pantalla
  está abierta (stock vendido en otra caja, métricas que avanzan).
- Una recarga full (`router.refresh()`) sería disruptiva (rompe form,
  scroll, drawer abierto).

**Cuándo NO usar:**
- El dato es one-shot al montar (usar Server Component + `force-dynamic`).
- El dato cambia solo cuando el usuario actual lo cambia (basta con
  `router.refresh()` post-mutación).
- El dato es crítico de consistencia (usar lectura server-side al
  momento de la acción, no polling).

**Si emerge ≥2.º consumo de polling** (ej. contadores caja, notificaciones
live), reabrir la decisión de dependencia (`swr`) — el costo de
re-implementar cache, dedup y focus revalidation supera el peso de la lib.
