import { z } from "zod";
import type { ExportHandler, ExportColumn } from "@/lib/reportes/export-types";
import { EXPORT_MAX_ROWS } from "@/lib/reportes/export-types";
import { parseDateRange, toDateString } from "@/lib/reportes/date-range";
import { fetchEstadoResultados } from "./queries";
import { OPEX_CATEGORY_LABELS, CASH_EXPENSE_LABELS } from "./queries";
import type { ExpenseCategoryKey, CashExpenseCategoryKey } from "./queries";

const EXPORT_COLUMNS: ExportColumn[] = [
  { key: "concepto", label: "Concepto", width: 36 },
  { key: "importe", label: "Importe", format: "currency", align: "right", width: 18 },
];

const FiltersSchema = z.object({
  from: z.string().optional().default(""),
  to: z.string().optional().default(""),
  branchId: z.string().optional(),
});

type ParsedFilters = z.infer<typeof FiltersSchema>;

export const estadoResultadosExportHandler: ExportHandler = {
  slug: "estado-resultados",
  title: "Estado de resultados",
  allowedRoles: ["ADMIN"],
  filtersSchema: FiltersSchema,
  pdfColumns: ["concepto", "importe"],

  async fetchRows(parsedFilters, ctx) {
    const filters = parsedFilters as ParsedFilters;
    const { from, to } = parseDateRange({ from: filters.from, to: filters.to });

    const effectiveBranchId =
      ctx.role === "ADMIN" ? (filters.branchId ?? null) : ctx.sessionBranchId;

    const data = await fetchEstadoResultados({
      from,
      to,
      branchId: effectiveBranchId,
    });

    const c = data.consolidated;

    const rows: Record<string, unknown>[] = [
      { concepto: "Ingresos brutos", importe: c.ingresos },
      { concepto: "(−) Costo de ventas", importe: -c.cogs },
      { concepto: "= Margen bruto", importe: c.margenBruto },
    ];

    // Gastos operativos bancarios (con detalle por categoría)
    rows.push({ concepto: "(−) Gastos banco / tarjeta / transferencia", importe: -c.opexBancario });
    for (const [k, v] of Object.entries(c.opexBancarioByCategoria)) {
      if ((v ?? 0) > 0) {
        rows.push({
          concepto: `    ${OPEX_CATEGORY_LABELS[k as ExpenseCategoryKey] ?? k}`,
          importe: -(v ?? 0),
        });
      }
    }

    rows.push({ concepto: "(−) Comisiones pagadas", importe: -c.comisionesPagadas });

    // Gastos de caja (con detalle por categoría)
    rows.push({ concepto: "(−) Gastos de caja", importe: -c.gastosEfectivo });
    for (const [k, v] of Object.entries(c.gastosEfectivoByCategoria)) {
      if ((v ?? 0) > 0) {
        rows.push({
          concepto: `    ${CASH_EXPENSE_LABELS[k as CashExpenseCategoryKey] ?? k}`,
          importe: -(v ?? 0),
        });
      }
    }

    rows.push({ concepto: "= Margen operativo", importe: c.margenOperativo });

    const saturated = rows.length > EXPORT_MAX_ROWS;
    const finalRows = saturated ? rows.slice(0, EXPORT_MAX_ROWS) : rows;

    const branchLabel = effectiveBranchId
      ? (ctx.branchNameById.get(effectiveBranchId) ?? effectiveBranchId)
      : "Todas las sucursales";

    return {
      rows: finalRows,
      columns: EXPORT_COLUMNS,
      meta: {
        rangeLabel: `${toDateString(from)} – ${toDateString(to)}`,
        branchLabel,
        totalRows: saturated ? EXPORT_MAX_ROWS + 1 : finalRows.length,
        saturated,
      },
    };
  },
};
