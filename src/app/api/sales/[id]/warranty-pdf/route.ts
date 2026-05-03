import type { SessionUser } from "@/lib/auth-types";
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
import { PolizaPDF } from "@/lib/pdf/templates/poliza-pdf";
import type { PolizaPDFData } from "@/lib/pdf/templates/poliza-pdf";

// GET /api/sales/[id]/warranty-pdf
// Returns the warranty PDF. 409 if warrantyDocReady = false (reensamble still pending).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  // 1. Auth guard
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { branchId, role } = session.user as unknown as SessionUser;
  const { id: saleId } = await params;

  // 2. Load sale with all needed relations
  const sale = await prisma.sale.findUnique({
    where: { id: saleId },
    include: {
      customer: { select: { name: true, phone: true, email: true } },
      user: { select: { name: true } },
      items: {
        include: {
          productVariant: {
            include: { modelo: true, color: true, voltaje: true, capacidad: true },
          },
        },
      },
      assemblyOrders: {
        where: { status: "PENDING" },
        select: { id: true, status: true },
      },
    },
  });

  // 3. 404 if not found
  if (!sale) {
    return NextResponse.json({ success: false, error: "Venta no encontrada" }, { status: 404 });
  }

  // 403 if role check fails
  if (role !== "ADMIN" && sale.branchId !== branchId) {
    return NextResponse.json({ success: false, error: "Sin acceso a esta venta" }, { status: 403 });
  }

  // 4. Check warrantyDocReady FIRST (before assertBranchConfiguredForPDF)
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

  // 5. Validate branch configuration (412 if not configured)
  let branch;
  try {
    branch = await assertBranchConfiguredForPDF(sale.branchId, "poliza");
  } catch (e) {
    if (e instanceof BranchNotConfiguredError) {
      return NextResponse.json(
        { error: e.message, missingFields: e.missingFields },
        { status: 412 }
      );
    }
    throw e;
  }

  // 6. Find CustomerBike — only for items whose modelo.requiere_vin === true
  if (!sale.customerId) {
    return NextResponse.json(
      { error: "Esta venta no tiene cliente registrado" },
      { status: 404 }
    );
  }

  const variantIdsWithVin = sale.items
    .filter((i) => i.productVariant?.modelo?.requiere_vin === true)
    .map((i) => i.productVariantId)
    .filter((id): id is string => id !== null);

  if (variantIdsWithVin.length === 0) {
    return NextResponse.json(
      { error: "No se encontró la bicicleta del cliente vinculada a esta venta" },
      { status: 404 }
    );
  }

  const bike = await prisma.customerBike.findFirst({
    where: {
      customerId: sale.customerId,
      productVariantId: { in: variantIdsWithVin },
    },
  });

  if (!bike) {
    return NextResponse.json(
      { error: "No se encontró la bicicleta del cliente vinculada a esta venta" },
      { status: 404 }
    );
  }

  // 7. Find current battery assignments
  const assignments = await prisma.batteryAssignment.findMany({
    where: { customerBikeId: bike.id, isCurrent: true },
    include: {
      battery: {
        include: { lot: true },
      },
    },
  });

  const baterias = assignments.map((a) => ({
    serial: a.battery.serialNumber,
    lote: a.battery.lot.reference ?? a.battery.lot.supplier ?? "—",
    fechaRecepcion: a.battery.lot.receivedAt.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
  }));

  // 8. Resolve seal buffer (sharp converts WebP → PNG before render)
  const sealSrc = branch.sealImageUrl
    ? await resolveSealBuffer(branch.sealImageUrl)
    : null;

  // 9. Build PDF data
  const polizaData: PolizaPDFData = {
    branch,
    folio: sale.folio,
    fecha: sale.createdAt.toLocaleDateString("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }),
    cliente: {
      nombre: sale.customer?.name ?? "Cliente",
      telefono: sale.customer?.phone ?? null,
      email: sale.customer?.email ?? null,
    },
    vehiculo: {
      modelo: bike.model ?? sale.items.find((i) => i.productVariant?.modelo?.requiere_vin)?.productVariant?.modelo?.nombre ?? "—",
      color: bike.color ?? sale.items.find((i) => i.productVariant?.color)?.productVariant?.color?.nombre ?? "—",
      voltaje: bike.voltaje ?? (() => {
        const pv = sale.items.find((i) => i.productVariant?.voltaje)?.productVariant;
        if (!pv?.voltaje) return "—";
        return pv.capacidad ? `${pv.voltaje.label} · ${pv.capacidad.nombre}` : pv.voltaje.label;
      })(),
      vin: bike.serialNumber,
    },
    baterias,
    terminos: branch.terminosPoliza ?? "",
    sealImagePath: branch.sealImageUrl,
    elaboradoPor: sale.user?.name ?? "",
  };

  // 10. Render PDF — .ts file requires React.createElement + type cast
  const element = React.createElement(PolizaPDF, {
    data: polizaData,
    sealSrc,
  }) as unknown as React.ReactElement<DocumentProps>;

  const buffer = await renderToBuffer(element);

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Poliza-${sale.folio}.pdf"`,
    },
  });
}
