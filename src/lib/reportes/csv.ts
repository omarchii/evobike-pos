"use client";

/**
 * Helper client-side de exportación CSV para reportes (P10).
 *
 * Genera un blob en el browser, escapa comillas y comas,
 * e incluye BOM UTF-8 para compatibilidad con Excel.
 *
 * NO usar desde Server Components — requiere acceso a `document` y `URL`.
 */

function escapeCSVValue(val: unknown): string {
  const str = String(val ?? "");
  // Escapar si contiene coma, comilla doble o salto de línea
  if (str.includes(",") || str.includes('"') || str.includes("\n")) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

/**
 * Descarga un archivo CSV en el browser a partir de un array de objetos.
 *
 * @param rows    Filas de datos. Las claves del primer objeto son los headers.
 * @param filename Nombre del archivo sin extensión (se agrega `.csv`).
 */
export function downloadCSV(
  rows: Record<string, unknown>[],
  filename: string,
): void {
  if (rows.length === 0) return;

  const headers = Object.keys(rows[0]!);
  const lines: string[] = [
    headers.map(escapeCSVValue).join(","),
    ...rows.map((row) =>
      headers.map((h) => escapeCSVValue(row[h])).join(","),
    ),
  ];

  const csvContent = lines.join("\n");
  // BOM UTF-8 para que Excel abra correctamente acentos y ñ
  const BOM = "\uFEFF";
  const blob = new Blob([BOM + csvContent], {
    type: "text/csv;charset=utf-8;",
  });

  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}.csv`;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
}
