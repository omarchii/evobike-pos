import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import { formatMXN } from "@/lib/pdf/helpers";

const s = StyleSheet.create({
  container: {
    alignItems: "flex-end",
    marginBottom: 8,
  },
  block: {
    width: 200,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  label: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: colors.text,
  },
  value: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: colors.text,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.bgTotalBar,
    paddingHorizontal: 8,
    paddingVertical: 5,
  },
  totalLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    fontWeight: 700,
    color: colors.textOnTotalBar,
  },
  totalValue: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    fontWeight: 700,
    color: colors.textOnTotalBar,
  },
});

type TotalsBlockProps = {
  subtotal: number;
  iva: number;
  total: number;
};

export function TotalsBlock({ subtotal, iva, total }: TotalsBlockProps) {
  return (
    <View style={s.container}>
      <View style={s.block}>
        <View style={s.row}>
          <Text style={s.label}>Subtotal</Text>
          <Text style={s.value}>{formatMXN(subtotal)}</Text>
        </View>
        <View style={s.row}>
          <Text style={s.label}>IVA (16.00%)</Text>
          <Text style={s.value}>{formatMXN(iva)}</Text>
        </View>
        <View style={s.totalRow}>
          <Text style={s.totalLabel}>Total</Text>
          <Text style={s.totalValue}>{formatMXN(total)}</Text>
        </View>
      </View>
    </View>
  );
}
