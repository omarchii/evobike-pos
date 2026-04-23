import React from "react";
import { View, Text, StyleSheet } from "@react-pdf/renderer";
import type { PaymentMethod, ServiceOrderType } from "@prisma/client";
import { BaseDocument } from "@/lib/pdf/components/base-document";
import { DocumentHeader } from "@/lib/pdf/components/document-header";
import { ClientInfoBlock } from "@/lib/pdf/components/client-info-block";
import {
  VehicleInfoBlock,
  type VehiculoPDFData,
} from "@/lib/pdf/components/vehicle-info-block";
import { ItemsTable } from "@/lib/pdf/components/items-table";
import { TotalsBlock } from "@/lib/pdf/components/totals-block";
import { LegalLegend } from "@/lib/pdf/components/legal-legend";
import { DocumentFooter } from "@/lib/pdf/components/document-footer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import type { BranchPDFData, ClientPDFData, PDFItem } from "@/lib/pdf/types";

export type ComprobanteServiceOrderPDFData = {
  branch: BranchPDFData;
  folio: string;
  type: ServiceOrderType;
  // "delivered" = status DELIVERED; "pending" = COMPLETED && prepaid
  // (cliente pre-pagó pero aún no retira físicamente el vehículo).
  deliveryState: "delivered" | "pending";
  fecha: Date;
  cliente: ClientPDFData;
  vehiculo: VehiculoPDFData | null;
  diagnosis: string | null;
  items: PDFItem[];
  subtotal: number;
  iva: number;
  total: number;
  totalEnLetra: string;
  // Si true (WARRANTY/COURTESY/POLICY_MAINTENANCE) el template oculta
  // TotalsBlock y muestra "Sin cobro" — alineado con Sale.excludeFromRevenue.
  excludeFromRevenue: boolean;
  prepaid: boolean;
  prepaidAt: Date | null;
  prepaidAmount: number | null;
  prepaidMethod: PaymentMethod | null;
  elaboradoPor: string;
  sealImagePath: string | null;
};

const s = StyleSheet.create({
  pendingBadgeRow: {
    marginBottom: 6,
  },
  pendingBadge: {
    alignSelf: "flex-start",
    backgroundColor: "#F9E5A1",
    color: "#6B4B00",
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  diagnosisBlock: {
    marginBottom: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.bgClientBlock,
  },
  diagnosisLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.textMuted,
    marginBottom: 2,
  },
  diagnosisText: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: colors.text,
    fontStyle: "italic",
  },
  sinCobroBox: {
    alignSelf: "flex-end",
    width: 200,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.bgTotalBar,
    marginBottom: 8,
  },
  sinCobroLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    fontWeight: 700,
    color: colors.textOnTotalBar,
    textAlign: "center",
  },
});

const DOC_TYPE_LABEL: Record<"delivered" | "pending", string> = {
  delivered: "Comprobante de servicio",
  pending: "Recibo de pre-pago",
};

export function ComprobanteServiceOrderPDF({
  data,
  sealSrc,
}: {
  data: ComprobanteServiceOrderPDFData;
  sealSrc?: { data: Buffer; format: "png" } | null;
}): React.JSX.Element {
  const docLabel = DOC_TYPE_LABEL[data.deliveryState];
  const title = `${docLabel} ${data.folio}`;

  return (
    <BaseDocument title={title}>
      <DocumentHeader
        branch={data.branch}
        documentType={docLabel}
        folio={data.folio}
      />

      {data.deliveryState === "pending" ? (
        <View style={s.pendingBadgeRow}>
          <Text style={s.pendingBadge}>
            Pendiente de entrega — solo comprobante de pre-pago
          </Text>
        </View>
      ) : null}

      <ClientInfoBlock client={data.cliente} fechaExpedicion={data.fecha} />

      {data.vehiculo ? <VehicleInfoBlock vehiculo={data.vehiculo} /> : null}

      {data.diagnosis ? (
        <View style={s.diagnosisBlock}>
          <Text style={s.diagnosisLabel}>Diagnóstico</Text>
          <Text style={s.diagnosisText}>{data.diagnosis}</Text>
        </View>
      ) : null}

      <ItemsTable items={data.items} totalEnLetra={data.totalEnLetra} />

      {data.excludeFromRevenue ? (
        <View style={s.sinCobroBox}>
          <Text style={s.sinCobroLabel}>Sin cobro</Text>
        </View>
      ) : (
        <TotalsBlock
          subtotal={data.subtotal}
          iva={data.iva}
          total={data.total}
        />
      )}

      <LegalLegend
        type={data.type}
        prepaid={data.prepaid}
        prepaidAt={data.prepaidAt}
        prepaidAmount={data.prepaidAmount}
        prepaidMethod={data.prepaidMethod}
        terminosPoliza={data.branch.terminosPoliza}
      />

      <DocumentFooter
        terminos={data.branch.terminosServicio}
        sealImagePath={data.sealImagePath}
        sealSrc={sealSrc}
      />
    </BaseDocument>
  );
}
