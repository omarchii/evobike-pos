import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { buildPortalWhatsappHref, parsePhotoUrls } from "@/lib/workshop";

// Sin auth. Retorna datos sanitizados para el portal público del cliente.
// Alcance estricto (confirmado en plan): estado + total + approvals + metadata
// de sucursal. Sin diagnosis, sin qaNotes, sin ítems crudos, sin precios por
// línea, sin teléfono raw (el número vive solo server-side; se expone como
// whatsappHref pre-formateado).
export const dynamic = "force-dynamic";

interface PublicApproval {
  id: string;
  itemsJson: unknown; // snapshot [{nombre, cantidad, precio, subtotal}]
  totalEstimado: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedAt: Date;
  respondedAt: Date | null;
  expiresAt: Date;
}

interface PublicServiceOrderView {
  folio: string;
  status: string;
  subStatus: string | null;
  type: string;
  bikeInfo: string | null;
  total: number;
  qaPassed: boolean;
  prepaid: boolean;
  prepaidAt: Date | null;
  prepaidAmount: number | null;
  photoUrls: string[];
  createdAt: Date;
  updatedAt: Date;
  customerFirstName: string;
  branch: {
    name: string;
    colonia: string | null;
    city: string | null;
    whatsappHref: string | null;
  };
  approvals: PublicApproval[];
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
        prepaid: true,
        prepaidAt: true,
        prepaidAmount: true,
        photoUrls: true,
        createdAt: true,
        updatedAt: true,
        customer: { select: { name: true } },
        branch: {
          select: {
            name: true,
            colonia: true,
            city: true,
            phone: true,
            whatsappTemplateTaller: true,
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
            expiresAt: true,
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
      prepaid: order.prepaid,
      prepaidAt: order.prepaidAt,
      prepaidAmount:
        order.prepaidAmount !== null ? Number(order.prepaidAmount) : null,
      photoUrls: parsePhotoUrls(order.photoUrls),
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      customerFirstName: firstName,
      branch: {
        name: order.branch.name,
        colonia: order.branch.colonia,
        city: order.branch.city,
        whatsappHref: buildPortalWhatsappHref({
          branchPhone: order.branch.phone,
          template: order.branch.whatsappTemplateTaller,
          folio: order.folio,
        }),
      },
      approvals: order.approvals.map((a) => ({
        id: a.id,
        itemsJson: a.itemsJson as Prisma.JsonValue,
        totalEstimado: Number(a.totalEstimado),
        status: a.status,
        requestedAt: a.requestedAt,
        respondedAt: a.respondedAt,
        expiresAt: a.expiresAt,
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
