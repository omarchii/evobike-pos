import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

const PIN_ELIGIBLE_ROLES = ["MANAGER", "ADMIN"] as const;

const schema = z.object({
  pin: z
    .string()
    .regex(/^\d{4,6}$/, "El PIN debe ser de 4 a 6 dígitos numéricos"),
});

export async function POST(
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

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true, role: true },
  });
  if (!target) {
    return NextResponse.json(
      { success: false, error: "Usuario no encontrado" },
      { status: 404 },
    );
  }
  if (!PIN_ELIGIBLE_ROLES.includes(target.role as "MANAGER" | "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "Solo gerentes y administradores pueden tener PIN" },
      { status: 400 },
    );
  }

  const hashed = await bcrypt.hash(parsed.data.pin, 10);
  await prisma.user.update({ where: { id }, data: { pin: hashed } });

  return NextResponse.json({ success: true });
}

export async function DELETE(
  _req: NextRequest,
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

  const target = await prisma.user.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!target) {
    return NextResponse.json(
      { success: false, error: "Usuario no encontrado" },
      { status: 404 },
    );
  }

  await prisma.user.update({ where: { id }, data: { pin: null } });

  return NextResponse.json({ success: true });
}
