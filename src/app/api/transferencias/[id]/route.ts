import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { patchTransferSchema, type TransferItemInput } from "@/lib/validators/transferencias";
import {
  canUserSeeTransfer,
  canUserEditBorrador,
  loadTransferWithItems,
  handlePrismaError,
} from "@/lib/transferencias";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  let user;
  try {
    user = await requireActiveUser(session);
  } catch (err) {
    if (err instanceof UserInactiveError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  try {
    const transfer = await loadTransferWithItems(prisma as Parameters<typeof loadTransferWithItems>[0], id);
    if (!transfer) {
      return NextResponse.json({ success: false, error: "Transferencia no encontrada" }, { status: 404 });
    }
    if (!canUserSeeTransfer(user, transfer)) {
      return NextResponse.json({ success: false, error: "Sin acceso a esta transferencia" }, { status: 403 });
    }
    return NextResponse.json({ success: true, data: transfer });
  } catch (error: unknown) {
    const { message, status } = handlePrismaError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  let user;
  try {
    user = await requireActiveUser(session);
  } catch (err) {
    if (err instanceof UserInactiveError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    }
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Formato inválido" }, { status: 400 });
  }

  const parsed = patchTransferSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: first }, { status: 400 });
  }

  const input = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await tx.stockTransfer.findUnique({
        where: { id },
        select: { id: true, status: true, fromBranchId: true, creadoPor: true },
      });
      if (!transfer) return { error: "Transferencia no encontrada", status: 404 as const };
      if (transfer.status !== "BORRADOR") {
        return { error: "Solo se pueden editar transferencias en estado BORRADOR", status: 409 as const };
      }
      if (!canUserEditBorrador(user, transfer)) {
        return { error: "Sin permiso para editar esta transferencia", status: 403 as const };
      }

      const updateData: Prisma.StockTransferUpdateInput = {};
      if (input.notas !== undefined) updateData.notas = input.notas ?? null;

      if (input.items !== undefined) {
        // Replace-all: delete existing items then create new ones
        await tx.stockTransferItem.deleteMany({ where: { transferId: id } });
        updateData.items = {
          create: input.items.map((item: TransferItemInput) => ({
            productVariantId: item.productVariantId ?? null,
            simpleProductId: item.simpleProductId ?? null,
            batteryId: item.batteryId ?? null,
            customerBikeId: item.customerBikeId ?? null,
            cantidadEnviada: item.cantidadEnviada,
          })),
        };
      }

      const updated = await tx.stockTransfer.update({
        where: { id },
        data: updateData,
        select: { id: true, folio: true, status: true, notas: true, updatedAt: true },
      });
      return { updated };
    });

    if ("error" in result) {
      return NextResponse.json({ success: false, error: result.error }, { status: result.status });
    }
    return NextResponse.json({ success: true, data: result.updated });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003")
        return NextResponse.json({ success: false, error: "Referencia inválida en ítem" }, { status: 422 });
    }
    const { message, status } = handlePrismaError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
