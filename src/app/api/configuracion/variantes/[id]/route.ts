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
  const variant = await prisma.productVariant.findUnique({
    where: { id },
    include: {
      modelo: { select: { id: true, nombre: true } },
      color: { select: { id: true, nombre: true } },
      voltaje: { select: { id: true, valor: true, label: true } },
    },
  });
  if (!variant) {
    return NextResponse.json(
      { success: false, error: "Variante no encontrada" },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: variant });
}

// Group A: always editable
const patchSchema = z.object({
  // Group A
  precioPublico: z.number().nonnegative().optional(),
  costo: z.number().nonnegative().optional(),
  precioDistribuidor: z.number().nonnegative().nullable().optional(),
  precioDistribuidorConfirmado: z.boolean().optional(),
  stockMinimo: z.number().int().nonnegative().optional(),
  stockMaximo: z.number().int().nonnegative().optional(),
  isActive: z.boolean().optional(),
  // Group B: only if no history
  sku: z.string().min(1).optional(),
  modelo_id: z.string().uuid().optional(),
  color_id: z.string().uuid().optional(),
  voltaje_id: z.string().uuid().optional(),
});

const GROUP_B_FIELDS = ["sku", "modelo_id", "color_id", "voltaje_id"] as const;

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

  const d = parsed.data;
  const touchesGroupB = GROUP_B_FIELDS.some((k) => d[k] !== undefined);

  const existing = await prisma.productVariant.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Variante no encontrada" },
      { status: 404 },
    );
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      if (touchesGroupB) {
        const [saleCount, movCount, stockRow] = await Promise.all([
          tx.saleItem.count({ where: { productVariantId: id } }),
          tx.inventoryMovement.count({ where: { productVariantId: id } }),
          tx.stock.findFirst({
            where: { productVariantId: id, quantity: { gt: 0 } },
          }),
        ]);
        if (saleCount > 0 || movCount > 0 || stockRow) {
          throw new HistoryError();
        }

        if (d.modelo_id !== undefined || d.color_id !== undefined) {
          const modeloId = d.modelo_id ?? existing.modelo_id;
          const colorId = d.color_id ?? existing.color_id;
          const mc = await tx.modeloColor.findUnique({
            where: { modelo_id_color_id: { modelo_id: modeloId, color_id: colorId } },
          });
          if (!mc) {
            throw new ApiError(
              "El color no está disponible para este modelo",
              400,
            );
          }
        }

        // Endpoint CRUD solo maneja variantes de vehículo (capacidad_id = null).
        // findFirst porque Postgres trata NULL como distinto en UNIQUE.
        const dup = await tx.productVariant.findFirst({
          where: {
            modelo_id: d.modelo_id ?? existing.modelo_id,
            color_id: d.color_id ?? existing.color_id,
            voltaje_id: d.voltaje_id ?? existing.voltaje_id,
            capacidad_id: null,
          },
        });
        if (dup && dup.id !== id) {
          throw new ApiError(
            "Ya existe una variante con ese modelo + color + voltaje",
            409,
          );
        }

        if (d.sku !== undefined && d.sku !== existing.sku) {
          const dupSku = await tx.productVariant.findUnique({ where: { sku: d.sku } });
          if (dupSku && dupSku.id !== id) {
            throw new ApiError("Ya existe una variante con ese SKU", 409);
          }
        }
      }

      const data: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(d)) {
        if (v !== undefined) data[k] = v;
      }

      return tx.productVariant.update({
        where: { id },
        data,
        include: {
          modelo: { select: { id: true, nombre: true } },
          color: { select: { id: true, nombre: true } },
          voltaje: { select: { id: true, valor: true, label: true } },
        },
      });
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (e) {
    if (e instanceof HistoryError) {
      return NextResponse.json(
        {
          success: false,
          error: "Esta variante tiene historial; desactívala y crea una nueva.",
          hasHistory: true,
        },
        { status: 409 },
      );
    }
    if (e instanceof ApiError) {
      return NextResponse.json({ success: false, error: e.message }, { status: e.status });
    }
    throw e;
  }
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
  const existing = await prisma.productVariant.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Variante no encontrada" },
      { status: 404 },
    );
  }

  await prisma.productVariant.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true, data: { id, isActive: false } });
}

class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}
class HistoryError extends Error {}
