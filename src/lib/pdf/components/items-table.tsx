import React from "react";
import { View, Text, Font } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";

// Desactiva la separación silábica automática en todos los PDFs.
// Sin esto, react-pdf parte "PRECIO UNITARIO" → "PRECIO UNI-TARIO".
Font.registerHyphenationCallback((word) => [word]);
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import { formatMXN } from "@/lib/pdf/helpers";
import type { PDFItem } from "@/lib/pdf/types";

type ColDef = { label: string; flex: number; last?: boolean };

const COLS: ColDef[] = [
  { label: "Producto", flex: 2.8 },
  { label: "Unidad de Medida", flex: 1.5 },
  { label: "Precio unitario", flex: 1.4 },
  { label: "Cantidad", flex: 0.85 },
  { label: "Descuento", flex: 0.95 },
  { label: "Total", flex: 1, last: true },
];

const s = StyleSheet.create({
  tableWrapper: {
    flex: 1,
    flexDirection: "column",
    border: `0.5pt solid ${colors.border}`,
    marginBottom: 4,
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
    textTransform: "uppercase",
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRight: `0.5pt solid ${colors.border}`,
  },
  headerCellLast: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    textTransform: "uppercase",
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  bodyRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${colors.border}`,
  },
  cell: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRight: `0.5pt solid ${colors.border}`,
  },
  cellLast: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 5,
    textAlign: "right",
  },
  numericCell: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderRight: `0.5pt solid ${colors.border}`,
    textAlign: "right",
  },
  spacer: {
    flex: 1,
  },
  totalLetraRow: {
    paddingHorizontal: 6,
    paddingVertical: 5,
    borderTop: `0.5pt solid ${colors.border}`,
  },
  totalLetraText: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
  },
});

type ItemsTableProps = {
  items: PDFItem[];
  totalEnLetra: string;
};

export function ItemsTable({ items, totalEnLetra }: ItemsTableProps) {
  return (
    <View style={s.tableWrapper}>
      {/* Header */}
      <View style={s.headerRow}>
        {COLS.map((col) => (
          <View
            key={col.label}
            style={[{ flex: col.flex }, col.last ? s.headerCellLast : s.headerCell]}
          >
            <Text>{col.label}</Text>
          </View>
        ))}
      </View>

      {/* Filas de items */}
      {items.map((item, i) => (
        <View key={i} style={s.bodyRow}>
          <View style={[{ flex: 3 }, s.cell]}>
            <Text>{item.description}</Text>
          </View>
          <View style={[{ flex: 1.5 }, s.cell]}>
            <Text>{item.unit}</Text>
          </View>
          <View style={[{ flex: 1.2 }, s.numericCell]}>
            <Text>{formatMXN(item.unitPrice)}</Text>
          </View>
          <View style={[{ flex: 0.7 }, s.numericCell]}>
            <Text>{item.quantity}</Text>
          </View>
          <View style={[{ flex: 0.9 }, s.numericCell]}>
            <Text>{(item.discount * 100).toFixed(2)}%</Text>
          </View>
          <View style={[{ flex: 1 }, s.cellLast]}>
            <Text>{formatMXN(item.total)}</Text>
          </View>
        </View>
      ))}

      {/* Espacio en blanco que llena la tabla */}
      <View style={s.spacer} />

      {/* Total en letra al pie de la tabla */}
      <View style={s.totalLetraRow}>
        <Text style={s.totalLetraText}>{totalEnLetra}</Text>
      </View>
    </View>
  );
}
