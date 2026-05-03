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
  const modeloId = searchParams.get("modeloId");

  const variantes = await prisma.productVariant.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(modeloId ? { modelo_id: modeloId } : {}),
    },
    include: {
      modelo: { select: { id: true, nombre: true, esBateria: true, isActive: true } },
      color: { select: { id: true, nombre: true, isActive: true } },
      voltaje: { select: { id: true, valor: true, label: true, isActive: true } },
      capacidad: { select: { nombre: true } },
    },
    orderBy: [{ isActive: "desc" }, { sku: "asc" }],
  });
  return NextResponse.json({ success: true, data: variantes });
}

const createSchema = z.object({
  modelo_id: z.string().uuid(),
  color_id: z.string().uuid(),
  voltaje_id: z.string().uuid(),
  sku: z.string().min(1, "SKU requerido"),
  precioPublico: z.number().nonnegative(),
  costo: z.number().nonnegative(),
  precioDistribuidor: z.number().nonnegative().nullable().optional(),
  precioDistribuidorConfirmado: z.boolean().optional(),
  stockMinimo: z.number().int().nonnegative().optional(),
  stockMaximo: z.number().int().nonnegative().optional(),
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

  try {
    const created = await prisma.$transaction(async (tx) => {
      const modelo = await tx.modelo.findUnique({ where: { id: d.modelo_id } });
      if (!modelo || !modelo.isActive) {
        throw new ApiError("Modelo inválido o inactivo", 400);
      }
      const voltaje = await tx.voltaje.findUnique({ where: { id: d.voltaje_id } });
      if (!voltaje || !voltaje.isActive) {
        throw new ApiError("Voltaje inválido o inactivo", 400);
      }
      const modeloColor = await tx.modeloColor.findUnique({
        where: {
          modelo_id_color_id: { modelo_id: d.modelo_id, color_id: d.color_id },
        },
      });
      if (!modeloColor) {
        throw new ApiError(
          "El color seleccionado no está disponible para este modelo",
          400,
        );
      }
      // Variantes de vehículo siempre tienen capacidad_id = null. El unique incluye
      // capacidad_id, y Postgres trata NULL como distinto en UNIQUE, así que no podemos
      // usar findUnique con null; usamos findFirst con el triple + capacidad_id: null.
      const dupTriple = await tx.productVariant.findFirst({
        where: {
          modelo_id: d.modelo_id,
          color_id: d.color_id,
          voltaje_id: d.voltaje_id,
          capacidad_id: null,
        },
      });
      if (dupTriple) {
        throw new ApiError(
          "Ya existe una variante con ese modelo + color + voltaje",
          409,
        );
      }
      const dupSku = await tx.productVariant.findUnique({ where: { sku: d.sku } });
      if (dupSku) {
        throw new ApiError("Ya existe una variante con ese SKU", 409);
      }

      return tx.productVariant.create({
        data: {
          modelo_id: d.modelo_id,
          color_id: d.color_id,
          voltaje_id: d.voltaje_id,
          sku: d.sku,
          precioPublico: d.precioPublico,
          costo: d.costo,
          precioDistribuidor: d.precioDistribuidor ?? null,
          precioDistribuidorConfirmado: d.precioDistribuidorConfirmado ?? false,
          stockMinimo: d.stockMinimo ?? 0,
          stockMaximo: d.stockMaximo ?? 0,
        },
        include: {
          modelo: { select: { id: true, nombre: true } },
          color: { select: { id: true, nombre: true } },
          voltaje: { select: { id: true, valor: true, label: true } },
          capacidad: { select: { nombre: true } },
        },
      });
    });

    return NextResponse.json({ success: true, data: created });
  } catch (e) {
    if (e instanceof ApiError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status });
    }
    throw e;
  }
}

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
