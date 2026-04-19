import React from "react";
import {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  renderToBuffer,
} from "@react-pdf/renderer";
import { colors } from "@/lib/pdf/colors";
import { FONT_FAMILY, registerFonts } from "@/lib/pdf/fonts";
import { DocumentHeader } from "@/lib/pdf/components/document-header";
import { DocumentFooter } from "@/lib/pdf/components/document-footer";
import type { ExportColumn } from "../export-types";
import type { BranchPDFData } from "@/lib/pdf/types";

registerFonts();

export type GeneratePDFOpts = {
  title: string;
  rows: Record<string, unknown>[];
  columns: ExportColumn[];
  meta: {
    rangeLabel: string;
    branchLabel: string;
    totalRows: number;
    saturated: boolean;
  };
  branchPDFData: BranchPDFData;
  sealSrc: { data: Buffer; format: "png" } | null;
  generatedAt: string;
};

const s = StyleSheet.create({
  page: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
    backgroundColor: colors.bgPage,
    paddingTop: 24,
    paddingBottom: 52,
    paddingHorizontal: 28,
  },
  subtitle: {
    flexDirection: "row",
    marginBottom: 8,
    marginTop: 2,
    gap: 6,
  },
  subtitleText: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.textMuted,
  },
  warnChip: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    color: colors.textMuted,
    backgroundColor: colors.bgLabelChip,
    paddingHorizontal: 4,
    paddingVertical: 1,
  },
  tableWrapper: {
    flexDirection: "column",
    border: `0.5pt solid ${colors.border}`,
  },
  headerRow: {
    flexDirection: "row",
    backgroundColor: colors.bgTableHeader,
    borderBottom: `0.5pt solid ${colors.border}`,
  },
  headerCell: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.text,
    paddingHorizontal: 5,
    paddingVertical: 4,
    borderRight: `0.5pt solid ${colors.border}`,
  },
  headerCellLast: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    fontWeight: 700,
    letterSpacing: 0.4,
    textTransform: "uppercase",
    color: colors.text,
    paddingHorizontal: 5,
    paddingVertical: 4,
  },
  bodyRow: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${colors.border}`,
  },
  bodyRowAlt: {
    flexDirection: "row",
    borderBottom: `0.5pt solid ${colors.border}`,
    backgroundColor: colors.bgClientBlock,
  },
  bodyCell: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
    paddingHorizontal: 5,
    paddingVertical: 3,
    borderRight: `0.5pt solid ${colors.border}`,
  },
  bodyCellLast: {
    fontFamily: FONT_FAMILY,
    fontSize: 8,
    color: colors.text,
    paddingHorizontal: 5,
    paddingVertical: 3,
  },
  footer: {
    position: "absolute",
    bottom: 16,
    left: 28,
    right: 28,
  },
  generatedLine: {
    fontFamily: FONT_FAMILY,
    fontSize: 7,
    color: colors.textMuted,
    marginBottom: 6,
  },
});

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCellValue(value: unknown, col: ExportColumn): string {
  if (value === null || value === undefined) return "";

  switch (col.format) {
    case "currency": {
      const n = typeof value === "number" ? value : Number(value);
      return isNaN(n) ? String(value) : MXN.format(n);
    }
    case "percent": {
      const n = typeof value === "number" ? value : Number(value);
      return isNaN(n) ? String(value) : `${(n * 100).toFixed(1)}%`;
    }
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return isNaN(n) ? String(value) : new Intl.NumberFormat("es-MX").format(n);
    }
    case "date": {
      if (typeof value === "string") return value.slice(0, 10);
      if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, "0");
        const d = String(value.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
      return String(value);
    }
    default:
      return String(value);
  }
}

function getCellFlex(col: ExportColumn): number {
  return col.width ?? 1;
}

function getCellTextAlign(
  col: ExportColumn,
): "left" | "right" | "center" {
  if (col.align) return col.align;
  if (col.format === "currency" || col.format === "number") return "right";
  return "left";
}

function ReportDocument({
  opts,
}: {
  opts: GeneratePDFOpts;
}) {
  const { title, rows, columns, meta, branchPDFData, sealSrc, generatedAt } =
    opts;

  const isLandscape = columns.length > 4;

  const footerTerminos = meta.saturated
    ? `Generado el ${generatedAt} · ⚠ Limitado a 10,000 filas — afina filtros para ver todo`
    : `Generado el ${generatedAt}`;

  return (
    <Document title={title} author="EvoBike POS">
      <Page
        size="A4"
        orientation={isLandscape ? "landscape" : "portrait"}
        style={s.page}
      >
        {/* Document header: logo, branch data, title + range */}
        <DocumentHeader
          branch={branchPDFData}
          documentType={title}
          folio={meta.rangeLabel}
        />

        {/* Subtitle: branch label */}
        <View style={s.subtitle}>
          <Text style={s.subtitleText}>
            {meta.branchLabel}
          </Text>
          {meta.saturated && (
            <Text style={s.warnChip}>
              Limitado a 10,000 filas
            </Text>
          )}
        </View>

        {/* Table */}
        <View style={s.tableWrapper}>
          {/* Header row — fixed so it repeats on every page */}
          <View style={s.headerRow} fixed>
            {columns.map((col, i) => (
              <Text
                key={col.key}
                style={[
                  i === columns.length - 1 ? s.headerCellLast : s.headerCell,
                  { flex: getCellFlex(col), textAlign: getCellTextAlign(col) },
                ]}
              >
                {col.label}
              </Text>
            ))}
          </View>

          {/* Data rows */}
          {rows.map((row, ri) => (
            <View
              key={ri}
              style={ri % 2 === 0 ? s.bodyRow : s.bodyRowAlt}
              wrap={false}
            >
              {columns.map((col, ci) => (
                <Text
                  key={col.key}
                  style={[
                    ci === columns.length - 1 ? s.bodyCellLast : s.bodyCell,
                    {
                      flex: getCellFlex(col),
                      textAlign: getCellTextAlign(col),
                    },
                  ]}
                >
                  {formatCellValue(row[col.key], col)}
                </Text>
              ))}
            </View>
          ))}
        </View>

        {/* Footer: fixed at bottom of every page */}
        <View style={s.footer} fixed>
          <Text style={s.generatedLine}>{footerTerminos}</Text>
          <DocumentFooter
            sealImagePath={null}
            sealSrc={sealSrc}
          />
        </View>
      </Page>
    </Document>
  );
}

export async function generatePDF(opts: GeneratePDFOpts): Promise<Buffer> {
  const buffer = await renderToBuffer(<ReportDocument opts={opts} />);
  return Buffer.from(buffer);
}
