import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
  TransferStateError,
  TransferPermissionError,
  TransferStockError,
  TransferBatteryError,
  TransferCustomerBikeError,
  TransferPolymorphismError,
  canUserDispatch,
  loadTransferWithItems,
  ejecutarDespachoItems,
  mapTransferError,
  handlePrismaError,
} from "@/lib/transferencias";

export async function POST(
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
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await loadTransferWithItems(tx, id);
      if (!transfer) throw Object.assign(new Error("Transferencia no encontrada"), { httpStatus: 404 });

      if (transfer.status !== "BORRADOR") {
        throw new TransferStateError("Solo se pueden despachar transferencias en estado BORRADOR");
      }

      if (!canUserDispatch(user, transfer)) {
        throw new TransferPermissionError(
          "Solo el MANAGER de la sucursal de origen o ADMIN puede despachar esta transferencia",
        );
      }

      await ejecutarDespachoItems(tx, transfer, transfer.items, user.id);

      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: "EN_TRANSITO",
          despachadoPor: user.id,
          despachadoAt: new Date(),
        },
        select: { id: true, folio: true, status: true, despachadoAt: true },
      });
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    if ((error as { httpStatus?: number }).httpStatus === 404) {
      return NextResponse.json({ success: false, error: (error as Error).message }, { status: 404 });
    }
    if (
      error instanceof TransferStateError ||
      error instanceof TransferPermissionError ||
      error instanceof TransferStockError ||
      error instanceof TransferBatteryError ||
      error instanceof TransferCustomerBikeError ||
      error instanceof TransferPolymorphismError
    ) {
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
