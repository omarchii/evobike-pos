export interface ProductoItem {
  productVariant: {
    modelo: { nombre: string };
    color: { nombre: string };
    voltaje: { label: string };
  } | null;
  simpleProduct: { nombre: string } | null;
}

export function formatProducto(item: ProductoItem): string {
  if (item.productVariant) {
    const pv = item.productVariant;
    return [pv.modelo.nombre, pv.color.nombre, pv.voltaje.label]
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
