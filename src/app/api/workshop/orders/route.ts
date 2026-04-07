import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface SessionUser {
  id: string;
  branchId: string;
}

const newOrderSchema = z.object({
  customerId: z.string().optional(),
  customerBikeId: z.string().optional(),
  customerName: z.string().min(1, "El nombre del cliente es obligatorio"),
  customerPhone: z.string().optional(),
  bikeInfo: z.string().min(1, "Los detalles de la bicicleta son obligatorios"),
  diagnosis: z.string().min(1, "El diagnóstico es obligatorio"),
});

// POST /api/workshop/orders — crear nueva orden de servicio
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId } = session.user as unknown as SessionUser;

  if (!branchId) {
    return NextResponse.json({ success: false, error: "Empleado sin sucursal asignada." }, { status: 400 });
  }

  const body: unknown = await req.json();
  const parsed = newOrderSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const input = parsed.data;

  try {
    let customer;
    if (input.customerId) {
      customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    } else if (input.customerPhone) {
      customer = await prisma.customer.findUnique({ where: { phone: input.customerPhone } });
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: input.customerName,
          phone: input.customerPhone || null,
        },
      });
    } else if (!input.customerId && customer.name !== input.customerName) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { name: input.customerName },
      });
    }

    const folio = `TS-${Date.now().toString().slice(-5)}`;

    const newOrder = await prisma.serviceOrder.create({
      data: {
        folio,
        branchId,
        userId,
        customerId: customer.id,
        customerBikeId: input.customerBikeId || null,
        bikeInfo: input.bikeInfo,
        diagnosis: input.diagnosis,
        status: "PENDING",
      },
    });

    return NextResponse.json({ success: true, data: { orderId: newOrder.id, folio: newOrder.folio } });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al crear la orden";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
