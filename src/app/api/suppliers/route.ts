import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

function isManagerOrAdmin(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

const optionalTrim = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v && v.length > 0 ? v : null));

const createSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido"),
  rfc: optionalTrim,
  contacto: optionalTrim,
  telefono: optionalTrim,
  email: z
    .union([z.string().trim().email("Email inválido"), z.literal("")])
    .optional()
    .transform((v) => (v && v.length > 0 ? v : null)),
  direccion: optionalTrim,
  notas: optionalTrim,
});

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user || !isManagerOrAdmin(user.role)) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  const { searchParams } = req.nextUrl;
  const includeInactive = searchParams.get("includeInactive") === "true";
  const q = searchParams.get("q")?.trim();

  const suppliers = await prisma.supplier.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(q
        ? {
            OR: [
              { nombre: { contains: q, mode: "insensitive" as const } },
              { rfc: { contains: q, mode: "insensitive" as const } },
            ],
          }
        : {}),
    },
    orderBy: [{ isActive: "desc" }, { nombre: "asc" }],
  });

  return NextResponse.json({ success: true, data: suppliers });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user || !isManagerOrAdmin(user.role)) {
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

  const created = await prisma.supplier.create({ data: parsed.data });

  return NextResponse.json({ success: true, data: created });
}
