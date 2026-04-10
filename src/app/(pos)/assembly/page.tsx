import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { redirect } from "next/navigation";
import type { AssemblyOrderRow } from "./assembly-board";
import { AssemblyTabsClient } from "./assembly-tabs-client";
import { Zap } from "lucide-react";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string;
  branchName: string;
}

export default async function AssemblyPage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const { role, branchId } = session.user as unknown as SessionUser;
  const branchFilter = role === "ADMIN" ? {} : { branchId };

  const [rawLots, batteryVariants, allBatteryConfigs, assemblyOrders] = await Promise.all([
    // ── Lotes de baterías ──────────────────────────────────────────────────────
    prisma.batteryLot.findMany({
      where: branchFilter,
      orderBy: { receivedAt: "desc" },
      take: 50,
      select: {
        id: true,
        productVariantId: true,
        supplier: true,
        reference: true,
        receivedAt: true,
        productVariant: {
          select: {
            sku: true,
            modelo: { select: { nombre: true } },
          },
        },
        user: { select: { name: true } },
        _count: { select: { batteries: true } },
        batteries: {
          where: { status: "IN_STOCK" },
          select: { id: true },
        },
      },
    }),

    // ── ProductVariants tipo batería ───────────────────────────────────────────
    prisma.productVariant.findMany({
      where: {
        modelo: { nombre: { contains: "Bat", mode: "insensitive" } },
      },
      select: {
        id: true,
        sku: true,
        modelo: { select: { nombre: true } },
      },
      orderBy: { sku: "asc" },
    }),

    // ── Configuraciones de baterías (para calcular disponibilidad) ────────────
    prisma.batteryConfiguration.findMany({
      select: { modeloId: true, voltajeId: true, batteryVariantId: true, quantity: true },
    }),

    // ── Órdenes de montaje ─────────────────────────────────────────────────────
    prisma.assemblyOrder.findMany({
      where: {
        ...branchFilter,
        status: { in: ["PENDING", "COMPLETED"] },
      },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 100,
      select: {
        id: true,
        status: true,
        notes: true,
        createdAt: true,
        completedAt: true,
        // customerBike es nullable (órdenes de recepción sin VIN todavía)
        customerBike: {
          select: {
            id: true,
            serialNumber: true,
            model: true,
            color: true,
            voltaje: true,
            customer: { select: { id: true, name: true } },
            batteryAssignments: {
              where: { isCurrent: true },
              select: {
                battery: {
                  select: {
                    serialNumber: true,
                    status: true,
                    lot: { select: { reference: true } },
                  },
                },
              },
            },
          },
        },
        // productVariant presente en órdenes generadas por recepción
        productVariant: {
          select: {
            id: true,
            sku: true,
            modelo_id: true,
            voltaje_id: true,
            modelo: { select: { nombre: true } },
            color: { select: { nombre: true } },
            voltaje: { select: { label: true } },
          },
        },
        assembledBy: { select: { id: true, name: true } },
      },
    }),
  ]);

  // ── Serializar ─────────────────────────────────────────────────────────────

  const lots = rawLots.map((l) => ({
    id: l.id,
    supplier: l.supplier,
    reference: l.reference,
    receivedAt: l.receivedAt.toISOString(),
    productVariantSku: l.productVariant.sku,
    batteryTypeName: l.productVariant.modelo.nombre,
    registeredBy: l.user.name,
    totalBatteries: l._count.batteries,
    inStock: l.batteries.length,
    installed: l._count.batteries - l.batteries.length,
  }));

  const variants = batteryVariants.map((v) => ({
    id: v.id,
    sku: v.sku,
    nombre: v.modelo.nombre,
  }));

  const orders: AssemblyOrderRow[] = assemblyOrders.map((o) => ({
    id: o.id,
    status: o.status as "PENDING" | "COMPLETED" | "CANCELLED",
    notes: o.notes,
    createdAt: o.createdAt.toISOString(),
    completedAt: o.completedAt?.toISOString() ?? null,
    customerBike: o.customerBike
      ? {
        id: o.customerBike.id,
        serialNumber: o.customerBike.serialNumber,
        model: o.customerBike.model,
        color: o.customerBike.color,
        voltaje: o.customerBike.voltaje,
        customer: o.customerBike.customer
          ? { id: o.customerBike.customer.id, name: o.customerBike.customer.name }
          : null,
      }
      : null,
    productVariant: o.productVariant
      ? {
        id: o.productVariant.id,
        sku: o.productVariant.sku,
        modeloId: o.productVariant.modelo_id,
        voltajeId: o.productVariant.voltaje_id,
        modeloNombre: o.productVariant.modelo.nombre,
        colorNombre: o.productVariant.color.nombre,
        voltajeLabel: o.productVariant.voltaje.label,
      }
      : null,
    assembledBy: o.assembledBy
      ? { id: o.assembledBy.id, name: o.assembledBy.name }
      : null,
    batteryAssignments: (o.customerBike?.batteryAssignments ?? []).map((ba) => ({
      serialNumber: ba.battery.serialNumber,
      status: ba.battery.status,
      lotReference: ba.battery.lot.reference,
    })),
  }));

  // ── Mapa de disponibilidad de baterías por vehicleProductVariantId ───────────
  // "modeloId:voltajeId" → { batteryVariantId, quantity }
  const configMap = new Map(
    allBatteryConfigs.map((c) => [
      `${c.modeloId}:${c.voltajeId}`,
      { batteryVariantId: c.batteryVariantId, perUnit: c.quantity },
    ])
  );

  // batteryVariantId → count of IN_STOCK batteries (from rawLots, already filtrado por branch)
  const batteryStockMap = new Map<string, number>();
  for (const lot of rawLots) {
    const cur = batteryStockMap.get(lot.productVariantId) ?? 0;
    batteryStockMap.set(lot.productVariantId, cur + lot.batteries.length);
  }

  // vehicleProductVariantId → { available, perUnit }
  const batteryAvailabilityMap: Record<string, { available: number; perUnit: number }> = {};
  for (const order of assemblyOrders) {
    if (!order.productVariant) continue;
    const pvId = order.productVariant.id;
    if (pvId in batteryAvailabilityMap) continue;
    const key = `${order.productVariant.modelo_id}:${order.productVariant.voltaje_id}`;
    const cfg = configMap.get(key);
    if (!cfg) continue;
    batteryAvailabilityMap[pvId] = {
      available: batteryStockMap.get(cfg.batteryVariantId) ?? 0,
      perUnit: cfg.perUnit,
    };
  }

  const canComplete = ["TECHNICIAN", "MANAGER", "ADMIN"].includes(role);
  const totalInStock = lots.reduce((s, l) => s + l.inStock, 0);

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.75rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--on-surf)",
            }}
          >
            Montaje de Vehículos
          </h1>
          <p style={{ fontSize: "0.8rem", color: "var(--on-surf-var)", marginTop: "0.2rem" }}>
            Ensamble de baterías y trazabilidad para garantía
          </p>
        </div>

        <div
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl"
          style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
          <Zap className="h-4 w-4" style={{ color: "var(--p-bright)" }} />
          <div>
            <p
              style={{
                fontSize: "0.65rem",
                fontWeight: 500,
                textTransform: "uppercase",
                letterSpacing: "0.05em",
                color: "var(--on-surf-var)",
              }}
            >
              Baterías disponibles
            </p>
            <p
              style={{
                fontSize: "1.1rem",
                fontWeight: 700,
                fontFamily: "var(--font-display)",
                color: "var(--on-surf)",
              }}
            >
              {totalInStock.toLocaleString("es-MX")}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs — client: Montaje | Baterías */}
      <AssemblyTabsClient
        lots={lots}
        variants={variants}
        orders={orders}
        canComplete={canComplete}
        batteryAvailabilityMap={batteryAvailabilityMap}
        userRole={role}
      />
    </div>
  );
}
