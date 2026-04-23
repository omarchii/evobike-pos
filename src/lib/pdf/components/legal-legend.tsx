import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import type { PaymentMethod, ServiceOrderType } from "@prisma/client";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import { formatDate, formatMXN } from "@/lib/pdf/helpers";

const s = StyleSheet.create({
  container: {
    marginTop: 4,
    marginBottom: 6,
    paddingHorizontal: 8,
    paddingVertical: 6,
    backgroundColor: colors.bgClientBlock,
  },
  heading: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: colors.textMuted,
    marginBottom: 3,
    textTransform: "uppercase",
  },
  body: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
    lineHeight: 1.35,
  },
});

const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: "efectivo",
  CARD: "tarjeta",
  TRANSFER: "transferencia",
  CREDIT_BALANCE: "saldo a favor",
  ATRATO: "financiamiento Atrato",
};

const GARANTIA_TALLER =
  "Servicio con garantía de 30 días naturales sobre la mano de obra. " +
  "Refacciones sujetas a garantía del fabricante. Conservar este comprobante para cualquier reclamación.";

const POLIZA_FALLBACK =
  "Mantenimiento incluido en póliza activa. Sin cobro para el cliente.";

export type LegalLegendProps = {
  type: ServiceOrderType;
  prepaid: boolean;
  prepaidAt: Date | null;
  prepaidAmount: number | null;
  prepaidMethod: PaymentMethod | null;
  terminosPoliza: string | null;
};

export function LegalLegend({
  type,
  prepaid,
  prepaidAt,
  prepaidAmount,
  prepaidMethod,
  terminosPoliza,
}: LegalLegendProps) {
  const { heading, body } = resolveLegend({
    type,
    prepaid,
    prepaidAt,
    prepaidAmount,
    prepaidMethod,
    terminosPoliza,
  });

  return (
    <View style={s.container}>
      <Text style={s.heading}>{heading}</Text>
      <Text style={s.body}>{body}</Text>
    </View>
  );
}

function resolveLegend({
  type,
  prepaid,
  prepaidAt,
  prepaidAmount,
  prepaidMethod,
  terminosPoliza,
}: LegalLegendProps): { heading: string; body: string } {
  if (type === "WARRANTY") {
    return {
      heading: "Servicio bajo garantía",
      body: "Servicio ejecutado bajo garantía del vehículo. No genera cargo para el cliente.",
    };
  }

  if (type === "COURTESY") {
    return {
      heading: "Cortesía",
      body: "Cortesía autorizada por gerencia. Sin costo para el cliente.",
    };
  }

  if (type === "POLICY_MAINTENANCE") {
    const polizaText =
      terminosPoliza && terminosPoliza.trim().length > 0
        ? terminosPoliza
        : POLIZA_FALLBACK;
    return {
      heading: "Mantenimiento de póliza",
      body: polizaText,
    };
  }

  // type === "PAID"
  if (!prepaid) {
    return {
      heading: "Comprobante de servicio",
      body: GARANTIA_TALLER,
    };
  }

  const fecha = prepaidAt ? formatDate(prepaidAt) : "—";
  const monto = prepaidAmount != null ? formatMXN(prepaidAmount) : "—";
  const metodoLabel =
    prepaidMethod != null ? PAYMENT_METHOD_LABELS[prepaidMethod] : null;

  const pagoLine =
    metodoLabel != null
      ? `Pagado ${monto} el ${fecha} vía ${metodoLabel}.`
      : `Pagado ${monto} el ${fecha} · pago mixto.`;

  return {
    heading: "Comprobante de servicio",
    body: `${pagoLine} ${GARANTIA_TALLER}`,
  };
}
