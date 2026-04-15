import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import { formatMXN } from "@/lib/pdf/helpers";

const s = StyleSheet.create({
  container: {
    marginBottom: 8,
  },
  titleChip: {
    backgroundColor: colors.bgLabelChip,
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: colors.textMuted,
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginBottom: 4,
    alignSelf: "flex-start",
  },
  tableWrapper: {
    border: `0.5pt solid ${colors.border}`,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: colors.bgTableHeader,
    borderBottom: `0.5pt solid ${colors.border}`,
  },
  headerCell: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRight: `0.5pt solid ${colors.border}`,
  },
  headerCellLast: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  bodyRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${colors.border}`,
  },
  cell: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRight: `0.5pt solid ${colors.border}`,
  },
  cellLast: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  cellNumeric: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderRight: `0.5pt solid ${colors.border}`,
    textAlign: "right",
  },
  summaryRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderTop: `0.5pt solid ${colors.border}`,
  },
  summaryLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    fontWeight: 700,
    marginRight: 12,
  },
  summaryValue: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    fontWeight: 700,
    minWidth: 80,
    textAlign: "right",
  },
  emptyRow: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  emptyText: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.textMuted,
    textAlign: "center",
  },
});

export type AbonoItem = {
  fecha: string;
  monto: number;
  metodoPago: string;
  cobradoPor: string;
};

type AbonosTimelineProps = {
  abonos: AbonoItem[];
  totalAbonado: number;
  saldoRestante: number;
};

export function AbonosTimeline({ abonos, totalAbonado, saldoRestante }: AbonosTimelineProps) {
  const saldoColor = saldoRestante > 0 ? "#E74C3C" : "#1B4332";

  return (
    <View style={s.container}>
      <Text style={s.titleChip}>HISTORIAL DE ABONOS</Text>
      <View style={s.tableWrapper}>
        {/* Header */}
        <View style={s.headerRow}>
          <View style={{ flex: 1.2 }}>
            <Text style={s.headerCell}>Fecha</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={s.headerCell}>Monto</Text>
          </View>
          <View style={{ flex: 1.3 }}>
            <Text style={s.headerCell}>Método de pago</Text>
          </View>
          <View style={{ flex: 1.5 }}>
            <Text style={s.headerCellLast}>Cobrado por</Text>
          </View>
        </View>

        {/* Rows */}
        {abonos.length === 0 ? (
          <View style={s.emptyRow}>
            <Text style={s.emptyText}>Sin abonos registrados.</Text>
          </View>
        ) : (
          abonos.map((ab, i) => (
            <View key={i} style={s.bodyRow}>
              <View style={{ flex: 1.2 }}>
                <Text style={s.cell}>{ab.fecha}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.cellNumeric}>{formatMXN(ab.monto)}</Text>
              </View>
              <View style={{ flex: 1.3 }}>
                <Text style={s.cell}>{ab.metodoPago}</Text>
              </View>
              <View style={{ flex: 1.5 }}>
                <Text style={s.cellLast}>{ab.cobradoPor}</Text>
              </View>
            </View>
          ))
        )}

        {/* Summary */}
        <View style={[s.summaryRow, { borderTopWidth: 1, borderTopColor: colors.border }]}>
          <Text style={[s.summaryLabel, { color: "#1B4332" }]}>Total abonado:</Text>
          <Text style={[s.summaryValue, { color: "#1B4332" }]}>{formatMXN(totalAbonado)}</Text>
        </View>
        <View style={s.summaryRow}>
          <Text style={[s.summaryLabel, { color: saldoColor }]}>Saldo restante:</Text>
          <Text style={[s.summaryValue, { color: saldoColor }]}>{formatMXN(saldoRestante)}</Text>
        </View>
      </View>
    </View>
  );
}
