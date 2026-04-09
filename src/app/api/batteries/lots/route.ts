import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface SessionUser {
  id: string;
  role: string;
  branchId: string;
}

// ── POST /api/batteries/lots — Registrar lote de baterías ──────────────────────

const createLotSchema = z.object({
  productVariantId: z.string().min(1, "Tipo de batería requerido"),
  supplier: z.string().optional(),
  reference: z.string().optional(),
  serials: z
    .array(z.string().min(1, "Los seriales no pueden estar vacíos"))
    .min(1, "Ingresa al menos un número de serie"),
  saleItemId: z.string().optional(), // ítem específico del pedido de origen
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId } = session.user as unknown as SessionUser;

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 }
    );
  }

  const body: unknown = await req.json();
  const parsed = createLotSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { productVariantId, supplier, reference, serials, saleItemId } = parsed.data;

  // Normalizar seriales: trim + deduplicar dentro del input
  const normalizedSerials = serials.map((s) => s.trim()).filter(Boolean);
  const uniqueSerials = Array.from(new Set(normalizedSerials));

  if (uniqueSerials.length !== normalizedSerials.length) {
    const seen = new Set<string>();
    const dupes: string[] = [];
    for (const s of normalizedSerials) {
      if (seen.has(s)) dupes.push(s);
      seen.add(s);
    }
    return NextResponse.json(
      {
        success: false,
        error: `Seriales duplicados en el listado: ${dupes.slice(0, 5).join(", ")}`,
      },
      { status: 400 }
    );
  }

  try {
    // Validar que el ProductVariant existe
    const variant = await prisma.productVariant.findUnique({
      where: { id: productVariantId },
      select: { id: true, sku: true },
    });
    if (!variant) {
      return NextResponse.json(
        { success: false, error: "Tipo de batería no encontrado" },
        { status: 400 }
      );
    }

    // Verificar que ningún serial ya existe en DB (seriales son globalmente únicos)
    const existing = await prisma.battery.findMany({
      where: { serialNumber: { in: uniqueSerials } },
      select: { serialNumber: true },
    });

    if (existing.length > 0) {
      const existingSerials = existing.map((b) => b.serialNumber);
      return NextResponse.json(
        {
          success: false,
          error: `Los siguientes seriales ya están registrados: ${existingSerials.slice(0, 5).join(", ")}${existingSerials.length > 5 ? ` y ${existingSerials.length - 5} más` : ""}`,
        },
        { status: 409 }
      );
    }

    // ── Validación de saleItemId (si viene) ──────────────────────────────────
    let quantityWarning: string | undefined;

    if (saleItemId) {
      const saleItem = await prisma.saleItem.findUnique({
        where: { id: saleItemId },
        select: {
          id: true,
          quantity: true,
          productVariant: {
            select: { modelo_id: true, voltaje_id: true },
          },
        },
      });

      if (!saleItem) {
        return NextResponse.json(
          { success: false, error: "Artículo del pedido no encontrado" },
          { status: 400 }
        );
      }

      if (!saleItem.productVariant) {
        return NextResponse.json(
          {
            success: false,
            error:
              "El artículo del pedido es una línea libre (sin producto del catálogo). No se pueden vincular baterías a líneas libres.",
          },
          { status: 422 }
        );
      }

      const batteryConfig = await prisma.batteryConfiguration.findFirst({
        where: {
          modeloId: saleItem.productVariant.modelo_id,
          voltajeId: saleItem.productVariant.voltaje_id,
        },
        select: { batteryVariantId: true, quantity: true },
      });

      if (!batteryConfig) {
        return NextResponse.json(
          { success: false, error: "El producto del pedido no requiere baterías" },
          { status: 422 }
        );
      }

      // El tipo de batería del lote debe coincidir con el de la configuración
      if (batteryConfig.batteryVariantId !== productVariantId) {
        return NextResponse.json(
          {
            success: false,
            error:
              "El tipo de batería no corresponde al configurado para este modelo/voltaje del pedido",
          },
          { status: 422 }
        );
      }

      // Verificar cantidad ya recibida para este saleItem (WARNING, no bloqueo)
      const alreadyReceived = await prisma.battery.count({
        where: { lot: { saleItemId } },
      });

      const requiredTotal = batteryConfig.quantity * saleItem.quantity;
      if (alreadyReceived + uniqueSerials.length > requiredTotal) {
        quantityWarning = `La cantidad excede la esperada para este artículo (${requiredTotal} baterías). Se registrarán ${uniqueSerials.length} baterías adicionales.`;
      }
    }

    // ── Crear lote + baterías + movimiento de inventario en transacción ───────
    const result = await prisma.$transaction(async (tx) => {
      const lot = await tx.batteryLot.create({
        data: {
          productVariantId,
          branchId,
          userId,
          supplier: supplier ?? null,
          reference: reference ?? null,
          saleItemId: saleItemId ?? null,
        },
      });

      await tx.battery.createMany({
        data: uniqueSerials.map((serialNumber) => ({
          serialNumber,
          lotId: lot.id,
          branchId,
          status: "IN_STOCK" as const,
        })),
      });

      // Fix crítico: registrar movimiento contable de inventario
      await tx.stock.upsert({
        where: {
          productVariantId_branchId: { productVariantId, branchId },
        },
        update: { quantity: { increment: uniqueSerials.length } },
        create: { productVariantId, branchId, quantity: uniqueSerials.length },
      });

      await tx.inventoryMovement.create({
        data: {
          productVariantId,
          branchId,
          userId,
          quantity: uniqueSerials.length,
          type: "PURCHASE_RECEIPT",
          referenceId: reference ?? "BATTERY_LOT",
        },
      });

      return { lotId: lot.id, batteriesCreated: uniqueSerials.length };
    });

    return NextResponse.json({
      success: true,
      data: result,
      ...(quantityWarning ? { warning: quantityWarning } : {}),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al registrar el lote";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// ── GET /api/batteries/lots — Listar lotes de baterías ────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { role, branchId } = session.user as unknown as SessionUser;

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20")));
  const skip = (page - 1) * limit;

  // ADMIN ve todos los lotes; el resto solo los de su sucursal
  const branchFilter = role === "ADMIN" ? {} : { branchId };

  try {
    const [lots, total] = await Promise.all([
      prisma.batteryLot.findMany({
        where: branchFilter,
        orderBy: { receivedAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          supplier: true,
          reference: true,
          receivedAt: true,
          productVariant: {
            select: {
              sku: true,
              modelo: { select: { nombre: true } },
            },
          },
          user: { select: { name: true } },
          _count: { select: { batteries: true } },
          batteries: {
            where: { status: "IN_STOCK" },
            select: { id: true },
          },
        },
      }),
      prisma.batteryLot.count({ where: branchFilter }),
    ]);

    const data = lots.map((lot) => ({
      id: lot.id,
      supplier: lot.supplier,
      reference: lot.reference,
      receivedAt: lot.receivedAt.toISOString(),
      productVariantSku: lot.productVariant.sku,
      batteryTypeName: lot.productVariant.modelo.nombre,
      registeredBy: lot.user.name,
      totalBatteries: lot._count.batteries,
      inStock: lot.batteries.length,
      installed: lot._count.batteries - lot.batteries.length,
    }));

    return NextResponse.json({
      success: true,
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al listar los lotes";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
