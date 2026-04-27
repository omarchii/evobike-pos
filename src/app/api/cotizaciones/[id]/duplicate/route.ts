import type { BranchedSessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// POST /api/cotizaciones/[id]/duplicate
// Clona la cotización en DRAFT con precios re-leídos del catálogo actual.
// Disponible desde cualquier estado (incluso EXPIRED, CANCELLED, CONVERTED).
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  void req;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId } = session.user as unknown as BranchedSessionUser;
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 }
    );
  }

  const { id } = await params;

  // ── Cargar cotización con ítems ────────────────────────────────────────────
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

  // ── Re-leer precios actuales del catálogo para ítems de catálogo ───────────
  const catalogIds = source.items
    .filter((i) => !i.isFreeForm && i.productVariantId)
    .map((i) => i.productVariantId as string);

  type CurrentPrice = { id: string; precio: number };
  const currentPriceMap = new Map<string, CurrentPrice>();

  if (catalogIds.length > 0) {
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: catalogIds } },
      select: { id: true, precioPublico: true },
    });
    for (const v of variants) {
      currentPriceMap.set(v.id, { id: v.id, precio: Number(v.precioPublico) });
    }
  }

  // ── Crear nueva cotización en $transaction ─────────────────────────────────
  try {
    const newQuotation = await prisma.$transaction(async (tx) => {
      // Folio atómico en la sucursal del usuario (nueva cotización en su sucursal)
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
        // Precio actualizado del catálogo (o precio original si el producto ya no existe)
        const current = currentPriceMap.get(item.productVariantId!);
        const unitPrice = current?.precio ?? Number(item.unitPrice);
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
      // Duplicado no arrastra descuento fijo (requeriría nueva autorización)
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
    const msg = error instanceof Error ? error.message : "Error al duplicar la cotización";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
