import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { BaseDocument } from "@/lib/pdf/components/base-document";
import { DocumentHeader } from "@/lib/pdf/components/document-header";
import { DocumentFooter } from "@/lib/pdf/components/document-footer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import type { BranchPDFData } from "@/lib/pdf/types";

// PDF Ficha de cliente — single-page summary (BRIEF §7.5).

const s = StyleSheet.create({
  metaRow: {
    flexDirection: "row",
    marginBottom: 8,
    backgroundColor: "#F1F3F2",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  metaCell: {
    flex: 1,
    paddingRight: 8,
  },
  metaLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    fontWeight: 700,
    color: colors.textMuted,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginBottom: 1,
  },
  metaValue: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: colors.text,
  },
  sectionTitle: {
    fontFamily: FONT_FAMILY,
    fontSize: 10,
    fontWeight: 700,
    color: colors.text,
    marginTop: 6,
    marginBottom: 4,
    letterSpacing: 0.3,
  },
  kpiRow: {
    flexDirection: "row",
    marginBottom: 8,
    gap: 6,
  },
  kpiCard: {
    flex: 1,
    backgroundColor: "#F1F3F2",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  kpiLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    color: colors.textMuted,
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  kpiValue: {
    fontFamily: FONT_FAMILY,
    fontSize: 12,
    fontWeight: 700,
    color: colors.text,
  },
  table: {
    marginBottom: 8,
  },
  thead: {
    flexDirection: "row",
    backgroundColor: "#E9EBEA",
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  trow: {
    flexDirection: "row",
    paddingHorizontal: 4,
    paddingVertical: 3,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
  },
  th: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    fontWeight: 700,
    color: colors.textMuted,
    letterSpacing: 0.3,
  },
  td: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
  },
  empty: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.textMuted,
    textAlign: "center",
    paddingVertical: 6,
  },
  bikeRow: {
    paddingHorizontal: 4,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: colors.border,
    flexDirection: "row",
  },
  fiscalGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    backgroundColor: "#F8FAFA",
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  fiscalCell: {
    width: "50%",
    paddingRight: 8,
    marginBottom: 4,
  },
});

export interface FichaActivityRow {
  fecha: string;
  folio: string;
  tipo: string;
  detalle: string;
  total: string;
}

export interface FichaBikeRow {
  vin: string;
  modelo: string;
  voltaje: string;
  odometro: string;
}

export interface CustomerFichaPDFData {
  branch: BranchPDFData;
  generatedAt: string;
  cliente: {
    nombre: string;
    rfc: string | null;
    razonSocial: string | null;
    isBusiness: boolean;
    phone: string | null;
    phone2: string | null;
    email: string | null;
    direccion: string | null;
    ciudad: string | null;
    estado: string | null;
    cp: string | null;
  };
  fiscal: {
    regimenFiscal: string | null;
    usoCFDI: string | null;
    emailFiscal: string | null;
    direccionFiscal: string | null;
  };
  kpis: {
    ltvTotal: string;
    saldoFavor: string;
    saldoPorCobrar: string;
    bicis: number;
  };
  bicis: FichaBikeRow[];
  ventasRecientes: FichaActivityRow[];
  ordenesRecientes: FichaActivityRow[];
  sealImagePath: string | null;
}

export function CustomerFichaPDF({
  data,
  sealSrc,
}: {
  data: CustomerFichaPDFData;
  sealSrc?: { data: Buffer; format: "png" } | null;
}): React.JSX.Element {
  const cliente = data.cliente;

  return (
    <BaseDocument title={`Ficha cliente — ${cliente.nombre}`}>
      <DocumentHeader
        branch={data.branch}
        documentType="Ficha de cliente"
        folio={data.generatedAt}
      />

      {/* Identidad cliente */}
      <View style={s.metaRow}>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Cliente</Text>
          <Text style={s.metaValue}>{cliente.nombre}</Text>
          {cliente.isBusiness && cliente.razonSocial && (
            <Text style={[s.metaValue, { fontSize: 8 }]}>
              {cliente.razonSocial}
            </Text>
          )}
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>RFC</Text>
          <Text style={s.metaValue}>{cliente.rfc ?? "—"}</Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Tipo</Text>
          <Text style={s.metaValue}>
            {cliente.isBusiness ? "Empresa" : "Persona física"}
          </Text>
        </View>
      </View>

      <View style={s.metaRow}>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Teléfono</Text>
          <Text style={s.metaValue}>
            {cliente.phone ?? "—"}
            {cliente.phone2 ? ` · ${cliente.phone2}` : ""}
          </Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Correo</Text>
          <Text style={s.metaValue}>{cliente.email ?? "—"}</Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Dirección</Text>
          <Text style={s.metaValue}>
            {[cliente.direccion, cliente.ciudad, cliente.estado, cliente.cp]
              .filter(Boolean)
              .join(", ") || "—"}
          </Text>
        </View>
      </View>

      {/* KPIs */}
      <Text style={s.sectionTitle}>Resumen</Text>
      <View style={s.kpiRow}>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>LTV total</Text>
          <Text style={s.kpiValue}>{data.kpis.ltvTotal}</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Saldo a favor</Text>
          <Text style={s.kpiValue}>{data.kpis.saldoFavor}</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Saldo por cobrar</Text>
          <Text style={s.kpiValue}>{data.kpis.saldoPorCobrar}</Text>
        </View>
        <View style={s.kpiCard}>
          <Text style={s.kpiLabel}>Bicis registradas</Text>
          <Text style={s.kpiValue}>{data.kpis.bicis}</Text>
        </View>
      </View>

      {/* Bicis */}
      <Text style={s.sectionTitle}>Vehículos</Text>
      <View style={s.table}>
        <View style={s.thead}>
          <Text style={[s.th, { width: 90 }]}>VIN</Text>
          <Text style={[s.th, { flex: 1 }]}>Modelo</Text>
          <Text style={[s.th, { width: 60 }]}>Voltaje</Text>
          <Text style={[s.th, { width: 70, textAlign: "right" }]}>Odómetro</Text>
        </View>
        {data.bicis.length === 0 ? (
          <Text style={s.empty}>Este cliente no tiene bicis registradas.</Text>
        ) : (
          data.bicis.map((b, idx) => (
            <View key={idx} style={s.bikeRow}>
              <Text style={[s.td, { width: 90 }]}>{b.vin}</Text>
              <Text style={[s.td, { flex: 1 }]}>{b.modelo}</Text>
              <Text style={[s.td, { width: 60 }]}>{b.voltaje}</Text>
              <Text style={[s.td, { width: 70, textAlign: "right" }]}>{b.odometro}</Text>
            </View>
          ))
        )}
      </View>

      {/* Ventas recientes */}
      <Text style={s.sectionTitle}>Ventas recientes</Text>
      <ActivityTable rows={data.ventasRecientes} />

      {/* Órdenes recientes */}
      <Text style={s.sectionTitle}>Órdenes de taller recientes</Text>
      <ActivityTable rows={data.ordenesRecientes} />

      {/* Datos fiscales */}
      <Text style={s.sectionTitle}>Datos fiscales</Text>
      <View style={s.fiscalGrid}>
        <FiscalField label="Régimen fiscal" value={data.fiscal.regimenFiscal} />
        <FiscalField label="Uso CFDI" value={data.fiscal.usoCFDI} />
        <FiscalField label="Email fiscal" value={data.fiscal.emailFiscal} />
        <FiscalField label="Dirección fiscal" value={data.fiscal.direccionFiscal} />
      </View>

      <DocumentFooter
        terminos={null}
        sealImagePath={data.sealImagePath}
        sealSrc={sealSrc}
      />
    </BaseDocument>
  );
}

function ActivityTable({ rows }: { rows: FichaActivityRow[] }): React.JSX.Element {
  return (
    <View style={s.table}>
      <View style={s.thead}>
        <Text style={[s.th, { width: 60 }]}>Fecha</Text>
        <Text style={[s.th, { width: 70 }]}>Folio</Text>
        <Text style={[s.th, { width: 70 }]}>Tipo</Text>
        <Text style={[s.th, { flex: 1 }]}>Detalle</Text>
        <Text style={[s.th, { width: 70, textAlign: "right" }]}>Total</Text>
      </View>
      {rows.length === 0 ? (
        <Text style={s.empty}>Sin actividad reciente.</Text>
      ) : (
        rows.map((r, idx) => (
          <View key={idx} style={s.trow}>
            <Text style={[s.td, { width: 60 }]}>{r.fecha}</Text>
            <Text style={[s.td, { width: 70 }]}>{r.folio}</Text>
            <Text style={[s.td, { width: 70 }]}>{r.tipo}</Text>
            <Text style={[s.td, { flex: 1 }]}>{r.detalle}</Text>
            <Text style={[s.td, { width: 70, textAlign: "right" }]}>{r.total}</Text>
          </View>
        ))
      )}
    </View>
  );
}

function FiscalField({
  label,
  value,
}: {
  label: string;
  value: string | null;
}): React.JSX.Element {
  return (
    <View style={s.fiscalCell}>
      <Text style={s.metaLabel}>{label}</Text>
      <Text style={s.metaValue}>{value ?? "—"}</Text>
    </View>
  );
}
