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
      }
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "No se pudo registrar la mercancía";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
