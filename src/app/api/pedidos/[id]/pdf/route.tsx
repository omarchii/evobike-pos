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
  totalEnLetra as totalEnLetraFn,
  calcSubtotalFromTotal,
  formatDate,
} from "@/lib/pdf/helpers";
import { PedidoPDF } from "@/lib/pdf/templates/pedido-pdf";
import type { PDFItem } from "@/lib/pdf/types";

interface RouteParams {
  params: Promise<{ id: string }>;
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
  { params }: RouteParams,
): Promise<Response> {
  // 1. Auth guard
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, role, branchId: sessionBranchId } =
    session.user as unknown as SessionUser;

  const { id } = await params;

  // 2. Cargar pedido con relaciones
  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      user: { select: { name: true } },
      branch: true,
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
        orderBy: { createdAt: "asc" },
        include: {
          session: {
            include: {
              user: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  // 3. Validaciones
  if (!sale) {
    return NextResponse.json({ error: "Pedido no encontrado" }, { status: 404 });
  }

  if (role === "MANAGER" && sale.branchId !== sessionBranchId) {
    return NextResponse.json({ error: "Sin acceso a este pedido" }, { status: 403 });
  }
  if (role === "SELLER" && sale.userId !== userId) {
    return NextResponse.json({ error: "Sin acceso a este pedido" }, { status: 403 });
  }

  // 4. Validar configuración de sucursal
  let branch;
  try {
    branch = await assertBranchConfiguredForPDF(sale.branchId, "pedido");
  } catch (e) {
    if (e instanceof BranchNotConfiguredError) {
      return NextResponse.json(
        { error: e.message, missingFields: e.missingFields },
        { status: 412 },
      );
    }
    throw e;
  }

  // 5. Mapear items → PDFItem[]
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

  // 6. Calcular totales
  const total = sale.total.toNumber();
  const descuento = sale.discount.toNumber();
  const { subtotal, iva } = calcSubtotalFromTotal(total - descuento);
  const totalEnLetra = totalEnLetraFn(total);

  // 7. Mapear abonos
  const abonos = sale.payments.map((p) => ({
    fecha: new Date(p.createdAt).toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    monto: p.amount.toNumber(),
    metodoPago: PAYMENT_LABELS[p.method] ?? p.method,
    cobradoPor: p.session.user.name ?? "—",
  }));

  const totalAbonado = abonos.reduce((acc, a) => acc + a.monto, 0);
  const saldoRestante = Math.max(0, total - totalAbonado);

  // 8. Determinar estado efectivo
  let effectiveStatus: string;
  if (sale.status === "CANCELLED") {
    effectiveStatus = "CANCELLED";
  } else if (sale.status === "COMPLETED") {
    effectiveStatus = "COMPLETED";
  } else if (totalAbonado > 0 && saldoRestante > 0) {
    effectiveStatus = "PARTIAL";
  } else if (saldoRestante === 0 && totalAbonado > 0) {
    effectiveStatus = "COMPLETED";
  } else {
    effectiveStatus = "PENDING";
  }

  // 9. Resolver sello
  const sealSrc = branch.sealImageUrl
    ? await resolveSealBuffer(branch.sealImageUrl)
    : null;

  // 10. Determinar tipo
  const tipo: "BACKORDER" | "LAYAWAY" =
    sale.orderType === "BACKORDER" ? "BACKORDER" : "LAYAWAY";

  // 11. Renderizar PDF
  const buffer = await renderToBuffer(
    <PedidoPDF
      data={{
        branch,
        folio: sale.folio,
        tipo,
        fecha: formatDate(sale.createdAt),
        cliente: {
          nombre: sale.customer?.name ?? "Público en general",
          telefono: sale.customer?.phone ?? null,
          email: sale.customer?.email ?? null,
        },
        items,
        subtotal,
        iva,
        total,
        totalEnLetra,
        descuento,
        abonos,
        totalAbonado,
        saldoRestante,
        status: effectiveStatus,
        terminos: branch.terminosPedido ?? "",
        sealImagePath: branch.sealImageUrl ?? null,
        elaboradoPor: sale.user.name ?? "—",
      }}
      sealSrc={sealSrc}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Pedido-${sale.folio}.pdf"`,
    },
  });
}
