// Tipos compartidos entre los componentes PDF y src/lib/branch.ts

export type BranchPDFData = {
  id: string;
  code: string;
  name: string;
  rfc: string;
  razonSocial: string;
  regimenFiscal: string;
  street: string;
  extNum: string | null;
  intNum: string | null;
  colonia: string;
  city: string;
  state: string;
  zip: string;
  phone: string;
  email: string | null;
  website: string | null;
  sealImageUrl: string | null;
  terminosCotizacion: string | null;
  terminosPedido: string | null;
  terminosPoliza: string | null;
  terminosServicio: string | null;
};

export type PDFItem = {
  description: string;
  unit: string;
  unitPrice: number;
  quantity: number;
  discount: number; // fracción, 0.1 = 10%
  total: number;
};

export type ClientPDFData = {
  nombre: string;
  rfc?: string | null;
  telefono?: string | null;
  domicilio?: string | null;
};
