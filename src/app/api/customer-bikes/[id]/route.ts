import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { isTechnicianPlus, writeCustomerEditLog } from "@/lib/customers/service";

// PATCH /api/customer-bikes/[id]
// Por ahora cubre `odometerKm` (BRIEF §7.4 tab Bicis + modal "Editar odómetro").
// Los cambios de voltaje y batería conservan sus endpoints especializados
// (VoltageChangeLog / BatteryAssignment). TECHNICIAN+ (SELLER no edita taller).
const patchSchema = z
  .object({
    odometerKm: z.number().int().min(0).max(10_000_000).nullable().optional(),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.odometerKm !== undefined, {
    message: "No hay cambios para aplicar",
  });

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  if (!isTechnicianPlus(user.role)) {
    return NextResponse.json(
      { success: false, error: "Requiere rol TECHNICIAN+" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const body: unknown = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { odometerKm, reason } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.customerBike.findUnique({ where: { id } });
      if (!before) return null;

      const after = await tx.customerBike.update({
        where: { id },
        data: { odometerKm: odometerKm ?? null },
      });

      if ((before.odometerKm ?? null) !== (after.odometerKm ?? null) && before.customerId) {
        await writeCustomerEditLog(tx, {
          customerId: before.customerId,
          userId: user.id,
          entries: [
            {
              field: "odometerKm",
              oldValue: before.odometerKm?.toString() ?? null,
              newValue: after.odometerKm?.toString() ?? null,
              customerBikeId: before.id,
            },
          ],
          reason: reason ?? null,
        });
      }

      return after;
    });

    if (!result) {
      return NextResponse.json({ success: false, error: "Bici no encontrada" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ success: false, error: "Bici no encontrada" }, { status: 404 });
    }
    console.error("[api/customer-bikes/[id] PATCH]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
