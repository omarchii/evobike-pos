export const ROUTE_LABELS: Record<string, string> = {
    "/": "Inicio",
    "/point-of-sale": "Punto de Venta",

    "/pedidos": "Pedidos",

    "/workshop": "Taller Mecánico",
    "/workshop/mantenimientos": "Mantenimientos",

    "/assembly": "Montaje",

    "/customers": "Clientes",

    "/cotizaciones": "Cotizaciones",
    "/cotizaciones/nueva": "Nueva cotización",

    "/ventas": "Ventas",

    "/transferencias": "Transferencias",

    "/inventario": "Inventario",
    "/inventario/recepciones": "Recepciones",
    "/inventario/recepciones/nuevo": "Nueva recepción",

    "/reportes": "Reportes",
    "/reportes/anual": "Reporte anual",
    "/reportes/caja": "Caja",
    "/reportes/caja/historial": "Historial de cortes",
    "/reportes/clientes": "Clientes",
    "/reportes/comisiones": "Comisiones",
    "/reportes/comisiones/reglas": "Reglas de comisiones",
    "/reportes/compras-proveedor": "Compras al proveedor",
    "/reportes/inventario": "Inventario",
    "/reportes/inventario/movimientos": "Movimientos",
    "/reportes/inventario/stock-minimo": "Stock mínimo",
    "/reportes/inventario/valor": "Valor de inventario",
    "/reportes/rentabilidad": "Rentabilidad por producto",
    "/reportes/transferencias": "Transferencias",
    "/reportes/transferencias/mermas": "Mermas en transferencias",
    "/reportes/ventas-vendedor": "Ventas por vendedor",

    "/cash-register": "Caja",
    "/tesoreria": "Tesorería",
    "/autorizaciones": "Autorizaciones",

    "/configuracion": "Configuración",
    "/configuracion/catalogo": "Catálogo",
    "/configuracion/comisiones": "Comisiones",
    "/configuracion/servicios": "Servicios",
    "/configuracion/sucursal": "Sucursal",
    "/configuracion/usuarios": "Usuarios",

    "/dev/pdf-preview": "Preview PDF",
};

/**
 * Rutas donde NO se renderiza el breadcrumb.
 * `/point-of-sale` es el POS (terminal inmersiva); `/` es el dashboard (root).
 */
export const HIDDEN_ROUTES = new Set<string>(["/", "/point-of-sale"]);

/** Segmentos intermedios conocidos que no tienen match con path completo. */
const SEGMENT_LABELS: Record<string, string> = {
    edit: "Editar",
    nuevo: "Nuevo",
    nueva: "Nueva",
};

export function resolveStaticLabel(segment: string, fullPath: string): string {
    if (ROUTE_LABELS[fullPath]) return ROUTE_LABELS[fullPath];
    if (SEGMENT_LABELS[segment]) return SEGMENT_LABELS[segment];
    return capitalize(segment);
}

function capitalize(s: string): string {
    if (!s) return s;
    const spaced = s.replace(/-/g, " ");
    return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
