import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RecepcionDetail } from "./recepcion-detail";
import type { SerializedReceiptDetail } from "./recepcion-detail";

export const dynamic = "force-dynamic";

interface SessionUser {
  role: string;
  branchId: string;
}

export default async function RecepcionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const { role, branchId } = session.user as unknown as SessionUser;
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/dashboard");

  const { id } = await params;

  const receipt = await prisma.purchaseReceipt.findUnique({
    where: { id },
    select: {
      id: true,
      branchId: true,
      proveedor: true,
      folioFacturaProveedor: true,
      facturaUrl: true,
      formaPagoProveedor: true,
      estadoPago: true,
      fechaVencimiento: true,
      fechaPago: true,
      totalPagado: true,
      notas: true,
      createdAt: true,
      branch: { select: { id: true, name: true } },
      user: { select: { id: true, name: true } },
      inventoryMovements: {
        select: {
          id: true,
          quantity: true,
          precioUnitarioPagado: true,
          productVariantId: true,
          simpleProductId: true,
          productVariant: {
            select: {
              id: true,
              sku: true,
              modelo: { select: { nombre: true } },
              color: { select: { nombre: true } },
              voltaje: { select: { label: true } },
            },
          },
          simpleProduct: {
            select: { id: true, nombre: true, categoria: true, codigo: true },
          },
        },
      },
      batteryLots: {
        select: {
          id: true,
          receivedAt: true,
          productVariant: {
            select: { sku: true, modelo: { select: { nombre: true } } },
          },
          _count: { select: { batteries: true } },
        },
      },
    },
  });

  if (!receipt) notFound();
  if (role !== "ADMIN" && receipt.branchId !== branchId) notFound();

  const variantLines = receipt.inventoryMovements
    .filter((m) => m.productVariantId !== null && m.productVariant !== null)
    .map((m) => ({
      movementId: m.id,
      productVariantId: m.productVariantId!,
      sku: m.productVariant!.sku,
      descripcion: [
        m.productVariant!.modelo?.nombre,
        m.productVariant!.color?.nombre,
        m.productVariant!.voltaje?.label,
      ]
        .filter(Boolean)
        .join(" · "),
      quantity: m.quantity,
      precioUnitarioPagado: m.precioUnitarioPagado?.toString() ?? null,
    }));

  const simpleLines = receipt.inventoryMovements
    .filter((m) => m.simpleProductId !== null && m.simpleProduct !== null)
    .map((m) => ({
      movementId: m.id,
      simpleProductId: m.simpleProductId!,
      codigo: m.simpleProduct!.codigo,
      nombre: m.simpleProduct!.nombre,
      categoria: m.simpleProduct!.categoria,
      quantity: m.quantity,
      precioUnitarioPagado: m.precioUnitarioPagado?.toString() ?? null,
    }));

  const batteryLots = receipt.batteryLots
    .filter((l) => l.productVariant !== null)
    .map((l) => ({
      id: l.id,
      receivedAt: l.receivedAt.toISOString(),
      sku: l.productVariant!.sku,
      modelo: l.productVariant!.modelo.nombre,
      totalBaterias: l._count.batteries,
    }));

  const data: SerializedReceiptDetail = {
    id: receipt.id,
    branch: receipt.branch,
    proveedor: receipt.proveedor,
    folioFacturaProveedor: receipt.folioFacturaProveedor,
    facturaUrl: receipt.facturaUrl,
    formaPagoProveedor: receipt.formaPagoProveedor,
    estadoPago: receipt.estadoPago,
    fechaVencimiento: receipt.fechaVencimiento?.toISOString() ?? null,
    fechaPago: receipt.fechaPago?.toISOString() ?? null,
    totalPagado: Number(receipt.totalPagado),
    notas: receipt.notas,
    createdAt: receipt.createdAt.toISOString(),
    registeredBy: {
      id: receipt.user.id,
      name: receipt.user.name,
    },
    variantLines,
    simpleLines,
    batteryLots,
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Back link */}
      <Link
        href="/inventario/recepciones"
        className="inline-flex items-center gap-1.5 text-sm font-medium"
        style={{ color: "var(--on-surf-var)", textDecoration: "none" }}
      >
        <ChevronLeft className="h-4 w-4" />
        Recepciones
      </Link>

      <RecepcionDetail data={data} />
    </div>
  );
}
