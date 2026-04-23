import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { isManagerPlus } from "@/lib/customers/service";

const UNMERGE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

// POST /api/customers/[sourceId]/unmerge — revertir soft-merge dentro de la ventana.
// BRIEF §6.1.
export async function POST(
  _req: NextRequest,
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

  const { id: sourceId } = await params;

  type UnmergeOutcome =
    | { ok: true; sourceId: string; targetId: string }
    | { ok: false; error: "NOT_FOUND" | "NOT_MERGED" | "EXPIRED" };

  try {
    const result: UnmergeOutcome = await prisma.$transaction(async (tx) => {
      const source = await tx.customer.findUnique({ where: { id: sourceId } });
      if (!source) return { ok: false, error: "NOT_FOUND" };
      if (!source.mergedIntoId || !source.mergedAt) {
        return { ok: false, error: "NOT_MERGED" };
      }
      const ageMs = Date.now() - source.mergedAt.getTime();
      if (ageMs > UNMERGE_WINDOW_MS) {
        return { ok: false, error: "EXPIRED" };
      }

      const targetId = source.mergedIntoId;
      // Reversa basada en los registros ya reasignados + los logs con field='__merge__'.
      // Estrategia simple: los logs de audit con field='__merge__' nos permiten
      // identificar la fusión. Reasignamos de vuelta las FKs cuya audit reference
      // incluye este source.
      //
      // Enfoque pragmático: reasignamos las filas de los modelos relevantes cuyo
      // customerId === target Y que nacieron antes de `mergedAt` (ventana segura
      // para no robar filas que se crearon post-merge directamente contra el
      // target legítimo).
      const threshold = source.mergedAt;

      // Customer-level reversions usan createdAt donde exista; Sales, Quotation,
      // ServiceOrder y CashTransaction tienen createdAt. CustomerBike también.
      await tx.sale.updateMany({
        where: { customerId: targetId, createdAt: { lte: threshold } },
        data: { customerId: sourceId },
      });
      await tx.serviceOrder.updateMany({
        where: { customerId: targetId, createdAt: { lte: threshold } },
        data: { customerId: sourceId },
      });
      await tx.quotation.updateMany({
        where: { customerId: targetId, createdAt: { lte: threshold } },
        data: { customerId: sourceId },
      });
      await tx.cashTransaction.updateMany({
        where: { customerId: targetId, createdAt: { lte: threshold } },
        data: { customerId: sourceId },
      });
      await tx.customerBike.updateMany({
        where: { customerId: targetId, createdAt: { lte: threshold } },
        data: { customerId: sourceId },
      });
      await tx.customerNote.updateMany({
        where: { customerId: targetId, createdAt: { lte: threshold } },
        data: { customerId: sourceId },
      });
      await tx.customerEditLog.updateMany({
        where: { customerId: targetId, createdAt: { lte: threshold } },
        data: { customerId: sourceId },
      });

      await tx.customer.update({
        where: { id: sourceId },
        data: { mergedIntoId: null, mergedAt: null },
      });

      await tx.customerEditLog.create({
        data: {
          customerId: sourceId,
          userId: user.id,
          field: "__unmerge__",
          oldValue: targetId,
          newValue: sourceId,
          reason: "Undo merge (BRIEF §6.1)",
        },
      });

      return { ok: true, sourceId, targetId };
    });

    if (!result.ok) {
      const map = {
        NOT_FOUND: { code: 404, msg: "Cliente no encontrado" },
        NOT_MERGED: { code: 409, msg: "El cliente no está fusionado" },
        EXPIRED: { code: 409, msg: "La ventana de 30 días para deshacer fusión venció" },
      } as const;
      const e = map[result.error];
      return NextResponse.json({ success: false, error: e.msg }, { status: e.code });
    }

    return NextResponse.json({
      success: true,
      data: { sourceId: result.sourceId, targetId: result.targetId },
    });
  } catch (err: unknown) {
    console.error("[api/customers/[id]/unmerge POST]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
