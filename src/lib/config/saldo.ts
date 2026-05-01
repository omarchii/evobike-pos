// Constantes de configuración de "saldo a favor" — Pack D.4.b.
//
// Fuente: decisión cliente reunión 2026-04-27 (P6 saldo a favor) +
// Pack D.1 helpers (`src/lib/customer-credit.ts` CREDIT_VALIDITY_DAYS).
// Centralizado aquí per `feedback_no_magic_numbers_in_queries.md`.

/** Default: créditos sin uso en N+ días = candidatos a alerta WhatsApp / contacto. */
export const SALDO_SIN_USO_DEFAULT_DAYS = 90;

/** Default: créditos próximos a vencer en N días o menos = recordatorio. */
export const SALDO_VENCIMIENTO_PROXIMO_DEFAULT_DAYS = 30;

/** Bound máximo aceptado en filtros UI para evitar abuso de query params. */
export const SALDO_FILTER_MAX_DAYS = 730;

/** Tope de filas por sección del reporte global (defensa contra clientes muy grandes). */
export const SALDO_REPORT_SECTION_LIMIT = 200;
