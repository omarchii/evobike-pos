import type { BranchedSessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/cotizaciones/[id]/send — DRAFT → SENT
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  void req;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { branchId, role } = session.user as unknown as BranchedSessionUser;
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 }
    );
  }

  const { id } = await params;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    select: { id: true, status: true, branchId: true },
  });

  if (!quotation) {
    return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 });
  }

  if (role !== "ADMIN" && quotation.branchId !== branchId) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  if (quotation.status !== "DRAFT") {
    return NextResponse.json(
      {
        success: false,
        error: `Solo las cotizaciones en DRAFT pueden marcarse como enviadas (estado actual: ${quotation.status}).`,
      },
      { status: 422 }
    );
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: { status: "EN_ESPERA_CLIENTE" },
    select: { id: true, folio: true, status: true, updatedAt: true },
  });

  return NextResponse.json({
    success: true,
    data: { id: updated.id, folio: updated.folio, status: updated.status, updatedAt: updated.updatedAt.toISOString() },
  });
}
