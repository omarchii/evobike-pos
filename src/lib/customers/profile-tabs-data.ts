// Datos server-side para los tabs Bicis, Ventas, Taller y Cotizaciones
// del perfil de cliente (BRIEF §7.4 — Sub-fases F y G). Cross-sucursal:
// ninguno de estos loaders filtra por `session.branchId`.

import { prisma } from "@/lib/prisma";
import {
  computeMaintenanceStatus,
  type MaintenanceStatus,
} from "@/lib/workshop-maintenance";

// === TAB BICIS =============================================================

export interface BikeMaintenanceRecord {
  id: string;
  folio: string;
  createdAt: Date;
  deliveredAt: Date | null;
  type: string;
  status: string;
  total: number;
  serviceLabels: string[];
}

export interface BikeBatteryRecord {
  id: string;
  batteryId: string;
  batterySerial: string;
  assignedAt: Date;
  unassignedAt: Date | null;
  voltageAtInstall: string | null;
  isCurrent: boolean;
  notes: string | null;
}

export interface BikeVoltageRecord {
  id: string;
  fromVoltage: string;
  toVoltage: string;
  reason: string;
  authorName: string | null;
  createdAt: Date;
}

export interface BikeOdometerRecord {
  id: string;
  oldValue: string | null;
  newValue: string | null;
  reason: string | null;
  authorName: string | null;
  createdAt: Date;
}

export interface BikeCardData {
  id: string;
  serialNumber: string;
  brand: string | null;
  model: string | null;
  color: string | null;
  voltaje: string | null;
  odometerKm: number | null;
  imageUrl: string | null;
  /** Estado operativo computado en base a ServiceOrder abiertas. */
  operationalStatus: "IN_WORKSHOP" | "OPERATIONAL" | "UNKNOWN";
  maintenance: MaintenanceStatus | null;
  purchaseDate: Date | null;
  hasAssemblyHistory: boolean;
  currentBatterySerial: string | null;
  lastMaintenanceFolio: string | null;
  lastMaintenanceAt: Date | null;
  maintenances: BikeMaintenanceRecord[];
  batteries: BikeBatteryRecord[];
  voltages: BikeVoltageRecord[];
  odometerHistory: BikeOdometerRecord[];
}

export async function getCustomerBikesTabData(
  customerId: string,
): Promise<BikeCardData[]> {
  const bikes = await prisma.customerBike.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      productVariant: {
        select: {
          imageUrl: true,
          modelo: { select: { imageUrl: true } },
        },
      },
      assemblyOrders: {
        where: {
          saleId: { not: null },
          sale: { status: { not: "CANCELLED" } },
        },
        select: { sale: { select: { createdAt: true } } },
        orderBy: { createdAt: "asc" },
      },
      batteryAssignments: {
        orderBy: { assignedAt: "desc" },
        include: {
          battery: { select: { id: true, serialNumber: true } },
          installedAtVoltageChange: { select: { toVoltage: true } },
        },
      },
      voltageChanges: {
        orderBy: { createdAt: "desc" },
      },
      serviceOrders: {
        orderBy: { createdAt: "desc" },
        include: {
          items: {
            select: {
              id: true,
              description: true,
              serviceCatalog: {
                select: { name: true, esMantenimiento: true },
              },
            },
          },
        },
      },
      editLogs: {
        where: { field: "odometerKm" },
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { user: { select: { name: true } } },
      },
    },
  });

  const userIds = new Set<string>();
  for (const b of bikes) {
    for (const v of b.voltageChanges) userIds.add(v.userId);
  }
  const users =
    userIds.size > 0
      ? await prisma.user.findMany({
          where: { id: { in: Array.from(userIds) } },
          select: { id: true, name: true },
        })
      : [];
  const userById = new Map(users.map((u) => [u.id, u.name]));

  return bikes.map((b) => {
    const purchaseDate = b.assemblyOrders[0]?.sale?.createdAt ?? null;

    const deliveredMant = b.serviceOrders
      .filter(
        (so) =>
          so.status === "DELIVERED" &&
          so.items.some((i) => i.serviceCatalog?.esMantenimiento),
      )
      .sort((a, b0) => b0.updatedAt.getTime() - a.updatedAt.getTime());
    const lastMaintenance = deliveredMant[0] ?? null;

    const maintenance = purchaseDate
      ? computeMaintenanceStatus({
          purchaseDate,
          lastMaintenanceAt: lastMaintenance?.updatedAt ?? null,
        })
      : null;

    const hasOpenWorkshop = b.serviceOrders.some(
      (so) => so.status === "PENDING" || so.status === "IN_PROGRESS",
    );

    const currentBattery = b.batteryAssignments.find((a) => a.isCurrent);

    const maintenances: BikeMaintenanceRecord[] = b.serviceOrders.map((so) => ({
      id: so.id,
      folio: so.folio,
      createdAt: so.createdAt,
      deliveredAt: so.status === "DELIVERED" ? so.updatedAt : null,
      type: so.type,
      status: so.status,
      total: Number(so.total),
      serviceLabels: so.items
        .map((i) => i.serviceCatalog?.name ?? i.description)
        .filter(Boolean) as string[],
    }));

    const batteries: BikeBatteryRecord[] = b.batteryAssignments.map((ba) => ({
      id: ba.id,
      batteryId: ba.batteryId,
      batterySerial: ba.battery.serialNumber,
      assignedAt: ba.assignedAt,
      unassignedAt: ba.unassignedAt,
      voltageAtInstall: ba.installedAtVoltageChange?.toVoltage ?? null,
      isCurrent: ba.isCurrent,
      notes: ba.notes,
    }));

    const voltages: BikeVoltageRecord[] = b.voltageChanges.map((v) => ({
      id: v.id,
      fromVoltage: v.fromVoltage,
      toVoltage: v.toVoltage,
      reason: v.reason,
      authorName: userById.get(v.userId) ?? null,
      createdAt: v.createdAt,
    }));

    const odometerHistory: BikeOdometerRecord[] = b.editLogs.map((l) => ({
      id: l.id,
      oldValue: l.oldValue,
      newValue: l.newValue,
      reason: l.reason,
      authorName: l.user?.name ?? null,
      createdAt: l.createdAt,
    }));

    return {
      id: b.id,
      serialNumber: b.serialNumber,
      brand: b.brand,
      model: b.model,
      color: b.color,
      voltaje: b.voltaje,
      odometerKm: b.odometerKm,
      imageUrl: b.productVariant?.imageUrl ?? b.productVariant?.modelo?.imageUrl ?? null,
      operationalStatus: hasOpenWorkshop ? "IN_WORKSHOP" : "OPERATIONAL",
      maintenance,
      purchaseDate,
      hasAssemblyHistory: b.assemblyOrders.length > 0,
      currentBatterySerial: currentBattery?.battery.serialNumber ?? null,
      lastMaintenanceFolio: lastMaintenance?.folio ?? null,
      lastMaintenanceAt: lastMaintenance?.updatedAt ?? null,
      maintenances,
      batteries,
      voltages,
      odometerHistory,
    };
  });
}

// === TAB VENTAS ============================================================

export interface SaleItemRow {
  id: string;
  description: string;
  quantity: number;
  price: number;
  discount: number;
}

export interface SaleRow {
  id: string;
  folio: string;
  createdAt: Date;
  status: string;
  orderType: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paidSum: number;
  outstanding: number;
  notes: string | null;
  internalNote: string | null;
  warrantyDocReady: boolean;
  expectedDeliveryDate: Date | null;
  branchName: string;
  userName: string | null;
  methodsUsed: string[];
  saleType: "CONTADO" | "APARTADO" | "CREDITO";
  items: SaleItemRow[];
}

export async function getCustomerSalesTabData(
  customerId: string,
): Promise<SaleRow[]> {
  const sales = await prisma.sale.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      branch: { select: { name: true } },
      user: { select: { name: true } },
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          price: true,
          discount: true,
          productVariant: {
            select: { modelo: { select: { nombre: true } } },
          },
          simpleProduct: { select: { nombre: true } },
        },
      },
      payments: { select: { amount: true, method: true } },
    },
  });

  return sales.map((s) => {
    const paidSum = s.payments.reduce((a, p) => a + Number(p.amount), 0);
    const total = Number(s.total);
    const methodsUsed = Array.from(
      new Set(s.payments.map((p) => p.method)),
    );
    const saleType: SaleRow["saleType"] =
      s.status === "LAYAWAY" ? "APARTADO" : "CONTADO";

    return {
      id: s.id,
      folio: s.folio,
      createdAt: s.createdAt,
      status: s.status,
      orderType: s.orderType,
      subtotal: Number(s.subtotal),
      discount: Number(s.discount),
      total,
      paidSum,
      outstanding: total - paidSum,
      notes: s.notes,
      internalNote: s.internalNote,
      warrantyDocReady: s.warrantyDocReady,
      expectedDeliveryDate: s.expectedDeliveryDate,
      branchName: s.branch.name,
      userName: s.user?.name ?? null,
      methodsUsed,
      saleType,
      items: s.items.map((i) => ({
        id: i.id,
        description:
          i.description ??
          i.productVariant?.modelo.nombre ??
          i.simpleProduct?.nombre ??
          "Línea",
        quantity: i.quantity,
        price: Number(i.price),
        discount: Number(i.discount),
      })),
    };
  });
}

// === TAB TALLER ============================================================

export interface ServiceOrderItemRow {
  id: string;
  description: string;
  quantity: number;
  price: number;
  isExtra: boolean;
  isMaintenance: boolean;
}

export interface ServiceOrderRow {
  id: string;
  folio: string;
  createdAt: Date;
  status: string;
  subStatus: string | null;
  type: string;
  total: number;
  prepaid: boolean;
  prepaidAmount: number | null;
  expectedDeliveryDate: string | null;
  diagnosis: string | null;
  bike: {
    id: string;
    serial: string;
    brand: string | null;
    model: string | null;
  } | null;
  bikeInfo: string | null;
  branchName: string;
  userName: string | null;
  items: ServiceOrderItemRow[];
}

export async function getCustomerServiceOrdersTabData(
  customerId: string,
): Promise<ServiceOrderRow[]> {
  const orders = await prisma.serviceOrder.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      branch: { select: { name: true } },
      user: { select: { name: true } },
      customerBike: {
        select: {
          id: true,
          serialNumber: true,
          brand: true,
          model: true,
        },
      },
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          price: true,
          isExtra: true,
          serviceCatalog: { select: { esMantenimiento: true } },
        },
      },
    },
  });

  return orders.map((o) => ({
    id: o.id,
    folio: o.folio,
    createdAt: o.createdAt,
    status: o.status,
    subStatus: o.subStatus,
    type: o.type,
    total: Number(o.total),
    prepaid: o.prepaid,
    prepaidAmount: o.prepaidAmount != null ? Number(o.prepaidAmount) : null,
    expectedDeliveryDate: o.expectedDeliveryDate,
    diagnosis: o.diagnosis,
    bike: o.customerBike
      ? {
          id: o.customerBike.id,
          serial: o.customerBike.serialNumber,
          brand: o.customerBike.brand,
          model: o.customerBike.model,
        }
      : null,
    bikeInfo: o.bikeInfo,
    branchName: o.branch.name,
    userName: o.user?.name ?? null,
    items: o.items.map((i) => ({
      id: i.id,
      description: i.description,
      quantity: i.quantity,
      price: Number(i.price),
      isExtra: i.isExtra,
      isMaintenance: i.serviceCatalog?.esMantenimiento ?? false,
    })),
  }));
}

// === TAB COTIZACIONES ======================================================

export interface QuotationItemRow {
  id: string;
  description: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface QuotationRow {
  id: string;
  folio: string;
  createdAt: Date;
  validUntil: Date;
  status: string;
  effectiveStatus: string;
  subtotal: number;
  discount: number;
  total: number;
  branchName: string;
  userName: string | null;
  convertedToSaleId: string | null;
  convertedAt: Date | null;
  internalNote: string | null;
  items: QuotationItemRow[];
}

export async function getCustomerQuotationsTabData(
  customerId: string,
): Promise<QuotationRow[]> {
  const quotations = await prisma.quotation.findMany({
    where: { customerId },
    orderBy: { createdAt: "desc" },
    include: {
      branch: { select: { name: true } },
      user: { select: { name: true } },
      items: {
        select: {
          id: true,
          description: true,
          quantity: true,
          unitPrice: true,
          lineTotal: true,
        },
      },
    },
  });

  const now = new Date();
  return quotations.map((q) => {
    const isExpired = q.validUntil < now && q.status === "DRAFT";
    const effectiveStatus = q.convertedToSaleId
      ? "CONVERTIDA"
      : q.cancelledAt
        ? "CANCELADA"
        : isExpired
          ? "EXPIRADA"
          : q.status;

    return {
      id: q.id,
      folio: q.folio,
      createdAt: q.createdAt,
      validUntil: q.validUntil,
      status: q.status,
      effectiveStatus,
      subtotal: Number(q.subtotal),
      discount: Number(q.discountAmount),
      total: Number(q.total),
      branchName: q.branch.name,
      userName: q.user?.name ?? null,
      convertedToSaleId: q.convertedToSaleId,
      convertedAt: q.convertedAt,
      internalNote: q.internalNote,
      items: q.items.map((i) => ({
        id: i.id,
        description: i.description,
        quantity: i.quantity,
        unitPrice: Number(i.unitPrice),
        lineTotal: Number(i.lineTotal),
      })),
    };
  });
}
