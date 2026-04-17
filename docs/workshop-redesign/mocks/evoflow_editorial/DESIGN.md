# Design System Documentation: High-End Editorial ERP

## 1. Overview & Creative North Star: "The Kinetic Manuscript"
This design system moves away from the cluttered, "dashboard-heavy" aesthetics typical of enterprise software. Our Creative North Star is **The Kinetic Manuscript**. We treat the ERP not as a tool, but as a premium editorial publication where technical data on electric mobility is presented with the authority of a high-end magazine and the precision of an aerospace interface.

The experience is defined by **intentional asymmetry**, large-scale typography, and a "No-Line" philosophy. By eliminating traditional borders, we allow the UI to breathe, using tonal depth and light to guide the user’s eye through complex mobility data.

## 2. Colors & Chromatic Depth
The palette is rooted in a deep, monochromatic dark mode, punctuated by the high-voltage energy of the EvoFlow Green.

### The "No-Line" Rule
**Absolute Restriction:** 1px solid borders are strictly prohibited for sectioning or containment. 
Boundaries must be defined through **Tonal Separation**. To separate a sidebar from a main content area, use a shift from `surface` (#131313) to `surface-container-low` (#1c1b1b). The lack of lines forces a cleaner, more sophisticated visual hierarchy that feels integrated rather than boxed-in.

### Surface Hierarchy & Nesting
Treat the UI as a series of physical layers. Use the surface-container tiers to create "nested" depth:
- **Base Layer:** `surface` (#131313) for the overall application background.
- **Content Blocks:** `surface-container-low` (#1c1b1b) for large layout sections.
- **Interactive Cards:** `surface-container-highest` (#353534) to pull technical data toward the foreground.
- **Glassmorphism:** For floating modals and overlays, use a semi-transparent `surface_variant` with a 20px-40px `backdrop-filter: blur()`. This creates a "frosted glass" effect that maintains the sense of depth without breaking the "No-Line" rule.

### The Velocity Gradient
To represent the movement inherent in electric mobility, all primary Actions (CTAs) must use the **Velocity Gradient**:
- **Start:** `primary` (#c0ecd4)
- **End:** `primary_container` (#a5d0b9)
- **Direction:** 135 degrees.
This subtle shift provides a "visual soul" and professional polish that flat color buttons lack.

## 3. Typography: Authority vs. Precision
We utilize a dual-typeface system to balance brand authority with the dense information requirements of an ERP.

*   **Space Grotesk (Authority):** Used for `display`, `headline`, and `title` scales. Its geometric quirks and wide apertures command attention and feel "engineered." Use this for hero numbers (e.g., Battery % or Fleet Total) and section headers.
*   **Inter (Technical Data):** Used for `body` and `label` scales. Inter provides maximum legibility for small-scale technical strings, VIN numbers, and status logs.

**Editorial Tip:** Don't be afraid of extreme scale. A `display-lg` headline at 3.5rem next to a `label-sm` technical note creates the "Editorial" tension that makes this system feel premium.

## 4. Elevation & Depth: Tonal Layering
In the absence of lines, elevation is our primary tool for hierarchy.

*   **The Layering Principle:** Place a `surface-container-lowest` card on a `surface-container-low` section to create a soft, natural "recessed" look. Use higher tiers for "raised" elements.
*   **Ambient Shadows:** For floating elements (like a navigation dock), use extra-diffused shadows.
    *   *Shadow Color:* `#000000` at 12% opacity.
    *   *Blur:* 30px to 50px.
    *   *Offset:* Vertical 10px.
*   **Ghost Borders:** If an element *requires* a container for accessibility in high-density data views, use the "Ghost Border": the `outline_variant` token at **15% opacity**. It should be felt, not seen.

## 5. Components

### Buttons
- **Primary:** Velocity Gradient background, `on_primary` text. `xl` roundedness (0.75rem).
- **Secondary:** `surface_container_highest` background. No border.
- **Tertiary:** Ghost Border (15% opacity `outline_variant`) or purely text-based with `primary` color.

### Technical Data Cards
Cards must never have borders. Use `surface_container` and a generous `padding: 2rem` to let the `Space Grotesk` headlines stand out. For grouping internal data, use a background shift to `surface_container_high` instead of a divider line.

### Modals & Overlays
Modals must employ **Glassmorphism**. 
- **Background:** `surface_variant` at 60% opacity.
- **Effect:** `backdrop-filter: blur(24px)`.
- **Edge:** A 1px "Light Leak" on the top edge only, using `primary` at 20% opacity.

### Inputs & Form Fields
- **Container:** `surface_container_lowest`.
- **Active State:** Change background to `surface_bright` and add a subtle `primary` glow (glow, not border).
- **Font:** Use `label-md` (Inter) for helper text to maintain technical clarity.

### Data Visualization
Use the `primary` (EvoFlow Green) for "Go" or "Positive" states and `tertiary` (#ffdad9) for alerts. Avoid standard "Traffic Light" reds/greens; use our refined palette to maintain the premium editorial feel.

## 6. Do’s and Don’ts

### Do
- **Do** use whitespace as a functional tool. If two sections feel cluttered, increase the gap instead of adding a line.
- **Do** use `Space Grotesk` for large, impactful numbers (e.g., "98% Charged").
- **Do** stack surfaces (Lowest -> Low -> Base) to create visual interest.
- **Do** ensure all Glassmorphism has enough contrast for accessibility.

### Don't
- **Don't** ever use a #000000 hex or a #ffffff hex. Always use the defined `surface` and `on_surface` tokens.
- **Don't** use 1px dividers to separate list items. Use 8px or 12px of vertical space.
- **Don't** use "Standard" easing. Use `cubic-bezier(0.2, 0, 0, 1)` for all transitions to mimic the smooth acceleration of an electric vehicle.
- **Don't** center-align everything. The editorial look thrives on left-aligned, structured grids with occasional asymmetrical "breakouts."