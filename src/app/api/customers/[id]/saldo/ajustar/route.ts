// POST /api/customers/[id]/saldo/ajustar — Pack D.4.a.
// Ajuste MANAGER+ que ACREDITA saldo a favor (positivo). Sin movimiento de caja —
// es corrección administrativa (gift, error de captura, conciliación, etc.).
// Origen: AJUSTE_MANAGER. Vence en 365d (CREDIT_VALIDITY_DAYS del helper).
//
// Ajuste negativo (deducción) NO se implementa aquí: requiere diseño aparte
// porque rechargeCustomerCredit rechaza monto <= 0 y deducir saldo significaría
// FIFO consume sin CashTransaction real. Defer hasta requerimiento concreto.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { requireBranchedUser } from "@/lib/auth-guards";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { prisma } from "@/lib/prisma";
import { rechargeCustomerCredit } from "@/lib/customer-credit";

const schema = z.object({
  amount: z.number().positive("Monto debe ser positivo"),
  reason: z.string().min(3, "Motivo es obligatorio (min 3 caracteres)").max(500),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const guard = requireBranchedUser(session);
  if (!guard.ok) return guard.response;
  const { id: userId, role } = guard.user;

  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { success: false, error: "Solo MANAGER+ puede ajustar saldo a favor." },
      { status: 403 },
    );
  }

  const { id: customerId } = await params;
  const body: unknown = await req.json();
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  try {
    await requireActiveUser(session);

    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      select: { id: true },
    });
    if (!customer) {
      return NextResponse.json(
        { success: false, error: "Cliente no encontrado" },
        { status: 404 },
      );
    }

    const credit = await prisma.$transaction((tx) =>
      rechargeCustomerCredit(
        customerId,
        parsed.data.amount,
        {
          tipo: "AJUSTE_MANAGER",
          id: userId,
          notes: parsed.data.reason,
        },
        tx,
      ),
    );

    return NextResponse.json({
      success: true,
      creditId: credit.id,
      newBalance: Number(credit.balance),
    });
  } catch (error: unknown) {
    if (error instanceof UserInactiveError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    console.error("[api/customers/[id]/saldo/ajustar POST]", error);
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
