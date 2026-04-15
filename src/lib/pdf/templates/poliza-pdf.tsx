import React from "react";
import { View, Text } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { BaseDocument } from "@/lib/pdf/components/base-document";
import { DocumentHeader } from "@/lib/pdf/components/document-header";
import { VehicleInfoBlock } from "@/lib/pdf/components/vehicle-info-block";
import { DocumentFooter } from "@/lib/pdf/components/document-footer";
import type { BranchPDFData } from "@/lib/pdf/types";

// ── Styles ─────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  // Client block (simplified inline version)
  clientBlock: {
    backgroundColor: "#F1F3F2",
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
    backgroundColor: "#DCDFDD",
    fontFamily: "Inter",
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.5,
    color: "#3D5247",
    paddingHorizontal: 4,
    paddingVertical: 2,
    marginRight: 5,
  },
  chipValue: {
    fontFamily: "Inter",
    fontSize: 8,
    color: "#131B2E",
    flexShrink: 1,
  },
  // Baterías table
  tableContainer: {
    marginBottom: 8,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#E9EBEA",
    paddingHorizontal: 6,
    paddingVertical: 4,
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 6,
    paddingVertical: 4,
    borderBottomWidth: 0.5,
    borderBottomColor: "#D0D5D2",
  },
  colNo: {
    width: 24,
  },
  colSerial: {
    flex: 2,
  },
  colLote: {
    flex: 3,
  },
  colFecha: {
    flex: 2,
  },
  headerText: {
    fontFamily: "Inter",
    fontSize: 7,
    fontWeight: 700,
    color: "#3D5247",
    letterSpacing: 0.3,
  },
  cellText: {
    fontFamily: "Inter",
    fontSize: 8,
    color: "#131B2E",
  },
  emptyRow: {
    paddingHorizontal: 6,
    paddingVertical: 8,
  },
  emptyText: {
    fontFamily: "Inter",
    fontSize: 8,
    color: "#3D5247",
    textAlign: "center",
  },
});

// ── Inline helpers ─────────────────────────────────────────────────────────────

function ClientChipValue({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <View style={s.clientColHalf}>
      <Text style={s.chip}>{label}</Text>
      <Text style={s.chipValue}>{value ?? "—"}</Text>
    </View>
  );
}

// ── Types ──────────────────────────────────────────────────────────────────────

export interface PolizaPDFData {
  branch: BranchPDFData;
  folio: string;
  fecha: string;
  cliente: {
    nombre: string;
    telefono: string | null;
    email: string | null;
  };
  vehiculo: {
    modelo: string;
    color: string;
    voltaje: string;
    vin: string;
  };
  baterias: {
    serial: string;
    lote: string;
    fechaRecepcion: string;
  }[];
  terminos: string;
  sealImagePath: string | null;
  elaboradoPor: string;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function PolizaPDF({
  data,
  sealSrc,
}: {
  data: PolizaPDFData;
  sealSrc?: { data: Buffer; format: "png" } | null;
}): React.JSX.Element {
  return (
    <BaseDocument title={`Póliza de Garantía ${data.folio}`}>
      {/* 1. Header */}
      <DocumentHeader
        branch={data.branch}
        documentType="Póliza de Garantía"
        folio={data.folio}
      />

      {/* 2. Simplified client block */}
      <View style={s.clientBlock}>
        <View style={s.clientRow}>
          <ClientChipValue label="CLIENTE" value={data.cliente.nombre} />
          <ClientChipValue label="TELÉFONO" value={data.cliente.telefono} />
        </View>
        <View style={s.clientRow}>
          {data.cliente.email != null ? (
            <ClientChipValue label="CORREO" value={data.cliente.email} />
          ) : (
            <View style={s.clientColHalf} />
          )}
          <ClientChipValue label="FECHA DE COMPRA" value={data.fecha} />
        </View>
      </View>

      {/* 3. Vehicle info */}
      <VehicleInfoBlock vehiculo={data.vehiculo} />

      {/* 4. Baterías table */}
      <View style={s.tableContainer}>
        <View style={s.tableHeader}>
          <Text style={[s.headerText, s.colNo]}>No.</Text>
          <Text style={[s.headerText, s.colSerial]}>Serial</Text>
          <Text style={[s.headerText, s.colLote]}>Lote de procedencia</Text>
          <Text style={[s.headerText, s.colFecha]}>Fecha de recepción</Text>
        </View>
        {data.baterias.length === 0 ? (
          <View style={s.emptyRow}>
            <Text style={s.emptyText}>Sin baterías registradas</Text>
          </View>
        ) : (
          data.baterias.map((bat, idx) => (
            <View key={bat.serial} style={s.tableRow}>
              <Text style={[s.cellText, s.colNo]}>{idx + 1}</Text>
              <Text style={[s.cellText, s.colSerial]}>{bat.serial}</Text>
              <Text style={[s.cellText, s.colLote]}>{bat.lote}</Text>
              <Text style={[s.cellText, s.colFecha]}>{bat.fechaRecepcion}</Text>
            </View>
          ))
        )}
      </View>

      {/* 5. Footer with terms + seal */}
      <DocumentFooter
        terminos={data.terminos}
        sealImagePath={data.sealImagePath}
        sealSrc={sealSrc}
      />
    </BaseDocument>
  );
}
