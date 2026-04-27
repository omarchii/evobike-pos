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

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const includeInactive = searchParams.get("includeInactive") === "true";

  const colores = await prisma.color.findMany({
    where: includeInactive ? {} : { isActive: true },
    orderBy: [{ isActive: "desc" }, { nombre: "asc" }],
  });
  return NextResponse.json({ success: true, data: colores });
}

const createSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  isGeneric: z.boolean().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  const denied = requireAdmin(user);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const dup = await prisma.color.findUnique({ where: { nombre: parsed.data.nombre } });
  if (dup) {
    return NextResponse.json(
      { success: false, error: "Ya existe un color con ese nombre" },
      { status: 409 },
    );
  }

  const created = await prisma.color.create({ data: parsed.data });
  return NextResponse.json({ success: true, data: created });
}
