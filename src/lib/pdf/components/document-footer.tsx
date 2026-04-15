import React from "react";
import fs from "fs";
import path from "path";
import sharp from "sharp";
import { View, Text, Image } from "@react-pdf/renderer";
import { StyleSheet } from "@react-pdf/renderer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY } from "@/lib/pdf/fonts";

const s = StyleSheet.create({
  container: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
  },
  terminos: {
    flex: 2,
    paddingRight: 16,
  },
  terminosText: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    color: colors.text,
    lineHeight: 1.3,
  },
  sealBlock: {
    flex: 1,
    alignItems: "center",
  },
  sealImage: {
    width: 60,
    height: 60,
    objectFit: "contain",
    marginBottom: 4,
  },
  sealLine: {
    width: "100%",
    height: 0.5,
    backgroundColor: colors.border,
    marginBottom: 4,
  },
  elaboradoPor: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    color: colors.text,
    textAlign: "center",
  },
});

/**
 * Lee un archivo de imagen del filesystem y lo convierte a un buffer PNG apto
 * para @react-pdf/renderer. Si el archivo es WebP (como los sellos guardados
 * por P1-A), sharp lo convierte a PNG. Si ya es PNG/JPEG, lo devuelve tal cual.
 * Devuelve null si el archivo no existe.
 */
async function resolveSealBuffer(
  sealImageUrl: string,
): Promise<{ data: Buffer; format: "png" } | null> {
  // sealImageUrl: ruta relativa a /public, p.ej. "/sellos/abc-123.webp"
  const absolutePath = sealImageUrl.startsWith("/")
    ? path.join(process.cwd(), "public", sealImageUrl)
    : sealImageUrl;

  if (!fs.existsSync(absolutePath)) return null;

  const pngBuffer = await sharp(absolutePath).png().toBuffer();
  return { data: pngBuffer, format: "png" };
}

type DocumentFooterProps = {
  terminos?: string | null;
  sealImagePath: string | null;
  sealSrc?: { data: Buffer; format: "png" } | null;
};

export function DocumentFooter({
  terminos,
  sealSrc,
}: DocumentFooterProps) {
  return (
    <View style={s.container}>
      {/* Términos del documento (omitido si no se proporcionan) */}
      {terminos ? (
        <View style={s.terminos}>
          <Text style={s.terminosText}>{terminos}</Text>
        </View>
      ) : null}

      {/* Sello y firma */}
      <View style={s.sealBlock}>
        {sealSrc != null ? (
          <Image style={s.sealImage} src={sealSrc} />
        ) : null}
        <View style={s.sealLine} />
        <Text style={s.elaboradoPor}>ELABORADO POR</Text>
      </View>
    </View>
  );
}

// Exportar el helper para que los Route Handlers lo llamen antes de renderizar
export { resolveSealBuffer };
