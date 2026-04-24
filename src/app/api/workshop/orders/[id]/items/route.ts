import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { calculateHourlyPrice } from "@/lib/workshop";
import { getViewBranchId } from "@/lib/branch-filter";
import type { SessionUser } from "@/lib/auth-types";

const addItemSchema = z
  .object({
    productVariantId: z.string().optional(),
    simpleProductId: z.string().optional(),
    serviceCatalogId: z.string().uuid().optional(),
    description: z.string().optional(),
    quantity: z.number().int().positive(),
    price: z.number().nonnegative().optional(),
    laborMinutes: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    const refs = [
      data.serviceCatalogId,
      data.productVariantId,
      data.simpleProductId,
    ].filter((v) => v != null).length;
    if (refs > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Un ítem solo puede referenciar un catálogo, una variante o un producto simple",
      });
    }
    if (refs === 0 && (!data.description || !data.price)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "El ítem libre requiere descripción y precio",
      });
    }
  });

const removeItemSchema = z.object({
  itemId: z.string().min(1, "ID de ítem requerido"),
});

// POST /api/workshop/orders/[id]/items — agregar concepto a la orden.
// Reglas de precio server-side:
//   - serviceCatalogId + HOURLY  → exige laborMinutes > 0, price = hourlyRate × min / 60
//   - serviceCatalogId + FIXED   → price = catalog.basePrice
//   - Sin catálogo (variant, simple, libre) → price obligatorio en el payload
// isExtra se marca true si la orden está en IN_PROGRESS o COMPLETED
// (cualquier ítem agregado post-diagnóstico inicial). PENDING → false.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const branchId = await getViewBranchId();

  if (!branchId) {
    return NextResponse.json({ success: false, error: "Selecciona una sucursal para operar" }, { status: 400 });
  }

  const { id: serviceOrderId } = await params;

  const body: unknown = await req.json();
  const parsed = addItemSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: { id: true, status: true, branchId: true },
    });
    if (!order) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }
    if (order.branchId !== branchId) {
      return NextResponse.json(
        { success: false, error: "Sin acceso a esta orden" },
        { status: 403 },
      );
    }
    if (order.status === "DELIVERED" || order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "No se puede modificar una orden cerrada/cancelada" },
        { status: 400 }
      );
    }

    // ── Resolver precio y descripción según catálogo ──
    let priceDecimal: Prisma.Decimal;
    let quantity = data.quantity;
    let description: string;
    let laborMinutes: number | null = null;

    if (data.serviceCatalogId) {
      const catalog = await prisma.serviceCatalog.findUnique({
        where: { id: data.serviceCatalogId },
        select: { name: true, basePrice: true, chargeModel: true, branchId: true, isActive: true },
      });
      if (!catalog || !catalog.isActive || catalog.branchId !== branchId) {
        return NextResponse.json(
          { success: false, error: "Servicio del catálogo no encontrado o inactivo" },
          { status: 422 },
        );
      }
      if (catalog.chargeModel === "HOURLY") {
        if (!data.laborMinutes) {
          return NextResponse.json(
            {
              success: false,
              error: `"${catalog.name}" requiere minutos de mano de obra`,
            },
            { status: 422 },
          );
        }
        const branch = await prisma.branch.findUnique({
          where: { id: branchId },
          select: { hourlyRate: true },
        });
        try {
          priceDecimal = calculateHourlyPrice(branch?.hourlyRate, data.laborMinutes);
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : "No se pudo calcular el precio por hora";
          return NextResponse.json({ success: false, error: message }, { status: 422 });
        }
        laborMinutes = data.laborMinutes;
        quantity = 1; // convención HOURLY: una sola línea, tiempo en laborMinutes
        description = data.description ?? catalog.name;
      } else {
        priceDecimal = catalog.basePrice;
        description = data.description ?? catalog.name;
      }
    } else {
      if (data.price == null) {
        return NextResponse.json(
          { success: false, error: "El ítem requiere precio" },
          { status: 422 },
        );
      }
      priceDecimal = new Prisma.Decimal(data.price);
      description = data.description ?? "";
      if (!description) {
        return NextResponse.json(
          { success: false, error: "El ítem requiere descripción" },
          { status: 422 },
        );
      }
    }

    // ítem agregado post-diagnóstico (cualquier status ≠ PENDING) = extra
    const isExtra = order.status !== "PENDING";

    // Nota: el descuento de stock ocurre al ENTREGAR la orden (D3 del spec),
    // no al agregar la refacción. El endpoint deliver valida stock e impacta
    // inventario atómicamente. Ver /api/service-orders/[id]/deliver.
    await prisma.$transaction(async (tx) => {
      await tx.serviceOrderItem.create({
        data: {
          serviceOrderId,
          serviceCatalogId: data.serviceCatalogId ?? null,
          productVariantId: data.productVariantId ?? null,
          simpleProductId: data.simpleProductId ?? null,
          description,
          quantity,
          price: priceDecimal,
          laborMinutes,
          isExtra,
        },
      });

      const items = await tx.serviceOrderItem.findMany({ where: { serviceOrderId } });
      const subtotal = items.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);

      await tx.serviceOrder.update({
        where: { id: serviceOrderId },
        data: { subtotal, total: subtotal },
      });
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[api/workshop/orders/[id]/items POST]", error);
    const message = error instanceof Error ? error.message : "Error al agregar el concepto";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

// DELETE /api/workshop/orders/[id]/items — eliminar concepto de la orden
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const branchId = await getViewBranchId();

  if (!branchId) {
    return NextResponse.json({ success: false, error: "Selecciona una sucursal para operar" }, { status: 400 });
  }

  const { id: serviceOrderId } = await params;

  const body: unknown = await req.json();
  const parsed = removeItemSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "ID de ítem requerido" }, { status: 400 });
  }

  const { itemId } = parsed.data;

  try {
    const order = await prisma.serviceOrder.findUnique({ where: { id: serviceOrderId } });
    if (!order || order.branchId !== branchId) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }
    if (order.status === "DELIVERED" || order.status === "CANCELLED") {
      return NextResponse.json(
        { success: false, error: "No se puede modificar una orden cerrada" },
        { status: 400 }
      );
    }

    await prisma.serviceOrderItem.delete({ where: { id: itemId } });

    const items = await prisma.serviceOrderItem.findMany({ where: { serviceOrderId } });
    const subtotal = items.reduce((acc, item) => acc + Number(item.price) * item.quantity, 0);

    await prisma.serviceOrder.update({
      where: { id: serviceOrderId },
      data: { subtotal, total: subtotal },
    });

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    console.error("[api/workshop/orders/[id]/items DELETE]", error);
    const message = error instanceof Error ? error.message : "Error al eliminar el concepto";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
