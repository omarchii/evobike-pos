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

const patchSchema = z.object({
  sku: z.string().min(1).optional(),
  precioPublico: z.number().nonnegative().optional(),
  costo: z.number().nonnegative().optional(),
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

  const existing = await prisma.productVariant.findUnique({
    where: { id },
    include: { modelo: true },
  });
  if (!existing || !existing.modelo.esBateria) {
    return NextResponse.json(
      { success: false, error: "Variante de batería no encontrada" },
      { status: 404 },
    );
  }

  if (parsed.data.sku && parsed.data.sku !== existing.sku) {
    const dup = await prisma.productVariant.findUnique({ where: { sku: parsed.data.sku } });
    if (dup && dup.id !== id) {
      return NextResponse.json(
        { success: false, error: "Ya existe una variante con ese SKU" },
        { status: 409 },
      );
    }
  }

  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v !== undefined) data[k] = v;
  }

  const updated = await prisma.productVariant.update({
    where: { id },
    data,
    include: {
      voltaje: { select: { id: true, valor: true, label: true } },
      capacidad: { select: { id: true, valorAh: true, nombre: true } },
      stocks: { select: { quantity: true } },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      ...updated,
      stockTotal: updated.stocks.reduce((s, x) => s + x.quantity, 0),
    },
  });
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

  const existing = await prisma.productVariant.findUnique({
    where: { id },
    include: { modelo: true },
  });
  if (!existing || !existing.modelo.esBateria) {
    return NextResponse.json(
      { success: false, error: "Variante de batería no encontrada" },
      { status: 404 },
    );
  }

  await prisma.productVariant.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true, data: { id } });
}
