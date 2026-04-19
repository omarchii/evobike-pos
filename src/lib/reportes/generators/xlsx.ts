import ExcelJS from "exceljs";
import type { ExportColumn } from "../export-types";

const HEADER_FILL_ARGB = "FF1B4332";
const HEADER_FONT_ARGB = "FFFFFFFF";

function toCellValue(value: unknown, col: ExportColumn): ExcelJS.CellValue {
  if (value === null || value === undefined) return "";

  switch (col.format) {
    case "currency":
    case "number":
    case "percent": {
      const n = typeof value === "number" ? value : Number(value);
      return isNaN(n) ? String(value) : n;
    }
    case "date": {
      if (value instanceof Date) return value;
      if (typeof value === "string") {
        const d = new Date(value);
        return isNaN(d.getTime()) ? value : d;
      }
      return String(value);
    }
    default:
      return String(value);
  }
}

function numFmt(col: ExportColumn): string | undefined {
  switch (col.format) {
    case "currency":
      return '"$"#,##0.00';
    case "number":
      return "#,##0.00";
    case "percent":
      return "0.00%";
    case "date":
      return "yyyy-mm-dd";
    default:
      return undefined;
  }
}

function colAlign(
  col: ExportColumn,
): ExcelJS.Alignment["horizontal"] {
  if (col.align) return col.align;
  if (col.format === "currency" || col.format === "number") return "right";
  return "left";
}

export async function generateXLSX(
  title: string,
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
  meta: { rangeLabel: string; branchLabel: string },
): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheetName = title.slice(0, 31);
  const ws = wb.addWorksheet(sheetName);

  const lastColLetter = String.fromCharCode(64 + Math.min(columns.length, 26));

  // Row 1: report title
  ws.mergeCells(`A1:${lastColLetter}1`);
  const titleCell = ws.getCell("A1");
  titleCell.value = title;
  titleCell.font = { bold: true, size: 14 };
  titleCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(1).height = 24;

  // Row 2: range · branch label
  ws.mergeCells(`A2:${lastColLetter}2`);
  const metaCell = ws.getCell("A2");
  metaCell.value = `${meta.rangeLabel} · ${meta.branchLabel}`;
  metaCell.font = { italic: true, size: 10, color: { argb: "FF666666" } };
  metaCell.alignment = { horizontal: "left", vertical: "middle" };
  ws.getRow(2).height = 16;

  // Row 3: blank spacer
  ws.getRow(3).height = 6;

  // Row 4: column headers
  const headerRow = ws.getRow(4);
  columns.forEach((col, i) => {
    const cell = headerRow.getCell(i + 1);
    cell.value = col.label;
    cell.font = {
      bold: true,
      color: { argb: HEADER_FONT_ARGB },
    };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: HEADER_FILL_ARGB },
    };
    cell.alignment = {
      horizontal: colAlign(col),
      vertical: "middle",
    };
  });
  headerRow.height = 20;

  // Freeze row 4 (header visible when scrolling)
  ws.views = [{ state: "frozen", ySplit: 4 }];

  // Rows 5+: data
  rows.forEach((row, ri) => {
    const dataRow = ws.getRow(5 + ri);
    columns.forEach((col, ci) => {
      const cell = dataRow.getCell(ci + 1);
      cell.value = toCellValue(row[col.key], col);
      const fmt = numFmt(col);
      if (fmt) cell.numFmt = fmt;
      cell.alignment = { horizontal: colAlign(col), vertical: "middle" };
    });
  });

  // Column widths
  columns.forEach((col, i) => {
    const wsCol = ws.getColumn(i + 1);
    wsCol.width = Math.min(30, Math.max(12, col.width ?? 15));
  });

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
