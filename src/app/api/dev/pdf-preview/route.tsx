import { notFound } from "next/navigation";
import { NextRequest, NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import {
  assertBranchConfiguredForPDF,
  BranchNotConfiguredError,
} from "@/lib/branch";
import { BaseDocument } from "@/lib/pdf/components/base-document";
import { DocumentHeader } from "@/lib/pdf/components/document-header";
import { ClientInfoBlock } from "@/lib/pdf/components/client-info-block";
import { ItemsTable } from "@/lib/pdf/components/items-table";
import { TotalsBlock } from "@/lib/pdf/components/totals-block";
import {
  DocumentFooter,
  resolveSealBuffer,
} from "@/lib/pdf/components/document-footer";
import { totalEnLetra, calcIVA } from "@/lib/pdf/helpers";
import type { PDFItem } from "@/lib/pdf/types";

export async function GET(request: NextRequest): Promise<NextResponse> {
  if (process.env.NODE_ENV !== "development") {
    notFound();
  }

  const { searchParams } = request.nextUrl;
  const branchId = searchParams.get("branchId");

  if (!branchId) {
    const firstBranch = await prisma.branch.findFirst({
      orderBy: { code: "asc" },
    });
    if (!firstBranch) {
      return NextResponse.json(
        { error: "No hay sucursales configuradas" },
        { status: 404 },
      );
    }
    return NextResponse.redirect(
      new URL(`/api/dev/pdf-preview?branchId=${firstBranch.id}`, request.url),
    );
  }

  let branch;
  try {
    branch = await assertBranchConfiguredForPDF(branchId, "cotizacion");
  } catch (err) {
    if (err instanceof BranchNotConfiguredError) {
      return NextResponse.json(
        {
          error: "Sucursal sin configurar",
          missingFields: err.missingFields,
        },
        { status: 422 },
      );
    }
    throw err;
  }

  // ── Datos dummy de cotización ────────────────────────────────────────────────
  const today = new Date();
  const vencimiento = new Date(today);
  vencimiento.setDate(vencimiento.getDate() + 7);

  const netPrice = 129.31;
  const qty = 1;
  const discount = 0;
  const itemTotal = Math.round(netPrice * qty * (1 - discount) * 100) / 100;

  const items: PDFItem[] = [
    {
      description: "REFACCION (Línea de freno de mano, Solara)",
      unit: "H87 - Pieza",
      unitPrice: netPrice,
      quantity: qty,
      discount,
      total: itemTotal,
    },
  ];

  const subtotal = Math.round(items.reduce((s, it) => s + it.total, 0) * 100) / 100;
  const { iva, total } = calcIVA(subtotal);
  const letraTotal = totalEnLetra(total);

  // Resolver sello antes de renderizar (sharp convierte WebP → PNG buffer)
  const sealSrc = branch.sealImageUrl
    ? await resolveSealBuffer(branch.sealImageUrl)
    : null;

  // ── Composición del documento ────────────────────────────────────────────────
  const document = (
    <BaseDocument title="Cotización dummy — Dev Preview">
      <DocumentHeader
        branch={branch}
        documentType="Cotización"
        folio="No. 71"
      />
      <ClientInfoBlock
        client={{
          nombre: "joseph anthony morris",
          rfc: "josephmorrisg",
          telefono: "7177584803",
          domicilio:
            "Calle: isla mujeres, Mun.: ISLA MUJERES, Edo.: Quintana Roo, C.P.: 77536, País: MEX",
        }}
        fechaExpedicion={today}
        fechaVencimiento={vencimiento}
      />
      <ItemsTable items={items} totalEnLetra={letraTotal} />
      <TotalsBlock subtotal={subtotal} iva={iva} total={total} />
      <DocumentFooter
        terminos={
          branch.terminosCotizacion ??
          "Para solicitar piezas y refacciones se requiere un anticipo del 50% del total de la cotización. Una vez solicitado el pedido a fábrica no se aceptan cambios, devoluciones ni cancelaciones. Los tiempos de entrega son estimados y dependen de disponibilidad y logística La garantía aplica solo en piezas EvoBike instaladas por nuestros técnicos y no aplica en piezas instaladas en unidades de otra marca"
        }
        sealImagePath={branch.sealImageUrl}
        sealSrc={sealSrc}
      />
    </BaseDocument>
  );

  const buffer = await renderToBuffer(document);

  return new NextResponse(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": "inline; filename=cotizacion-preview.pdf",
    },
  });
}
