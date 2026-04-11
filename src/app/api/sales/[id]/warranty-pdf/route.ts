import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

// GET /api/sales/[id]/warranty-pdf
// Returns sale warranty data. 409 if warrantyDocReady = false (reensamble still pending).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { branchId, role } = session.user as unknown as SessionUser;
  const { id: saleId } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    select: {
      id: true,
      folio: true,
      branchId: true,
      warrantyDocReady: true,
      createdAt: true,
      customer: { select: { id: true, name: true, phone: true } },
      items: {
        select: {
          id: true,
          productVariantId: true,
          description: true,
          quantity: true,
          price: true,
        },
      },
      assemblyOrders: {
        where: { status: "PENDING" },
        select: { id: true, status: true },
      },
    },
  });

  if (!sale) {
    return NextResponse.json({ success: false, error: "Venta no encontrada" }, { status: 404 });
  }

  if (role !== "ADMIN" && sale.branchId !== branchId) {
    return NextResponse.json({ success: false, error: "Sin acceso a esta venta" }, { status: 403 });
  }

  if (!sale.warrantyDocReady) {
    return NextResponse.json(
      {
        success: false,
        error: "Póliza pendiente de reensamble",
        pendingAssemblyOrders: sale.assemblyOrders.length,
      },
      { status: 409 }
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      folio: sale.folio,
      customerId: sale.customer?.id ?? null,
      customerName: sale.customer?.name ?? null,
      customerPhone: sale.customer?.phone ?? null,
      createdAt: sale.createdAt.toISOString(),
      items: sale.items,
    },
  });
}
