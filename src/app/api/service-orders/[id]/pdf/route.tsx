import type { SessionUser } from "@/lib/auth-types";
import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import {
  assertBranchConfiguredForPDF,
  BranchNotConfiguredError,
} from "@/lib/branch";
import { resolveSealBuffer } from "@/lib/pdf/components/document-footer";
import {
  calcSubtotalFromTotal,
  totalEnLetra as totalEnLetraFn,
} from "@/lib/pdf/helpers";
import { ComprobanteServiceOrderPDF } from "@/lib/pdf/templates/comprobante-service-order-pdf";
import type { PDFItem } from "@/lib/pdf/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/service-orders/[id]/pdf
//
// Gate de disponibilidad: status === "DELIVERED" || (status === "COMPLETED" && prepaid).
// El segundo caso cubre el recibo de pre-pago: un cliente paga lunes y retira
// miércoles — debe poder imprimir comprobante del pago antes de la entrega física.
//
// Stateless: el PDF refleja el estado actual de la orden al momento de la consulta.
// Descargar pre-entrega y re-descargar post-entrega produce dos PDFs distintos
// (el segundo sin badge PENDIENTE). Comportamiento esperado — sin versionado
// ni cacheo por intención.
export async function GET(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  // 1. Auth
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const {
    id: userId,
    role,
    branchId: sessionBranchId,
  } = session.user as unknown as SessionUser;

  // Técnicos no descargan PDF (roadmap E.4: MANAGER/SELLER/ADMIN).
  if (role !== "MANAGER" && role !== "SELLER" && role !== "ADMIN") {
    return NextResponse.json({ error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await params;

  // 2. Fetch ServiceOrder con relaciones
  const order = await prisma.serviceOrder.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, phone: true } },
      customerBike: true,
      user: { select: { name: true } },
      items: {
        include: {
          productVariant: {
            include: {
              modelo: true,
              color: true,
            },
          },
        },
      },
      sale: { select: { createdAt: true } },
    },
  });

  if (!order) {
    return NextResponse.json({ error: "Orden no encontrada" }, { status: 404 });
  }

  // 3. Scope check. ADMIN sin restricción; MANAGER a su sucursal del JWT;
  //    SELLER solo sus órdenes (mismo patrón que /api/pedidos/[id]/pdf).
  if (role === "MANAGER" && order.branchId !== sessionBranchId) {
    return NextResponse.json({ error: "Sin acceso a esta orden" }, { status: 403 });
  }
  if (role === "SELLER" && order.userId !== userId) {
    return NextResponse.json({ error: "Sin acceso a esta orden" }, { status: 403 });
  }

  // 4. Gate de disponibilidad
  const isDelivered = order.status === "DELIVERED";
  const isPrepaidPending = order.status === "COMPLETED" && order.prepaid;
  if (!isDelivered && !isPrepaidPending) {
    return NextResponse.json(
      { error: "La orden aún no tiene comprobante disponible" },
      { status: 422 },
    );
  }
  const deliveryState: "delivered" | "pending" = isDelivered
    ? "delivered"
    : "pending";

  // 5. Validar configuración de sucursal
  let branch;
  try {
    branch = await assertBranchConfiguredForPDF(order.branchId, "servicio");
  } catch (e) {
    if (e instanceof BranchNotConfiguredError) {
      return NextResponse.json(
        { error: e.message, missingFields: e.missingFields },
        { status: 412 },
      );
    }
    throw e;
  }

  // 6. Mapear items → PDFItem[]
  const items: PDFItem[] = order.items.map((item) => {
    let description: string;
    if (item.productVariantId !== null && item.productVariant !== null) {
      description = `${item.productVariant.modelo.nombre} - ${item.productVariant.color.nombre}`;
    } else {
      description = item.description || "Servicio / mano de obra";
    }

    const unitPrice = item.price.toNumber();
    const qty = item.quantity;
    const lineTotal = unitPrice * qty;

    return {
      description,
      unit: "Pieza",
      unitPrice,
      quantity: qty,
      discount: 0,
      total: lineTotal,
    };
  });

  // 7. Totales — excludeFromRevenue deriva del invariante type: PAID → false,
  //    WARRANTY/COURTESY/POLICY_MAINTENANCE → true.
  const excludeFromRevenue = order.type !== "PAID";
  const total = order.total.toNumber();
  const { subtotal, iva } = calcSubtotalFromTotal(total);
  const totalEnLetra = excludeFromRevenue ? "" : totalEnLetraFn(total);

  // 8. Fecha de expedición: pre-pago → fecha del pago; delivered → fecha
  //    de creación de la Sale (proxy de la entrega, ya que no hay deliveredAt).
  const fecha = order.prepaid
    ? (order.prepaidAt ?? order.createdAt)
    : (order.sale?.createdAt ?? order.createdAt);

  // 9. Vehículo (nullable — órdenes legacy sin customerBike vinculado)
  const vehiculo = order.customerBike
    ? {
        modelo:
          [order.customerBike.brand, order.customerBike.model]
            .filter((p): p is string => Boolean(p && p.trim()))
            .join(" ") ||
          order.bikeInfo ||
          "—",
        color: order.customerBike.color ?? "—",
        voltaje: order.customerBike.voltaje
          ? `${order.customerBike.voltaje}V`
          : "—",
        vin: order.customerBike.serialNumber,
      }
    : null;

  // 10. Sello
  const sealSrc = branch.sealImageUrl
    ? await resolveSealBuffer(branch.sealImageUrl)
    : null;

  // 11. Render
  const buffer = await renderToBuffer(
    <ComprobanteServiceOrderPDF
      data={{
        branch,
        folio: order.folio,
        type: order.type,
        deliveryState,
        fecha,
        cliente: {
          nombre: order.customer.name,
          telefono: order.customer.phone,
        },
        vehiculo,
        diagnosis: order.diagnosis,
        items,
        subtotal,
        iva,
        total,
        totalEnLetra,
        excludeFromRevenue,
        prepaid: order.prepaid,
        prepaidAt: order.prepaidAt,
        prepaidAmount: order.prepaidAmount?.toNumber() ?? null,
        prepaidMethod: order.prepaidMethod,
        elaboradoPor: order.user.name ?? "—",
        sealImagePath: branch.sealImageUrl,
      }}
      sealSrc={sealSrc}
    />,
  );

  const filename =
    deliveryState === "pending"
      ? `Recibo-prepago-${order.folio}.pdf`
      : `Comprobante-${order.folio}.pdf`;

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${filename}"`,
    },
  });
}
