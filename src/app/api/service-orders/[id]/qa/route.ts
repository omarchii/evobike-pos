import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";

interface AuthUser {
  id: string;
  branchId: string;
  role: string;
}

const qaSchema = z.object({
  qaPassed: z.literal(true),
  qaNotes: z.string().max(1000).optional(),
});

// POST /api/service-orders/[id]/qa
// Registra el visto bueno de control de calidad. Guard: status=COMPLETED.
//
// Idempotencia: si la orden ya tiene qaPassedAt seteado, retorna 200 con
// el estado actual y el payload entrante es ignorado. El QA es inmutable
// desde esta API; la reversión requiere un endpoint administrativo
// dedicado (Fase 6 de hardening).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const { id: userId, branchId, role } = session.user as unknown as AuthUser;
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 },
    );
  }
  if (role === "SELLER") {
    return NextResponse.json(
      { success: false, error: "Sin permisos para registrar QA" },
      { status: 403 },
    );
  }

  const { id: serviceOrderId } = await params;

  const body: unknown = await req.json();
  const parsed = qaSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  try {
    await requireActiveUser(session);

    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: {
        id: true,
        branchId: true,
        status: true,
        qaPassedAt: true,
        qaPassedByUserId: true,
      },
    });
    if (!order) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }
    if (order.branchId !== branchId) {
      return NextResponse.json(
        { success: false, error: "Sin acceso a esta orden" },
        { status: 403 },
      );
    }
    if (order.status !== "COMPLETED") {
      return NextResponse.json(
        {
          success: false,
          error: "El QA solo se registra cuando la orden está completada",
        },
        { status: 422 },
      );
    }

    // Idempotencia: QA ya registrado → 200 con estado actual, sin mutar.
    if (order.qaPassedAt !== null) {
      return NextResponse.json({
        success: true,
        data: {
          id: order.id,
          qaPassedAt: order.qaPassedAt,
          qaPassedByUserId: order.qaPassedByUserId,
          alreadySet: true,
        },
      });
    }

    const updated = await prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: {
        qaPassedAt: new Date(),
        qaPassedByUserId: userId,
        qaNotes: parsed.data.qaNotes ?? null,
      },
      select: { id: true, qaPassedAt: true, qaPassedByUserId: true },
    });

    return NextResponse.json({
      success: true,
      data: {
        id: updated.id,
        qaPassedAt: updated.qaPassedAt,
        qaPassedByUserId: updated.qaPassedByUserId,
        alreadySet: false,
      },
    });
  } catch (error: unknown) {
    if (error instanceof UserInactiveError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 },
      );
    }
    console.error("[api/service-orders/[id]/qa POST]", error);
    const message =
      error instanceof Error ? error.message : "Error al registrar el QA";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
