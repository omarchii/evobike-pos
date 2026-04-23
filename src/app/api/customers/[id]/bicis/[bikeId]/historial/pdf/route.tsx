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
import { CustomerBikeHistorialPDF } from "@/lib/pdf/templates/customer-bike-historial-pdf";
import type {
  BikeBatteryHistoryRow,
  BikeOdometerHistoryRow,
  BikeServiceHistoryRow,
  BikeVoltageHistoryRow,
} from "@/lib/pdf/templates/customer-bike-historial-pdf";

// GET /api/customers/[id]/bicis/[bikeId]/historial/pdf — historial completo de
// la unidad para garantías de fabricante (BRIEF §7.5).
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; bikeId: string }> },
): Promise<Response> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { id: customerId, bikeId } = await params;

  const bike = await prisma.customerBike.findFirst({
    where: { id: bikeId, customerId },
    include: {
      customer: {
        select: {
          name: true,
          rfc: true,
          phone: true,
          email: true,
        },
      },
      assemblyOrders: {
        where: {
          saleId: { not: null },
          sale: { status: { not: "CANCELLED" } },
        },
        select: { sale: { select: { createdAt: true } } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      serviceOrders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            select: {
              description: true,
              serviceCatalog: { select: { name: true } },
            },
          },
        },
      },
      batteryAssignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          battery: { select: { serialNumber: true } },
          installedAtVoltageChange: { select: { toVoltage: true } },
        },
      },
      voltageChanges: {
        orderBy: { createdAt: "desc" },
      },
      editLogs: {
        where: { field: "odometerKm" },
        orderBy: { createdAt: "desc" },
        include: { user: { select: { name: true } } },
      },
    },
  });

  if (!bike || !bike.customer) {
    return NextResponse.json({ error: "Bici no encontrada" }, { status: 404 });
  }
  // Type narrowing — TS no infiere `bike.customer` non-null tras el guard.
  const customer = bike.customer;

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

  const fmtDate = (d: Date | null): string => {
    if (!d) return "—";
    return new Intl.DateTimeFormat("es-MX", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }).format(d);
  };

  const fmtMXN = (n: number): string =>
    new Intl.NumberFormat("es-MX", {
      style: "currency",
      currency: "MXN",
      maximumFractionDigits: 0,
    }).format(n);

  const SO_TYPE_LABEL: Record<string, string> = {
    PAID: "Pagada",
    WARRANTY: "Garantía",
    COURTESY: "Cortesía",
    POLICY_MAINTENANCE: "Mant. póliza",
  };
  const SO_STATUS_LABEL: Record<string, string> = {
    PENDING: "Pendiente",
    IN_PROGRESS: "En proceso",
    COMPLETED: "Completada",
    DELIVERED: "Entregada",
    CANCELLED: "Cancelada",
  };

  const servicios: BikeServiceHistoryRow[] = bike.serviceOrders.map((o) => {
    const labels = o.items
      .map((i) => i.serviceCatalog?.name ?? i.description)
      .filter((label): label is string => Boolean(label));
    return {
      fecha: fmtDate(o.createdAt),
      folio: o.folio,
      tipo: SO_TYPE_LABEL[o.type] ?? o.type,
      estado: SO_STATUS_LABEL[o.status] ?? o.status,
      total: fmtMXN(Number(o.total)),
      servicios: labels,
      notas: o.diagnosis,
    };
  });

  const baterias: BikeBatteryHistoryRow[] = bike.batteryAssignments.map((a) => ({
    serial: a.battery.serialNumber,
    desde: fmtDate(a.assignedAt),
    hasta: a.unassignedAt ? fmtDate(a.unassignedAt) : "Vigente",
    voltaje: a.installedAtVoltageChange?.toVoltage ?? "—",
    notas: a.notes,
  }));

  const voltageUserIds = Array.from(new Set(bike.voltageChanges.map((v) => v.userId)));
  const voltageUsers =
    voltageUserIds.length > 0
      ? await prisma.user.findMany({
          where: { id: { in: voltageUserIds } },
          select: { id: true, name: true },
        })
      : [];
  const userNameById = new Map(voltageUsers.map((u) => [u.id, u.name ?? "—"]));

  const voltajes: BikeVoltageHistoryRow[] = bike.voltageChanges.map((v) => ({
    fecha: fmtDate(v.createdAt),
    cambio: `${v.fromVoltage} → ${v.toVoltage}`,
    motivo: v.reason === "PRE_SALE" ? "Pre-venta" : "Post-venta",
    autor: userNameById.get(v.userId) ?? "—",
  }));

  const odometros: BikeOdometerHistoryRow[] = bike.editLogs.map((l) => ({
    fecha: fmtDate(l.createdAt),
    cambio: `${l.oldValue ?? "—"} → ${l.newValue ?? "—"} km`,
    motivo: l.reason ?? "—",
    autor: l.user?.name ?? "—",
  }));

  const sealSrc = branch.sealImageUrl
    ? await resolveSealBuffer(branch.sealImageUrl)
    : null;

  const purchaseDate = bike.assemblyOrders[0]?.sale?.createdAt ?? null;
  const currentBattery = bike.batteryAssignments.find((a) => a.isCurrent);

  const buffer = await renderToBuffer(
    <CustomerBikeHistorialPDF
      data={{
        branch,
        generatedAt: fmtDate(new Date()),
        duenoActual: {
          nombre: customer.name,
          rfc: customer.rfc,
          phone: customer.phone,
          email: customer.email,
        },
        bici: {
          vin: bike.serialNumber,
          marca: bike.brand,
          modelo: bike.model,
          color: bike.color,
          voltajeActual: bike.voltaje,
          odometerKm: bike.odometerKm,
          fechaCompra: purchaseDate ? fmtDate(purchaseDate) : null,
          estado: "Activo",
          bateriaActual: currentBattery?.battery.serialNumber ?? null,
        },
        servicios,
        baterias,
        voltajes,
        odometros,
        sealImagePath: branch.sealImageUrl,
      }}
      sealSrc={sealSrc}
    />,
  );

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Historial-${bike.serialNumber}.pdf"`,
    },
  });
}
