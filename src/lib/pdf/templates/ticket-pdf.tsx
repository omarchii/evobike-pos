import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { BaseDocument } from "@/lib/pdf/components/base-document";
import { DocumentHeader } from "@/lib/pdf/components/document-header";
import { ItemsTable } from "@/lib/pdf/components/items-table";
import { TotalsBlock } from "@/lib/pdf/components/totals-block";
import { DocumentFooter } from "@/lib/pdf/components/document-footer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import type { BranchPDFData, PDFItem } from "@/lib/pdf/types";

export interface TicketPDFData {
  branch: BranchPDFData;
  folio: string;
  fecha: string;
  vendedor: string;
  cliente: {
    nombre: string;
    telefono: string | null;
    email: string | null;
  } | null;
  items: PDFItem[];
  subtotal: number;
  iva: number;
  total: number;
  totalEnLetra: string;
  descuento: number;
  metodosPago: string[];
  cancelada: boolean;
  canceladaPor: string | null;
  canceladaFecha: string | null;
  terminos: string | null;
  sealImagePath: string | null;
  elaboradoPor: string;
}

const s = StyleSheet.create({
  metaBlock: {
    backgroundColor: colors.bgClientBlock,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  metaCol: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
  },
  chip: {
    backgroundColor: colors.bgLabelChip,
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: colors.textMuted,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: 5,
  },
  chipValue: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
    flexShrink: 1,
  },
  cancelBanner: {
    backgroundColor: "#FDECEA",
    borderRadius: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 6,
  },
  cancelBannerTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    fontWeight: 700,
    color: "#7B241C",
    marginBottom: 2,
  },
  cancelBannerDetail: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: "#7B241C",
  },
  metodosBlock: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  metodosLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    fontWeight: 700,
    color: colors.textMuted,
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  metodosValue: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
  },
});

function LabelValue({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={s.metaCol}>
      <Text style={s.chip}>{label}</Text>
      <Text style={s.chipValue}>{value ?? "—"}</Text>
    </View>
  );
}

export function TicketPDF({
  data,
  sealSrc,
}: {
  data: TicketPDFData;
  sealSrc?: { data: Buffer; format: "png" } | null;
}): React.JSX.Element {
  return (
    <BaseDocument title={`Ticket ${data.folio}`}>
      <DocumentHeader
        branch={data.branch}
        documentType="Ticket de Venta"
        folio={data.folio}
      />

      {/* Bloque de metadatos: fecha, vendedor, cliente */}
      <View style={s.metaBlock}>
        <View style={s.metaRow}>
          <LabelValue label="FECHA" value={data.fecha} />
          <LabelValue label="VENDEDOR" value={data.vendedor} />
        </View>
        {data.cliente !== null ? (
          <View style={s.metaRow}>
            <LabelValue label="CLIENTE" value={data.cliente.nombre} />
            {data.cliente.telefono !== null ? (
              <LabelValue label="TELÉFONO" value={data.cliente.telefono} />
            ) : null}
            {data.cliente.email !== null ? (
              <LabelValue label="EMAIL" value={data.cliente.email} />
            ) : null}
          </View>
        ) : null}
      </View>

      {/* Banner de cancelación */}
      {data.cancelada ? (
        <View style={s.cancelBanner}>
          <Text style={s.cancelBannerTitle}>VENTA CANCELADA</Text>
          {data.canceladaPor !== null ? (
            <Text style={s.cancelBannerDetail}>
              Autorizado por: {data.canceladaPor}
            </Text>
          ) : null}
          {data.canceladaFecha !== null ? (
            <Text style={s.cancelBannerDetail}>{data.canceladaFecha}</Text>
          ) : null}
        </View>
      ) : null}

      <ItemsTable items={data.items} totalEnLetra={data.totalEnLetra} />

      <TotalsBlock
        subtotal={data.subtotal}
        iva={data.iva}
        total={data.total}
        descuento={data.descuento > 0 ? data.descuento : undefined}
      />

      {/* Métodos de pago */}
      <View style={s.metodosBlock}>
        <Text style={s.metodosLabel}>MÉTODOS DE PAGO</Text>
        <Text style={s.metodosValue}>{data.metodosPago.join(" · ")}</Text>
      </View>

      <DocumentFooter
        terminos={data.terminos ?? ""}
        sealImagePath={data.sealImagePath}
        sealSrc={sealSrc}
      />
    </BaseDocument>
  );
}
