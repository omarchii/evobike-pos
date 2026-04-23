import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { resolveOperationalBranchId } from "@/lib/branch-scope";
import type { SessionUser } from "@/lib/auth-types";

const assignSchema = z.object({
  assignedTechId: z.string().uuid().nullable(),
});

// PATCH /api/service-orders/[id]/assign
// Asigna o reasigna técnico. Reglas de rol (decisión #1 BRIEF):
//   MANAGER / ADMIN  → libre en órdenes de su sucursal.
//   TECHNICIAN       → self-assign sobre órdenes libres; soltar solo
//                      órdenes actualmente suyas.
//   SELLER           → sin permisos.
//
// `assignedTechId: null` desasigna.
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const userId = user.id;
  const role = user.role;
  const branchId = await resolveOperationalBranchId({ user });
  if (branchId === "__none__") {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 },
    );
  }

  const { id: serviceOrderId } = await params;

  const body: unknown = await req.json();
  const parsed = assignSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const { assignedTechId } = parsed.data;

  try {
    await requireActiveUser(session);

    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: { id: true, branchId: true, status: true, assignedTechId: true },
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
    if (order.status === "DELIVERED" || order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "No se puede modificar una orden cerrada/cancelada" },
        { status: 422 },
      );
    }

    const isManager = role === "MANAGER" || role === "ADMIN";
    const isTechnician = role === "TECHNICIAN";

    if (!isManager && !isTechnician) {
      return NextResponse.json(
        { success: false, error: "Sin permisos para asignar técnicos" },
        { status: 403 },
      );
    }

    if (isTechnician) {
      if (assignedTechId === null) {
        // Soltar: solo si la orden es actualmente suya.
        if (order.assignedTechId !== userId) {
          return NextResponse.json(
            { success: false, error: "Solo puedes soltar órdenes asignadas a ti" },
            { status: 403 },
          );
        }
      } else {
        // Tomar: solo self-assign sobre órdenes libres.
        if (assignedTechId !== userId) {
          return NextResponse.json(
            { success: false, error: "Un técnico solo puede tomarse a sí mismo" },
            { status: 403 },
          );
        }
        if (order.assignedTechId !== null) {
          return NextResponse.json(
            { success: false, error: "La orden ya tiene técnico asignado" },
            { status: 409 },
          );
        }
      }
    }

    if (assignedTechId !== null) {
      const tech = await prisma.user.findUnique({
        where: { id: assignedTechId },
        select: { id: true, role: true, branchId: true, isActive: true },
      });
      if (!tech || !tech.isActive) {
        return NextResponse.json(
          { success: false, error: "El técnico no existe o está inactivo" },
          { status: 422 },
        );
      }
      if (tech.role !== "TECHNICIAN") {
        return NextResponse.json(
          { success: false, error: "El usuario asignado no es técnico" },
          { status: 422 },
        );
      }
      if (tech.branchId !== branchId) {
        return NextResponse.json(
          { success: false, error: "El técnico es de otra sucursal" },
          { status: 422 },
        );
      }
    }

    const updated = await prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: { assignedTechId },
      select: { id: true, assignedTechId: true },
    });

    console.log(
      "[workshop-mobile]",
      JSON.stringify({
        userId,
        role,
        orderId: serviceOrderId,
        action: "assign",
        mobileClient: req.headers.get("x-client") === "mobile-dashboard",
        ts: new Date().toISOString(),
      }),
    );

    return NextResponse.json({
      success: true,
      data: { id: updated.id, assignedTechId: updated.assignedTechId },
    });
  } catch (error: unknown) {
    if (error instanceof UserInactiveError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 },
      );
    }
    console.error("[api/service-orders/[id]/assign PATCH]", error);
    const message =
      error instanceof Error ? error.message : "Error al asignar técnico";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
