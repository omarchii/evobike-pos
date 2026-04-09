import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

type DriftDirection = "higher" | "lower" | "none";

interface PriceCheckItem {
  itemId: string;
  description: string;
  productVariantId: string;
  frozenPrice: number;
  currentPrice: number;
  drift: DriftDirection;
}

// GET /api/cotizaciones/[id]/price-check
// Compara precios congelados vs catálogo actual. No bloquea; solo informa.
export async function GET(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  void req;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { branchId } = session.user as unknown as SessionUser;
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 }
    );
  }

  const { id } = await params;

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: {
        where: { isFreeForm: false },
        select: {
          id: true,
          productVariantId: true,
          description: true,
          unitPrice: true,
        },
      },
    },
  });

  if (!quotation) {
    return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 });
  }

  // Solo ítems de catálogo con productVariantId
  const catalogItems = quotation.items.filter(
    (i): i is typeof i & { productVariantId: string } => i.productVariantId !== null
  );

  if (catalogItems.length === 0) {
    return NextResponse.json({ success: true, data: [] });
  }

  const variantIds = catalogItems.map((i) => i.productVariantId);
  const currentVariants = await prisma.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: { id: true, precioPublico: true },
  });

  const currentPriceMap = new Map(
    currentVariants.map((v) => [v.id, Number(v.precioPublico)])
  );

  const result: PriceCheckItem[] = catalogItems.map((item) => {
    const frozenPrice = Number(item.unitPrice);
    const currentPrice = currentPriceMap.get(item.productVariantId) ?? frozenPrice;

    let drift: DriftDirection = "none";
    if (currentPrice > frozenPrice) drift = "higher";
    else if (currentPrice < frozenPrice) drift = "lower";

    return {
      itemId: item.id,
      description: item.description,
      productVariantId: item.productVariantId,
      frozenPrice,
      currentPrice,
      drift,
    };
  });

  return NextResponse.json({ success: true, data: result });
}
