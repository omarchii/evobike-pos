import React from "react";
import { BaseDocument } from "@/lib/pdf/components/base-document";
import { DocumentHeader } from "@/lib/pdf/components/document-header";
import { ClientInfoBlock } from "@/lib/pdf/components/client-info-block";
import { ItemsTable } from "@/lib/pdf/components/items-table";
import { TotalsBlock } from "@/lib/pdf/components/totals-block";
import { DocumentFooter } from "@/lib/pdf/components/document-footer";
import type { BranchPDFData, PDFItem, ClientPDFData } from "@/lib/pdf/types";

export interface CotizacionPDFData {
  branch: BranchPDFData;
  folio: string;
  /** ISO 8601 string — pasado desde el route handler */
  fechaExpedicion: string;
  /** ISO 8601 string — pasado desde el route handler */
  fechaVencimiento: string;
  cliente: {
    nombre: string;
    telefono: string | null;
  };
  items: PDFItem[];
  subtotal: number;
  iva: number;
  total: number;
  totalEnLetra: string;
  /** Monto global de descuento (puede ser 0) */
  descuento: number;
  terminos: string;
  sealImagePath: string | null;
  elaboradoPor: string;
}

export function CotizacionPDF({
  data,
  sealSrc,
}: {
  data: CotizacionPDFData;
  sealSrc?: { data: Buffer; format: "png" } | null;
}): React.JSX.Element {
  const client: ClientPDFData = {
    nombre: data.cliente.nombre,
    telefono: data.cliente.telefono,
  };

  return (
    <BaseDocument title={`Cotización ${data.folio}`}>
      <DocumentHeader
        branch={data.branch}
        documentType="Cotización"
        folio={data.folio}
      />
      <ClientInfoBlock
        client={client}
        fechaExpedicion={new Date(data.fechaExpedicion)}
        fechaVencimiento={new Date(data.fechaVencimiento)}
      />
      <ItemsTable items={data.items} totalEnLetra={data.totalEnLetra} />
      <TotalsBlock
        subtotal={data.subtotal}
        iva={data.iva}
        total={data.total}
        descuento={data.descuento > 0 ? data.descuento : undefined}
      />
      <DocumentFooter
        terminos={data.terminos}
        sealImagePath={data.sealImagePath}
        sealSrc={sealSrc}
      />
    </BaseDocument>
  );
}
