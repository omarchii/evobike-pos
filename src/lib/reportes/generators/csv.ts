import type { ExportColumn } from "../export-types";

const MXN = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const NUM = new Intl.NumberFormat("es-MX");

function formatCell(value: unknown, col: ExportColumn): string {
  if (value === null || value === undefined) return "";

  switch (col.format) {
    case "currency": {
      const n = typeof value === "number" ? value : Number(value);
      return isNaN(n) ? String(value) : MXN.format(n);
    }
    case "percent": {
      const n = typeof value === "number" ? value : Number(value);
      return isNaN(n) ? String(value) : `${(n * 100).toFixed(2)}%`;
    }
    case "number": {
      const n = typeof value === "number" ? value : Number(value);
      return isNaN(n) ? String(value) : NUM.format(n);
    }
    case "date": {
      if (value instanceof Date) {
        const y = value.getFullYear();
        const m = String(value.getMonth() + 1).padStart(2, "0");
        const d = String(value.getDate()).padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
      if (typeof value === "string") return value.slice(0, 10);
      return String(value);
    }
    default:
      return String(value);
  }
}

function escapeCSV(val: string): string {
  if (
    val.includes(",") ||
    val.includes('"') ||
    val.includes("\n") ||
    val.includes("\r")
  ) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

export function generateCSV(
  rows: Record<string, unknown>[],
  columns: ExportColumn[],
): Buffer {
  const header = columns.map((c) => escapeCSV(c.label)).join(",");

  const dataLines = rows.map((row) =>
    columns.map((c) => escapeCSV(formatCell(row[c.key], c))).join(","),
  );

  const csvContent = [header, ...dataLines].join("\r\n");
  const BOM = "\uFEFF";
  return Buffer.from(BOM + csvContent, "utf-8");
}
