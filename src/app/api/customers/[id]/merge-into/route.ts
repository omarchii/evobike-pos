import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { isManagerPlus } from "@/lib/customers/service";

// POST /api/customers/[sourceId]/merge-into
// Body: { targetId: string, overrides?: Record<string, unknown> }
// MANAGER+. Rechaza cadenas (BRIEF §6.1).
const bodySchema = z.object({
  targetId: z.string().min(1),
  overrides: z.record(z.string(), z.unknown()).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  if (!isManagerPlus(user.role)) {
    return NextResponse.json({ success: false, error: "Requiere rol MANAGER+" }, { status: 403 });
  }

  const body: unknown = await req.json();
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "targetId requerido" }, { status: 400 });
  }

  const { id: sourceId } = await params;
  const { targetId } = parsed.data;

  if (sourceId === targetId) {
    return NextResponse.json(
      { success: false, error: "El origen y el destino no pueden ser el mismo" },
      { status: 400 },
    );
  }

  type MergeOutcome =
    | { ok: true; targetId: string }
    | {
        ok: false;
        error:
          | "NOT_FOUND"
          | "SOURCE_ALREADY_MERGED"
          | "TARGET_ALREADY_MERGED"
          | "SOURCE_IS_TARGET_OF_ANOTHER";
      };

  try {
    const result: MergeOutcome = await prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.customer.findUnique({ where: { id: sourceId } }),
        tx.customer.findUnique({ where: { id: targetId } }),
      ]);
      if (!source || !target) return { ok: false, error: "NOT_FOUND" };

      // Antichain §6.1.
      if (source.mergedIntoId) return { ok: false, error: "SOURCE_ALREADY_MERGED" };
      if (target.mergedIntoId) return { ok: false, error: "TARGET_ALREADY_MERGED" };

      const sourceIsATarget = await tx.customer.findFirst({
        where: { mergedIntoId: sourceId },
        select: { id: true },
      });
      if (sourceIsATarget) return { ok: false, error: "SOURCE_IS_TARGET_OF_ANOTHER" };

      // Reasignar FKs. Todos los modelos que referencian Customer.
      await tx.sale.updateMany({ where: { customerId: sourceId }, data: { customerId: targetId } });
      await tx.serviceOrder.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });
      await tx.quotation.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });
      await tx.cashTransaction.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });
      await tx.customerBike.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });
      await tx.customerNote.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });
      await tx.customerEditLog.updateMany({
        where: { customerId: sourceId },
        data: { customerId: targetId },
      });

      // Sumar saldos al target.
      const sourceBalance = source.balance;
      if (Number(sourceBalance) > 0) {
        await tx.customer.update({
          where: { id: targetId },
          data: { balance: { increment: sourceBalance } },
        });
      }

      // Marcar source como mergeado.
      await tx.customer.update({
        where: { id: sourceId },
        data: {
          mergedIntoId: targetId,
          mergedAt: new Date(),
          // Dejar balance en 0 para que no cuente doble en reportes agregados.
          balance: 0,
        },
      });

      await tx.customerEditLog.create({
        data: {
          customerId: targetId,
          userId: user.id,
          field: "__merge__",
          oldValue: sourceId,
          newValue: targetId,
          reason: "Soft-merge (BRIEF §6.1)",
        },
      });

      return { ok: true, targetId: target.id };
    });

    if (!result.ok) {
      const map = {
        NOT_FOUND: { code: 404, msg: "Cliente origen o destino no encontrado" },
        SOURCE_ALREADY_MERGED: { code: 409, msg: "El cliente origen ya fue fusionado" },
        TARGET_ALREADY_MERGED: { code: 409, msg: "El cliente destino ya fue fusionado" },
        SOURCE_IS_TARGET_OF_ANOTHER: {
          code: 409,
          msg: "El origen ya recibió una fusión previa; no puede ser fusionado hacia otro",
        },
      } as const;
      const e = map[result.error];
      return NextResponse.json({ success: false, error: e.msg }, { status: e.code });
    }

    return NextResponse.json({ success: true, data: { targetId: result.targetId } });
  } catch (err: unknown) {
    console.error("[api/customers/[id]/merge-into POST]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
