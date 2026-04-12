import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import bcrypt from "bcryptjs";

interface SessionUser {
  id: string;
  branchId: string | null;
  role: string;
}

const ROLE_VALUES = ["ADMIN", "MANAGER", "SELLER", "TECHNICIAN"] as const;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  const { searchParams } = req.nextUrl;
  const branchId = searchParams.get("branchId");
  const includeInactive = searchParams.get("includeInactive") === "true";

  const users = await prisma.user.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      ...(includeInactive ? {} : { isActive: true }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      branchId: true,
      branch: { select: { id: true, code: true, name: true } },
    },
    orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ success: true, data: users });
}

const createSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres"),
  role: z.enum(ROLE_VALUES),
  branchId: z.string().uuid("Sucursal inválida"),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user || user.role !== "ADMIN") {
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { name, email, password, role, branchId } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { success: false, error: "Ya existe un usuario con ese email" },
      { status: 409 },
    );
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return NextResponse.json(
      { success: false, error: "Sucursal no encontrada" },
      { status: 404 },
    );
  }

  const hashed = await bcrypt.hash(password, 10);
  const created = await prisma.user.create({
    data: { name, email, password: hashed, role, branchId },
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

  return NextResponse.json({ success: true, data: created });
}
