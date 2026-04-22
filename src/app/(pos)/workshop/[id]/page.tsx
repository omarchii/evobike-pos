import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ServiceOrderDetailsView } from "./service-order-details";
import type { FullSerializedOrder, SerializedProduct, SerializedOrderItem } from "./service-order-details";
import type { SerializedApproval, SerializedApprovalItem } from "./approvals-list";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { resolveOperationalBranchId } from "@/lib/branch-scope";
import type { SessionUser } from "@/lib/auth-types";
import { expirePendingApprovalsTx } from "@/lib/workshop-approval-expiry";
import { approvalItemsJsonSchema } from "@/lib/workshop-approvals";

export const dynamic = "force-dynamic";

export default async function WorkshopOrderPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const user = session.user as unknown as SessionUser;
  const userId = user.id;
  const role = user.role;

  // Branch efectivo: cookie para ADMIN, JWT para el resto.
  const viewBranchId = await resolveOperationalBranchId({ user });

  // Lazy expiry de approvals vencidas (D.2). Idempotente, segura ante
  // races por el WHERE condicional. Corre antes del findUnique para
  // que la lectura siguiente vea el estado actualizado.
  await expirePendingApprovalsTx(prisma, params.id);

  const order = await prisma.serviceOrder.findUnique({
    where: { id: params.id },
    include: {
      customer: { select: { name: true, phone: true } },
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
      user: { select: { name: true } },
      qaPassedByUser: { select: { name: true } },
      sale: {
        select: {
          id: true,
          folio: true,
          total: true,
          status: true,
        },
      },
      approvals: {
        include: { createdBy: { select: { name: true } } },
        orderBy: { requestedAt: "desc" },
      },
    },
  });

  if (!order || order.branchId !== viewBranchId) {
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
    type: order.type,
    customerId: order.customerId,
    bikeInfo: order.bikeInfo,
    diagnosis: order.diagnosis,
    subtotal: Number(order.subtotal),
    total: Number(order.total),
    prepaid: order.prepaid,
    prepaidAt: order.prepaidAt ? order.prepaidAt.toISOString() : null,
    prepaidAmount: order.prepaidAmount != null ? Number(order.prepaidAmount) : null,
    prepaidMethod: order.prepaidMethod,
    qaPassedAt: order.qaPassedAt ? order.qaPassedAt.toISOString() : null,
    qaPassedByName: order.qaPassedByUser?.name ?? null,
    qaNotes: order.qaNotes,
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

  const serializedApprovals: SerializedApproval[] = order.approvals.map((a) => {
    const parsed = approvalItemsJsonSchema.safeParse(a.itemsJson);
    const items: SerializedApprovalItem[] = parsed.success
      ? parsed.data.map((it) => ({
          nombre: it.nombre,
          cantidad: it.cantidad,
          precio: it.precio,
          subtotal: it.subtotal,
        }))
      : [];
    return {
      id: a.id,
      status: a.status,
      channel: a.channel,
      totalEstimado: Number(a.totalEstimado),
      requestedAt: a.requestedAt.toISOString(),
      expiresAt: a.expiresAt.toISOString(),
      respondedAt: a.respondedAt ? a.respondedAt.toISOString() : null,
      respondedNote: a.respondedNote,
      createdByName: a.createdBy.name,
      items,
    };
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Button variant="ghost" asChild className="mb-4 text-[var(--on-surf-var)] hover:text-[var(--on-surf)]">
          <Link href="/workshop">
            <ArrowLeft className="mr-2 h-4 w-4" /> Volver al Tablero
          </Link>
        </Button>
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h1 className="text-3xl font-bold tracking-tight">
            Orden de Servicio {order.folio}
          </h1>
          <Button variant="outline" asChild size="sm">
            <a
              href={`/taller/etiqueta/${order.id}`}
              target="_blank"
              rel="noopener noreferrer"
            >
              Imprimir etiqueta
            </a>
          </Button>
        </div>
      </div>

      <ServiceOrderDetailsView
        order={serializedOrder}
        catalogProducts={serializedProducts}
        approvals={serializedApprovals}
        hasCashSession={!!cashSession}
        userRole={role ?? "EMPLOYEE"}
      />
    </div>
  );
}
