export interface ProductoItem {
  productVariant: {
    modelo: { nombre: string };
    color: { nombre: string };
    voltaje: { label: string };
    capacidad?: { nombre: string } | null;
  } | null;
  simpleProduct: { nombre: string } | null;
}

export function formatProducto(item: ProductoItem): string {
  if (item.productVariant) {
    const pv = item.productVariant;
    const ahSuffix = pv.capacidad ? ` · ${pv.capacidad.nombre}` : "";
    return [pv.modelo.nombre, pv.color.nombre, pv.voltaje.label + ahSuffix]
      .filter(Boolean)
      .join(" ");
  }
  if (item.simpleProduct) return item.simpleProduct.nombre;
  return "—";
}

export function computeMermaUnidades(
  cantidadEnviada: number,
  cantidadRecibida: number | null,
): number {
  return cantidadEnviada - (cantidadRecibida ?? 0);
}
