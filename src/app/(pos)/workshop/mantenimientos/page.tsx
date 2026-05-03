import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MantenimientosTable, type MantenimientoRow } from "./mantenimientos-table";
import { computeMaintenanceStatus } from "@/lib/workshop-maintenance";
import { branchWhere, getViewBranchId } from "@/lib/branch-filter";
import type { SessionUser } from "@/lib/auth-types";

export const dynamic = "force-dynamic";

export default async function MantenimientosPage({
  searchParams,
}: {
  searchParams: Promise<{
    estado?: string;
    from?: string;
    to?: string;
    q?: string;
  }>;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");

  const allowedRoles = ["TECHNICIAN", "MANAGER", "ADMIN"];
  if (!allowedRoles.includes(user.role)) redirect("/workshop");

  const resolvedParams = await searchParams;

  // Brief 2026-04-23: Taller = S (admite Global). Antes era operativo "jamás global".
  const viewBranchId = await getViewBranchId(resolvedParams);

  const bikes = await prisma.customerBike.findMany({
    where: {
      ...branchWhere(viewBranchId),
      assemblyOrders: {
        some: {
          saleId: { not: null },
          sale: { status: { not: "CANCELLED" } },
        },
      },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true, phone2: true } },
      productVariant: {
        include: {
          modelo: { select: { nombre: true } },
          color: { select: { nombre: true } },
          voltaje: { select: { label: true } },
          capacidad: { select: { nombre: true } },
        },
      },
      assemblyOrders: {
        where: {
          saleId: { not: null },
          sale: { status: { not: "CANCELLED" } },
        },
        include: { sale: { select: { createdAt: true, folio: true } } },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
      serviceOrders: {
        where: {
          status: "DELIVERED",
          items: { some: { serviceCatalog: { esMantenimiento: true } } },
        },
        include: { sale: { select: { createdAt: true } } },
        orderBy: { updatedAt: "desc" },
        take: 1,
      },
      branch: { select: { code: true, name: true } },
    },
  });

  const rows: MantenimientoRow[] = [];

  for (const bike of bikes) {
    const fechaCompraRaw = bike.assemblyOrders[0]?.sale?.createdAt ?? null;
    if (!fechaCompraRaw) continue;

    const fechaCompra = new Date(fechaCompraRaw);
    const ultimoMantRaw =
      bike.serviceOrders[0]?.sale?.createdAt ??
      bike.serviceOrders[0]?.updatedAt ??
      null;
    const ultimoMant = ultimoMantRaw ? new Date(ultimoMantRaw) : null;

    const { nivel, diasRestantes, proximaFecha } = computeMaintenanceStatus({
      purchaseDate: fechaCompra,
      lastMaintenanceAt: ultimoMant,
    });

    const estado: MantenimientoRow["estado"] =
      nivel === "VENCIDO" ? "vencido" : nivel === "POR_VENCER" ? "porVencer" : "alCorriente";

    const modeloStr = bike.productVariant
      ? [
          bike.productVariant.modelo.nombre,
          bike.productVariant.color.nombre,
          bike.productVariant.voltaje.label + (bike.productVariant.capacidad ? ` · ${bike.productVariant.capacidad.nombre}` : ""),
        ]
          .filter(Boolean)
          .join(" ")
      : (bike.model ?? "Sin modelo");

    rows.push({
      bikeId: bike.id,
      customerId: bike.customer?.id ?? null,
      customerName: bike.customer?.name ?? "Sin cliente",
      phone: bike.customer?.phone ?? bike.customer?.phone2 ?? null,
      modelo: modeloStr,
      serialNumber: bike.serialNumber,
      fechaCompra: fechaCompra.toISOString(),
      ultimoMantenimiento: ultimoMant?.toISOString() ?? null,
      proximoEstimado: proximaFecha.toISOString(),
      diasRestantes,
      estado,
      branchCode: bike.branch.code,
      branchName: bike.branch.name,
    });
  }

  rows.sort((a, b) => a.diasRestantes - b.diasRestantes);

  return <MantenimientosTable rows={rows} />;
}
