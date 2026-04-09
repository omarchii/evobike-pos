import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

const cancelSchema = z.object({
  reason: z.string().min(1, "El motivo de cancelación es requerido"),
});

const CANCELLABLE_STATUSES = ["DRAFT", "SENT"] as const;

// POST /api/cotizaciones/[id]/cancel — DRAFT/SENT → CANCELLED
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId, role } = session.user as unknown as SessionUser;
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 }
    );
  }

  const { id } = await params;

  const body: unknown = await req.json();
  const parsed = cancelSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: msg }, { status: 422 });
  }

  const { reason } = parsed.data;

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

  if (!CANCELLABLE_STATUSES.includes(quotation.status as (typeof CANCELLABLE_STATUSES)[number])) {
    return NextResponse.json(
      {
        success: false,
        error: `No se puede cancelar una cotización en estado ${quotation.status}. Solo se permiten DRAFT y SENT.`,
      },
      { status: 422 }
    );
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      status: "CANCELLED",
      cancelledAt: new Date(),
      cancelledByUserId: userId,
      cancelReason: reason,
    },
    select: { id: true, folio: true, status: true, cancelledAt: true, cancelReason: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: updated.id,
      folio: updated.folio,
      status: updated.status,
      cancelledAt: updated.cancelledAt?.toISOString() ?? null,
      cancelReason: updated.cancelReason,
    },
  });
}
