import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import { formatDate } from "@/lib/pdf/helpers";
import type { ClientPDFData } from "@/lib/pdf/types";

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
  fullRow: {
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

function LabelValue({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={s.colHalf}>
      <Text style={s.chip}>{label}</Text>
      <Text style={s.value}>{value ?? "—"}</Text>
    </View>
  );
}

type ClientInfoBlockProps = {
  client: ClientPDFData;
  fechaExpedicion: Date;
  fechaVencimiento?: Date;
};

export function ClientInfoBlock({
  client,
  fechaExpedicion,
  fechaVencimiento,
}: ClientInfoBlockProps) {
  return (
    <View style={s.block}>
      {/* Fila 1: Razón social (columna izquierda) */}
      <View style={s.row}>
        <LabelValue label="RAZÓN SOCIAL" value={client.nombre} />
        <View style={{ flex: 1 }} />
      </View>

      {/* Fila 2: Fecha expedición | Fecha vencimiento */}
      <View style={s.row}>
        <LabelValue
          label="FECHA DE EXPEDICIÓN"
          value={formatDate(fechaExpedicion)}
        />
        <LabelValue
          label="FECHA DE VENCIMIENTO"
          value={fechaVencimiento ? formatDate(fechaVencimiento) : "—"}
        />
      </View>

      {/* Fila 3: Domicilio fiscal (ancho completo) */}
      {client.domicilio ? (
        <View style={s.fullRow}>
          <LabelValue label="DOMICILIO FISCAL" value={client.domicilio} />
        </View>
      ) : null}

      {/* Fila 4: RFC (solo si se proporcionó) | Teléfono */}
      <View style={s.row}>
        {client.rfc !== undefined ? (
          <LabelValue label="RFC" value={client.rfc} />
        ) : null}
        <LabelValue label="TELÉFONO" value={client.telefono} />
      </View>
    </View>
  );
}
