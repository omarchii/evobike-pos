import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireBranchedUser } from "@/lib/auth-guards";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const guard = requireBranchedUser(session);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  const branchId = req.nextUrl.searchParams.get("branchId");
  if (!branchId)
    return NextResponse.json({ success: false, error: "branchId requerido" }, { status: 400 });

  if (user.role !== "ADMIN" && user.branchId !== branchId)
    return NextResponse.json({ success: false, error: "Sin acceso a esa sucursal" }, { status: 403 });

  try {
    const [pvStocks, spStocks, batteries, customerBikes] = await Promise.all([
      prisma.stock.findMany({
        where: { branchId, productVariantId: { not: null }, quantity: { gt: 0 } },
        select: {
          quantity: true,
          productVariant: {
            select: {
              id: true,
              modelo: { select: { nombre: true } },
              color: { select: { nombre: true } },
              voltaje: { select: { valor: true, label: true } },
              capacidad: { select: { nombre: true } },
            },
          },
        },
      }),
      prisma.stock.findMany({
        where: { branchId, simpleProductId: { not: null }, quantity: { gt: 0 } },
        select: {
          quantity: true,
          simpleProduct: { select: { id: true, nombre: true } },
        },
      }),
      prisma.battery.findMany({
        where: { branchId, status: "IN_STOCK" },
        select: { id: true, serialNumber: true },
        orderBy: { serialNumber: "asc" },
      }),
      prisma.customerBike.findMany({
        where: { branchId, customerId: null },
        select: { id: true, serialNumber: true, brand: true, model: true, color: true },
        orderBy: { serialNumber: "asc" },
      }),
    ]);

    const productVariants = pvStocks
      .filter((s) => s.productVariant)
      .map((s) => ({
        id: s.productVariant!.id,
        modelo: s.productVariant!.modelo.nombre,
        color: s.productVariant!.color.nombre,
        voltaje: s.productVariant!.voltaje.label + (s.productVariant!.capacidad ? ` · ${s.productVariant!.capacidad.nombre}` : ""),
        stock: s.quantity,
        label: `${s.productVariant!.modelo.nombre} — ${s.productVariant!.color.nombre} ${s.productVariant!.voltaje.label}${s.productVariant!.capacidad ? ` · ${s.productVariant!.capacidad.nombre}` : ""} (disponible: ${s.quantity})`,
      }));

    const simpleProducts = spStocks
      .filter((s) => s.simpleProduct)
      .map((s) => ({
        id: s.simpleProduct!.id,
        nombre: s.simpleProduct!.nombre,
        stock: s.quantity,
        label: `${s.simpleProduct!.nombre} (disponible: ${s.quantity})`,
      }));

    return NextResponse.json({ success: true, data: { productVariants, simpleProducts, batteries, customerBikes } });
  } catch (error) {
    console.error("[items-disponibles]", error);
    return NextResponse.json({ success: false, error: "Error interno del servidor" }, { status: 500 });
  }
}
