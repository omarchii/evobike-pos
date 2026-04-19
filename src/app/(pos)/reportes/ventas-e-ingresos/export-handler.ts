import { z } from "zod";
import type { ExportHandler, ExportColumn } from "@/lib/reportes/export-types";
import { EXPORT_MAX_ROWS } from "@/lib/reportes/export-types";
import { parseDateRange } from "@/lib/reportes/date-range";
import { toDateString } from "@/lib/reportes/date-range";
import { getSalesTableForExport } from "./queries";

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completada",
  LAYAWAY: "Apartado",
  CANCELLED: "Cancelada",
  PENDING: "Pendiente",
};

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "folio", label: "Folio", width: 10 },
  { key: "fecha", label: "Fecha", format: "date", width: 12 },
  { key: "clienteNombre", label: "Cliente", width: 22 },
  { key: "vendedorNombre", label: "Vendedor", width: 16 },
  { key: "metodoPago", label: "Método de pago", width: 16 },
  { key: "items", label: "# Ítems", format: "number", align: "right", width: 8 },
  { key: "subtotal", label: "Subtotal", format: "currency", align: "right", width: 14 },
  { key: "descuento", label: "Descuento", format: "currency", align: "right", width: 14 },
  { key: "total", label: "Total", format: "currency", align: "right", width: 14 },
  { key: "statusLabel", label: "Estado", width: 12 },
];

const FiltersSchema = z.object({
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
  vendedorId: z.string().optional(),
  metodo: z.string().optional(),
});

type ParsedFilters = z.infer<typeof FiltersSchema>;

export const ventasEIngresosExportHandler: ExportHandler = {
  slug: "ventas-e-ingresos",
  title: "Ventas e ingresos",
  allowedRoles: ["ADMIN", "MANAGER"],
  filtersSchema: FiltersSchema,
  pdfColumns: ["folio", "fecha", "clienteNombre", "vendedorNombre", "metodoPago", "total"],

  async fetchRows(parsedFilters, ctx) {
    const filters = parsedFilters as ParsedFilters;

    const { from, to } = parseDateRange({ from: filters.from, to: filters.to });

    const effectiveBranchId =
      ctx.role === "ADMIN" ? null : ctx.sessionBranchId;

    const salesFilters = {
      from,
      to,
      vendedorId: filters.vendedorId || undefined,
      metodo: filters.metodo || undefined,
    };

    const rawRows = await getSalesTableForExport(effectiveBranchId, salesFilters);

    const saturated = rawRows.length > EXPORT_MAX_ROWS;
    const rows = saturated ? rawRows.slice(0, EXPORT_MAX_ROWS) : rawRows;

    const flatRows: Record<string, unknown>[] = rows.map((r) => ({
      folio: r.folio,
      fecha: r.fecha,
      clienteNombre: r.clienteNombre,
      vendedorNombre: r.vendedorNombre,
      metodoPago: r.metodoPago,
      items: r.items,
      subtotal: r.subtotal,
      descuento: r.descuento,
      total: r.total,
      statusLabel: STATUS_LABELS[r.status] ?? r.status,
    }));

    let branchLabel = "Todas";
    if (effectiveBranchId) {
      branchLabel =
        ctx.branchNameById.get(effectiveBranchId) ?? effectiveBranchId;
    }

    const rangeLabel = `${toDateString(from)} – ${toDateString(to)}`;

    return {
      rows: flatRows,
      columns: EXPORT_COLUMNS,
      meta: {
        rangeLabel,
        branchLabel,
        totalRows: saturated ? EXPORT_MAX_ROWS + 1 : rows.length,
        saturated,
      },
    };
  },
};
