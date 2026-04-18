/**
 * Devuelve una cadena tipo "hace 3 min" a partir de una fecha pasada.
 * Intervalos: segundos → minutos → horas → días → meses → años.
 * Fechas futuras o distancias < 1 min devuelven "hace unos segundos".
 *
 * Acepta `Date` o string ISO. El parámetro `now` permite inyectar el instante
 * de comparación (útil en tests o renders server-side que fijan un `nowMs`).
 */
export function formatRelative(input: Date | string, now: Date = new Date()): string {
    const then = input instanceof Date ? input : new Date(input);
    const diffMs = now.getTime() - then.getTime();
    const diffMin = Math.round(diffMs / 60000);
    if (diffMin < 1) return "hace unos segundos";
    if (diffMin < 60) return `hace ${diffMin} min`;
    const diffH = Math.round(diffMin / 60);
    if (diffH < 24) return `hace ${diffH} h`;
    const diffD = Math.round(diffH / 24);
    if (diffD < 30) return `hace ${diffD} d`;
    const diffMo = Math.round(diffD / 30);
    if (diffMo < 12) return `hace ${diffMo} mes${diffMo === 1 ? "" : "es"}`;
    const diffY = Math.round(diffMo / 12);
    return `hace ${diffY} año${diffY === 1 ? "" : "s"}`;
}
