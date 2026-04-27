import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  const { role, branchId } = session.user as unknown as SessionUser;

  if (role !== "ADMIN" && role !== "MANAGER") {
    return NextResponse.json(
      { success: false, error: "Solo MANAGER o ADMIN pueden consultar compras al proveedor" },
      { status: 403 },
    );
  }

  const { id } = await params;

  try {
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
        updatedAt: true,
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

    if (!receipt) {
      return NextResponse.json(
        { success: false, error: "Recepción no encontrada" },
        { status: 404 },
      );
    }
    if (role !== "ADMIN" && receipt.branchId !== branchId) {
      return NextResponse.json(
        { success: false, error: "Recepción de otra sucursal" },
        { status: 403 },
      );
    }

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

    return NextResponse.json({
      success: true,
      data: {
        id: receipt.id,
        branch: receipt.branch,
        proveedor: receipt.proveedor,
        folioFacturaProveedor: receipt.folioFacturaProveedor,
        facturaUrl: receipt.facturaUrl,
        formaPagoProveedor: receipt.formaPagoProveedor,
        estadoPago: receipt.estadoPago,
        fechaVencimiento: receipt.fechaVencimiento,
        fechaPago: receipt.fechaPago?.toISOString() ?? null,
        totalPagado: receipt.totalPagado.toString(),
        notas: receipt.notas,
        createdAt: receipt.createdAt.toISOString(),
        updatedAt: receipt.updatedAt.toISOString(),
        registeredBy: receipt.user,
        variantLines,
        simpleLines,
        batteryLots,
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al obtener recepción";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
