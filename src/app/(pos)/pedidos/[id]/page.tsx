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

  const totalPaid = sale.payments.reduce(
    (acc, p) => acc + Number(p.amount),
    0
  );

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
