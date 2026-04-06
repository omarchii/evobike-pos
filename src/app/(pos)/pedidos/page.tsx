import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import PedidosList from "./pedidos-list";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

interface SerializedPayment {
  id: string;
  amount: number;
  method: string;
  createdAt: Date;
}

interface SerializedItem {
  id: string;
  quantity: number;
  price: number;
  discount: number;
  productName: string;
}

export interface SerializedPedido {
  id: string;
  folio: string;
  status: string;
  orderType: string | null;
  total: number;
  subtotal: number;
  discount: number;
  totalPaid: number;
  notes: string | null;
  expectedDeliveryDate: Date | null;
  createdAt: Date;
  customer: {
    id: string;
    name: string;
    phone: string | null;
  } | null;
  createdBy: string;
  items: SerializedItem[];
  payments: SerializedPayment[];
}

export default async function PedidosPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;

  if (!user?.branchId) {
    return <div>No tienes sucursal asignada</div>;
  }

  const { branchId } = user;

  const pedidos = await prisma.sale.findMany({
    where: {
      branchId,
      status: "LAYAWAY",
    },
    include: {
      customer: {
        select: { id: true, name: true, phone: true },
      },
      user: {
        select: { name: true },
      },
      payments: true,
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
    },
    orderBy: { createdAt: "desc" },
  });

  const serialized: SerializedPedido[] = pedidos.map((p) => {
    const totalPaid = p.payments.reduce(
      (acc, pay) => acc + Number(pay.amount),
      0
    );

    return {
      id: p.id,
      folio: p.folio,
      status: p.status,
      orderType: p.orderType,
      total: Number(p.total),
      subtotal: Number(p.subtotal),
      discount: Number(p.discount),
      totalPaid,
      notes: p.notes ?? null,
      expectedDeliveryDate: p.expectedDeliveryDate ?? null,
      createdAt: p.createdAt,
      customer: p.customer
        ? {
            id: p.customer.id,
            name: p.customer.name,
            phone: p.customer.phone ?? null,
          }
        : null,
      createdBy: p.user.name ?? "–",
      payments: p.payments.map((pay) => ({
        id: pay.id,
        amount: Number(pay.amount),
        method: pay.method,
        createdAt: pay.createdAt,
      })),
      items: p.items.map((item) => ({
        id: item.id,
        quantity: item.quantity,
        price: Number(item.price),
        discount: Number(item.discount),
        productName: item.productVariant
          ? `${item.productVariant.modelo.nombre} ${item.productVariant.color.nombre} ${item.productVariant.voltaje.label}`
          : "Producto",
      })),
    };
  });

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Pedidos</h1>
          <p className="text-slate-500">
            Gestiona apartados y pedidos pendientes de entrega.
          </p>
        </div>
      </div>

      <PedidosList pedidos={serialized} />
    </div>
  );
}
