import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { cancelarTransferSchema } from "@/lib/validators/transferencias";
import {
  TransferStateError,
  TransferPermissionError,
  canUserCancel,
  loadTransferWithItems,
  ejecutarReversaItems,
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

  const parsed = cancelarTransferSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: first }, { status: 400 });
  }

  const { motivo } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const transfer = await loadTransferWithItems(tx, id);
      if (!transfer) throw Object.assign(new Error("Transferencia no encontrada"), { httpStatus: 404 });

      const cancelableStatuses = ["SOLICITADA", "BORRADOR", "EN_TRANSITO"];
      if (!cancelableStatuses.includes(transfer.status)) {
        throw new TransferStateError(
          `No se puede cancelar una transferencia en estado ${transfer.status}`,
        );
      }

      if (!canUserCancel(user, transfer)) {
        throw new TransferPermissionError("Sin permiso para cancelar esta transferencia");
      }

      if (transfer.status === "EN_TRANSITO") {
        await ejecutarReversaItems(tx, transfer, transfer.items, user.id);
      }

      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: "CANCELADA",
          canceladoPor: user.id,
          canceladoAt: new Date(),
          motivoCancelacion: motivo,
        },
        select: { id: true, folio: true, status: true, canceladoAt: true, motivoCancelacion: true },
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
