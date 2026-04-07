import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface SessionUser {
  id: string;
  branchId: string;
}

const receiptSchema = z.object({
  items: z
    .array(
      z.object({
        productVariantId: z.string().min(1),
        quantity: z.number().int().positive(),
        cost: z.number().nonnegative(),
      })
    )
    .min(1, "No hay productos en esta recepción"),
  reference: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId } = session.user as unknown as SessionUser;

  const body: unknown = await req.json();
  const parsed = receiptSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { items, reference } = parsed.data;

  try {
    // Pre-cargar info de variantes para clasificar (fuera de tx para eficiencia)
    const variantIds = items.map((i) => i.productVariantId);
    const variantInfoList = await prisma.productVariant.findMany({
      where: { id: { in: variantIds } },
      select: {
        id: true,
        modelo_id: true,
        voltaje_id: true,
        modelo: { select: { requiere_vin: true } },
      },
    });

    // Para variantes con requiere_vin=true, verificar si tienen BatteryConfiguration
    const vinRequiredIds = variantInfoList
      .filter((v) => v.modelo.requiere_vin)
      .map((v) => v.id);

    type AssembleableMap = Map<string, boolean>;
    const assembleableMap: AssembleableMap = new Map();

    if (vinRequiredIds.length > 0) {
      const batteryConfigs = await prisma.batteryConfiguration.findMany({
        where: {
          OR: variantInfoList
            .filter((v) => v.modelo.requiere_vin)
            .map((v) => ({ modeloId: v.modelo_id, voltajeId: v.voltaje_id })),
        },
        select: { modeloId: true, voltajeId: true },
      });

      // Construir set de combinaciones ensamblables
      const assembleableKeys = new Set(
        batteryConfigs.map((c) => `${c.modeloId}:${c.voltajeId}`)
      );

      for (const v of variantInfoList) {
        if (v.modelo.requiere_vin) {
          assembleableMap.set(v.id, assembleableKeys.has(`${v.modelo_id}:${v.voltaje_id}`));
        }
      }
    }


    await prisma.$transaction(async (tx) => {
      for (const item of items) {
        if (item.quantity <= 0) continue;

        await tx.stock.upsert({
          where: {
            productVariantId_branchId: {
              productVariantId: item.productVariantId,
              branchId,
            },
          },
          update: { quantity: { increment: item.quantity } },
          create: {
            productVariantId: item.productVariantId,
            branchId,
            quantity: item.quantity,
          },
        });

        await tx.productVariant.update({
          where: { id: item.productVariantId },
          data: { costo: item.cost },
        });

        await tx.inventoryMovement.create({
          data: {
            productVariantId: item.productVariantId,
            branchId,
            userId,
            quantity: item.quantity,
            type: "PURCHASE_RECEIPT",
            referenceId: reference || "RECEIPT_BATCH",
          },
        });

        // Crear AssemblyOrders para vehículos ensamblables
        if (assembleableMap.get(item.productVariantId) === true) {
          const ordersData = Array.from({ length: item.quantity }, () => ({
            productVariantId: item.productVariantId,
            branchId,
            status: "PENDING" as const,
            receiptReference: reference ?? null,
          }));

          await tx.assemblyOrder.createMany({ data: ordersData });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la mercancía";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
