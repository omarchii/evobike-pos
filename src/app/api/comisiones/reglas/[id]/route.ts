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

// ── PATCH — Update commission rule ──────────────────────────────────────────

const updateSchema = z.object({
  commissionType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]).optional(),
  value: z.number().positive("El valor debe ser positivo").optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const rule = await prisma.commissionRule.findUnique({ where: { id } });
  if (!rule) {
    return NextResponse.json(
      { success: false, error: "Regla no encontrada" },
      { status: 404 },
    );
  }
  if (user.role !== "ADMIN" && rule.branchId !== user.branchId) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }
  const branchId = rule.branchId;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON inválido" },
      { status: 400 },
    );
  }

  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { commissionType, value, isActive } = parsed.data;

  // If reactivating, check for duplicate
  if (isActive === true && !rule.isActive) {
    const duplicate = await prisma.commissionRule.findFirst({
      where: {
        branchId,
        role: rule.role,
        modeloId: rule.modeloId,
        isActive: true,
        id: { not: id },
      },
    });

    if (duplicate) {
      return NextResponse.json(
        {
          success: false,
          error: "Ya existe otra regla activa para este rol y modelo.",
        },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.commissionRule.update({
    where: { id },
    data: {
      ...(commissionType !== undefined && { commissionType }),
      ...(value !== undefined && { value }),
      ...(isActive !== undefined && { isActive }),
    },
    include: {
      modelo: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: updated.id,
      role: updated.role,
      commissionType: updated.commissionType,
      value: Number(updated.value),
      modeloId: updated.modeloId,
      modeloNombre: updated.modelo?.nombre ?? null,
      isActive: updated.isActive,
      branchId: updated.branchId,
      createdAt: updated.createdAt.toISOString(),
    },
  });
}

// ── DELETE — Soft-delete (deactivate) commission rule ───────────────────────

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  const { id } = await params;

  const rule = await prisma.commissionRule.findUnique({ where: { id } });
  if (!rule) {
    return NextResponse.json(
      { success: false, error: "Regla no encontrada" },
      { status: 404 },
    );
  }
  if (user.role !== "ADMIN" && rule.branchId !== user.branchId) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  await prisma.commissionRule.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true });
}
