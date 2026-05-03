import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { adjustStock, upsertStockVariant, upsertStockSimple } from "@/lib/stock-ops";

export class TransferStateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferStateError";
  }
}

export class TransferPermissionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferPermissionError";
  }
}

export class TransferStockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferStockError";
  }
}

export class TransferPolymorphismError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferPolymorphismError";
  }
}

export class TransferBatteryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferBatteryError";
  }
}

export class TransferCustomerBikeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TransferCustomerBikeError";
  }
}

export interface SessionUser {
  id: string;
  role: string;
  branchId: string;
}

type TxClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];

const TRANSFER_INCLUDE = {
  items: {
    include: {
      productVariant: {
        select: {
          id: true,
          modelo: { select: { nombre: true } },
          color: { select: { nombre: true } },
          voltaje: { select: { valor: true, label: true } },
        },
      },
      simpleProduct: { select: { id: true, nombre: true } },
      battery: {
        select: { id: true, serialNumber: true, status: true, branchId: true },
      },
      customerBike: {
        select: {
          id: true,
          serialNumber: true,
          brand: true,
          model: true,
          color: true,
          customerId: true,
          branchId: true,
          batteryAssignments: {
            where: { isCurrent: true, unassignedAt: null },
            select: {
              id: true,
              batteryId: true,
              battery: { select: { id: true, branchId: true } },
            },
          },
        },
      },
    },
  },
  fromBranch: { select: { id: true, name: true, code: true } },
  toBranch: { select: { id: true, name: true, code: true } },
  creadoPorUser: { select: { id: true, name: true } },
} as const;

export type TransferWithItems = Awaited<ReturnType<typeof loadTransferWithItems>>;

export async function loadTransferWithItems(tx: TxClient, id: string) {
  return tx.stockTransfer.findUnique({
    where: { id },
    include: TRANSFER_INCLUDE,
  });
}

export async function generarFolioTransferencia(tx: TxClient, fromBranchId: string): Promise<string> {
  const branch = await tx.branch.findUnique({
    where: { id: fromBranchId },
    select: { code: true },
  });
  const branchCode = branch?.code ?? "UNK";
  const count = await tx.stockTransfer.count({ where: { fromBranchId } });
  const seq = String(count + 1).padStart(4, "0");
  return `TRF-${branchCode}-${seq}`;
}

export function canUserReceive(user: SessionUser, transfer: { toBranchId: string }): boolean {
  return user.role === "ADMIN" || (user.role === "MANAGER" && user.branchId === transfer.toBranchId);
}

export function canUserDispatch(user: SessionUser, transfer: { fromBranchId: string }): boolean {
  return user.role === "ADMIN" || (user.role === "MANAGER" && user.branchId === transfer.fromBranchId);
}

export function canUserCreateSolicitada(user: SessionUser, toBranchId: string): boolean {
  return user.role === "ADMIN" || user.branchId === toBranchId;
}

export function canUserCreateBorrador(user: SessionUser, fromBranchId: string): boolean {
  return user.role === "ADMIN" || (user.role === "MANAGER" && user.branchId === fromBranchId);
}

export function canUserCancel(
  user: SessionUser,
  transfer: { status: string; fromBranchId: string; toBranchId: string; creadoPor: string },
): boolean {
  if (user.role === "ADMIN") return true;
  const isManagerOrigin = user.role === "MANAGER" && user.branchId === transfer.fromBranchId;
  const isManagerDest = user.role === "MANAGER" && user.branchId === transfer.toBranchId;
  switch (transfer.status) {
    case "SOLICITADA":
      return user.id === transfer.creadoPor || isManagerOrigin || isManagerDest;
    case "BORRADOR":
      return isManagerOrigin;
    case "EN_TRANSITO":
      return isManagerOrigin || isManagerDest;
    default:
      return false;
  }
}

export function canUserEditBorrador(
  user: SessionUser,
  transfer: { fromBranchId: string; creadoPor: string },
): boolean {
  return (
    user.role === "ADMIN" ||
    (user.role === "MANAGER" && user.branchId === transfer.fromBranchId) ||
    user.id === transfer.creadoPor
  );
}

export function canUserSeeTransfer(
  user: SessionUser,
  transfer: { fromBranchId: string; toBranchId: string; creadoPor: string },
): boolean {
  if (user.role === "ADMIN") return true;
  if (user.role === "MANAGER") {
    return user.branchId === transfer.fromBranchId || user.branchId === transfer.toBranchId;
  }
  return user.id === transfer.creadoPor || user.branchId === transfer.toBranchId;
}

export function mapTransferError(error: unknown): { message: string; status: number } {
  if (error instanceof TransferStateError) return { message: error.message, status: 409 };
  if (error instanceof TransferPermissionError) return { message: error.message, status: 403 };
  if (error instanceof TransferStockError) return { message: error.message, status: 409 };
  if (error instanceof TransferPolymorphismError) return { message: error.message, status: 422 };
  if (error instanceof TransferBatteryError) return { message: error.message, status: 422 };
  if (error instanceof TransferCustomerBikeError) return { message: error.message, status: 422 };
  return { message: "Error interno del servidor", status: 500 };
}

type LoadedTransfer = NonNullable<TransferWithItems>;
type LoadedItem = LoadedTransfer["items"][number];

export async function ejecutarDespachoItems(
  tx: TxClient,
  transfer: Pick<LoadedTransfer, "id" | "folio" | "fromBranchId" | "toBranchId">,
  items: LoadedItem[],
  userId: string,
): Promise<void> {
  for (const item of items) {
    if (item.productVariantId) {
      const stock = await tx.stock.findUnique({
        where: { productVariantId_branchId: { productVariantId: item.productVariantId, branchId: transfer.fromBranchId } },
        select: { id: true, quantity: true, version: true },
      });
      if (!stock || stock.quantity < item.cantidadEnviada) {
        throw new TransferStockError(
          `Stock insuficiente para el producto (ID: ${item.productVariantId}) en la sucursal de origen`,
        );
      }
      await adjustStock(tx, stock.id, -item.cantidadEnviada, stock.version);
      await tx.inventoryMovement.create({
        data: {
          productVariantId: item.productVariantId,
          branchId: transfer.fromBranchId,
          userId,
          quantity: item.cantidadEnviada,
          type: "TRANSFER_OUT",
          referenceId: transfer.id,
        },
      });
    } else if (item.simpleProductId) {
      const stock = await tx.stock.findUnique({
        where: { simpleProductId_branchId: { simpleProductId: item.simpleProductId, branchId: transfer.fromBranchId } },
        select: { id: true, quantity: true, version: true },
      });
      if (!stock || stock.quantity < item.cantidadEnviada) {
        throw new TransferStockError(
          `Stock insuficiente para el producto simple (ID: ${item.simpleProductId}) en la sucursal de origen`,
        );
      }
      await adjustStock(tx, stock.id, -item.cantidadEnviada, stock.version);
      await tx.inventoryMovement.create({
        data: {
          simpleProductId: item.simpleProductId,
          branchId: transfer.fromBranchId,
          userId,
          quantity: item.cantidadEnviada,
          type: "TRANSFER_OUT",
          referenceId: transfer.id,
        },
      });
    } else if (item.batteryId) {
      const battery = await tx.battery.findUnique({
        where: { id: item.batteryId },
        select: { id: true, branchId: true, status: true },
      });
      if (!battery || battery.branchId !== transfer.fromBranchId || battery.status !== "IN_STOCK") {
        throw new TransferBatteryError(
          `La batería (ID: ${item.batteryId}) no está disponible en la sucursal de origen`,
        );
      }
      await tx.battery.update({
        where: { id: item.batteryId },
        data: { branchId: transfer.toBranchId, status: "IN_TRANSIT" },
      });
    } else if (item.customerBikeId) {
      const bike = await tx.customerBike.findUnique({
        where: { id: item.customerBikeId },
        select: {
          id: true,
          branchId: true,
          customerId: true,
          batteryAssignments: {
            where: { isCurrent: true, unassignedAt: null },
            select: { batteryId: true },
          },
        },
      });
      if (!bike || bike.branchId !== transfer.fromBranchId) {
        throw new TransferCustomerBikeError(
          `La bicicleta (ID: ${item.customerBikeId}) no se encuentra en la sucursal de origen`,
        );
      }
      if (bike.customerId !== null) {
        throw new TransferCustomerBikeError(
          `La bicicleta (ID: ${item.customerBikeId}) está asignada a un cliente y no puede transferirse`,
        );
      }
      if (bike.batteryAssignments.length === 0) {
        throw new TransferCustomerBikeError(
          `La bicicleta (ID: ${item.customerBikeId}) no tiene batería instalada y no puede transferirse`,
        );
      }
      await tx.customerBike.update({
        where: { id: item.customerBikeId },
        data: { branchId: transfer.toBranchId },
      });
      for (const assignment of bike.batteryAssignments) {
        await tx.battery.update({
          where: { id: assignment.batteryId },
          data: { branchId: transfer.toBranchId },
        });
      }
    } else {
      throw new TransferPolymorphismError("Ítem sin tipo de producto definido");
    }
  }
}

export async function ejecutarReversaItems(
  tx: TxClient,
  transfer: Pick<LoadedTransfer, "id" | "folio" | "fromBranchId" | "toBranchId">,
  items: LoadedItem[],
  userId: string,
): Promise<void> {
  for (const item of items) {
    if (item.productVariantId) {
      await upsertStockVariant(tx, item.productVariantId, transfer.fromBranchId, item.cantidadEnviada);
      await tx.inventoryMovement.create({
        data: {
          productVariantId: item.productVariantId,
          branchId: transfer.fromBranchId,
          userId,
          quantity: item.cantidadEnviada,
          type: "ADJUSTMENT",
          referenceId: transfer.id,
        },
      });
    } else if (item.simpleProductId) {
      await upsertStockSimple(tx, item.simpleProductId, transfer.fromBranchId, item.cantidadEnviada);
      await tx.inventoryMovement.create({
        data: {
          simpleProductId: item.simpleProductId,
          branchId: transfer.fromBranchId,
          userId,
          quantity: item.cantidadEnviada,
          type: "ADJUSTMENT",
          referenceId: transfer.id,
        },
      });
    } else if (item.batteryId) {
      await tx.battery.update({
        where: { id: item.batteryId },
        data: { branchId: transfer.fromBranchId, status: "IN_STOCK" },
      });
    } else if (item.customerBikeId) {
      const bike = await tx.customerBike.findUnique({
        where: { id: item.customerBikeId },
        select: {
          batteryAssignments: {
            where: { isCurrent: true, unassignedAt: null },
            select: { batteryId: true },
          },
        },
      });
      await tx.customerBike.update({
        where: { id: item.customerBikeId },
        data: { branchId: transfer.fromBranchId },
      });
      if (bike) {
        for (const assignment of bike.batteryAssignments) {
          await tx.battery.update({
            where: { id: assignment.batteryId },
            data: { branchId: transfer.fromBranchId },
          });
        }
      }
    }
  }
}

export function handlePrismaError(error: unknown): { message: string; status: number } {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") return { message: "Registro duplicado", status: 409 };
    if (error.code === "P2003") return { message: "Referencia inválida", status: 422 };
  }
  console.error("[transferencias]", error);
  const message = error instanceof Error ? error.message : "Error interno del servidor";
  return { message, status: 500 };
}
