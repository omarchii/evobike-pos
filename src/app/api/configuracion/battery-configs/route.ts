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
  const modeloId = searchParams.get("modeloId");

  const configs = await prisma.batteryConfiguration.findMany({
    where: modeloId ? { modeloId } : {},
    include: {
      modelo: { select: { id: true, nombre: true } },
      voltaje: { select: { id: true, valor: true, label: true } },
      batteryVariant: {
        select: {
          id: true,
          sku: true,
          modelo: { select: { id: true, nombre: true } },
        },
      },
    },
    orderBy: [{ modelo: { nombre: "asc" } }, { voltaje: { valor: "asc" } }],
  });
  return NextResponse.json({ success: true, data: configs });
}

const createSchema = z.object({
  modeloId: z.string().min(1),
  voltajeId: z.string().min(1),
  batteryVariantId: z.string().min(1),
  quantity: z.number().int().positive(),
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

  const d = parsed.data;
  const batteryVariant = await prisma.productVariant.findUnique({
    where: { id: d.batteryVariantId },
    include: { modelo: true },
  });
  if (!batteryVariant) {
    return NextResponse.json(
      { success: false, error: "Batería no encontrada" },
      { status: 400 },
    );
  }
  if (!batteryVariant.modelo.esBateria) {
    return NextResponse.json(
      { success: false, error: "La variante seleccionada no es una batería" },
      { status: 400 },
    );
  }

  const dup = await prisma.batteryConfiguration.findUnique({
    where: {
      modeloId_voltajeId_batteryVariantId: {
        modeloId: d.modeloId,
        voltajeId: d.voltajeId,
        batteryVariantId: d.batteryVariantId,
      },
    },
  });
  if (dup) {
    return NextResponse.json(
      { success: false, error: "Ya existe esa configuración de batería" },
      { status: 409 },
    );
  }

  const created = await prisma.batteryConfiguration.create({
    data: d,
    include: {
      modelo: { select: { id: true, nombre: true } },
      voltaje: { select: { id: true, valor: true, label: true } },
      batteryVariant: {
        select: { id: true, sku: true, modelo: { select: { id: true, nombre: true } } },
      },
    },
  });
  return NextResponse.json({ success: true, data: created });
}
