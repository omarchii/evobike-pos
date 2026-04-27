import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

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
  valor: z.number().int().positive().optional(),
  label: z.string().min(1).optional(),
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

  const existing = await prisma.voltaje.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Voltaje no encontrado" },
      { status: 404 },
    );
  }

  if (parsed.data.valor !== undefined && parsed.data.valor !== existing.valor) {
    const dup = await prisma.voltaje.findUnique({ where: { valor: parsed.data.valor } });
    if (dup) {
      return NextResponse.json(
        { success: false, error: "Ya existe ese voltaje" },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.voltaje.update({ where: { id }, data: parsed.data });
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
  const existing = await prisma.voltaje.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Voltaje no encontrado" },
      { status: 404 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.voltaje.update({ where: { id }, data: { isActive: false } });
    const affected = await tx.productVariant.updateMany({
      where: { voltaje_id: id },
      data: { isActive: false },
    });
    return affected.count;
  });

  return NextResponse.json({
    success: true,
    data: { id, affectedVariants: result },
  });
}
