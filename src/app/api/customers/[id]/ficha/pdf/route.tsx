import React from "react";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { renderToBuffer } from "@react-pdf/renderer";
import { getAuthedUser } from "@/lib/auth-helpers";
import {
  assertBranchConfiguredForPDF,
  BranchNotConfiguredError,
} from "@/lib/branch";
import { resolveSealBuffer } from "@/lib/pdf/components/document-footer";
import { CustomerFichaPDF } from "@/lib/pdf/templates/customer-ficha-pdf";
import type {
  FichaActivityRow,
  FichaBikeRow,
} from "@/lib/pdf/templates/customer-ficha-pdf";

// GET /api/customers/[id]/ficha/pdf — ficha de cliente (BRIEF §7.5).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      bikes: {
        select: {
          serialNumber: true,
          brand: true,
          model: true,
          voltaje: true,
          odometerKm: true,
        },
      },
    },
  });

  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  // Branding: usa la sucursal del usuario actual; si no está configurada,
  // 412 con el detalle estándar.
  let branch;
  try {
    branch = await assertBranchConfiguredForPDF(user.branchId, "reporte");
  } catch (e) {
    if (e instanceof BranchNotConfiguredError) {
      return NextResponse.json(
        { error: e.message, missingFields: e.missingFields },
        { status: 412 },
      );
    }
    throw e;
  }

  const [completedAgg, layawaySales, recentSales, recentOrders] = await Promise.all([
    prisma.sale.aggregate({
      where: { customerId: id, status: "COMPLETED" },
      _sum: { total: true },
    }),
    prisma.sale.findMany({
      where: { customerId: id, status: "LAYAWAY" },
      select: {
        total: true,
        payments: { select: { amount: true } },
      },
    }),
    prisma.sale.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        folio: true,
        createdAt: true,
        status: true,
        total: true,
        branch: { select: { name: true } },
      },
    }),
    prisma.serviceOrder.findMany({
      where: { customerId: id },
      orderBy: { createdAt: "desc" },
      take: 10,
      select: {
        folio: true,
        createdAt: true,
        type: true,
        status: true,
        total: true,
        customerBike: { select: { serialNumber: true } },
      },
    }),
  ]);

  const ltvTotal = Number(completedAgg._sum.total ?? 0);
  let saldoPorCobrar = 0;
  for (const sale of layawaySales) {
    const total = Number(sale.total);
    const paid = sale.payments.reduce((s, p) => s + Number(p.amount), 0);
    saldoPorCobrar += Math.max(0, total - paid);
  }

  const fmtMXN = (n: number): string =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(n);

  const fmtDate = (d: Date): string =>
    new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(d);

  const SALE_STATUS_LABEL: Record<string, string> = {
    COMPLETED: "Completada",
    LAYAWAY: "Apartado",
    CANCELLED: "Cancelada",
  };

  const SO_TYPE_LABEL: Record<string, string> = {
    PAID: "Pagada",
    WARRANTY: "Garantía",
    COURTESY: "Cortesía",
    POLICY_MAINTENANCE: "Mant.",
  };

  const ventas: FichaActivityRow[] = recentSales.map((s) => ({
    fecha: fmtDate(s.createdAt),
    folio: s.folio,
    tipo: SALE_STATUS_LABEL[s.status] ?? s.status,
    detalle: s.branch.name,
    total: fmtMXN(Number(s.total)),
  }));

  const ordenes: FichaActivityRow[] = recentOrders.map((o) => ({
    fecha: fmtDate(o.createdAt),
    folio: o.folio,
    tipo: SO_TYPE_LABEL[o.type] ?? o.type,
    detalle: o.customerBike?.serialNumber ?? "—",
    total: fmtMXN(Number(o.total)),
  }));

  const bicis: FichaBikeRow[] = customer.bikes.map((b) => ({
    vin: b.serialNumber,
    modelo: [b.brand, b.model].filter(Boolean).join(" ") || "—",
    voltaje: b.voltaje ?? "—",
    odometro:
      b.odometerKm != null
        ? `${b.odometerKm.toLocaleString("es-MX")} km`
        : "—",
  }));

  const sealSrc = branch.sealImageUrl
    ? await resolveSealBuffer(branch.sealImageUrl)
    : null;

  const direccionShipping = [
    customer.shippingStreet,
    customer.shippingExtNum && `#${customer.shippingExtNum}`,
    customer.shippingColonia,
  ]
    .filter(Boolean)
    .join(" ");

  const buffer = await renderToBuffer(
    <CustomerFichaPDF
      data={{
        branch,
        generatedAt: fmtDate(new Date()),
        cliente: {
          nombre: customer.name,
          rfc: customer.rfc,
          razonSocial: customer.razonSocial,
          isBusiness: customer.isBusiness,
          phone: customer.phone,
          phone2: customer.phone2,
          email: customer.email,
          direccion: direccionShipping || null,
          ciudad: customer.shippingCity,
          estado: customer.shippingState,
          cp: customer.shippingZip,
        },
        fiscal: {
          regimenFiscal: customer.regimenFiscal,
          usoCFDI: customer.usoCFDI,
          emailFiscal: customer.emailFiscal,
          direccionFiscal: customer.direccionFiscal,
        },
        kpis: {
          ltvTotal: fmtMXN(ltvTotal),
          saldoFavor: fmtMXN(Number(customer.balance)),
          saldoPorCobrar: fmtMXN(saldoPorCobrar),
          bicis: customer.bikes.length,
        },
        bicis,
        ventasRecientes: ventas,
        ordenesRecientes: ordenes,
        sealImagePath: branch.sealImageUrl,
      }}
      sealSrc={sealSrc}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Ficha-${customer.name.replace(/\s+/g, "_")}.pdf"`,
    },
  });
}
