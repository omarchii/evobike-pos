import React from "react";
import path from "path";
import { View, Text, Image } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";
import type { BranchPDFData } from "@/lib/pdf/types";

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 10,
  },
  left: {
    width: 120,
    justifyContent: "center",
    alignItems: "flex-start",
  },
  center: {
    flex: 1,
    alignItems: "center",
    paddingHorizontal: 8,
  },
  right: {
    width: 100,
    alignItems: "flex-end",
  },
  logo: {
    width: 110,
    height: 40,
    objectFit: "contain",
  },
  branchName: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    fontWeight: 700,
    color: colors.text,
    textAlign: "center",
    marginBottom: 1,
  },
  branchDetail: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    color: colors.text,
    textAlign: "center",
    marginBottom: 1,
  },
  docTypeLabel: {
    fontFamily: FONT_FAMILY,
    fontSize: 9,
    color: colors.text,
    textAlign: "right",
  },
  docFolio: {
    fontFamily: FONT_FAMILY,
    fontSize: 14,
    fontWeight: 700,
    color: colors.text,
    textAlign: "right",
  },
});

type DocumentHeaderProps = {
  branch: BranchPDFData;
  documentType: string;
  folio: string;
};

export function DocumentHeader({
  branch,
  documentType,
  folio,
}: DocumentHeaderProps) {
  // evobike-logo-pdf.png es un PNG real (converted from WebP).
  // evobike-logo.png es en realidad un WebP disfrazado — react-pdf no lo soporta.
  const logoPath = path.join(process.cwd(), "public", "evobike-logo-pdf.png");

  const addressLine = [
    branch.street,
    branch.colonia,
    `${branch.city}, ${branch.state}, ${branch.zip}`,
  ]
    .filter(Boolean)
    .join(", ");

  return (
    <View style={s.container}>
      {/* Izquierda: logo */}
      <View style={s.left}>
        {/* react-pdf Image no acepta prop alt */}
        {/* eslint-disable-next-line jsx-a11y/alt-text */}
        <Image style={s.logo} src={logoPath} />
      </View>

      {/* Centro: datos de sucursal */}
      <View style={s.center}>
        <Text style={s.branchName}>{branch.razonSocial.toUpperCase()}</Text>
        <Text style={s.branchDetail}>
          {"RFC "}
          {branch.rfc}
        </Text>
        <Text style={s.branchDetail}>{addressLine}</Text>
        <Text style={s.branchDetail}>México</Text>
        {branch.phone ? (
          <Text style={s.branchDetail}>{branch.phone}</Text>
        ) : null}
        {branch.website ? (
          <Text style={s.branchDetail}>{branch.website}</Text>
        ) : null}
        {branch.email ? (
          <Text style={s.branchDetail}>{branch.email}</Text>
        ) : null}
      </View>

      {/* Derecha: tipo de documento y folio */}
      <View style={s.right}>
        <Text style={s.docTypeLabel}>{documentType}</Text>
        <Text style={s.docFolio}>{folio}</Text>
      </View>
    </View>
  );
}
