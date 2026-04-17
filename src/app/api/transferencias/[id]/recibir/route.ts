import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { recibirTransferSchema } from "@/lib/validators/transferencias";
import {
  TransferStateError,
  TransferPermissionError,
  canUserReceive,
  loadTransferWithItems,
  mapTransferError,
  handlePrismaError,
} from "@/lib/transferencias";

export async function POST(
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

  const parsed = recibirTransferSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: first }, { status: 400 });
  }

  const input = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await loadTransferWithItems(tx, id);
      if (!transfer) throw Object.assign(new Error("Transferencia no encontrada"), { httpStatus: 404 });

      if (transfer.status !== "EN_TRANSITO") {
        throw new TransferStateError("Solo se pueden recibir transferencias en estado EN_TRANSITO");
      }

      if (!canUserReceive(user, transfer)) {
        throw new TransferPermissionError(
          "Solo el MANAGER de la sucursal de destino o ADMIN puede recibir esta transferencia",
        );
      }

      // Validate all body item IDs reference actual transfer items
      const itemMap = new Map(transfer.items.map((i) => [i.id, i]));
      for (const bodyItem of input.items) {
        const transferItem = itemMap.get(bodyItem.id);
        if (!transferItem) {
          throw new TransferStateError(`Ítem con ID ${bodyItem.id} no pertenece a esta transferencia`);
        }
        if (bodyItem.cantidadRecibida > transferItem.cantidadEnviada) {
          throw new TransferStateError(
            `La cantidad recibida no puede superar la enviada para el ítem ${bodyItem.id}`,
          );
        }
        if ((transferItem.batteryId || transferItem.customerBikeId) && bodyItem.cantidadRecibida !== transferItem.cantidadEnviada) {
          throw new TransferStateError(
            `Baterías y bicicletas deben recibirse en su totalidad (ítem ${bodyItem.id})`,
          );
        }
      }

      // Process each body item
      for (const bodyItem of input.items) {
        const transferItem = itemMap.get(bodyItem.id)!;

        await tx.stockTransferItem.update({
          where: { id: bodyItem.id },
          data: { cantidadRecibida: bodyItem.cantidadRecibida },
        });

        if (transferItem.productVariantId) {
          await tx.stock.upsert({
            where: {
              productVariantId_branchId: {
                productVariantId: transferItem.productVariantId,
                branchId: transfer.toBranchId,
              },
            },
            update: { quantity: { increment: bodyItem.cantidadRecibida } },
            create: {
              productVariantId: transferItem.productVariantId,
              branchId: transfer.toBranchId,
              quantity: bodyItem.cantidadRecibida,
            },
          });
          await tx.inventoryMovement.create({
            data: {
              productVariantId: transferItem.productVariantId,
              branchId: transfer.toBranchId,
              userId: user.id,
              quantity: bodyItem.cantidadRecibida,
              type: "TRANSFER_IN",
              referenceId: transfer.id,
            },
          });
          const diff = transferItem.cantidadEnviada - bodyItem.cantidadRecibida;
          if (diff > 0) {
            await tx.inventoryMovement.create({
              data: {
                productVariantId: transferItem.productVariantId,
                branchId: transfer.fromBranchId,
                userId: user.id,
                quantity: -diff,
                type: "ADJUSTMENT",
                referenceId: transfer.id,
              },
            });
          }
        } else if (transferItem.simpleProductId) {
          await tx.stock.upsert({
            where: {
              simpleProductId_branchId: {
                simpleProductId: transferItem.simpleProductId,
                branchId: transfer.toBranchId,
              },
            },
            update: { quantity: { increment: bodyItem.cantidadRecibida } },
            create: {
              simpleProductId: transferItem.simpleProductId,
              branchId: transfer.toBranchId,
              quantity: bodyItem.cantidadRecibida,
            },
          });
          await tx.inventoryMovement.create({
            data: {
              simpleProductId: transferItem.simpleProductId,
              branchId: transfer.toBranchId,
              userId: user.id,
              quantity: bodyItem.cantidadRecibida,
              type: "TRANSFER_IN",
              referenceId: transfer.id,
            },
          });
          const diff = transferItem.cantidadEnviada - bodyItem.cantidadRecibida;
          if (diff > 0) {
            await tx.inventoryMovement.create({
              data: {
                simpleProductId: transferItem.simpleProductId,
                branchId: transfer.fromBranchId,
                userId: user.id,
                quantity: -diff,
                type: "ADJUSTMENT",
                referenceId: transfer.id,
              },
            });
          }
        } else if (transferItem.batteryId) {
          await tx.battery.update({
            where: { id: transferItem.batteryId },
            data: { status: "IN_STOCK" },
          });
        }
        // customerBikeId: no-op (branchId already set during dispatch, status unchanged)
      }

      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: "RECIBIDA",
          recibidoPor: user.id,
          recibidoAt: new Date(),
        },
        select: { id: true, folio: true, status: true, recibidoAt: true },
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    if ((error as { httpStatus?: number }).httpStatus === 404) {
      return NextResponse.json({ success: false, error: (error as Error).message }, { status: 404 });
    }
    if (error instanceof TransferStateError || error instanceof TransferPermissionError) {
      const { message, status } = mapTransferError(error);
      return NextResponse.json({ success: false, error: message }, { status });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2003")
        return NextResponse.json({ success: false, error: "Referencia inválida" }, { status: 422 });
    }
    const { message, status } = handlePrismaError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
