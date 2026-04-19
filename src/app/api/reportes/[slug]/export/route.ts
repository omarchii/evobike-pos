import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ExportRequestSchema,
  EXPORT_MAX_ROWS,
} from "@/lib/reportes/export-types";
import { getExportHandler } from "@/lib/reportes/export-registry";
import { generateCSV } from "@/lib/reportes/generators/csv";
import { generateXLSX } from "@/lib/reportes/generators/xlsx";
import { generatePDF } from "@/lib/reportes/generators/pdf";
import {
  assertBranchConfiguredForPDF,
  BranchNotConfiguredError,
} from "@/lib/branch";
import { resolveSealBuffer } from "@/lib/pdf/components/document-footer";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

const inFlight = new Map<string, Promise<NextResponse>>();

export async function POST(
  req: Request,
  { params }: { params: Promise<{ slug: string }> },
): Promise<NextResponse> {
  const { slug } = await params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, role, branchId: sessionBranchId } =
    session.user as unknown as SessionUser;

  if (inFlight.has(userId)) {
    return NextResponse.json(
      { error: "Ya tienes una exportación en curso. Espera a que termine." },
      { status: 429 },
    );
  }

  const handler = getExportHandler(slug);
  if (!handler) {
    return NextResponse.json(
      { error: "Reporte no encontrado" },
      { status: 404 },
    );
  }

  const allowedRole = role as "ADMIN" | "MANAGER" | "SELLER" | "TECHNICIAN";
  if (!handler.allowedRoles.includes(allowedRole)) {
    return NextResponse.json({ error: "Acceso denegado" }, { status: 403 });
  }

  let rawBody: unknown;
  try {
    rawBody = await req.json();
  } catch {
    return NextResponse.json({ error: "Cuerpo de la solicitud inválido" }, { status: 400 });
  }

  const parsed = ExportRequestSchema.safeParse(rawBody);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Parámetros inválidos", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  const filtersParsed = handler.filtersSchema.safeParse(parsed.data.filters);
  if (!filtersParsed.success) {
    return NextResponse.json(
      { error: "Filtros inválidos", issues: filtersParsed.error.issues },
      { status: 400 },
    );
  }

  const workPromise: Promise<NextResponse> = (async () => {
    const branches = await prisma.branch.findMany({
      select: { id: true, code: true, name: true },
    });

    const ctx = {
      userId,
      role: allowedRole,
      sessionBranchId: sessionBranchId ?? null,
      branchNameById: new Map(branches.map((b) => [b.id, b.code])),
    };

    const { rows, columns, meta } = await handler.fetchRows(
      filtersParsed.data,
      ctx,
    );

    if (meta.totalRows > EXPORT_MAX_ROWS) {
      return NextResponse.json(
        {
          error: "Rango demasiado grande. Afina filtros o exporta en partes.",
          rowsCount: meta.totalRows,
          maxRows: EXPORT_MAX_ROWS,
        },
        { status: 413 },
      );
    }

    const format = parsed.data.format;
    const now = new Date();
    const ts = now
      .toLocaleString("sv", { timeZone: "America/Merida" })
      .replace(/[-: ]/g, "")
      .slice(0, 15);
    const tsParts = ts.replace(/^(\d{8})(\d{6})$/, "$1-$2");
    const branchSuffix =
      meta.branchLabel === "Todas"
        ? ""
        : `_${meta.branchLabel.replace(/\s+/g, "")}`;
    const filenameBase = `${slug}_${tsParts}${branchSuffix}`;

    if (format === "csv") {
      const buffer = generateCSV(rows, columns);
      return buildResponse(
        buffer,
        `${filenameBase}.csv`,
        "text/csv; charset=utf-8",
      );
    }

    if (format === "xlsx") {
      const buffer = await generateXLSX(handler.title, rows, columns, {
        rangeLabel: meta.rangeLabel,
        branchLabel: meta.branchLabel,
      });
      return buildResponse(
        buffer,
        `${filenameBase}.xlsx`,
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      );
    }

    // PDF
    const branchIdForPDF =
      ctx.sessionBranchId ??
      (allowedRole === "ADMIN" ? (branches[0]?.id ?? null) : null);

    if (!branchIdForPDF) {
      return NextResponse.json(
        {
          error:
            "ADMIN sin sucursal asignada — no se puede determinar los datos para el PDF.",
        },
        { status: 400 },
      );
    }

    let branchPDFData;
    try {
      branchPDFData = await assertBranchConfiguredForPDF(
        branchIdForPDF,
        "reporte",
      );
    } catch (e) {
      if (e instanceof BranchNotConfiguredError) {
        return NextResponse.json(
          { error: e.message, missingFields: e.missingFields },
          { status: 412 },
        );
      }
      throw e;
    }

    const sealSrc = branchPDFData.sealImageUrl
      ? await resolveSealBuffer(branchPDFData.sealImageUrl)
      : null;

    const pdfCols = handler.pdfColumns
      ? columns.filter((c) => handler.pdfColumns!.includes(c.key))
      : columns.slice(0, 6);

    const generatedAt = now.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "America/Merida",
    });

    const buffer = await generatePDF({
      title: handler.title,
      rows,
      columns: pdfCols,
      meta,
      branchPDFData,
      sealSrc,
      generatedAt,
    });

    return buildResponse(buffer, `${filenameBase}.pdf`, "application/pdf");
  })();

  inFlight.set(userId, workPromise);
  try {
    return await workPromise;
  } finally {
    inFlight.delete(userId);
  }
}

function buildResponse(
  buffer: Buffer,
  filename: string,
  contentType: string,
): NextResponse {
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": contentType,
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
