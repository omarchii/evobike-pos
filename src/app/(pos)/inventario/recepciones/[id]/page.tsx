import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBranchedUserOrRedirect } from "@/lib/auth-guards";
import { sign } from "@/lib/storage/blob";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { RecepcionDetail } from "./recepcion-detail";
import type { SerializedReceiptDetail } from "./recepcion-detail";

export const dynamic = "force-dynamic";

export default async function RecepcionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getServerSession(authOptions);
  const { role, branchId } = requireBranchedUserOrRedirect(session);
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/");

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
              capacidad: { select: { nombre: true } },
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

  // AssemblyOrders generadas por esta recepción (ensamble programado S3).
  const assemblyOrders = receipt
    ? await prisma.assemblyOrder.findMany({
        where: { receiptReference: receipt.id },
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          productVariant: {
            select: {
              sku: true,
              modelo: { select: { nombre: true } },
              color: { select: { nombre: true } },
              voltaje: { select: { label: true } },
              capacidad: { select: { nombre: true } },
            },
          },
          batteryConfiguration: {
            select: {
              batteryVariant: {
                select: {
                  voltaje: { select: { label: true } },
                  capacidad: { select: { nombre: true } },
                },
              },
            },
          },
          reservedBatteries: {
            select: { serialNumber: true },
            orderBy: { createdAt: "asc" },
          },
        },
      })
    : [];

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
        m.productVariant!.capacidad?.nombre,
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

  // Agrupar assemblyOrders por variante para mostrar "unidades por vehículo".
  type AssemblyGroup = {
    variantSku: string;
    vehicleDesc: string;
    units: Array<{
      orderId: string;
      configLabel: string | null;
      serials: string[];
    }>;
  };
  const groupMap = new Map<string, AssemblyGroup>();
  for (const ao of assemblyOrders) {
    if (!ao.productVariant) continue;
    const key = ao.productVariant.sku;
    const g = groupMap.get(key) ?? {
      variantSku: ao.productVariant.sku,
      vehicleDesc: [
        ao.productVariant.modelo?.nombre,
        ao.productVariant.color?.nombre,
        ao.productVariant.voltaje?.label,
        ao.productVariant.capacidad?.nombre,
      ]
        .filter(Boolean)
        .join(" · "),
      units: [],
    };
    const cfg = ao.batteryConfiguration;
    const configLabel = cfg
      ? `${cfg.batteryVariant.voltaje.label} · ${cfg.batteryVariant.capacidad?.nombre ?? "—"}`
      : null;
    g.units.push({
      orderId: ao.id,
      configLabel,
      serials: ao.reservedBatteries.map((b) => b.serialNumber),
    });
    groupMap.set(key, g);
  }
  const assemblyGroups = Array.from(groupMap.values());

  const batteryLots = receipt.batteryLots
    .filter((l) => l.productVariant !== null)
    .map((l) => ({
      id: l.id,
      receivedAt: l.receivedAt.toISOString(),
      sku: l.productVariant!.sku,
      modelo: l.productVariant!.modelo.nombre,
      totalBaterias: l._count.batteries,
    }));

  const facturaSignedUrl = receipt.facturaUrl
    ? await sign(receipt.facturaUrl)
    : null;

  const data: SerializedReceiptDetail = {
    id: receipt.id,
    branch: receipt.branch,
    proveedor: receipt.proveedor,
    folioFacturaProveedor: receipt.folioFacturaProveedor,
    facturaUrl: facturaSignedUrl,
    formaPagoProveedor: receipt.formaPagoProveedor,
    estadoPago: receipt.estadoPago,
    fechaVencimiento: receipt.fechaVencimiento,
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
    assemblyGroups,
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
