import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
  createTransferSchema,
  type TransferItemInput,
} from "@/lib/validators/transferencias";
import {
  TransferStateError,
  TransferPermissionError,
  TransferStockError,
  TransferBatteryError,
  TransferCustomerBikeError,
  TransferPolymorphismError,
  canUserCreateBorrador,
  generarFolioTransferencia,
  loadTransferWithItems,
  ejecutarDespachoItems,
  mapTransferError,
  handlePrismaError,
} from "@/lib/transferencias";
import { StockConflictError, withStockRetry } from "@/lib/stock-ops";

export async function GET(req: NextRequest): Promise<NextResponse> {
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

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(50, Math.max(1, parseInt(searchParams.get("pageSize") ?? "20")));
  const skip = (page - 1) * pageSize;
  const statusParam = searchParams.get("status");
  const desde = searchParams.get("desde");
  const hasta = searchParams.get("hasta");
  const direccion = searchParams.get("direccion") ?? "todas";

  const VALID_STATUSES = ["SOLICITADA", "BORRADOR", "EN_TRANSITO", "RECIBIDA", "CANCELADA"];

  const where: Prisma.StockTransferWhereInput = {};

  if (statusParam && VALID_STATUSES.includes(statusParam)) {
    where.status = statusParam as Prisma.EnumStockTransferStatusFilter;
  }
  if (desde || hasta) {
    where.createdAt = {
      ...(desde ? { gte: new Date(desde) } : {}),
      ...(hasta ? { lte: new Date(hasta) } : {}),
    };
  }

  // Branch scoping
  if (user.role === "ADMIN") {
    // no branch filter
  } else if (user.role === "MANAGER") {
    const branchFilter: Prisma.StockTransferWhereInput =
      direccion === "entrantes"
        ? { toBranchId: user.branchId }
        : direccion === "salientes"
          ? { fromBranchId: user.branchId }
          : { OR: [{ fromBranchId: user.branchId }, { toBranchId: user.branchId }] };
    Object.assign(where, branchFilter);
  } else {
    // SELLER
    const sellerFilter: Prisma.StockTransferWhereInput =
      direccion === "salientes"
        ? { creadoPor: user.id }
        : { OR: [{ creadoPor: user.id }, { toBranchId: user.branchId }] };
    Object.assign(where, sellerFilter);
  }

  try {
    const [rows, total] = await Promise.all([
      prisma.stockTransfer.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: pageSize,
        select: {
          id: true,
          folio: true,
          status: true,
          fromBranchId: true,
          toBranchId: true,
          creadoPor: true,
          notas: true,
          createdAt: true,
          updatedAt: true,
          fromBranch: { select: { id: true, name: true } },
          toBranch: { select: { id: true, name: true } },
          creadoPorUser: { select: { id: true, name: true } },
          _count: { select: { items: true } },
        },
      }),
      prisma.stockTransfer.count({ where }),
    ]);

    return NextResponse.json({
      success: true,
      data: rows.map((r) => ({
        ...r,
        createdAt: r.createdAt.toISOString(),
        updatedAt: r.updatedAt.toISOString(),
        totalItems: r._count.items,
      })),
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch (error: unknown) {
    const { message, status } = handlePrismaError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "Formato inválido" }, { status: 400 });
  }

  const parsed = createTransferSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: first }, { status: 400 });
  }

  const input = parsed.data;

  // Role-based restrictions
  if (user.role === "SELLER") {
    if (input.toBranchId !== user.branchId) {
      return NextResponse.json(
        { success: false, error: "Solo puedes solicitar transferencias hacia tu propia sucursal" },
        { status: 403 },
      );
    }
    if (input.enviarAhora) {
      return NextResponse.json(
        { success: false, error: "Los vendedores no pueden despachar transferencias" },
        { status: 403 },
      );
    }
  } else if (user.role === "MANAGER") {
    if (!canUserCreateBorrador(user, input.fromBranchId)) {
      return NextResponse.json(
        { success: false, error: "Solo puedes crear transferencias desde tu propia sucursal" },
        { status: 403 },
      );
    }
  }
  // ADMIN: unrestricted

  const initialStatus = user.role === "SELLER" ? "SOLICITADA" : "BORRADOR";
  const enviarAhora = user.role !== "SELLER" && input.enviarAhora === true;

  try {
    const result = await withStockRetry(() => prisma.$transaction(async (tx) => {
      // Validate branches exist
      const [fromBranch, toBranch] = await Promise.all([
        tx.branch.findUnique({ where: { id: input.fromBranchId }, select: { id: true } }),
        tx.branch.findUnique({ where: { id: input.toBranchId }, select: { id: true } }),
      ]);
      if (!fromBranch) throw new Error("Sucursal de origen no encontrada");
      if (!toBranch) throw new Error("Sucursal de destino no encontrada");

      const folio = await generarFolioTransferencia(tx, input.fromBranchId);

      const transfer = await tx.stockTransfer.create({
        data: {
          folio,
          fromBranchId: input.fromBranchId,
          toBranchId: input.toBranchId,
          status: initialStatus,
          creadoPor: user.id,
          notas: input.notas ?? null,
          items: {
            create: input.items.map((item: TransferItemInput) => ({
              productVariantId: item.productVariantId ?? null,
              simpleProductId: item.simpleProductId ?? null,
              batteryId: item.batteryId ?? null,
              customerBikeId: item.customerBikeId ?? null,
              cantidadEnviada: item.cantidadEnviada,
            })),
          },
        },
        select: { id: true, folio: true, status: true },
      });

      if (enviarAhora) {
        const loaded = await loadTransferWithItems(tx, transfer.id);
        if (!loaded) throw new Error("Error al cargar la transferencia recién creada");
        await ejecutarDespachoItems(tx, loaded, loaded.items, user.id);
        await tx.stockTransfer.update({
          where: { id: transfer.id },
          data: {
            status: "EN_TRANSITO",
            despachadoPor: user.id,
            despachadoAt: new Date(),
          },
        });
        return { ...transfer, status: "EN_TRANSITO" as const };
      }

      return transfer;
    }));

    return NextResponse.json({ success: true, data: result }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof StockConflictError) {
      return NextResponse.json({ success: false, error: "Conflicto de concurrencia en stock. Intenta de nuevo." }, { status: 409 });
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
      if (error.code === "P2002")
        return NextResponse.json({ success: false, error: "Folio duplicado" }, { status: 409 });
      if (error.code === "P2003")
        return NextResponse.json({ success: false, error: "Referencia inválida" }, { status: 422 });
    }
    const { message, status } = handlePrismaError(error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
