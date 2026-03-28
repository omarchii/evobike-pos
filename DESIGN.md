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

**Usos — máximo 2 instancias por vista:**

- Fondo del KPI card más importante (ej: Ventas hoy)
- Botón Primary CTA principal
- Indicadores de progreso de alto nivel

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

---

## 8. CSS Custom Properties — Implementación

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

  --shadow: 0px 12px 32px -4px rgba(0, 0, 0, 0.4);
}
```

---

## 9. Do's and Don'ts

### Do

- Usar `#2ECC71` exclusivamente para elementos de acción — CTAs, focus states, progreso. Los neutrales hacen el trabajo estructural.
- Usar `surface-container-low` como fondo del sidebar. El tinte verde acompaña la identidad sin saturar.
- Aplicar el Velocity Gradient solo en el KPI card más importante y en el botón Primary. Máximo 2 instancias por vista.
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
