import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import {
  assertBranchConfiguredForPDF,
  BranchNotConfiguredError,
} from "@/lib/branch";
import { resolveSealBuffer } from "@/lib/pdf/components/document-footer";
import {
  formatDate,
  totalEnLetra as totalEnLetraFn,
  calcSubtotalFromTotal,
} from "@/lib/pdf/helpers";
import { TicketPDF } from "@/lib/pdf/templates/ticket-pdf";
import type { TicketPDFData } from "@/lib/pdf/templates/ticket-pdf";
import type { PDFItem } from "@/lib/pdf/types";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta de débito/crédito",
  TRANSFER: "Transferencia bancaria",
  CREDIT_BALANCE: "Saldo a favor",
  ATRATO: "Financiamiento Atrato",
};

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  // 1. Auth guard
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, role, branchId: sessionBranchId } =
    session.user as unknown as SessionUser;

  const { id } = await params;

  // 2. Cargar venta con relaciones
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      branch: true,
      user: true,
      customer: true,
      items: {
        include: {
          productVariant: {
            include: {
              modelo: true,
              color: true,
              voltaje: true,
            },
          },
          simpleProduct: true,
        },
      },
      payments: {
        where: { type: "PAYMENT_IN" },
      },
      authorizationRequests: {
        where: { tipo: "CANCELACION", status: "APPROVED" },
        include: { approver: true },
        orderBy: { resolvedAt: "desc" },
        take: 1,
      },
    },
  });

  if (!sale) {
    return NextResponse.json({ error: "Venta no encontrada" }, { status: 404 });
  }

  // 3. Scoping por rol
  if (role === "SELLER" && sale.userId !== userId) {
    return NextResponse.json({ error: "Sin acceso a esta venta" }, { status: 403 });
  }
  if (role === "MANAGER" && sale.branchId !== sessionBranchId) {
    return NextResponse.json({ error: "Sin acceso a esta venta" }, { status: 403 });
  }

  // 4. Validar configuración de sucursal (412 = Precondition Failed)
  let branch;
  try {
    branch = await assertBranchConfiguredForPDF(sale.branchId, "ticket");
  } catch (err) {
    if (err instanceof BranchNotConfiguredError) {
      return NextResponse.json(
        { error: err.message, missingFields: err.missingFields },
        { status: 412 },
      );
    }
    throw err;
  }

  // 5. Métodos de pago únicos traducidos al español
  const metodosPago = [
    ...new Set(
      sale.payments.map((p) => PAYMENT_LABELS[p.method] ?? p.method),
    ),
  ];

  // 6. Mapear items → PDFItem[]
  const items: PDFItem[] = sale.items.map((item) => {
    let description: string;

    if (item.productVariantId !== null && item.productVariant !== null) {
      description = `${item.productVariant.modelo.nombre} - ${item.productVariant.color.nombre} - ${item.productVariant.voltaje.label}`;
    } else if (item.simpleProductId !== null && item.simpleProduct !== null) {
      description = item.description ?? item.simpleProduct.nombre;
    } else {
      description = item.description ?? "Producto libre";
    }

    const unitPrice = item.price.toNumber();
    const qty = item.quantity;
    const discountAmt = item.discount.toNumber();
    const discountFraction = discountAmt > 0 ? discountAmt / (unitPrice * qty) : 0;
    const lineTotal = unitPrice * qty - discountAmt;

    return {
      description,
      unit: "Pieza",
      unitPrice,
      quantity: qty,
      discount: discountFraction,
      total: lineTotal,
    };
  });

  // 7. Calcular totales
  const total = sale.total.toNumber();
  const descuento = sale.discount.toNumber();
  const { subtotal, iva } = calcSubtotalFromTotal(total - descuento);
  const totalEnLetra = totalEnLetraFn(total);

  // 8. Datos de cancelación (si aplica)
  const cancelada = sale.status === "CANCELLED";
  const authReq = sale.authorizationRequests[0];
  const canceladaPor = authReq?.approver?.name ?? null;
  const canceladaFecha =
    authReq?.resolvedAt != null
      ? authReq.resolvedAt.toLocaleDateString("es-MX", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
        })
      : null;

  // 9. Resolver sello
  const sealSrc =
    sale.branch.sealImageUrl != null
      ? await resolveSealBuffer(sale.branch.sealImageUrl)
      : null;

  // 10. Renderizar PDF
  const ticketData: TicketPDFData = {
    branch,
    folio: sale.folio,
    fecha: formatDate(sale.createdAt),
    vendedor: sale.user.name ?? "—",
    cliente:
      sale.customer !== null
        ? {
            nombre: sale.customer.name,
            telefono: sale.customer.phone ?? null,
            email: sale.customer.email ?? null,
          }
        : null,
    items,
    subtotal,
    iva,
    total,
    totalEnLetra,
    descuento,
    metodosPago,
    cancelada,
    canceladaPor,
    canceladaFecha,
    terminos: null,
    sealImagePath: sale.branch.sealImageUrl ?? null,
    elaboradoPor: sale.user.name ?? "—",
  };

  // React.createElement cast needed because renderToBuffer expects ReactElement<DocumentProps>
  // but TicketPDF wraps BaseDocument which renders <Document> internally — the types are compatible at runtime.
  const element = React.createElement(TicketPDF, {
    data: ticketData,
    sealSrc,
  }) as unknown as React.ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Ticket-${sale.folio}.pdf"`,
    },
  });
}
