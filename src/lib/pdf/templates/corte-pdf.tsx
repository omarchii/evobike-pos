import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { BaseDocument } from "@/lib/pdf/components/base-document";
import { DocumentHeader } from "@/lib/pdf/components/document-header";
import { DocumentFooter } from "@/lib/pdf/components/document-footer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import { formatMXN } from "@/lib/pdf/helpers";
import type { BranchPDFData } from "@/lib/pdf/types";

// ── Interfaces ────────────────────────────────────────────────────────────────

export interface CorteDenominacion {
  denominacion: number;
  cantidad: number;
  subtotal: number;
}

export interface CorteResumen {
  saldoInicial: number;
  ventasEfectivo: number;
  entradasEfectivo: number;
  gastosEfectivo: number;
  retirosEfectivo: number;
  reembolsosEfectivo: number;
  efectivoEsperado: number;
  efectivoContado: number;
  diferencia: number;
}

export interface CortePDFData {
  branch: BranchPDFData;
  folio: string;
  operador: string;
  apertura: {
    fecha: string; // "14/04/2026 08:30"
    montoInicial: number;
  };
  cierre: {
    fecha: string; // "14/04/2026 22:15"
    cerradoPor: string;
  };
  resumen: CorteResumen;
  denominaciones: CorteDenominacion[] | null;
  autorizacion: {
    autorizadoPor: string;
    motivo: string;
  } | null;
  sealImagePath: string | null;
}

// ── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Bloque de sesión
  sessionBlock: {
    backgroundColor: colors.bgClientBlock,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 8,
  },
  sessionRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  sessionCol: {
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

  // Resumen financiero
  resumenBlock: {
    marginBottom: 8,
  },
  resumenTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  resumenRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderBottom: `0.5pt solid ${colors.border}`,
  },
  resumenSeparator: {
    height: 1,
    backgroundColor: colors.text,
    marginVertical: 1,
  },
  resumenLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 8.5,
    color: colors.text,
  },
  resumenLabelMuted: {
    fontFamily: FONT_FAMILY,
    fontSize: 8.5,
    color: colors.textMuted,
  },
  resumenValue: {
    fontFamily: FONT_FAMILY,
    fontSize: 8.5,
    color: colors.text,
    textAlign: "right",
  },
  resumenValueMuted: {
    fontFamily: FONT_FAMILY,
    fontSize: 8.5,
    color: colors.textMuted,
    textAlign: "right",
  },
  resumenValuePositive: {
    fontFamily: FONT_FAMILY,
    fontSize: 8.5,
    fontWeight: 700,
    color: colors.primary,
    textAlign: "right",
  },
  resumenValueNegative: {
    fontFamily: FONT_FAMILY,
    fontSize: 8.5,
    fontWeight: 700,
    color: "#E74C3C",
    textAlign: "right",
  },
  resumenValueBold: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    fontWeight: 700,
    color: colors.text,
    textAlign: "right",
  },
  totalBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    backgroundColor: colors.bgTotalBar,
    paddingHorizontal: 8,
    paddingVertical: 5,
    marginTop: 1,
  },
  totalBarLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    fontWeight: 700,
    color: "#FFFFFF",
  },
  totalBarValue: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    fontWeight: 700,
    color: "#FFFFFF",
  },

  // Denominaciones
  denomBlock: {
    marginBottom: 8,
  },
  denomTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: colors.textMuted,
    textTransform: "uppercase",
    marginBottom: 4,
  },
  denomHeaderRow: {
    flexDirection: "row",
    backgroundColor: colors.bgTableHeader,
  },
  denomHeaderCell: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 5,
  },
  denomBodyRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${colors.border}`,
  },
  denomBodyCell: {
    fontFamily: FONT_FAMILY,
    fontSize: 8.5,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  denomBodyCellBold: {
    fontFamily: FONT_FAMILY,
    fontSize: 8.5,
    fontWeight: 700,
    color: colors.text,
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  denomLegacy: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    fontStyle: "italic",
    color: colors.textMuted,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },

  // Autorización
  authBlock: {
    marginBottom: 8,
    borderLeft: "3pt solid #F39C12",
    backgroundColor: "#FEF9E7",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  authText: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
    marginBottom: 2,
  },
});

// ── Helpers ───────────────────────────────────────────────────────────────────

function ChipValue({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.sessionCol}>
      <Text style={s.chip}>{label}</Text>
      <Text style={s.chipValue}>{value}</Text>
    </View>
  );
}

function ResumenRow({
  label,
  value,
  variant = "normal",
}: {
  label: string;
  value: string;
  variant?: "normal" | "muted" | "bold" | "positive" | "negative";
}) {
  const labelStyle =
    variant === "muted" ? s.resumenLabelMuted : s.resumenLabel;
  const valueStyle =
    variant === "positive"
      ? s.resumenValuePositive
      : variant === "negative"
        ? s.resumenValueNegative
        : variant === "bold"
          ? s.resumenValueBold
          : variant === "muted"
            ? s.resumenValueMuted
            : s.resumenValue;

  return (
    <View style={s.resumenRow}>
      <Text style={labelStyle}>{label}</Text>
      <Text style={valueStyle}>{value}</Text>
    </View>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────

type CortePDFProps = {
  data: CortePDFData;
  sealSrc?: { data: Buffer; format: "png" } | null;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function CortePDF({ data, sealSrc }: CortePDFProps) {
  const { resumen } = data;

  const diferenciaVariant =
    Math.abs(resumen.diferencia) < 0.01
      ? ("normal" as const)
      : resumen.diferencia > 0
        ? ("positive" as const)
        : ("negative" as const);

  const diferenciaPrefix =
    resumen.diferencia > 0.01 ? "+" : resumen.diferencia < -0.01 ? "" : "";

  return (
    <BaseDocument title={`Corte de Caja — ${data.folio}`}>
      {/* 1. Header */}
      <DocumentHeader
        branch={data.branch}
        documentType="Comprobante de Corte de Caja"
        folio={data.folio.slice(-8).toUpperCase()}
      />

      {/* 2. Bloque de sesión */}
      <View style={s.sessionBlock}>
        <View style={s.sessionRow}>
          <ChipValue label="OPERADOR" value={data.operador} />
          <ChipValue label="SUCURSAL" value={data.branch.name} />
        </View>
        <View style={s.sessionRow}>
          <ChipValue label="APERTURA" value={data.apertura.fecha} />
          <ChipValue label="CIERRE" value={data.cierre.fecha} />
        </View>
        {data.cierre.cerradoPor !== data.operador ? (
          <View style={s.sessionRow}>
            <ChipValue label="CERRADO POR" value={data.cierre.cerradoPor} />
          </View>
        ) : null}
      </View>

      {/* 3. Resumen financiero */}
      <View style={s.resumenBlock}>
        <Text style={s.resumenTitle}>Resumen financiero</Text>

        <ResumenRow
          label="Saldo inicial"
          value={formatMXN(resumen.saldoInicial)}
        />
        <ResumenRow
          label="(+) Ventas en efectivo"
          value={formatMXN(resumen.ventasEfectivo)}
          variant="muted"
        />
        <ResumenRow
          label="(+) Entradas de efectivo"
          value={formatMXN(resumen.entradasEfectivo)}
          variant="muted"
        />
        <ResumenRow
          label="(-) Gastos"
          value={`-${formatMXN(resumen.gastosEfectivo)}`}
          variant="muted"
        />
        <ResumenRow
          label="(-) Retiros"
          value={`-${formatMXN(resumen.retirosEfectivo)}`}
          variant="muted"
        />
        <ResumenRow
          label="(-) Reembolsos"
          value={`-${formatMXN(resumen.reembolsosEfectivo)}`}
          variant="muted"
        />

        {/* Barra de efectivo esperado */}
        <View style={s.totalBar}>
          <Text style={s.totalBarLabel}>Efectivo esperado</Text>
          <Text style={s.totalBarValue}>{formatMXN(resumen.efectivoEsperado)}</Text>
        </View>

        {/* Efectivo contado y diferencia */}
        <ResumenRow
          label="Efectivo contado"
          value={formatMXN(resumen.efectivoContado)}
          variant="bold"
        />
        <ResumenRow
          label="Diferencia"
          value={`${diferenciaPrefix}${formatMXN(resumen.diferencia)}`}
          variant={diferenciaVariant}
        />
      </View>

      {/* 4. Denominaciones */}
      <View style={s.denomBlock}>
        <Text style={s.denomTitle}>Desglose de denominaciones</Text>

        {data.denominaciones !== null ? (
          <View>
            {/* Header */}
            <View style={s.denomHeaderRow}>
              <Text style={{ ...s.denomHeaderCell, flex: 2 }}>Denominación</Text>
              <Text style={{ ...s.denomHeaderCell, flex: 1, textAlign: "center" }}>
                Cantidad
              </Text>
              <Text style={{ ...s.denomHeaderCell, flex: 2, textAlign: "right" }}>
                Subtotal
              </Text>
            </View>

            {/* Filas */}
            {data.denominaciones.map((d) => (
              <View key={d.denominacion} style={s.denomBodyRow}>
                <Text style={{ ...s.denomBodyCell, flex: 2 }}>
                  {formatMXN(d.denominacion)}
                </Text>
                <Text
                  style={{
                    ...s.denomBodyCell,
                    flex: 1,
                    textAlign: "center",
                  }}
                >
                  {d.cantidad}
                </Text>
                <Text
                  style={{
                    ...s.denomBodyCell,
                    flex: 2,
                    textAlign: "right",
                  }}
                >
                  {formatMXN(d.subtotal)}
                </Text>
              </View>
            ))}

            {/* Fila total */}
            <View style={{ ...s.denomBodyRow, backgroundColor: colors.bgClientBlock }}>
              <Text style={{ ...s.denomBodyCellBold, flex: 2 }}>TOTAL</Text>
              <Text
                style={{ ...s.denomBodyCellBold, flex: 1, textAlign: "center" }}
              >
                —
              </Text>
              <Text
                style={{ ...s.denomBodyCellBold, flex: 2, textAlign: "right" }}
              >
                {formatMXN(resumen.efectivoContado)}
              </Text>
            </View>
          </View>
        ) : (
          <Text style={s.denomLegacy}>
            Desglose no disponible para esta sesión.
          </Text>
        )}
      </View>

      {/* 5. Autorización de diferencia */}
      {data.autorizacion !== null ? (
        <View style={s.authBlock}>
          <Text style={s.authText}>
            Diferencia autorizada por: {data.autorizacion.autorizadoPor}
          </Text>
          <Text style={s.authText}>
            Motivo: {data.autorizacion.motivo}
          </Text>
        </View>
      ) : null}

      {/* 6. Footer (sin términos) */}
      <DocumentFooter
        sealImagePath={data.sealImagePath}
        sealSrc={sealSrc}
      />
    </BaseDocument>
  );
}
