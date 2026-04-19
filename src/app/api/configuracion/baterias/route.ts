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

// Endpoint específico para variantes de batería. A diferencia de /variantes,
// este se encarga de (voltaje, capacidad, color=N/A, modelo=BATERIA EVOBIKE)
// y valida que no exista ya la combinación V×Ah.
const createSchema = z.object({
  voltaje_id: z.string().uuid(),
  capacidad_id: z.string().uuid(),
  sku: z.string().min(1, "SKU requerido"),
  precioPublico: z.number().nonnegative(),
  costo: z.number().nonnegative(),
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
      const voltaje = await tx.voltaje.findUnique({ where: { id: d.voltaje_id } });
      if (!voltaje) throw new ApiError("Voltaje inválido", 400);

      const capacidad = await tx.capacidad.findUnique({ where: { id: d.capacidad_id } });
      if (!capacidad) throw new ApiError("Capacidad inválida", 400);

      const bateriaModelo = await tx.modelo.findFirst({ where: { esBateria: true, isActive: true } });
      if (!bateriaModelo) {
        throw new ApiError(
          "No hay modelo de batería activo. Ejecuta el seed primero.",
          500,
        );
      }

      // Color N/A (genérico) — las baterías no tienen color en el catálogo real.
      const colorNA = await tx.color.findFirst({ where: { nombre: "N/A" } });
      if (!colorNA) throw new ApiError("Color N/A no existe", 500);

      const dup = await tx.productVariant.findFirst({
        where: {
          modelo_id: bateriaModelo.id,
          voltaje_id: d.voltaje_id,
          capacidad_id: d.capacidad_id,
        },
      });
      if (dup) {
        throw new ApiError(
          `Ya existe una variante ${voltaje.label} ${capacidad.nombre}`,
          409,
        );
      }

      const dupSku = await tx.productVariant.findUnique({ where: { sku: d.sku } });
      if (dupSku) throw new ApiError("Ya existe una variante con ese SKU", 409);

      return tx.productVariant.create({
        data: {
          modelo_id: bateriaModelo.id,
          color_id: colorNA.id,
          voltaje_id: d.voltaje_id,
          capacidad_id: d.capacidad_id,
          sku: d.sku,
          precioPublico: d.precioPublico,
          costo: d.costo,
          stockMinimo: d.stockMinimo ?? 0,
          stockMaximo: d.stockMaximo ?? 0,
        },
        include: {
          voltaje: { select: { id: true, valor: true, label: true } },
          capacidad: { select: { id: true, valorAh: true, nombre: true } },
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
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}
