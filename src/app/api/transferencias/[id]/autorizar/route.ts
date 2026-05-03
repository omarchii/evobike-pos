import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { autorizarTransferSchema } from "@/lib/validators/transferencias";
import {
  TransferStateError,
  TransferPermissionError,
  TransferStockError,
  TransferBatteryError,
  TransferCustomerBikeError,
  TransferPolymorphismError,
  loadTransferWithItems,
  ejecutarDespachoItems,
  mapTransferError,
  handlePrismaError,
} from "@/lib/transferencias";
import { StockConflictError, withStockRetry } from "@/lib/stock-ops";

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

  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json(
      { success: false, error: "Solo MANAGER o ADMIN pueden autorizar transferencias" },
      { status: 403 },
    );
  }

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json().catch(() => ({}));
  } catch {
    body = {};
  }

  const parsed = autorizarTransferSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: first }, { status: 400 });
  }

  const { despacharInmediato = false } = parsed.data;

  try {
    const result = await withStockRetry(() => prisma.$transaction(async (tx) => {
      const transfer = await loadTransferWithItems(tx, id);
      if (!transfer) throw Object.assign(new Error("Transferencia no encontrada"), { httpStatus: 404 });

      if (transfer.status !== "SOLICITADA") {
        throw new TransferStateError("Solo se pueden autorizar transferencias en estado SOLICITADA");
      }

      // MANAGER must belong to fromBranch
      if (user.role === "MANAGER" && user.branchId !== transfer.fromBranchId) {
        throw new TransferPermissionError("Solo el MANAGER de la sucursal de origen puede autorizar esta transferencia");
      }

      const now = new Date();

      if (despacharInmediato) {
        await ejecutarDespachoItems(tx, transfer, transfer.items, user.id);
        return tx.stockTransfer.update({
          where: { id },
          data: {
            status: "EN_TRANSITO",
            autorizadoPor: user.id,
            autorizadoAt: now,
            despachadoPor: user.id,
            despachadoAt: now,
          },
          select: { id: true, folio: true, status: true, autorizadoAt: true, despachadoAt: true },
        });
      }

      return tx.stockTransfer.update({
        where: { id },
        data: {
          status: "BORRADOR",
          autorizadoPor: user.id,
          autorizadoAt: now,
        },
        select: { id: true, folio: true, status: true, autorizadoAt: true },
      });
    }));

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof StockConflictError) {
      return NextResponse.json({ success: false, error: "Conflicto de concurrencia en stock. Intenta de nuevo." }, { status: 409 });
    }
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
