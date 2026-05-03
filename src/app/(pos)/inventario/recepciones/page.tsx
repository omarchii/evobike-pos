import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBranchedUserOrRedirect } from "@/lib/auth-guards";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import { RecepcionesList } from "./recepciones-list";
import type { SerializedReceiptListItem, ReceiptFilters } from "./types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 20;
const VALID_ESTADOS = ["PAGADA", "PENDIENTE", "CREDITO"] as const;
type ValidEstado = (typeof VALID_ESTADOS)[number];

export default async function RecepcionesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await getServerSession(authOptions);
  const { role, branchId } = requireBranchedUserOrRedirect(session);
  if (role !== "ADMIN" && role !== "MANAGER") redirect("/");

  const params = await searchParams;

  const searchParam =
    typeof params.search === "string" ? params.search.trim() : "";
  const estadoPagoParam =
    typeof params.estadoPago === "string" ? params.estadoPago : "";
  const proveedorParam =
    typeof params.proveedor === "string" ? params.proveedor : "";
  const vencDesdeParam =
    typeof params.vencimientoDesde === "string"
      ? params.vencimientoDesde
      : "";
  const vencHastaParam =
    typeof params.vencimientoHasta === "string"
      ? params.vencimientoHasta
      : "";
  const pageParam =
    typeof params.page === "string"
      ? Math.max(1, parseInt(params.page) || 1)
      : 1;

  const where: Prisma.PurchaseReceiptWhereInput = {
    ...(role !== "ADMIN" ? { branchId } : {}),
    ...(estadoPagoParam &&
    (VALID_ESTADOS as readonly string[]).includes(estadoPagoParam)
      ? { estadoPago: estadoPagoParam as ValidEstado }
      : {}),
    ...(proveedorParam ? { proveedor: proveedorParam } : {}),
    ...(vencDesdeParam || vencHastaParam
      ? {
          fechaVencimiento: {
            ...(vencDesdeParam ? { gte: vencDesdeParam } : {}),
            ...(vencHastaParam ? { lte: vencHastaParam } : {}),
          },
        }
      : {}),
    ...(searchParam
      ? {
          OR: [
            { folioFacturaProveedor: { contains: searchParam, mode: "insensitive" } },
            { proveedor: { contains: searchParam, mode: "insensitive" } },
          ],
        }
      : {}),
  };

  const baseWhere: Prisma.PurchaseReceiptWhereInput =
    role !== "ADMIN" ? { branchId } : {};

  const [rawRows, total, distinctProveedores] = await Promise.all([
    prisma.purchaseReceipt.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (pageParam - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        proveedor: true,
        folioFacturaProveedor: true,
        facturaUrl: true,
        formaPagoProveedor: true,
        estadoPago: true,
        fechaVencimiento: true,
        fechaPago: true,
        totalPagado: true,
        createdAt: true,
        branch: { select: { id: true, name: true } },
        user: { select: { name: true } },
        _count: { select: { inventoryMovements: true, batteryLots: true } },
      },
    }),
    prisma.purchaseReceipt.count({ where }),
    prisma.purchaseReceipt.findMany({
      where: baseWhere,
      select: { proveedor: true },
      distinct: ["proveedor"],
      orderBy: { proveedor: "asc" },
    }),
  ]);

  const rows: SerializedReceiptListItem[] = rawRows.map((r) => ({
    id: r.id,
    proveedor: r.proveedor,
    folioFacturaProveedor: r.folioFacturaProveedor,
    facturaUrl: r.facturaUrl,
    formaPagoProveedor: r.formaPagoProveedor as "CONTADO" | "CREDITO" | "TRANSFERENCIA",
    estadoPago: r.estadoPago as "PAGADA" | "PENDIENTE" | "CREDITO",
    fechaVencimiento: r.fechaVencimiento,
    fechaPago: r.fechaPago?.toISOString() ?? null,
    totalPagado: Number(r.totalPagado),
    createdAt: r.createdAt.toISOString(),
    branch: r.branch,
    registeredBy: r.user.name ?? "—",
    totalLineas: r._count.inventoryMovements,
    totalLotes: r._count.batteryLots,
  }));

  const filters: ReceiptFilters = {
    search: searchParam,
    estadoPago: estadoPagoParam,
    proveedor: proveedorParam,
    vencimientoDesde: vencDesdeParam,
    vencimientoHasta: vencHastaParam,
    page: pageParam,
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col">
      <RecepcionesList
        rows={rows}
        total={total}
        totalPages={Math.ceil(total / PAGE_SIZE)}
        proveedores={distinctProveedores.map((p) => p.proveedor)}
        currentFilters={filters}
      />
    </div>
  );
}
