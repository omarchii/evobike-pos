import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import PedidoDetalle from "./pedido-detalle";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

export interface DetallePayment {
  id: string;
  amount: number;
  method: string;
  collectionStatus: string;
  createdAt: Date;
  collectedBy: string;
}

export interface DetalleItem {
  id: string;
  quantity: number;
  price: number;
  discount: number;
  productName: string;
  // Estado de recepción (solo para BACKORDER con vehículos ensamblables)
  reception?: {
    vehiclesExpected: number;
    vehiclesReceived: number;  // AssemblyOrders creadas
    vehiclesAssembled: number; // AssemblyOrders COMPLETED
    batteriesExpected: number; // BatteryConfiguration.quantity × quantity
    batteriesReceived: number; // Battery records vinculados al SaleItem
  };
}

export interface PedidoDetalleData {
  id: string;
  folio: string;
  status: string;
  orderType: string | null;
  total: number;
  subtotal: number;
  discount: number;
  totalPaid: number;
  notes: string | null;
  internalNote: string | null;
  expectedDeliveryDate: Date | null;
  createdAt: Date;
  branchName: string;
  createdBy: string;
  customer: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  items: DetalleItem[];
  payments: DetallePayment[];
}

export default async function PedidoDetallePage({ params }: PageProps) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.branchId) redirect("/pedidos");

  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id },
    include: {
      customer: {
        select: { id: true, name: true, phone: true },
      },
      user: {
        select: { name: true },
      },
      branch: {
        select: { name: true },
      },
      items: {
        include: {
          productVariant: {
            include: {
              modelo: true,
              color: true,
              voltaje: true,
            },
          },
        },
      },
      payments: {
        include: {
          session: {
            include: {
              user: {
                select: { name: true },
              },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!sale || sale.status !== "LAYAWAY" || sale.branchId !== user.branchId) {
    redirect("/pedidos");
  }

  const totalPaid = sale.payments.reduce((acc, p) => acc + Number(p.amount), 0);

  // ── Estado de recepción (solo para BACKORDER) ─────────────────────────────
  // Estructura: saleItemId → { vehiclesReceived, vehiclesAssembled, batteriesReceived }
  type ReceptionStats = {
    vehiclesReceived: number;
    vehiclesAssembled: number;
    batteriesReceived: number;
    batteriesExpected: number;
  };
  const receptionByItem = new Map<string, ReceptionStats>();

  if (sale.orderType === "BACKORDER") {
    const saleItemIds = sale.items.map((i) => i.id);

    const [assemblyOrders, batteryLots, batteryConfigs] = await Promise.all([
      prisma.assemblyOrder.findMany({
        where: { saleId: sale.id },
        select: { productVariantId: true, status: true },
      }),
      prisma.batteryLot.findMany({
        where: { saleItemId: { in: saleItemIds } },
        select: {
          saleItemId: true,
          _count: { select: { batteries: true } },
        },
      }),
      prisma.batteryConfiguration.findMany({
        where: {
          OR: sale.items.map((i) => ({
            modeloId: i.productVariant.modelo.id,
            voltajeId: i.productVariant.voltaje.id,
          })),
        },
        select: { modeloId: true, voltajeId: true, quantity: true },
      }),
    ]);

    // Mapa: "modeloId:voltajeId" → batteries per unit
    const configMap = new Map(
      batteryConfigs.map((c) => [`${c.modeloId}:${c.voltajeId}`, c.quantity])
    );

    // Contar AssemblyOrders por productVariantId
    const assemblyByVariant = new Map<string, { received: number; assembled: number }>();
    for (const ao of assemblyOrders) {
      if (!ao.productVariantId) continue;
      const cur = assemblyByVariant.get(ao.productVariantId) ?? { received: 0, assembled: 0 };
      cur.received += 1;
      if (ao.status === "COMPLETED") cur.assembled += 1;
      assemblyByVariant.set(ao.productVariantId, cur);
    }

    // Contar baterías por saleItemId
    const batteriesByItem = new Map<string, number>();
    for (const lot of batteryLots) {
      if (!lot.saleItemId) continue;
      batteriesByItem.set(
        lot.saleItemId,
        (batteriesByItem.get(lot.saleItemId) ?? 0) + lot._count.batteries
      );
    }

    for (const item of sale.items) {
      const pvId = item.productVariant.id;
      const ao = assemblyByVariant.get(pvId);
      if (!ao) continue; // no es ensamblable o aún no llegó

      const configKey = `${item.productVariant.modelo.id}:${item.productVariant.voltaje.id}`;
      const perUnit = configMap.get(configKey) ?? 0;

      receptionByItem.set(item.id, {
        vehiclesReceived: ao.received,
        vehiclesAssembled: ao.assembled,
        batteriesExpected: perUnit * item.quantity,
        batteriesReceived: batteriesByItem.get(item.id) ?? 0,
      });
    }
  }

  const data: PedidoDetalleData = {
    id: sale.id,
    folio: sale.folio,
    status: sale.status,
    orderType: sale.orderType,
    total: Number(sale.total),
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    totalPaid,
    notes: sale.notes ?? null,
    internalNote: sale.internalNote ?? null,
    expectedDeliveryDate: sale.expectedDeliveryDate ?? null,
    createdAt: sale.createdAt,
    branchName: sale.branch.name,
    createdBy: sale.user.name ?? "–",
    customer: sale.customer
      ? {
          id: sale.customer.id,
          name: sale.customer.name,
          phone: sale.customer.phone ?? null,
        }
      : null,
    items: sale.items.map((item) => ({
      id: item.id,
      quantity: item.quantity,
      price: Number(item.price),
      discount: Number(item.discount),
      productName: item.productVariant
        ? `${item.productVariant.modelo.nombre} ${item.productVariant.color.nombre} ${item.productVariant.voltaje.label}`
        : "Producto",
      reception: receptionByItem.has(item.id)
        ? { vehiclesExpected: item.quantity, ...receptionByItem.get(item.id)! }
        : undefined,
    })),
    payments: sale.payments.map((p) => ({
      id: p.id,
      amount: Number(p.amount),
      method: p.method,
      collectionStatus: p.collectionStatus,
      createdAt: p.createdAt,
      collectedBy: p.session.user.name ?? "–",
    })),
  };

  return <PedidoDetalle pedido={data} />;
}
