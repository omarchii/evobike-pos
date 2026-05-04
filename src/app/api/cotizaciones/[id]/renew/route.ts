import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBranchedUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { getEffectiveStatus } from "@/lib/quotations";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/cotizaciones/[id]/renew — Q.8 mod4
//
// Crea una nueva cotización en DRAFT con renewedFromId apuntando al origen.
// Solo permitido cuando el origen está EXPIRED (o efectivamente expirado por
// validUntil < now aunque el cron aún no haya corrido — defense-in-depth).
//
// Si el origen aún tiene status no-EXPIRED por cron-no-corrido-aún, este
// endpoint también lo materializa (status=EXPIRED + expiredAt=now) en la
// misma transaction para mantener invariante: cualquier renewedFrom debe
// estar EXPIRED.
//
// Re-lee precios actuales del catálogo (no congela los del original).
// El descuento fijo NO se hereda (requeriría nueva autorización).
export async function POST(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const guard = requireBranchedUser(session);
  if (!guard.ok) return guard.response;
  const { id: userId, branchId } = guard.user;

  const { id } = await params;

  const source = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: {
        select: {
          productVariantId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          isFreeForm: true,
        },
      },
    },
  });

  if (!source) {
    return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 });
  }

  const effectiveStatus = getEffectiveStatus({
    status: source.status,
    validUntil: source.validUntil,
  });

  if (effectiveStatus !== "EXPIRED") {
    return NextResponse.json(
      {
        success: false,
        error: `Solo se pueden renovar cotizaciones expiradas (estado actual: ${source.status}).`,
      },
      { status: 422 }
    );
  }

  // Re-leer precios actuales para items de catálogo.
  const catalogIds = source.items
    .filter((i) => !i.isFreeForm && i.productVariantId)
    .map((i) => i.productVariantId as string);

  const currentPriceMap = new Map<string, number>();
  if (catalogIds.length > 0) {
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: catalogIds } },
      select: { id: true, precioPublico: true },
    });
    for (const v of variants) {
      currentPriceMap.set(v.id, Number(v.precioPublico));
    }
  }

  try {
    const newQuotation = await prisma.$transaction(async (tx) => {
      // Defense-in-depth: materializar EXPIRED en el origen si el cron aún no lo hizo.
      if (source.status !== "EXPIRED") {
        await tx.quotation.update({
          where: { id: source.id },
          data: { status: "EXPIRED", expiredAt: new Date() },
        });
      }

      const updatedBranch = await tx.branch.update({
        where: { id: branchId },
        data: { lastQuotationFolioNumber: { increment: 1 } },
        select: { lastQuotationFolioNumber: true, code: true },
      });
      const folio = `${updatedBranch.code}-COT-${String(updatedBranch.lastQuotationFolioNumber).padStart(4, "0")}`;

      const validUntil = new Date();
      validUntil.setDate(validUntil.getDate() + 7);

      const itemsData = source.items.map((item) => {
        if (item.isFreeForm) {
          const lineTotal = Number(item.unitPrice) * item.quantity;
          return {
            isFreeForm: true,
            productVariantId: null,
            description: item.description,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
            lineTotal,
          };
        }
        const currentPrice = currentPriceMap.get(item.productVariantId!);
        const unitPrice = currentPrice ?? Number(item.unitPrice);
        const lineTotal = unitPrice * item.quantity;
        return {
          isFreeForm: false,
          productVariantId: item.productVariantId,
          description: item.description,
          quantity: item.quantity,
          unitPrice,
          lineTotal,
        };
      });

      const subtotal = itemsData.reduce((acc, i) => acc + i.lineTotal, 0);
      const discountAmount = 0;
      const total = subtotal - discountAmount;

      return tx.quotation.create({
        data: {
          folio,
          branchId,
          userId,
          customerId: source.customerId,
          anonymousCustomerName: source.anonymousCustomerName,
          anonymousCustomerPhone: source.anonymousCustomerPhone,
          validUntil,
          subtotal,
          discountAmount,
          total,
          internalNote: source.internalNote,
          renewedFromId: source.id,
          items: { create: itemsData },
        },
        include: { items: true },
      });
    });

    return NextResponse.json({
      success: true,
      data: {
        id: newQuotation.id,
        folio: newQuotation.folio,
        status: newQuotation.status,
        renewedFromId: newQuotation.renewedFromId,
        validUntil: newQuotation.validUntil.toISOString(),
        subtotal: Number(newQuotation.subtotal),
        discountAmount: Number(newQuotation.discountAmount),
        total: Number(newQuotation.total),
        items: newQuotation.items.map((i) => ({
          id: i.id,
          productVariantId: i.productVariantId,
          description: i.description,
          quantity: i.quantity,
          unitPrice: Number(i.unitPrice),
          lineTotal: Number(i.lineTotal),
          isFreeForm: i.isFreeForm,
        })),
        createdAt: newQuotation.createdAt.toISOString(),
      },
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error al renovar la cotización";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
