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

function canManage(user: SessionUser | undefined): boolean {
  return !!user && (user.role === "ADMIN" || user.role === "MANAGER");
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  basePrice: z.number().nonnegative().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!canManage(user)) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const existing = await prisma.serviceCatalog.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Servicio no encontrado" },
      { status: 404 },
    );
  }
  if (user!.role !== "ADMIN" && existing.branchId !== user!.branchId) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON inválido" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const updated = await prisma.serviceCatalog.update({
    where: { id },
    data: parsed.data,
    include: { branch: { select: { id: true, code: true, name: true } } },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: updated.id,
      name: updated.name,
      basePrice: Number(updated.basePrice),
      isActive: updated.isActive,
      branchId: updated.branchId,
      branchCode: updated.branch?.code ?? null,
      branchName: updated.branch?.name ?? null,
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!canManage(user)) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  const { id } = await params;
  const existing = await prisma.serviceCatalog.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Servicio no encontrado" },
      { status: 404 },
    );
  }
  if (user!.role !== "ADMIN" && existing.branchId !== user!.branchId) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  await prisma.serviceCatalog.update({
    where: { id },
    data: { isActive: false },
  });
  return NextResponse.json({ success: true });
}
