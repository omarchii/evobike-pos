// Centralised business-rule thresholds.
// Each constant cites its source so future readers know *why* the value is what it is.

/** OTs sin actividad (updatedAt) después de este umbral no cuentan como reserva
 *  de stock en la fórmula I3a. Decisión de sesión I.3.b 2026-05-03. */
export const GHOST_RESERVATION_TTL_DAYS = 90;
