import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { CashRegisterSession } from "@prisma/client";
import { z } from "zod";

interface SessionUser {
  id: string;
  branchId: string;
}

type SerializedCashSession = Omit<CashRegisterSession, "openingAmt" | "closingAmt"> & {
  openingAmt: number;
  closingAmt: number | null;
};

function serializeSession(s: CashRegisterSession): SerializedCashSession {
  return {
    ...s,
    openingAmt: Number(s.openingAmt),
    closingAmt: s.closingAmt ? Number(s.closingAmt) : null,
  };
}

// GET /api/cash-register/session — sesión activa del usuario
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId } = session.user as unknown as SessionUser;

  try {
    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: { userId, branchId, status: "OPEN" },
    });

    return NextResponse.json({
      success: true,
      data: activeSession ? serializeSession(activeSession) : null,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const openSchema = z.object({
  openingAmt: z.number().nonnegative(),
});

// POST /api/cash-register/session — abrir turno
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId } = session.user as unknown as SessionUser;

  const body: unknown = await req.json();
  const parsed = openSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Monto inválido" }, { status: 400 });
  }

  try {
    const existing = await prisma.cashRegisterSession.findFirst({
      where: { userId, branchId, status: "OPEN" },
    });

    if (existing) {
      return NextResponse.json(
        { success: false, error: "Ya existe una sesión abierta para este usuario." },
        { status: 409 }
      );
    }

    const newSession = await prisma.cashRegisterSession.create({
      data: { userId, branchId, openingAmt: parsed.data.openingAmt, status: "OPEN" },
    });

    return NextResponse.json({ success: true, data: serializeSession(newSession) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const closeSchema = z.object({
  closingAmt: z.number().nonnegative(),
});

// PATCH /api/cash-register/session — cerrar turno
export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId } = session.user as unknown as SessionUser;

  const body: unknown = await req.json();
  const parsed = closeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Monto inválido" }, { status: 400 });
  }

  try {
    const activeSession = await prisma.cashRegisterSession.findFirst({
      where: { userId, branchId, status: "OPEN" },
    });

    if (!activeSession) {
      return NextResponse.json({ success: false, error: "No hay ninguna sesión abierta." }, { status: 404 });
    }

    const closed = await prisma.cashRegisterSession.update({
      where: { id: activeSession.id },
      data: { closedAt: new Date(), closingAmt: parsed.data.closingAmt, status: "CLOSED" },
    });

    return NextResponse.json({ success: true, data: serializeSession(closed) });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
