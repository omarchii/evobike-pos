import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

// GET /api/cotizaciones/search?folio=LEO-COT-0001
// Búsqueda cross-branch por folio (para flujo de conversión en sucursal distinta).
// Cualquier usuario autenticado puede buscar en cualquier sucursal.
export async function GET(req: NextRequest): Promise<NextResponse> {
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

  const { searchParams } = new URL(req.url);
  const folio = searchParams.get("folio")?.trim();

  if (!folio) {
    return NextResponse.json(
      { success: false, error: "El parámetro 'folio' es requerido" },
      { status: 400 }
    );
  }

  const results = await prisma.quotation.findMany({
    where: {
      folio: { contains: folio, mode: "insensitive" },
    },
    select: {
      id: true,
      folio: true,
      status: true,
      validUntil: true,
      subtotal: true,
      discountAmount: true,
      total: true,
      customerId: true,
      anonymousCustomerName: true,
      anonymousCustomerPhone: true,
      convertedToSaleId: true,
      cancelReason: true,
      createdAt: true,
      branch: { select: { id: true, code: true, name: true } },
      user: { select: { id: true, name: true } },
      customer: { select: { id: true, name: true, phone: true } },
      items: {
        select: {
          id: true,
          productVariantId: true,
          description: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
          isFreeForm: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  const data = results.map((q) => ({
    id: q.id,
    folio: q.folio,
    status: q.status,
    validUntil: q.validUntil.toISOString(),
    subtotal: Number(q.subtotal),
    discountAmount: Number(q.discountAmount),
    total: Number(q.total),
    customerId: q.customerId,
    anonymousCustomerName: q.anonymousCustomerName,
    anonymousCustomerPhone: q.anonymousCustomerPhone,
    convertedToSaleId: q.convertedToSaleId,
    cancelReason: q.cancelReason,
    createdAt: q.createdAt.toISOString(),
    branch: q.branch,
    user: q.user,
    customer: q.customer,
    items: q.items.map((i) => ({
      id: i.id,
      productVariantId: i.productVariantId,
      description: i.description,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.lineTotal),
      isFreeForm: i.isFreeForm,
    })),
  }));

  return NextResponse.json({ success: true, data });
}
