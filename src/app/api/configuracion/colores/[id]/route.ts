import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface SessionUser {
  id: string;
  branchId: string | null;
  role: string;
}

function requireAdmin(user: SessionUser | undefined): NextResponse | null {
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }
  return null;
}

const patchSchema = z.object({
  nombre: z.string().min(1).optional(),
  isGeneric: z.boolean().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  const denied = requireAdmin(user);
  if (denied) return denied;

  const { id } = await params;
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const existing = await prisma.color.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Color no encontrado" },
      { status: 404 },
    );
  }

  if (parsed.data.nombre && parsed.data.nombre !== existing.nombre) {
    const dup = await prisma.color.findUnique({ where: { nombre: parsed.data.nombre } });
    if (dup) {
      return NextResponse.json(
        { success: false, error: "Ya existe un color con ese nombre" },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.color.update({ where: { id }, data: parsed.data });
  return NextResponse.json({ success: true, data: updated });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  const denied = requireAdmin(user);
  if (denied) return denied;

  const { id } = await params;
  const existing = await prisma.color.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Color no encontrado" },
      { status: 404 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.color.update({ where: { id }, data: { isActive: false } });
    const affected = await tx.productVariant.updateMany({
      where: { color_id: id },
      data: { isActive: false },
    });
    return affected.count;
  });

  return NextResponse.json({
    success: true,
    data: { id, affectedVariants: result },
  });
}
