import { getServerSession } from "next-auth";
import { redirect, notFound } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canUserSeeTransfer } from "@/lib/transferencias";
import { TransferenciaDetalleClient } from "./transferencia-detalle-client";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

export default async function TransferenciaDetallePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ modal?: string }>;
}): Promise<React.ReactElement> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;
  const role = user.role;

  if (!["SELLER", "MANAGER", "ADMIN"].includes(role)) {
    redirect("/");
  }

  const { id } = await params;
  const sp = await searchParams;
  const autoModal = sp.modal ?? null;

  const transfer = await prisma.stockTransfer.findUnique({
    where: { id },
    include: {
      items: {
        include: {
          productVariant: {
            select: {
              id: true,
              modelo: { select: { nombre: true } },
              color: { select: { nombre: true } },
              voltaje: { select: { valor: true, label: true } },
            },
          },
          simpleProduct: { select: { id: true, nombre: true } },
          battery: { select: { id: true, serialNumber: true, status: true, branchId: true } },
          customerBike: {
            select: {
              id: true,
              serialNumber: true,
              brand: true,
              model: true,
              color: true,
              customerId: true,
              branchId: true,
            },
          },
        },
      },
      fromBranch: { select: { id: true, name: true, code: true } },
      toBranch: { select: { id: true, name: true, code: true } },
      creadoPorUser: { select: { id: true, name: true } },
      autorizadoPorUser: { select: { id: true, name: true } },
      despachadoPorUser: { select: { id: true, name: true } },
      recibidoPorUser: { select: { id: true, name: true } },
      canceladoPorUser: { select: { id: true, name: true } },
    },
  });

  if (!transfer) notFound();

  const userForCheck = { id: user.id, role, branchId: user.branchId ?? "" };
  if (!canUserSeeTransfer(userForCheck, transfer)) notFound();

  const data = {
    id: transfer.id,
    folio: transfer.folio,
    status: transfer.status,
    fromBranchId: transfer.fromBranchId,
    toBranchId: transfer.toBranchId,
    fromBranch: transfer.fromBranch,
    toBranch: transfer.toBranch,
    creadoPor: transfer.creadoPor,
    creadoPorUser: transfer.creadoPorUser,
    autorizadoPor: transfer.autorizadoPor,
    autorizadoAt: transfer.autorizadoAt?.toISOString() ?? null,
    autorizadoPorUser: transfer.autorizadoPorUser,
    despachadoPor: transfer.despachadoPor,
    despachadoAt: transfer.despachadoAt?.toISOString() ?? null,
    despachadoPorUser: transfer.despachadoPorUser,
    recibidoPor: transfer.recibidoPor,
    recibidoAt: transfer.recibidoAt?.toISOString() ?? null,
    recibidoPorUser: transfer.recibidoPorUser,
    canceladoPor: transfer.canceladoPor,
    canceladoAt: transfer.canceladoAt?.toISOString() ?? null,
    canceladoPorUser: transfer.canceladoPorUser,
    motivoCancelacion: transfer.motivoCancelacion,
    notas: transfer.notas,
    createdAt: transfer.createdAt.toISOString(),
    updatedAt: transfer.updatedAt.toISOString(),
    items: transfer.items.map((item) => ({
      id: item.id,
      transferId: item.transferId,
      productVariantId: item.productVariantId,
      simpleProductId: item.simpleProductId,
      batteryId: item.batteryId,
      customerBikeId: item.customerBikeId,
      cantidadEnviada: item.cantidadEnviada,
      cantidadRecibida: item.cantidadRecibida,
      productVariant: item.productVariant,
      simpleProduct: item.simpleProduct,
      battery: item.battery,
      customerBike: item.customerBike,
    })),
  };

  return (
    <TransferenciaDetalleClient
      transfer={data}
      userRole={role}
      userBranchId={user.branchId ?? ""}
      userId={user.id}
      autoModal={autoModal}
    />
  );
}
