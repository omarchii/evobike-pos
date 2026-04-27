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
  quantity: z.number().int().positive().optional(),
  batteryVariantId: z.string().min(1).optional(),
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

  const existing = await prisma.batteryConfiguration.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Configuración no encontrada" },
      { status: 404 },
    );
  }

  if (parsed.data.batteryVariantId) {
    const bv = await prisma.productVariant.findUnique({
      where: { id: parsed.data.batteryVariantId },
      include: { modelo: true },
    });
    if (!bv || !bv.modelo.esBateria) {
      return NextResponse.json(
        { success: false, error: "La variante seleccionada no es una batería" },
        { status: 400 },
      );
    }
    if (bv.voltaje_id !== existing.voltajeId) {
      return NextResponse.json(
        { success: false, error: "El voltaje de la batería no coincide con la configuración" },
        { status: 400 },
      );
    }
    const dup = await prisma.batteryConfiguration.findUnique({
      where: {
        modeloId_voltajeId_batteryVariantId: {
          modeloId: existing.modeloId,
          voltajeId: existing.voltajeId,
          batteryVariantId: parsed.data.batteryVariantId,
        },
      },
    });
    if (dup && dup.id !== id) {
      return NextResponse.json(
        { success: false, error: "Ya existe esa configuración" },
        { status: 409 },
      );
    }
  }

  const updated = await prisma.batteryConfiguration.update({
    where: { id },
    data: parsed.data,
    include: {
      modelo: { select: { id: true, nombre: true } },
      voltaje: { select: { id: true, valor: true, label: true } },
      batteryVariant: {
        select: {
          id: true,
          sku: true,
          modelo: { select: { id: true, nombre: true } },
          capacidad: { select: { id: true, valorAh: true, nombre: true } },
        },
      },
    },
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
  const existing = await prisma.batteryConfiguration.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Configuración no encontrada" },
      { status: 404 },
    );
  }
  await prisma.batteryConfiguration.delete({ where: { id } });
  return NextResponse.json({ success: true, data: { id } });
}
