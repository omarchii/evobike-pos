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

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const { id } = await params;
  const modelo = await prisma.modelo.findUnique({
    where: { id },
    include: { coloresDisponibles: { include: { color: true } } },
  });
  if (!modelo) {
    return NextResponse.json(
      { success: false, error: "Modelo no encontrado" },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: modelo });
}

const patchSchema = z.object({
  nombre: z.string().min(1).optional(),
  descripcion: z.string().nullable().optional(),
  requiere_vin: z.boolean().optional(),
  categoria: z.enum(CATEGORIAS).nullable().optional(), // null = modelo de batería
  esBateria: z.boolean().optional(),
  isActive: z.boolean().optional(),
  colorIds: z.array(z.string().uuid()).optional(),
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

  const existing = await prisma.modelo.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Modelo no encontrado" },
      { status: 404 },
    );
  }

  if (parsed.data.nombre && parsed.data.nombre !== existing.nombre) {
    const dup = await prisma.modelo.findUnique({
      where: { nombre: parsed.data.nombre },
    });
    if (dup) {
      return NextResponse.json(
        { success: false, error: "Ya existe un modelo con ese nombre" },
        { status: 409 },
      );
    }
  }

  const { colorIds, ...rest } = parsed.data;

  const updated = await prisma.$transaction(async (tx) => {
    const data: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
      if (v !== undefined) data[k] = v;
    }
    const m = await tx.modelo.update({ where: { id }, data });

    if (colorIds) {
      await tx.modeloColor.deleteMany({ where: { modelo_id: id } });
      if (colorIds.length > 0) {
        await tx.modeloColor.createMany({
          data: colorIds.map((color_id) => ({ modelo_id: id, color_id })),
        });
      }
    }

    return tx.modelo.findUnique({
      where: { id: m.id },
      include: { coloresDisponibles: { include: { color: true } } },
    });
  });

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

  const existing = await prisma.modelo.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Modelo no encontrado" },
      { status: 404 },
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    await tx.modelo.update({ where: { id }, data: { isActive: false } });
    const affected = await tx.productVariant.updateMany({
      where: { modelo_id: id },
      data: { isActive: false },
    });
    return affected.count;
  });

  return NextResponse.json({
    success: true,
    data: { id, affectedVariants: result },
  });
}
