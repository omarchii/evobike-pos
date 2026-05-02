export const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body, 'Inter')",
  fontSize: "0.875rem",
  height: 44,
  width: "100%",
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  outline: "none",
};

export const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  appearance: "none",
  WebkitAppearance: "none",
  cursor: "pointer",
};

export const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--on-surf-var)",
  marginBottom: "0.375rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

export function modalStyle(): React.CSSProperties {
  return {
    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
  };
}

export const CATEGORIA_LABELS: Record<string, string> = {
  BICICLETA: "Bicicleta", // deprecated — se conserva para retrocompatibilidad
  JUGUETE: "Juguete",
  SCOOTER: "Scooter",
  BASE: "Base",
  PLUS: "Plus",
  CARGA: "Carga",
  CARGA_PESADA: "Carga pesada",
  TRICICLO: "Triciclo",
};

// 7 categorías activas — orden de visualización.
// BICICLETA (deprecated) no aparece aquí, pero se mapea vía CATEGORIA_LABELS si quedan registros.
export const CATEGORIAS_ACTIVAS = [
  "JUGUETE",
  "SCOOTER",
  "BASE",
  "PLUS",
  "CARGA",
  "CARGA_PESADA",
  "TRICICLO",
] as const;

export const SIMPLE_CATEGORIA_LABELS: Record<string, string> = {
  ACCESORIO: "Accesorio",
  CARGADOR: "Cargador",
  REFACCION: "Refacción",
  BATERIA_STANDALONE: "Batería standalone",
};

export interface ModeloRow {
  id: string;
  nombre: string;
  descripcion: string | null;
  requiere_vin: boolean;
  categoria: string | null; // null = Modelo de batería
  esBateria: boolean;
  isActive: boolean;
  imageUrl: string | null;
  colorIds: string[];
  warrantyDays: number | null;
}

export interface ColorRow {
  id: string;
  nombre: string;
  isGeneric: boolean;
  isActive: boolean;
}

export interface VoltajeRow {
  id: string;
  valor: number;
  label: string;
  isActive: boolean;
}

export interface VarianteRow {
  id: string;
  sku: string;
  modelo_id: string;
  modelo_nombre: string;
  modelo_esBateria: boolean;
  color_id: string;
  color_nombre: string;
  voltaje_id: string;
  voltaje_label: string;
  precioPublico: number;
  costo: number;
  precioDistribuidor: number | null;
  precioDistribuidorConfirmado: boolean;
  stockMinimo: number;
  stockMaximo: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface CapacidadRow {
  id: string;
  valorAh: number;
  nombre: string;
  isActive: boolean;
}

export interface BatteryVariantRow {
  id: string;
  sku: string;
  voltajeId: string;
  voltajeValor: number;
  voltajeLabel: string;
  capacidadId: string;
  capacidadValorAh: number;
  capacidadNombre: string;
  precioPublico: number;
  costo: number;
  stockMinimo: number;
  stockMaximo: number;
  stockTotal: number;
  isActive: boolean;
}

export interface BatteryConfigRow {
  id: string;
  modeloId: string;
  modeloNombre: string;
  voltajeId: string;
  voltajeValor: number;
  voltajeLabel: string;
  batteryVariantId: string;
  batteryVariantSku: string;
  batteryVariantModelo: string;
  batteryCapacidadAh: number | null; // null para variantes legacy sin capacidad
  batteryCapacidadNombre: string | null;
  quantity: number;
}

export interface SimpleProductRow {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: string;
  modeloAplicable: string | null;
  precioPublico: number;
  precioMayorista: number;
  stockMinimo: number;
  stockMaximo: number;
  imageUrl: string | null;
  isActive: boolean;
}

export interface BranchRow {
  id: string;
  code: string;
  name: string;
}
