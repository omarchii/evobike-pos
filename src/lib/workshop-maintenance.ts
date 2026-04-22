import { prisma } from "./prisma";

export type MaintenanceLevel = "VENCIDO" | "POR_VENCER" | "AL_CORRIENTE";

export interface MaintenanceStatus {
  nivel: MaintenanceLevel;
  diasRestantes: number;
  proximaFecha: Date;
  baseFecha: Date;
}

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setMonth(d.getMonth() + months);
  return d;
}

function diffDays(a: Date, b: Date): number {
  return Math.floor((a.getTime() - b.getTime()) / 86_400_000);
}

/**
 * Calcula el estado de mantenimiento de una bicicleta según reglas P11:
 * - base = último mantenimiento entregado ?? fecha de compra
 * - próximo = base + 6 meses
 * - VENCIDO: hoy > próximo  /  POR_VENCER: 0 ≤ diff ≤ 30d  /  AL_CORRIENTE: diff > 30d
 */
export function computeMaintenanceStatus(input: {
  purchaseDate: Date;
  lastMaintenanceAt: Date | null;
}): MaintenanceStatus {
  const base = input.lastMaintenanceAt ?? input.purchaseDate;
  const proximaFecha = addMonths(base, 6);
  const today = new Date();
  const diasRestantes = diffDays(proximaFecha, today);

  const nivel: MaintenanceLevel =
    diasRestantes < 0
      ? "VENCIDO"
      : diasRestantes <= 30
        ? "POR_VENCER"
        : "AL_CORRIENTE";

  return { nivel, diasRestantes, proximaFecha, baseFecha: base };
}

/**
 * Consulta el estado de mantenimiento de una bicicleta por ID.
 * Retorna null si la bici no existe o no tiene venta de origen.
 */
export async function getBikeMaintenanceStatus(
  bikeId: string,
): Promise<MaintenanceStatus | null> {
  const bike = await prisma.customerBike.findUnique({
    where: { id: bikeId },
    include: {
      assemblyOrders: {
        where: {
          saleId: { not: null },
          sale: { status: { not: "CANCELLED" } },
        },
        include: { sale: { select: { createdAt: true } } },
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
    },
  });

  if (!bike) return null;

  const fechaCompraRaw = bike.assemblyOrders[0]?.sale?.createdAt ?? null;
  if (!fechaCompraRaw) return null;

  const fechaCompra = new Date(fechaCompraRaw);
  const ultimoMantRaw =
    bike.serviceOrders[0]?.sale?.createdAt ??
    bike.serviceOrders[0]?.updatedAt ??
    null;
  const ultimoMant = ultimoMantRaw ? new Date(ultimoMantRaw) : null;

  return computeMaintenanceStatus({
    purchaseDate: fechaCompra,
    lastMaintenanceAt: ultimoMant,
  });
}

/**
 * Retorna los servicios de mantenimiento activos de una sucursal.
 * Consumido por el wizard de recepción (Decisión 2, Sub-fase C).
 */
export async function getBranchMaintenanceServices(
  branchId: string,
): Promise<Array<{ id: string; name: string; basePrice: number }>> {
  const services = await prisma.serviceCatalog.findMany({
    where: { branchId, esMantenimiento: true, isActive: true },
    select: { id: true, name: true, basePrice: true },
    orderBy: { name: "asc" },
  });

  return services.map((s) => ({
    id: s.id,
    name: s.name,
    basePrice: Number(s.basePrice),
  }));
}
