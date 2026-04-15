import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { BaseDocument } from "@/lib/pdf/components/base-document";
import { DocumentHeader } from "@/lib/pdf/components/document-header";
import { ItemsTable } from "@/lib/pdf/components/items-table";
import { TotalsBlock } from "@/lib/pdf/components/totals-block";
import { DocumentFooter } from "@/lib/pdf/components/document-footer";
import { AbonosTimeline } from "@/lib/pdf/components/abonos-timeline";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import type { BranchPDFData, PDFItem } from "@/lib/pdf/types";
import type { AbonoItem } from "@/lib/pdf/components/abonos-timeline";

export interface PedidoPDFData {
  branch: BranchPDFData;
  folio: string;
  tipo: "LAYAWAY" | "BACKORDER";
  fecha: string;
  cliente: {
    nombre: string;
    telefono: string | null;
    email: string | null;
  };
  items: PDFItem[];
  subtotal: number;
  iva: number;
  total: number;
  totalEnLetra: string;
  descuento: number;
  abonos: AbonoItem[];
  totalAbonado: number;
  saldoRestante: number;
  status: string;
  terminos: string;
  sealImagePath: string | null;
  elaboradoPor: string;
}

// ── Status badge config ────────────────────────────────────────────────────────

type StatusConfig = {
  bg: string;
  color: string;
  label: string;
};

const STATUS_MAP: Record<string, StatusConfig> = {
  PENDING: { bg: "#FEF9E7", color: "#F39C12", label: "PENDIENTE" },
  PARTIAL: { bg: "#FEF9E7", color: "#F39C12", label: "ABONADO PARCIAL" },
  COMPLETED: { bg: "#D8F3DC", color: "#1B4332", label: "LIQUIDADO" },
  CANCELLED: { bg: "#FDECEA", color: "#7B241C", label: "CANCELADO" },
};

const DEFAULT_STATUS: StatusConfig = { bg: "#FEF9E7", color: "#F39C12", label: "PENDIENTE" };

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Status badge
  statusBadge: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 3,
    marginBottom: 8,
    borderRadius: 2,
  },
  statusText: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.8,
  },
  // Client block
  clientBlock: {
    backgroundColor: colors.bgClientBlock,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  clientRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  clientColHalf: {
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
});

// ── LabelValue helper ─────────────────────────────────────────────────────────

function LabelValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={s.clientColHalf}>
      <Text style={s.chip}>{label}</Text>
      <Text style={s.chipValue}>{value ?? "—"}</Text>
    </View>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function PedidoPDF({
  data,
  sealSrc,
}: {
  data: PedidoPDFData;
  sealSrc?: { data: Buffer; format: "png" } | null;
}): React.JSX.Element {
  const statusCfg = STATUS_MAP[data.status] ?? DEFAULT_STATUS;
  const documentType = data.tipo === "BACKORDER" ? "Backorder" : "Apartado";

  return (
    <BaseDocument title={`Pedido ${data.folio}`}>
      {/* Header */}
      <DocumentHeader
        branch={data.branch}
        documentType={documentType}
        folio={data.folio}
      />

      {/* Status badge */}
      <View style={[s.statusBadge, { backgroundColor: statusCfg.bg }]}>
        <Text style={[s.statusText, { color: statusCfg.color }]}>{statusCfg.label}</Text>
      </View>

      {/* Simplified client block */}
      <View style={s.clientBlock}>
        {/* Row 1: CLIENTE | TELÉFONO */}
        <View style={s.clientRow}>
          <LabelValue label="CLIENTE" value={data.cliente.nombre} />
          <LabelValue label="TELÉFONO" value={data.cliente.telefono} />
        </View>
        {/* Row 2: CORREO (if present) | FECHA */}
        <View style={s.clientRow}>
          {data.cliente.email ? (
            <LabelValue label="CORREO" value={data.cliente.email} />
          ) : (
            <View style={s.clientColHalf} />
          )}
          <LabelValue label="FECHA" value={data.fecha} />
        </View>
      </View>

      {/* Items */}
      <ItemsTable items={data.items} totalEnLetra={data.totalEnLetra} />

      {/* Totals */}
      <TotalsBlock
        subtotal={data.subtotal}
        iva={data.iva}
        total={data.total}
        descuento={data.descuento > 0 ? data.descuento : undefined}
      />

      {/* Abonos timeline */}
      <AbonosTimeline
        abonos={data.abonos}
        totalAbonado={data.totalAbonado}
        saldoRestante={data.saldoRestante}
      />

      {/* Footer */}
      <DocumentFooter
        terminos={data.terminos}
        sealImagePath={data.sealImagePath}
        sealSrc={sealSrc}
      />
    </BaseDocument>
  );
}
