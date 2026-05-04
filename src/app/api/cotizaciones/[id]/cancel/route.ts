import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBranchedUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { CANCELLABLE_STATUSES } from "@/lib/quotations";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const cancelSchema = z.object({
  reason: z.string().min(1, "El motivo de cancelación es requerido"),
});

// POST /api/cotizaciones/[id]/cancel — {DRAFT,EN_ESPERA_CLIENTE,EN_ESPERA_FABRICA,ACEPTADA} → RECHAZADA
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const guard = requireBranchedUser(session);
  if (!guard.ok) return guard.response;
  const { id: userId, branchId, role } = guard.user;

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

  if (!CANCELLABLE_STATUSES.includes(quotation.status)) {
    return NextResponse.json(
      {
        success: false,
        error: `No se puede rechazar una cotización en estado ${quotation.status}. Solo se permiten ${CANCELLABLE_STATUSES.join(", ")}.`,
      },
      { status: 422 }
    );
  }

  const updated = await prisma.quotation.update({
    where: { id },
    data: {
      status: "RECHAZADA",
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
