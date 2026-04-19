import { z } from "zod";

export const EXPORT_FORMATS = ["csv", "xlsx", "pdf"] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export const EXPORT_MAX_ROWS = 10_000;

export const ExportRequestSchema = z.object({
  format: z.enum(EXPORT_FORMATS),
  filters: z.record(z.string(), z.unknown()),
  columns: z.array(z.string()).optional(),
});
export type ExportRequest = z.infer<typeof ExportRequestSchema>;

export type ExportColumn = {
  key: string;
  label: string;
  width?: number;
  align?: "left" | "right" | "center";
  format?: "text" | "number" | "currency" | "date" | "percent";
};

export type ExportContext = {
  userId: string;
  role: "ADMIN" | "MANAGER" | "SELLER" | "TECHNICIAN";
  sessionBranchId: string | null;
  branchNameById: Map<string, string>;
};

export type ExportHandler = {
  slug: string;
  title: string;
  allowedRoles: Array<"ADMIN" | "MANAGER" | "SELLER" | "TECHNICIAN">;
  filtersSchema: z.ZodSchema;
  fetchRows: (
    parsedFilters: unknown,
    ctx: ExportContext,
  ) => Promise<{
    rows: Record<string, unknown>[];
    columns: ExportColumn[];
    meta: {
      rangeLabel: string;
      branchLabel: string;
      totalRows: number;
      saturated: boolean;
    };
  }>;
  pdfColumns?: string[];
};
