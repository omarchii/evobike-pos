import type { CSSProperties } from "react";

export const MODAL_STYLE: CSSProperties = {
  background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
  backdropFilter: "blur(20px)",
  WebkitBackdropFilter: "blur(20px)",
  boxShadow: "var(--shadow)",
  borderRadius: "var(--r-xl)",
  maxWidth: 560,
};

export const MODAL_STYLE_LG: CSSProperties = {
  ...MODAL_STYLE,
  maxWidth: 680,
};

export const TITLE_STYLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "1.375rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "var(--on-surf)",
};

export const DESCRIPTION_STYLE: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.8125rem",
  color: "var(--on-surf-var)",
  lineHeight: 1.5,
};

export const LABEL_STYLE: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.6875rem",
  fontWeight: 500,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--on-surf-var)",
  marginBottom: "0.375rem",
  display: "block",
};

export const INPUT_STYLE: CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  fontSize: "0.9375rem",
  height: 44,
  width: "100%",
  padding: "0 0.75rem",
  outline: "none",
};

export const TEXTAREA_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  height: "auto",
  padding: "0.5rem 0.75rem",
  resize: "vertical",
  minHeight: 72,
};

export const SELECT_STYLE: CSSProperties = {
  ...INPUT_STYLE,
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233d5247' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.9rem center",
  paddingRight: "2.5rem",
};

export const PRIMARY_BUTTON_STYLE: CSSProperties = {
  background: "var(--velocity-gradient)",
  color: "#FFFFFF",
  borderRadius: "var(--r-full)",
  border: "none",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "0.875rem",
  height: 44,
  paddingInline: "1.75rem",
  cursor: "pointer",
  whiteSpace: "nowrap",
};

export const SECONDARY_BUTTON_STYLE: CSSProperties = {
  background: "var(--surf-high)",
  color: "var(--on-surf-var)",
  borderRadius: "var(--r-full)",
  border: "none",
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  fontSize: "0.875rem",
  height: 44,
  paddingInline: "1.5rem",
  cursor: "pointer",
};

export const DANGER_BUTTON_STYLE: CSSProperties = {
  background: "var(--ter)",
  color: "#FFFFFF",
  borderRadius: "var(--r-full)",
  border: "none",
  fontFamily: "var(--font-body)",
  fontWeight: 600,
  fontSize: "0.875rem",
  height: 44,
  paddingInline: "1.75rem",
  cursor: "pointer",
};

export const CLOSE_BUTTON_STYLE: CSSProperties = {
  width: 32,
  height: 32,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  borderRadius: "var(--r-full)",
  background: "var(--surf-high)",
  color: "var(--on-surf-var)",
  border: "none",
  cursor: "pointer",
  flexShrink: 0,
};

export const ERROR_STYLE: CSSProperties = {
  color: "var(--ter)",
  fontSize: "0.75rem",
  marginTop: "0.25rem",
};

export interface BranchOption {
  id: string;
  name: string;
  code: string;
}

export interface TransferRow {
  id: string;
  folio: string;
  status: string;
  fromBranchId: string;
  toBranchId: string;
  fromBranch: BranchOption;
  toBranch: BranchOption;
  creadoPor: string;
  creadoPorUser: { id: string; name: string };
  createdAt: string;
  totalItems: number;
}

export interface TransferItemDetail {
  id: string;
  transferId: string;
  productVariantId: string | null;
  simpleProductId: string | null;
  batteryId: string | null;
  customerBikeId: string | null;
  cantidadEnviada: number;
  cantidadRecibida: number | null;
  productVariant: {
    id: string;
    modelo: { nombre: string };
    color: { nombre: string };
    voltaje: { valor: number; label: string };
  } | null;
  simpleProduct: { id: string; nombre: string } | null;
  battery: { id: string; serialNumber: string; status: string; branchId: string } | null;
  customerBike: {
    id: string;
    serialNumber: string;
    brand: string | null;
    model: string | null;
    color: string | null;
    customerId: string | null;
    branchId: string;
  } | null;
}

export interface TransferDetail {
  id: string;
  folio: string;
  status: string;
  fromBranchId: string;
  toBranchId: string;
  fromBranch: BranchOption;
  toBranch: BranchOption;
  creadoPor: string;
  creadoPorUser: { id: string; name: string };
  autorizadoPor: string | null;
  autorizadoAt: string | null;
  autorizadoPorUser: { id: string; name: string } | null;
  despachadoPor: string | null;
  despachadoAt: string | null;
  despachadoPorUser: { id: string; name: string } | null;
  recibidoPor: string | null;
  recibidoAt: string | null;
  recibidoPorUser: { id: string; name: string } | null;
  canceladoPor: string | null;
  canceladoAt: string | null;
  canceladoPorUser: { id: string; name: string } | null;
  motivoCancelacion: string | null;
  notas: string | null;
  createdAt: string;
  updatedAt: string;
  items: TransferItemDetail[];
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function itemDescription(item: TransferItemDetail): string {
  if (item.productVariant) {
    const pv = item.productVariant;
    return `${pv.modelo.nombre} — ${pv.color.nombre} ${pv.voltaje.label}`;
  }
  if (item.simpleProduct) return item.simpleProduct.nombre;
  if (item.battery) return `Batería #${item.battery.serialNumber}`;
  if (item.customerBike) {
    const cb = item.customerBike;
    const brandModel = [cb.brand, cb.model].filter(Boolean).join(" ") || "Bici";
    return `${brandModel}${cb.color ? ` (${cb.color})` : ""} — S/N: ${cb.serialNumber}`;
  }
  return "Ítem desconocido";
}

export function itemTypeLabel(item: TransferItemDetail): string {
  if (item.productVariantId) return "Vehículo";
  if (item.simpleProductId) return "Accesorio";
  if (item.batteryId) return "Batería";
  if (item.customerBikeId) return "Bicicleta";
  return "—";
}
