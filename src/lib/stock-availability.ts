import { prisma as globalPrisma } from "@/lib/prisma";
import { GHOST_RESERVATION_TTL_DAYS } from "@/lib/config";

export type AvailabilityEntry = {
  stock: number;
  workshopPending: number;
  assemblyPending: number;
  enCamino: number;
  disponible: number;
};

function ghostCutoff(now: Date): Date {
  const d = new Date(now);
  d.setDate(d.getDate() - GHOST_RESERVATION_TTL_DAYS);
  return d;
}

type Opts = {
  applyGhostFilter?: boolean;
  now?: Date;
  prisma?: typeof globalPrisma;
};

export async function getAvailability(
  ids: string[],
  branchId: string,
  kind: "variant" | "simple",
  opts?: Opts,
): Promise<Map<string, AvailabilityEntry>> {
  if (ids.length === 0) return new Map();
  return kind === "variant"
    ? variantAvailability(ids, branchId, opts)
    : simpleAvailability(ids, branchId, opts);
}

async function variantAvailability(
  ids: string[],
  branchId: string,
  opts?: Opts,
): Promise<Map<string, AvailabilityEntry>> {
  const db = opts?.prisma ?? globalPrisma;
  const cutoff =
    (opts?.applyGhostFilter ?? true)
      ? ghostCutoff(opts?.now ?? new Date())
      : undefined;

  const [stockRows, workshopRows, batteryRows, transitRows] = await Promise.all([
    db.stock.findMany({
      where: { branchId, productVariantId: { in: ids } },
      select: { productVariantId: true, quantity: true },
    }),
    db.serviceOrderItem.groupBy({
      by: ["productVariantId"],
      where: {
        productVariantId: { in: ids },
        inventoryMovementId: null,
        serviceOrder: {
          status: { notIn: ["DELIVERED", "CANCELLED"] },
          branchId,
          ...(cutoff ? { updatedAt: { gte: cutoff } } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    db.battery.findMany({
      where: {
        status: "IN_STOCK",
        assemblyOrderId: { not: null },
        assemblyOrder: { status: "PENDING" },
        branchId,
        lot: { productVariantId: { in: ids } },
      },
      select: { lot: { select: { productVariantId: true } } },
    }),
    db.stockTransferItem.groupBy({
      by: ["productVariantId"],
      where: {
        productVariantId: { in: ids },
        transfer: { status: "EN_TRANSITO", toBranchId: branchId },
      },
      _sum: { cantidadEnviada: true },
    }),
  ]);

  const stockMap = new Map<string, number>();
  for (const r of stockRows) {
    if (r.productVariantId) stockMap.set(r.productVariantId, r.quantity);
  }
  const workshopMap = new Map<string, number>();
  for (const r of workshopRows) {
    if (r.productVariantId) workshopMap.set(r.productVariantId, r._sum.quantity ?? 0);
  }
  const assemblyMap = new Map<string, number>();
  for (const r of batteryRows) {
    const vid = r.lot.productVariantId;
    if (vid) assemblyMap.set(vid, (assemblyMap.get(vid) ?? 0) + 1);
  }
  const transitMap = new Map<string, number>();
  for (const r of transitRows) {
    if (r.productVariantId) transitMap.set(r.productVariantId, r._sum.cantidadEnviada ?? 0);
  }

  return buildResult(ids, stockMap, workshopMap, assemblyMap, transitMap);
}

async function simpleAvailability(
  ids: string[],
  branchId: string,
  opts?: Opts,
): Promise<Map<string, AvailabilityEntry>> {
  const db = opts?.prisma ?? globalPrisma;
  const cutoff =
    (opts?.applyGhostFilter ?? true)
      ? ghostCutoff(opts?.now ?? new Date())
      : undefined;

  const [stockRows, workshopRows, transitRows] = await Promise.all([
    db.stock.findMany({
      where: { branchId, simpleProductId: { in: ids } },
      select: { simpleProductId: true, quantity: true },
    }),
    db.serviceOrderItem.groupBy({
      by: ["simpleProductId"],
      where: {
        simpleProductId: { in: ids },
        inventoryMovementId: null,
        serviceOrder: {
          status: { notIn: ["DELIVERED", "CANCELLED"] },
          branchId,
          ...(cutoff ? { updatedAt: { gte: cutoff } } : {}),
        },
      },
      _sum: { quantity: true },
    }),
    db.stockTransferItem.groupBy({
      by: ["simpleProductId"],
      where: {
        simpleProductId: { in: ids },
        transfer: { status: "EN_TRANSITO", toBranchId: branchId },
      },
      _sum: { cantidadEnviada: true },
    }),
  ]);

  const stockMap = new Map<string, number>();
  for (const r of stockRows) {
    if (r.simpleProductId) stockMap.set(r.simpleProductId, r.quantity);
  }
  const workshopMap = new Map<string, number>();
  for (const r of workshopRows) {
    if (r.simpleProductId) workshopMap.set(r.simpleProductId, r._sum.quantity ?? 0);
  }
  const transitMap = new Map<string, number>();
  for (const r of transitRows) {
    if (r.simpleProductId) transitMap.set(r.simpleProductId, r._sum.cantidadEnviada ?? 0);
  }

  return buildResult(ids, stockMap, workshopMap, new Map(), transitMap);
}

function buildResult(
  ids: string[],
  stock: Map<string, number>,
  workshop: Map<string, number>,
  assembly: Map<string, number>,
  transit: Map<string, number>,
): Map<string, AvailabilityEntry> {
  const out = new Map<string, AvailabilityEntry>();
  for (const id of ids) {
    const s = stock.get(id) ?? 0;
    const wp = workshop.get(id) ?? 0;
    const ap = assembly.get(id) ?? 0;
    const ec = transit.get(id) ?? 0;
    out.set(id, {
      stock: s,
      workshopPending: wp,
      assemblyPending: ap,
      enCamino: ec,
      disponible: Math.max(0, s - wp - ap),
    });
  }
  return out;
}
