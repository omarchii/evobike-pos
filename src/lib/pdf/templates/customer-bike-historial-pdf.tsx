import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { BaseDocument } from "@/lib/pdf/components/base-document";
import { DocumentHeader } from "@/lib/pdf/components/document-header";
import { DocumentFooter } from "@/lib/pdf/components/document-footer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import type { BranchPDFData } from "@/lib/pdf/types";

// PDF historial por bici (BRIEF §7.5) — útil para garantías de fabricante.
// Identidad de la unidad + dueño + cronología de service orders + historial
// de baterías y voltajes.

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
  serviceCard: {
    backgroundColor: "#F8FAFA",
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 6,
  },
  serviceHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  serviceFolio: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    fontWeight: 700,
    color: colors.text,
  },
  serviceMeta: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    color: colors.textMuted,
  },
  serviceDetail: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
    lineHeight: 1.4,
  },
  serviceItem: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    color: colors.textMuted,
    marginTop: 2,
  },
});

export interface BikeServiceHistoryRow {
  fecha: string;
  folio: string;
  tipo: string;
  estado: string;
  total: string;
  servicios: string[];
  notas: string | null;
}

export interface BikeBatteryHistoryRow {
  serial: string;
  desde: string;
  hasta: string;
  voltaje: string;
  notas: string | null;
}

export interface BikeVoltageHistoryRow {
  fecha: string;
  cambio: string;
  motivo: string;
  autor: string;
}

export interface BikeOdometerHistoryRow {
  fecha: string;
  cambio: string;
  motivo: string;
  autor: string;
}

export interface CustomerBikeHistorialPDFData {
  branch: BranchPDFData;
  generatedAt: string;
  duenoActual: {
    nombre: string;
    rfc: string | null;
    phone: string | null;
    email: string | null;
  };
  bici: {
    vin: string;
    marca: string | null;
    modelo: string | null;
    color: string | null;
    voltajeActual: string | null;
    odometerKm: number | null;
    fechaCompra: string | null;
    estado: string;
    bateriaActual: string | null;
  };
  servicios: BikeServiceHistoryRow[];
  baterias: BikeBatteryHistoryRow[];
  voltajes: BikeVoltageHistoryRow[];
  odometros: BikeOdometerHistoryRow[];
  sealImagePath: string | null;
}

export function CustomerBikeHistorialPDF({
  data,
  sealSrc,
}: {
  data: CustomerBikeHistorialPDFData;
  sealSrc?: { data: Buffer; format: "png" } | null;
}): React.JSX.Element {
  const bici = data.bici;
  const dueno = data.duenoActual;

  return (
    <BaseDocument title={`Historial bici — ${bici.vin}`}>
      <DocumentHeader
        branch={data.branch}
        documentType="Historial de unidad"
        folio={bici.vin}
      />

      {/* Identidad bici */}
      <View style={s.metaRow}>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>VIN</Text>
          <Text style={s.metaValue}>{bici.vin}</Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Marca y modelo</Text>
          <Text style={s.metaValue}>
            {[bici.marca, bici.modelo].filter(Boolean).join(" ") || "—"}
          </Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Color</Text>
          <Text style={s.metaValue}>{bici.color ?? "—"}</Text>
        </View>
      </View>

      <View style={s.metaRow}>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Voltaje actual</Text>
          <Text style={s.metaValue}>{bici.voltajeActual ?? "—"}</Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Odómetro</Text>
          <Text style={s.metaValue}>
            {bici.odometerKm != null
              ? `${bici.odometerKm.toLocaleString("es-MX")} km`
              : "No registrado"}
          </Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Fecha de compra</Text>
          <Text style={s.metaValue}>{bici.fechaCompra ?? "—"}</Text>
        </View>
      </View>

      {/* Dueño actual */}
      <Text style={s.sectionTitle}>Propietario actual</Text>
      <View style={s.metaRow}>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Nombre</Text>
          <Text style={s.metaValue}>{dueno.nombre}</Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>RFC</Text>
          <Text style={s.metaValue}>{dueno.rfc ?? "—"}</Text>
        </View>
        <View style={s.metaCell}>
          <Text style={s.metaLabel}>Contacto</Text>
          <Text style={s.metaValue}>
            {dueno.phone ?? "—"}
            {dueno.email ? `\n${dueno.email}` : ""}
          </Text>
        </View>
      </View>

      {/* Servicios */}
      <Text style={s.sectionTitle}>
        Cronología de servicios ({data.servicios.length})
      </Text>
      {data.servicios.length === 0 ? (
        <Text style={s.empty}>Sin órdenes de taller registradas.</Text>
      ) : (
        data.servicios.map((sv, idx) => (
          <View key={idx} style={s.serviceCard}>
            <View style={s.serviceHeader}>
              <Text style={s.serviceFolio}>{sv.folio}</Text>
              <Text style={s.serviceMeta}>
                {sv.fecha} · {sv.tipo} · {sv.estado} · {sv.total}
              </Text>
            </View>
            {sv.servicios.length > 0 && (
              <Text style={s.serviceDetail}>{sv.servicios.join(" · ")}</Text>
            )}
            {sv.notas && (
              <Text style={s.serviceItem}>Notas: {sv.notas}</Text>
            )}
          </View>
        ))
      )}

      {/* Baterías */}
      <Text style={s.sectionTitle}>
        Historial de baterías ({data.baterias.length})
      </Text>
      <View style={s.table}>
        <View style={s.thead}>
          <Text style={[s.th, { width: 80 }]}>Serial</Text>
          <Text style={[s.th, { width: 70 }]}>Desde</Text>
          <Text style={[s.th, { width: 70 }]}>Hasta</Text>
          <Text style={[s.th, { width: 50 }]}>Voltaje</Text>
          <Text style={[s.th, { flex: 1 }]}>Notas</Text>
        </View>
        {data.baterias.length === 0 ? (
          <Text style={s.empty}>Sin asignaciones registradas.</Text>
        ) : (
          data.baterias.map((b, idx) => (
            <View key={idx} style={s.trow}>
              <Text style={[s.td, { width: 80 }]}>{b.serial}</Text>
              <Text style={[s.td, { width: 70 }]}>{b.desde}</Text>
              <Text style={[s.td, { width: 70 }]}>{b.hasta}</Text>
              <Text style={[s.td, { width: 50 }]}>{b.voltaje}</Text>
              <Text style={[s.td, { flex: 1 }]}>{b.notas ?? "—"}</Text>
            </View>
          ))
        )}
      </View>

      {/* Voltajes */}
      <Text style={s.sectionTitle}>
        Cambios de voltaje ({data.voltajes.length})
      </Text>
      <View style={s.table}>
        <View style={s.thead}>
          <Text style={[s.th, { width: 70 }]}>Fecha</Text>
          <Text style={[s.th, { width: 90 }]}>Cambio</Text>
          <Text style={[s.th, { width: 80 }]}>Motivo</Text>
          <Text style={[s.th, { flex: 1 }]}>Autor</Text>
        </View>
        {data.voltajes.length === 0 ? (
          <Text style={s.empty}>Sin cambios registrados.</Text>
        ) : (
          data.voltajes.map((v, idx) => (
            <View key={idx} style={s.trow}>
              <Text style={[s.td, { width: 70 }]}>{v.fecha}</Text>
              <Text style={[s.td, { width: 90 }]}>{v.cambio}</Text>
              <Text style={[s.td, { width: 80 }]}>{v.motivo}</Text>
              <Text style={[s.td, { flex: 1 }]}>{v.autor}</Text>
            </View>
          ))
        )}
      </View>

      {/* Odómetro */}
      <Text style={s.sectionTitle}>
        Cambios de odómetro ({data.odometros.length})
      </Text>
      <View style={s.table}>
        <View style={s.thead}>
          <Text style={[s.th, { width: 70 }]}>Fecha</Text>
          <Text style={[s.th, { width: 110 }]}>Cambio</Text>
          <Text style={[s.th, { width: 110 }]}>Motivo</Text>
          <Text style={[s.th, { flex: 1 }]}>Autor</Text>
        </View>
        {data.odometros.length === 0 ? (
          <Text style={s.empty}>Sin cambios registrados.</Text>
        ) : (
          data.odometros.map((o, idx) => (
            <View key={idx} style={s.trow}>
              <Text style={[s.td, { width: 70 }]}>{o.fecha}</Text>
              <Text style={[s.td, { width: 110 }]}>{o.cambio}</Text>
              <Text style={[s.td, { width: 110 }]}>{o.motivo}</Text>
              <Text style={[s.td, { flex: 1 }]}>{o.autor}</Text>
            </View>
          ))
        )}
      </View>

      <DocumentFooter
        terminos={null}
        sealImagePath={data.sealImagePath}
        sealSrc={sealSrc}
      />
    </BaseDocument>
  );
}
