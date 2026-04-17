import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { MantenimientosTable, type MantenimientoRow } from "./mantenimientos-table";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

export default async function MantenimientosPage({
  searchParams,
}: {
  searchParams: Promise<{
    branchId?: string;
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

  const params = await searchParams;

  const branches = await prisma.branch.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  const scopedBranchId =
    user.role === "ADMIN"
      ? (params.branchId ?? null)
      : (user.branchId ?? null);

  const bikes = await prisma.customerBike.findMany({
    where: {
      ...(scopedBranchId ? { branchId: scopedBranchId } : {}),
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

  const today = new Date();

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

    const base = ultimoMant ?? fechaCompra;
    const proximoEstimado = addMonths(base, 6);
    const diasRestantes = diffDays(proximoEstimado, today);

    const estado: MantenimientoRow["estado"] =
      diasRestantes < 0
        ? "vencido"
        : diasRestantes <= 30
          ? "porVencer"
          : "alCorriente";

    const modeloStr = bike.productVariant
      ? [
          bike.productVariant.modelo.nombre,
          bike.productVariant.color.nombre,
          bike.productVariant.voltaje.label,
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
      proximoEstimado: proximoEstimado.toISOString(),
      diasRestantes,
      estado,
      branchCode: bike.branch.code,
      branchName: bike.branch.name,
    });
  }

  rows.sort((a, b) => a.diasRestantes - b.diasRestantes);

  return (
    <MantenimientosTable
      rows={rows}
      role={user.role}
      branches={branches}
      scopedBranchId={scopedBranchId}
    />
  );
}
