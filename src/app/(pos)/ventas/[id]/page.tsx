import type { SessionUser } from "@/lib/auth-types";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import { SaleDetail } from "./sale-detail";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export interface SaleAssemblyOrder {
  id: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  voltageChangeLogId: string | null;
  customerBike: { serialNumber: string; voltaje: string | null } | null;
}

export interface SaleItemData {
  id: string;
  description: string | null;
  isFreeForm: boolean;
  quantity: number;
  price: number;
  discount: number;
  productVariant: {
    modeloNombre: string;
    colorNombre: string;
    voltajeLabel: string;
  } | null;
}

export interface SaleDetailData {
  id: string;
  folio: string;
  status: "COMPLETED" | "CANCELLED" | "LAYAWAY";
  orderType: "LAYAWAY" | "BACKORDER" | null;
  total: number;
  subtotal: number;
  discount: number;
  warrantyDocReady: boolean;
  createdAt: string;
  notes: string | null;
  customer: {
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
  seller: string;
  items: SaleItemData[];
  assemblyOrders: SaleAssemblyOrder[];
}

export default async function VentaDetallePage({ params }: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user) notFound();

  const { id } = await params;

  const sale = await prisma.sale.findUnique({
    where: { id },
    select: {
      id: true,
      folio: true,
      status: true,
      orderType: true,
      total: true,
      subtotal: true,
      discount: true,
      warrantyDocReady: true,
      createdAt: true,
      branchId: true,
      notes: true,
      customer: {
        select: { name: true, phone: true, email: true },
      },
      user: {
        select: { name: true },
      },
      items: {
        select: {
          id: true,
          description: true,
          isFreeForm: true,
          quantity: true,
          price: true,
          discount: true,
          productVariant: {
            select: {
              modelo: { select: { nombre: true } },
              color: { select: { nombre: true } },
              voltaje: { select: { label: true } },
              capacidad: { select: { nombre: true } },
            },
          },
        },
      },
      assemblyOrders: {
        where: { voltageChangeLogId: { not: null } },
        select: {
          id: true,
          status: true,
          voltageChangeLogId: true,
          customerBike: {
            select: { serialNumber: true, voltaje: true },
          },
        },
      },
    },
  });

  if (!sale) notFound();

  if (user.role !== "ADMIN" && sale.branchId !== user.branchId) notFound();

  const data: SaleDetailData = {
    id: sale.id,
    folio: sale.folio,
    status: sale.status as "COMPLETED" | "CANCELLED" | "LAYAWAY",
    orderType: sale.orderType as "LAYAWAY" | "BACKORDER" | null,
    total: Number(sale.total),
    subtotal: Number(sale.subtotal),
    discount: Number(sale.discount),
    warrantyDocReady: sale.warrantyDocReady,
    createdAt: sale.createdAt.toISOString(),
    notes: sale.notes ?? null,
    customer: sale.customer
      ? { name: sale.customer.name, phone: sale.customer.phone ?? null, email: sale.customer.email ?? null }
      : null,
    seller: sale.user.name ?? "–",
    items: sale.items.map((item) => ({
      id: item.id,
      description: item.description ?? null,
      isFreeForm: item.isFreeForm,
      quantity: item.quantity,
      price: Number(item.price),
      discount: Number(item.discount),
      productVariant: item.productVariant
        ? {
            modeloNombre: item.productVariant.modelo.nombre,
            colorNombre: item.productVariant.color.nombre,
            voltajeLabel: item.productVariant.voltaje.label + (item.productVariant.capacidad ? ` · ${item.productVariant.capacidad.nombre}` : ""),
          }
        : null,
    })),
    assemblyOrders: sale.assemblyOrders.map((ao) => ({
      id: ao.id,
      status: ao.status as "PENDING" | "COMPLETED" | "CANCELLED",
      voltageChangeLogId: ao.voltageChangeLogId ?? null,
      customerBike: ao.customerBike
        ? { serialNumber: ao.customerBike.serialNumber, voltaje: ao.customerBike.voltaje ?? null }
        : null,
    })),
  };

  return <SaleDetail sale={data} userRole={user.role} />;
}
