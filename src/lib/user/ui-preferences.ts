export const DENSITY_LEVELS = ["compact", "normal", "comfortable"] as const;
export type DensityLevel = (typeof DENSITY_LEVELS)[number];

export type UiPreferences = {
  density?: DensityLevel;
  // Extensible v1.5: defaultCompareMode, columnOrder, etc.
};

export const DEFAULT_DENSITY: DensityLevel = "normal";

/**
 * Extrae density de User.uiPreferences con fallback.
 * Defensive: si el JSON tiene shape inesperado, devuelve default.
 */
export function resolveDensity(prefs: unknown): DensityLevel {
  if (!prefs || typeof prefs !== "object") return DEFAULT_DENSITY;
  const p = prefs as { density?: unknown };
  if (
    typeof p.density === "string" &&
    (DENSITY_LEVELS as readonly string[]).includes(p.density)
  ) {
    return p.density as DensityLevel;
  }
  return DEFAULT_DENSITY;
}

export function densityClassName(level: DensityLevel): string {
  return `density-${level}`;
}
