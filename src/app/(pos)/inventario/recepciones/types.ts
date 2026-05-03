export type EstadoPago = "PAGADA" | "PENDIENTE" | "CREDITO";
export type FormaPago = "CONTADO" | "CREDITO" | "TRANSFERENCIA";

export interface SerializedReceiptListItem {
  id: string;
  proveedor: string;
  folioFacturaProveedor: string | null;
  facturaUrl: string | null;
  formaPagoProveedor: FormaPago;
  estadoPago: EstadoPago;
  fechaVencimiento: string | null;
  fechaPago: string | null;
  totalPagado: number;
  createdAt: string;
  branch: { id: string; name: string };
  registeredBy: string;
  totalLineas: number;
  totalLotes: number;
}

export interface ReceiptFilters {
  search: string;
  estadoPago: string;
  proveedor: string;
  vencimientoDesde: string;
  vencimientoHasta: string;
  page: number;
}
