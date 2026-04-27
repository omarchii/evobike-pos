import type { BranchedSessionUser } from "@/lib/auth-types";
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
} from "@/lib/pdf/helpers";
import { CotizacionPDF } from "@/lib/pdf/templates/cotizacion-pdf";
import type { PDFItem } from "@/lib/pdf/types";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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
    session.user as unknown as BranchedSessionUser;

  const { id } = await params;

  // 2. Cargar cotización con relaciones
  const quotation = await prisma.quotation.findUnique({
    where: { id },
    include: {
      items: true,
      customer: true,
      user: { select: { name: true } },
    },
  });

  if (!quotation) {
    return NextResponse.json(
      { error: "Cotización no encontrada" },
      { status: 404 },
    );
  }

  // 3. Scoping por rol
  if (role === "SELLER" && quotation.userId !== userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }
  if (role === "MANAGER" && quotation.branchId !== sessionBranchId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 403 });
  }

  // 4. Validar configuración de sucursal (412 = Precondition Failed)
  let branch;
  try {
    branch = await assertBranchConfiguredForPDF(quotation.branchId, "cotizacion");
  } catch (e) {
    if (e instanceof BranchNotConfiguredError) {
      return NextResponse.json(
        { error: e.message, missingFields: e.missingFields },
        { status: 412 },
      );
    }
    throw e;
  }

  // 5. Calcular datos financieros
  const total = quotation.total.toNumber();
  const descuento = quotation.discountAmount.toNumber();
  // El subtotal se calcula sobre el neto (total - descuento) ya con IVA incluido
  const { subtotal, iva } = calcSubtotalFromTotal(total - descuento);
  const totalEnLetra = totalEnLetraFn(total);

  // 6. Mapear items
  const items: PDFItem[] = quotation.items.map((item) => {
    const unitPrice = item.unitPrice.toNumber();
    const lineTotal = item.lineTotal.toNumber();
    const grossTotal = unitPrice * item.quantity;
    const discount = lineTotal < grossTotal ? 1 - lineTotal / grossTotal : 0;
    return {
      description: item.description,
      unit: "Pieza",
      unitPrice,
      quantity: item.quantity,
      discount,
      total: lineTotal,
    };
  });

  // 7. Datos del cliente (registrado o anónimo)
  const cliente = quotation.customer
    ? {
        nombre: quotation.customer.name,
        telefono: quotation.customer.phone ?? null,
      }
    : {
        nombre: quotation.anonymousCustomerName ?? "Público en general",
        telefono: quotation.anonymousCustomerPhone ?? null,
      };

  // 8. Resolver sello (sharp convierte WebP → PNG buffer antes del render)
  const sealSrc = branch.sealImageUrl
    ? await resolveSealBuffer(branch.sealImageUrl)
    : null;

  // 9. Renderizar PDF
  const buffer = await renderToBuffer(
    <CotizacionPDF
      data={{
        branch,
        folio: quotation.folio,
        fechaExpedicion: quotation.createdAt.toISOString(),
        fechaVencimiento: quotation.validUntil.toISOString(),
        cliente,
        items,
        subtotal,
        iva,
        total,
        totalEnLetra,
        descuento,
        terminos: branch.terminosCotizacion ?? "",
        sealImagePath: branch.sealImageUrl,
        elaboradoPor: quotation.user.name ?? "",
      }}
      sealSrc={sealSrc}
    />,
  );

  // 10. Responder con el PDF en streaming
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Cotizacion-${quotation.folio}.pdf"`,
    },
  });
}
