import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";

// Sin auth. Retorna datos sanitizados para el portal público del cliente.
// Alcance estricto (confirmado en plan): estado + total + approvals + metadata
// de sucursal. Sin diagnosis, sin qaNotes, sin ítems crudos, sin precios por
// línea, sin teléfono real del cliente.
export const dynamic = "force-dynamic";

interface PublicApproval {
  id: string;
  itemsJson: unknown; // snapshot [{nombre, cantidad, precio, subtotal}]
  totalEstimado: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: Date;
  respondedAt: Date | null;
}

interface PublicServiceOrderView {
  folio: string;
  status: string;
  subStatus: string | null;
  type: string;
  bikeInfo: string | null;
  total: number;
  qaPassed: boolean;
  createdAt: Date;
  updatedAt: Date;
  customerFirstName: string;
  branch: {
    colonia: string | null;
    city: string | null;
    phoneMasked: string | null;
  };
  approvals: PublicApproval[];
}

function maskPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  if (digits.length < 4) return null;
  // Preserva los últimos 4 dígitos; resto → *.
  const tail = digits.slice(-4);
  const masked = "*".repeat(digits.length - 4) + tail;
  // Formato ligero "55** **67 89" → lo dejamos contiguo para no asumir layout.
  return masked;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ token: string }> },
): Promise<NextResponse> {
  const { token } = await params;

  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { publicToken: token },
      select: {
        folio: true,
        status: true,
        subStatus: true,
        type: true,
        bikeInfo: true,
        total: true,
        qaPassedAt: true,
        publicTokenEnabled: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { name: true } },
        branch: {
          select: {
            colonia: true,
            city: true,
            phone: true,
          },
        },
        approvals: {
          select: {
            id: true,
            itemsJson: true,
            totalEstimado: true,
            status: true,
            requestedAt: true,
            respondedAt: true,
          },
          orderBy: { requestedAt: "desc" },
        },
      },
    });

    if (!order || !order.publicTokenEnabled) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 },
      );
    }

    const firstName = order.customer?.name
      ? order.customer.name.trim().split(/\s+/)[0] ?? ""
      : "";

    const data: PublicServiceOrderView = {
      folio: order.folio,
      status: order.status,
      subStatus: order.subStatus,
      type: order.type,
      bikeInfo: order.bikeInfo,
      total: Number(order.total),
      qaPassed: order.qaPassedAt !== null,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customerFirstName: firstName,
      branch: {
        colonia: order.branch.colonia,
        city: order.branch.city,
        phoneMasked: maskPhone(order.branch.phone),
      },
      approvals: order.approvals.map((a) => ({
        id: a.id,
        itemsJson: a.itemsJson as Prisma.JsonValue,
        totalEstimado: Number(a.totalEstimado),
        status: a.status,
        requestedAt: a.requestedAt,
        respondedAt: a.respondedAt,
      })),
    };

    return NextResponse.json({ success: true, data });
  } catch (error: unknown) {
    console.error("[api/service-orders/public/[token] GET]", error);
    return NextResponse.json(
      { success: false, error: "Error al consultar la orden" },
      { status: 500 },
    );
  }
}
