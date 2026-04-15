import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";

const s = StyleSheet.create({
  block: {
    backgroundColor: colors.bgClientBlock,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  colHalf: {
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
  value: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
    flexShrink: 1,
  },
});

function LabelValue({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <View style={s.colHalf}>
      <Text style={s.chip}>{label}</Text>
      <Text style={s.value}>{value ?? "—"}</Text>
    </View>
  );
}

export type VehiculoPDFData = {
  modelo: string;
  color: string;
  voltaje: string;
  vin: string;
};

type VehicleInfoBlockProps = {
  vehiculo: VehiculoPDFData;
};

export function VehicleInfoBlock({ vehiculo }: VehicleInfoBlockProps) {
  return (
    <View style={s.block}>
      <View style={s.row}>
        <LabelValue label="MODELO" value={vehiculo.modelo} />
        <LabelValue label="COLOR" value={vehiculo.color} />
      </View>
      <View style={s.row}>
        <LabelValue label="VOLTAJE" value={vehiculo.voltaje} />
        <LabelValue label="VIN" value={vehiculo.vin} />
      </View>
    </View>
  );
}
