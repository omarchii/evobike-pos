import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBranchedUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
  getActiveSession,
  assertSessionFreshOrThrow,
  OrphanedCashSessionError,
} from "@/lib/cash-register";

const balanceSchema = z.object({
  amount: z.number().positive("Monto inválido"),
  method: z.enum(["CASH", "CARD", "TRANSFER"]),
});

// POST /api/customers/[id]/balance — agregar saldo a favor al cliente
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const guard = requireBranchedUser(session);
  if (!guard.ok) return guard.response;
  const { id: userId, branchId } = guard.user;
  const { id: customerId } = await params;

  const body: unknown = await req.json();
  const parsed = balanceSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { amount, method } = parsed.data;

  try {
    await requireActiveUser(session);

    const activeSession = await getActiveSession(branchId);
    if (!activeSession) {
      return NextResponse.json(
        { success: false, error: "Caja cerrada. Abre la caja para recibir dinero." },
        { status: 409 }
      );
    }
    assertSessionFreshOrThrow(activeSession);

    await prisma.$transaction(async (tx) => {
      await tx.cashTransaction.create({
        data: {
          sessionId: activeSession.id,
          userId,
          customerId,
          type: "PAYMENT_IN",
          method,
          amount,
        },
      });

      await tx.customer.update({
        where: { id: customerId },
        data: { balance: { increment: amount } },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof UserInactiveError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof OrphanedCashSessionError) {
      return NextResponse.json(
        {
          success: false,
          error: "La caja del día anterior debe cerrarse antes de registrar nuevas operaciones.",
        },
        { status: 409 },
      );
    }
    console.error("[api/customers/[id]/balance POST]", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
