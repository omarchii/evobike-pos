# Design System Document: Kinetic Precision (EvoFlow Green Edition)

## 1. Overview & Creative North Star: "The Kinetic Architect"
This design system is engineered for the high-stakes world of electric mobility ERP. It rejects the generic, "bootstrapped" look of standard enterprise software in favor of a **Kinetic Architect** aesthetic. 

The North Star is the intersection of mechanical precision and fluid energy. This is achieved through a "Dark Priority" interface that feels like a high-end vehicle cockpit. We break the rigid grid through **intentional asymmetry**—offsetting data visualizations and using significant negative space to create an editorial flow. The experience should feel less like a database and more like a curated command center.

---

## 2. Colors: Tonal Depth & The No-Line Rule
Our palette is rooted in deep obsidian tones and a signature "EvoFlow Green" that pulses with electric energy.

### The "No-Line" Rule
**Explicit Instruction:** Use of 1px solid borders for sectioning or containment is strictly prohibited. Boundaries must be defined solely through background color shifts or subtle tonal transitions. This creates a more organic, high-end feel.

### Surface Hierarchy & Nesting
Instead of lines, use the `surface-container` tiers to create a physical sense of depth. Treat the UI as stacked sheets of tinted glass:
- **Base Layer:** `surface` (#121412)
- **Primary Sectioning:** `surface-container-low` (#1a1c1a)
- **Interactive Cards:** `surface-container` (#1e201e)
- **Floating/Active Elements:** `surface-container-highest` (#333533)

### The "Glass & Gradient" Rule
To elevate the ERP from "functional" to "premium," floating elements (like Modals or Tooltips) should utilize **Glassmorphism**.
- **Effect:** Background blur (20px-32px) + `surface-variant` at 60% opacity.
- **Signature Texture:** Use a subtle radial gradient on Primary CTAs, transitioning from `primary` (#c0ecd4) to `primary_container` (#a5d0b9) at a 45-degree angle to simulate the metallic sheen of EV bodywork.

---

## 3. Typography: The Data/KPI Dichotomy
We use a dual-font strategy to balance aggressive performance with technical legibility.

- **KPIs & Display (Space Grotesk):** A geometric sans-serif with idiosyncratic "electric" apertures. Used for `display-lg` through `headline-sm`. This is our "Brand Voice." It conveys the precision of the hardware.
- **Technical Data (Inter):** The industry standard for clarity. Used for all `title`, `body`, and `label` roles. It provides the "Analytical Reliability" required for complex ERP data tables and logistics.

**Editorial Scale:** Use extreme contrast. A `display-lg` KPI (3.5rem) should sit confidently next to a `label-sm` (0.6875rem) metadata point to create a sense of hierarchy that feels intentional and bold.

---

## 4. Elevation & Depth: Tonal Layering
Traditional drop shadows are replaced by **Tonal Layering**.

- **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section to create a soft, natural "recessed" lift. 
- **Ambient Shadows:** When a floating state is required (e.g., a dragged item), use an extra-diffused shadow: `box-shadow: 0 20px 40px rgba(0, 33, 20, 0.15);`. The shadow color is a tinted version of `on_primary_fixed_variant` rather than black, mimicking natural ambient light.
- **The "Ghost Border" Fallback:** If accessibility requires a container edge, use the `outline_variant` token at **15% opacity**. Never use 100% opaque borders.

---

## 5. Components: Precision Primitive Styling

### Buttons & Interaction
- **Primary Button:** Large rounding (`full` or `xl`), using the `primary_container` (#a5d0b9). Text is `on_primary_fixed` (#002114) for maximum contrast.
- **Secondary/Ghost:** No container. Use `on_surface` text with a `primary` icon. On hover, shift the background to `surface_bright` at 10% opacity.

### Cards & Lists
- **No Dividers:** Forbid the use of divider lines. Separate list items using `0.5rem` of vertical white space or by alternating between `surface_container_low` and `surface_container`.
- **KPI Cards:** Use `lg` (2rem) corner radius. The top-left corner should feature a high-contrast Space Grotesk value, while the bottom-right houses the Inter-based label.

### Input Fields
- **Soft Trays:** Inputs should not be boxes, but "trays." Use `surface_container_highest` with a bottom-only "Ghost Border" that illuminates to `primary` (#c0ecd4) upon focus.
- **Rounding:** Standard inputs use `md` (1.5rem) rounding to maintain the "EvoFlow" softness.

---

## 6. Do's and Don'ts

### Do
- **DO** use asymmetry. If a dashboard has four widgets, let one take 60% of the width to create a "Hero KPI."
- **DO** utilize `surface_tint` (#a5d0b9) at low opacities (3-5%) as an overlay for large background areas to give the dark mode a cohesive green "soul."
- **DO** use high-rounding (`xl`: 3rem) for large image containers or hero sections to mimic the aerodynamic curves of electric scooters.

### Don't
- **DON'T** use pure black (#000000). Always use `surface` (#121412) to keep the "obsidian glass" feel.
- **DON'T** use 1px dividers. If you feel the need to separate, use space. If space isn't enough, use a color shift.
- **DON'T** use standard Material shadows. Keep it flat or use the "Ambient Shadow" spec defined in Section 4.