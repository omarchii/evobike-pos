import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { isManagerPlus } from "@/lib/customers/service";

const patchSchema = z.object({ pinned: z.boolean().optional() });

// PATCH /api/customers/[id]/notes/[noteId] — toggle pin (MANAGER+).
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
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
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Cuerpo inválido" }, { status: 400 });
  }

  const { id: customerId, noteId } = await params;

  try {
    const updated = await prisma.customerNote.update({
      where: { id: noteId, customerId },
      data: { pinned: parsed.data.pinned },
    });
    return NextResponse.json({ success: true, data: updated });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ success: false, error: "Nota no encontrada" }, { status: 404 });
    }
    console.error("[api/customers/[id]/notes/[noteId] PATCH]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}

// DELETE /api/customers/[id]/notes/[noteId] — autor o MANAGER+.
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; noteId: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: customerId, noteId } = await params;

  const note = await prisma.customerNote.findUnique({ where: { id: noteId } });
  if (!note || note.customerId !== customerId) {
    return NextResponse.json({ success: false, error: "Nota no encontrada" }, { status: 404 });
  }

  const isAuthor = note.authorId === user.id;
  if (!isAuthor && !isManagerPlus(user.role)) {
    return NextResponse.json(
      { success: false, error: "Solo el autor o MANAGER+ puede eliminar" },
      { status: 403 },
    );
  }

  await prisma.customerNote.delete({ where: { id: noteId } });
  return NextResponse.json({ success: true });
}
