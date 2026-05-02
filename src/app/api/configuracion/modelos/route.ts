import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const CATEGORIAS = [
  "BICICLETA", // deprecated
  "JUGUETE",
  "SCOOTER",
  "BASE",
  "PLUS",
  "CARGA",
  "CARGA_PESADA",
  "TRICICLO",
] as const;

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
  const esBateria = searchParams.get("esBateria");

  const modelos = await prisma.modelo.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(esBateria === "true" ? { esBateria: true } : {}),
      ...(esBateria === "false" ? { esBateria: false } : {}),
    },
    include: {
      coloresDisponibles: { include: { color: true } },
      _count: { select: { configuraciones: true } },
    },
    orderBy: [{ isActive: "desc" }, { nombre: "asc" }],
  });

  return NextResponse.json({ success: true, data: modelos });
}

const createSchema = z.object({
  nombre: z.string().min(1, "Nombre requerido"),
  descripcion: z.string().nullable().optional(),
  requiere_vin: z.boolean().optional(),
  categoria: z.enum(CATEGORIAS).nullable().optional(), // null = modelo de batería
  esBateria: z.boolean().optional(),
  colorIds: z.array(z.string().uuid()).optional(),
  warrantyDays: z.number().int().nonnegative().nullable().optional(),
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

  const dup = await prisma.modelo.findUnique({ where: { nombre: parsed.data.nombre } });
  if (dup) {
    return NextResponse.json(
      { success: false, error: "Ya existe un modelo con ese nombre" },
      { status: 409 },
    );
  }

  const { colorIds, ...rest } = parsed.data;
  const created = await prisma.modelo.create({
    data: {
      ...rest,
      descripcion: rest.descripcion ?? null,
      ...(colorIds && colorIds.length > 0
        ? {
            coloresDisponibles: {
              create: colorIds.map((color_id) => ({ color_id })),
            },
          }
        : {}),
    },
    include: { coloresDisponibles: { include: { color: true } } },
  });

  return NextResponse.json({ success: true, data: created });
}
