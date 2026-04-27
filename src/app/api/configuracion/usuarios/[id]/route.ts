import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const ROLE_VALUES = ["ADMIN", "MANAGER", "SELLER", "TECHNICIAN"] as const;

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  email: z.string().email("Email inválido").optional(),
  role: z.enum(ROLE_VALUES).optional(),
  branchId: z.string().uuid().optional(),
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  const { id } = await params;

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

  const existing = await prisma.user.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  if (existing.id === user.id && parsed.data.isActive === false) {
    return NextResponse.json(
      { success: false, error: "No puedes desactivarte a ti mismo" },
      { status: 400 },
    );
  }

  if (parsed.data.email && parsed.data.email !== existing.email) {
    const dup = await prisma.user.findUnique({ where: { email: parsed.data.email } });
    if (dup) {
      return NextResponse.json(
        { success: false, error: "Ya existe un usuario con ese email" },
        { status: 409 },
      );
    }
  }

  if (parsed.data.branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: parsed.data.branchId } });
    if (!branch) {
      return NextResponse.json(
        { success: false, error: "Sucursal no encontrada" },
        { status: 404 },
      );
    }
  }

  const updated = await prisma.user.update({
    where: { id },
    data: parsed.data,
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      branchId: true,
      branch: { select: { id: true, code: true, name: true } },
    },
  });

  return NextResponse.json({ success: true, data: updated });
}
