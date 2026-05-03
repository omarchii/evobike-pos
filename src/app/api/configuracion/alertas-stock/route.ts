import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  const { searchParams } = req.nextUrl;
  const queryBranchId = searchParams.get("branchId");

  const branchId =
    user.role === "ADMIN"
      ? queryBranchId ?? undefined
      : user.branchId ?? undefined;

  if (user.role === "MANAGER" && !user.branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 },
    );
  }

  const stocks = await prisma.stock.findMany({
    where: {
      ...(branchId ? { branchId } : {}),
      OR: [
        {
          productVariant: {
            isActive: true,
            stockMinimo: { gt: 0 },
          },
        },
        {
          simpleProduct: {
            isActive: true,
            stockMinimo: { gt: 0 },
          },
        },
      ],
    },
    include: {
      branch: { select: { id: true, code: true, name: true } },
      productVariant: {
        select: {
          id: true,
          sku: true,
          stockMinimo: true,
          stockMaximo: true,
          imageUrl: true,
          modelo: { select: { nombre: true } },
          color: { select: { nombre: true } },
          voltaje: { select: { label: true } },
          capacidad: { select: { nombre: true } },
        },
      },
      simpleProduct: {
        select: {
          id: true,
          codigo: true,
          nombre: true,
          categoria: true,
          stockMinimo: true,
          stockMaximo: true,
          imageUrl: true,
        },
      },
    },
  });

  const alerts = stocks
    .map((s) => {
      const min = s.productVariant?.stockMinimo ?? s.simpleProduct?.stockMinimo ?? 0;
      if (min <= 0) return null;
      if (s.quantity > min) return null;
      return {
        kind: s.productVariant ? ("variant" as const) : ("simple" as const),
        stockId: s.id,
        branchId: s.branchId,
        branchCode: s.branch.code,
        branchName: s.branch.name,
        quantity: s.quantity,
        stockMinimo: min,
        delta: s.quantity - min,
        variant: s.productVariant
          ? {
              id: s.productVariant.id,
              sku: s.productVariant.sku,
              imageUrl: s.productVariant.imageUrl,
              modelo: s.productVariant.modelo.nombre,
              color: s.productVariant.color.nombre,
              voltaje: s.productVariant.capacidad
                ? `${s.productVariant.voltaje.label} · ${s.productVariant.capacidad.nombre}`
                : s.productVariant.voltaje.label,
            }
          : null,
        simple: s.simpleProduct
          ? {
              id: s.simpleProduct.id,
              codigo: s.simpleProduct.codigo,
              nombre: s.simpleProduct.nombre,
              categoria: s.simpleProduct.categoria,
              imageUrl: s.simpleProduct.imageUrl,
            }
          : null,
      };
    })
    .filter((x): x is NonNullable<typeof x> => x !== null)
    .sort((a, b) => a.delta - b.delta);

  return NextResponse.json({ success: true, data: alerts });
}
