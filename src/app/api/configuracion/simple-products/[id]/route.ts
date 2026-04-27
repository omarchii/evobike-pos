import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeModeloAplicable } from "@/lib/products";
import { z } from "zod";

const CATEGORIAS = ["ACCESORIO", "CARGADOR", "REFACCION", "BATERIA_STANDALONE"] as const;

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
  const item = await prisma.simpleProduct.findUnique({ where: { id } });
  if (!item) {
    return NextResponse.json(
      { success: false, error: "Producto no encontrado" },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: item });
}

const patchSchema = z.object({
  codigo: z.string().min(1).optional(),
  nombre: z.string().min(1).optional(),
  descripcion: z.string().nullable().optional(),
  categoria: z.enum(CATEGORIAS).optional(),
  modeloAplicable: z.string().nullable().optional(),
  precioPublico: z.number().nonnegative().optional(),
  precioMayorista: z.number().nonnegative().optional(),
  stockMinimo: z.number().int().nonnegative().optional(),
  stockMaximo: z.number().int().nonnegative().optional(),
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

  const existing = await prisma.simpleProduct.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Producto no encontrado" },
      { status: 404 },
    );
  }

  if (parsed.data.codigo && parsed.data.codigo !== existing.codigo) {
    const dup = await prisma.simpleProduct.findUnique({
      where: { codigo: parsed.data.codigo },
    });
    if (dup) {
      return NextResponse.json(
        { success: false, error: "Ya existe un producto con ese código" },
        { status: 409 },
      );
    }
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    if (k === "modeloAplicable") {
      data[k] = normalizeModeloAplicable(v as string | null);
    } else {
      data[k] = v;
    }
  }

  const updated = await prisma.simpleProduct.update({ where: { id }, data });
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
  const existing = await prisma.simpleProduct.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Producto no encontrado" },
      { status: 404 },
    );
  }
  await prisma.simpleProduct.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true, data: { id, isActive: false } });
}
