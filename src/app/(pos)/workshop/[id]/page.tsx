import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ServiceOrderDetailsView } from "./service-order-details";
import type { FullSerializedOrder, SerializedProduct, SerializedOrderItem } from "./service-order-details";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

export default async function WorkshopOrderPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  const { id: userId, role } = (session?.user as unknown as SessionUser) ?? {};

  const order = await prisma.serviceOrder.findUnique({
    where: { id: params.id },
    include: {
      customer: true,
      customerBike: {
        select: {
          serialNumber: true,
          voltaje: true,
          brand: true,
          model: true,
          color: true,
        },
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
      user: true,
      sale: {
        select: {
          id: true,
          folio: true,
          total: true,
          status: true,
        },
      },
    },
  });

  if (!order) {
    notFound();
  }

  // Check for open cash register session (needed to show charge/deliver buttons)
  const cashSession = userId
    ? await prisma.cashRegisterSession.findFirst({
        where: { branchId: order.branchId, status: "OPEN" },
        select: { id: true },
      })
    : null;

  // Fetch active product variants for the add-item combobox
  const products = await prisma.productVariant.findMany({
    include: {
      modelo: true,
      color: true,
      voltaje: true,
    },
    orderBy: { sku: "asc" },
  });

  // Serialize Decimals and build typed objects
  const serializedOrder: FullSerializedOrder = {
    id: order.id,
    folio: order.folio,
    status: order.status,
    customerId: order.customerId,
    bikeInfo: order.bikeInfo,
    diagnosis: order.diagnosis,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    prepaid: order.prepaid,
    createdAt: order.createdAt,
    customer: order.customer,
    user: order.user,
    customerBike: order.customerBike ?? null,
    items: order.items.map((i): SerializedOrderItem => ({
      id: i.id,
      serviceOrderId: i.serviceOrderId,
      productVariantId: i.productVariantId,
      inventoryMovementId: i.inventoryMovementId ?? null,
      description: i.description,
      quantity: i.quantity,
      price: Number(i.price),
      productVariant: i.productVariant
        ? {
            id: i.productVariant.id,
            sku: i.productVariant.sku,
            name: `${i.productVariant.modelo.nombre} ${i.productVariant.color.nombre} ${i.productVariant.voltaje.label}`,
            price: Number(i.productVariant.precioPublico),
          }
        : null,
    })),
    sale: order.sale
      ? {
          id: order.sale.id,
          folio: order.sale.folio,
          total: Number(order.sale.total),
          status: order.sale.status,
        }
      : null,
  };

  const serializedProducts: SerializedProduct[] = products.map((p) => ({
    id: p.id,
    sku: p.sku,
    name: `${p.modelo.nombre} ${p.color.nombre} ${p.voltaje.label}`,
    price: Number(p.precioPublico),
  }));

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" asChild className="mb-4 text-slate-500 hover:text-slate-900">
          <Link href="/workshop">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Tablero
          </Link>
        </Button>
        <h1 className="text-3xl font-bold tracking-tight">
          Orden de Servicio {order.folio}
        </h1>
      </div>

      <ServiceOrderDetailsView
        order={serializedOrder}
        catalogProducts={serializedProducts}
        hasCashSession={!!cashSession}
        userRole={role ?? "EMPLOYEE"}
      />
    </div>
  );
}
