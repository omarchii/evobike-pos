"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useRouter, usePathname } from "next/navigation";
import { Wrench, Plus, AlertTriangle, Package, Search, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import type { BatteryVariantOption } from "./new-battery-lot-dialog";
import { NewAssemblyDialog } from "./new-assembly-dialog";
import { CompleteAssemblyDialog } from "./complete-assembly-dialog";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface AssemblyOrderRow {
  id: string;
  status: "PENDING" | "COMPLETED" | "CANCELLED";
  notes: string | null;
  createdAt: string;
  completedAt: string | null;
  saleId: string | null;          // 4-D: set when order originates from a voltage change on sale
  voltageChangeLogId: string | null;  // 4-D: set when order originates from voltage change
  // null para órdenes generadas por recepción de inventario (sin VIN todavía)
  customerBike: {
    id: string;
    serialNumber: string;
    model: string | null;
    color: string | null;
    voltaje: string | null;
    customer: { id: string; name: string } | null;
  } | null;
  // Presente cuando la orden fue generada por recepción
  productVariant: {
    id: string;
    sku: string;
    modeloId: string;
    voltajeId: string;
    modeloNombre: string;
    colorNombre: string;
    voltajeLabel: string;
  } | null;
  assembledBy: { id: string; name: string } | null;
  batteryAssignments: {
    serialNumber: string;
    status: string;
    lotReference: string | null;
  }[];
}

// Grupo de órdenes sin VIN del mismo productVariant
interface PendingGroup {
  productVariantId: string;
  modeloNombre: string;
  colorNombre: string;
  voltajeLabel: string;
  sku: string;
  orders: AssemblyOrderRow[];
  available: number; // baterías IN_STOCK del tipo requerido
  perUnit: number;   // baterías requeridas por vehículo (de BatteryConfiguration)
}

interface AssemblyConfigData {
  modelos: {
    id: string;
    nombre: string;
    voltajes: { id: string; valor: number; label: string }[];
    colores: { id: string; nombre: string }[];
  }[];
  configurations: { modeloId: string; voltajeId: string; quantity: number }[];
  branchId: string | null;
}

interface Props {
  pendingOrders: AssemblyOrderRow[];
  completedOrders: AssemblyOrderRow[];
  completedTotal: number;
  completedPage: number;
  completedPageSize: number;
  search: string;
  dateFrom: string | null;
  dateTo: string | null;
  canComplete: boolean;
  userRole: string;
  batteryVariants: BatteryVariantOption[];
  batteryAvailabilityMap: Record<string, { available: number; perUnit: number }>;
}

// ── Board ──────────────────────────────────────────────────────────────────────

export function AssemblyBoard({
  pendingOrders,
  completedOrders,
  completedTotal,
  completedPage,
  completedPageSize,
  search,
  dateFrom,
  dateTo,
  canComplete,
  batteryAvailabilityMap,
}: Props): React.JSX.Element {
  const router = useRouter();
  const pathname = usePathname();
  const [config, setConfig] = useState<AssemblyConfigData | null>(null);
  const [now] = useState(() => Date.now());
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<AssemblyOrderRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AssemblyOrderRow | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<AssemblyOrderRow | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [uninstallLoading, setUninstallLoading] = useState(false);
  const [searchInput, setSearchInput] = useState(search);
  const searchTimeout = useRef<ReturnType<typeof setTimeout>>(undefined);

  const pendingWithVin = pendingOrders.filter((o) => o.customerBike !== null);
  const pendingWithoutVin = pendingOrders.filter((o) => o.customerBike === null);

  const totalCompletedPages = Math.ceil(completedTotal / completedPageSize);

  // ── URL param helpers ──────────────────────────────────────────────────────
  const updateParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams();
    const current = { search, from: dateFrom, to: dateTo, page: completedPage > 1 ? String(completedPage) : null };
    for (const [key, val] of Object.entries(current)) {
      if (val) params.set(key, String(val));
    }
    for (const [key, val] of Object.entries(updates)) {
      if (val) params.set(key, val);
      else params.delete(key);
    }
    if (updates.search !== undefined || updates.from !== undefined || updates.to !== undefined) {
      params.delete("page");
    }
    const qs = params.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }, [search, dateFrom, dateTo, completedPage, pathname, router]);

  const pendingGroups = pendingWithoutVin.reduce<PendingGroup[]>((groups, order) => {
    if (!order.productVariant) return groups;
    const existing = groups.find((g) => g.productVariantId === order.productVariant!.id);
    if (existing) {
      existing.orders.push(order);
    } else {
      const avail = batteryAvailabilityMap[order.productVariant.id];
      groups.push({
        productVariantId: order.productVariant.id,
        modeloNombre: order.productVariant.modeloNombre,
        colorNombre: order.productVariant.colorNombre,
        voltajeLabel: order.productVariant.voltajeLabel,
        sku: order.productVariant.sku,
        orders: [order],
        available: avail?.available ?? 0,
        perUnit: avail?.perUnit ?? 1,
      });
    }
    return groups;
  }, []);

  const totalPending = pendingWithVin.length + pendingWithoutVin.length;

  // ── Load config on mount ───────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/assembly/config")
      .then((r) => r.json() as Promise<{ success: boolean; data?: AssemblyConfigData }>)
      .then((res) => {
        if (res.success && res.data) setConfig(res.data);
      })
      .catch(() => {
        // config unavailable — complete dialogs will show 1 battery input as fallback
      });
  }, []);

  // ── Re-fetch via server component refresh ──────────────────────────────────
  const refetch = useCallback(() => {
    router.refresh();
  }, [router]);

  // ── Required batteries for an order ───────────────────────────────────────
  const getRequiredQuantity = useCallback(
    (order: AssemblyOrderRow): number => {
      if (!config) return 1;
      // Preferir lookup por ID (órdenes con productVariant)
      if (order.productVariant) {
        const cfg = config.configurations.find(
          (c) =>
            c.modeloId === order.productVariant!.modeloId &&
            c.voltajeId === order.productVariant!.voltajeId
        );
        return cfg?.quantity ?? 1;
      }
      // Fallback: texto para órdenes manuales legacy
      const modeloEntry = config.modelos.find(
        (m) => m.nombre === order.customerBike?.model
      );
      if (!modeloEntry) return 1;
      const voltajeEntry = modeloEntry.voltajes.find(
        (v) => v.label === order.customerBike?.voltaje
      );
      if (!voltajeEntry) return 1;
      const cfg = config.configurations.find(
        (c) => c.modeloId === modeloEntry.id && c.voltajeId === voltajeEntry.id
      );
      return cfg?.quantity ?? 1;
    },
    [config]
  );

  // ── Cancel ─────────────────────────────────────────────────────────────────
  const handleConfirmCancel = useCallback(async () => {
    if (!cancelTarget) return;
    setCancelLoading(true);
    toast.loading("Cancelando orden...", { id: "cancel-assembly" });
    try {
      const res = await fetch(`/api/assembly/${cancelTarget.id}/cancel`, {
        method: "PATCH",
      }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);

      if (res.success) {
        toast.success("Orden cancelada", { id: "cancel-assembly" });
        setCancelTarget(null);
        await refetch();
      } else {
        toast.error(res.error ?? "Error al cancelar", { id: "cancel-assembly" });
      }
    } catch {
      toast.error("Error de conexión", { id: "cancel-assembly" });
    } finally {
      setCancelLoading(false);
    }
  }, [cancelTarget, refetch]);

  // ── Uninstall ──────────────────────────────────────────────────────────────
  const handleConfirmUninstall = useCallback(async () => {
    if (!uninstallTarget) return;
    setUninstallLoading(true);
    toast.loading("Desinstalando baterías...", { id: "uninstall-assembly" });
    try {
      const res = await fetch("/api/batteries/uninstall", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerBikeId: uninstallTarget.customerBike?.id }),
      }).then(
        (r) =>
          r.json() as Promise<{
            success: boolean;
            data?: { uninstalledCount: number };
            error?: string;
          }>
      );

      if (res.success) {
        const count = res.data?.uninstalledCount ?? 0;
        toast.success(
          `${count} bater${count === 1 ? "ía desinstalada" : "ías desinstaladas"} — regresaron a inventario`,
          { id: "uninstall-assembly" }
        );
        setUninstallTarget(null);
        await refetch();
      } else {
        toast.error(res.error ?? "Error al desinstalar", { id: "uninstall-assembly" });
      }
    } catch {
      toast.error("Error de conexión", { id: "uninstall-assembly" });
    } finally {
      setUninstallLoading(false);
    }
  }, [uninstallTarget, refetch]);

  // ── Nombre para mostrar en diálogos ───────────────────────────────────────
  const getOrderDisplayName = (order: AssemblyOrderRow): string => {
    if (order.customerBike) return order.customerBike.serialNumber;
    if (order.productVariant)
      return `${order.productVariant.modeloNombre} ${order.productVariant.voltajeLabel} / ${order.productVariant.colorNombre}`;
    return order.id;
  };

  return (
    <div className="space-y-4">
      {/* CTA */}
      <div className="flex items-center justify-end">
        <Button
          onClick={() => setNewDialogOpen(true)}
          style={{
            background: "var(--velocity-gradient)",
            color: "#fff",
            borderRadius: "1.5rem",
            border: "none",
            fontSize: "0.8rem",
            height: "2.25rem",
          }}
        >
          <Plus className="h-4 w-4 mr-1.5" />
          Nueva Orden de Montaje
        </Button>
      </div>

      {/* Kanban columns */}
      <div className="grid grid-cols-2 gap-5">
        {/* Pendientes */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--warn)" }} />
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--on-surf-var)",
              }}
            >
              Pendientes ({totalPending})
            </span>
          </div>

          {totalPending === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 rounded-2xl"
              style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
            >
              <Wrench className="h-8 w-8 mb-2" style={{ color: "var(--on-surf-var)" }} />
              <p style={{ fontSize: "0.8rem", color: "var(--on-surf-var)" }}>
                Sin órdenes pendientes
              </p>
            </div>
          ) : (
            <>
              {/* Grupos de órdenes de recepción (sin VIN) */}
              {pendingGroups.map((group) => (
                <ReceiptGroupCard
                  key={group.productVariantId}
                  group={group}
                  canComplete={canComplete}
                  onMountNext={() => setCompleteTarget(group.orders[0])}
                  onCancelAll={() => setCancelTarget(group.orders[0])}
                />
              ))}

              {/* Órdenes manuales (con VIN) */}
              {pendingWithVin.map((order) => (
                <AssemblyCard
                  key={order.id}
                  order={order}
                  canComplete={canComplete}
                  onComplete={() => setCompleteTarget(order)}
                  onCancel={() => setCancelTarget(order)}
                  onUninstall={() => setUninstallTarget(order)}
                  now={now}
                />
              ))}
            </>
          )}
        </div>

        {/* Completadas */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--sec)" }} />
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: 600,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: "var(--on-surf-var)",
              }}
            >
              Completadas ({completedTotal})
            </span>
          </div>

          {/* Search + date filters */}
          <div className="space-y-2">
            <div
              className="flex items-center gap-2 px-3 py-2 rounded-xl"
              style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
            >
              <Search className="h-3.5 w-3.5 shrink-0" style={{ color: "var(--on-surf-var)" }} />
              <input
                type="text"
                placeholder="Buscar VIN, modelo, cliente..."
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  clearTimeout(searchTimeout.current);
                  searchTimeout.current = setTimeout(() => {
                    updateParams({ search: e.target.value || null });
                  }, 400);
                }}
                style={{
                  fontSize: "0.78rem",
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "var(--on-surf)",
                  width: "100%",
                }}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="date"
                value={dateFrom ?? ""}
                onChange={(e) => updateParams({ from: e.target.value || null })}
                style={{
                  fontSize: "0.72rem",
                  padding: "0.3rem 0.5rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--outline-variant)",
                  background: "var(--surf-lowest)",
                  color: "var(--on-surf)",
                  flex: 1,
                }}
              />
              <span style={{ fontSize: "0.72rem", color: "var(--on-surf-var)" }}>—</span>
              <input
                type="date"
                value={dateTo ?? ""}
                onChange={(e) => updateParams({ to: e.target.value || null })}
                style={{
                  fontSize: "0.72rem",
                  padding: "0.3rem 0.5rem",
                  borderRadius: "0.5rem",
                  border: "1px solid var(--outline-variant)",
                  background: "var(--surf-lowest)",
                  color: "var(--on-surf)",
                  flex: 1,
                }}
              />
            </div>
          </div>

          {completedOrders.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 rounded-2xl"
              style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
            >
              <p style={{ fontSize: "0.8rem", color: "var(--on-surf-var)" }}>
                {search || dateFrom || dateTo ? "Sin resultados" : "Sin ensambles completados"}
              </p>
            </div>
          ) : (
            <>
              {completedOrders.map((order) => (
                <AssemblyCard
                  key={order.id}
                  order={order}
                  canComplete={canComplete}
                  onComplete={() => setCompleteTarget(order)}
                  onCancel={() => setCancelTarget(order)}
                  onUninstall={() => setUninstallTarget(order)}
                  now={now}
                />
              ))}

              {/* Pagination */}
              {totalCompletedPages > 1 && (
                <div className="flex items-center justify-center gap-3 pt-2">
                  <button
                    disabled={completedPage <= 1}
                    onClick={() => updateParams({ page: String(completedPage - 1) })}
                    className="p-1.5 rounded-lg disabled:opacity-30"
                    style={{ background: "var(--surf-lowest)" }}
                  >
                    <ChevronLeft className="h-4 w-4" style={{ color: "var(--on-surf)" }} />
                  </button>
                  <span style={{ fontSize: "0.72rem", color: "var(--on-surf-var)" }}>
                    {completedPage} / {totalCompletedPages}
                  </span>
                  <button
                    disabled={completedPage >= totalCompletedPages}
                    onClick={() => updateParams({ page: String(completedPage + 1) })}
                    className="p-1.5 rounded-lg disabled:opacity-30"
                    style={{ background: "var(--surf-lowest)" }}
                  >
                    <ChevronRight className="h-4 w-4" style={{ color: "var(--on-surf)" }} />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* ── Dialogs ─────────────────────────────────────────────────────────── */}

      <NewAssemblyDialog
        open={newDialogOpen}
        onOpenChange={setNewDialogOpen}
        onSuccess={refetch}
      />

      {completeTarget && (
        <CompleteAssemblyDialog
          open={!!completeTarget}
          onOpenChange={(open) => {
            if (!open) setCompleteTarget(null);
          }}
          orderId={completeTarget.id}
          // Para órdenes sin VIN: vin es null y el diálogo pide ingresarlo
          vin={completeTarget.customerBike?.serialNumber ?? null}
          modelName={
            completeTarget.customerBike?.model ??
            completeTarget.productVariant?.modeloNombre ??
            null
          }
          voltajeLabel={
            completeTarget.customerBike?.voltaje ??
            completeTarget.productVariant?.voltajeLabel ??
            null
          }
          requiredQuantity={getRequiredQuantity(completeTarget)}
          branchId={config?.branchId ?? null}
          onSuccess={refetch}
        />
      )}

      {/* Cancel confirmation */}
      <AlertDialog
        open={!!cancelTarget}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
      >
        <AlertDialogContent
          style={{
            background: "var(--surf-bright)",
            borderRadius: "1.25rem",
            border: "none",
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className="flex items-center gap-2"
              style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: "var(--warn)" }} />
              ¿Cancelar orden de montaje?
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: "var(--on-surf-var)" }}>
              La orden{" "}
              <span
                className="font-mono font-semibold"
                style={{ color: "var(--on-surf)" }}
              >
                {cancelTarget ? getOrderDisplayName(cancelTarget) : ""}
              </span>{" "}
              quedará cancelada. Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ borderRadius: "1rem" }} disabled={cancelLoading}>
              Volver
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmCancel}
              disabled={cancelLoading}
              style={{
                background: "var(--ter)",
                color: "#fff",
                borderRadius: "1rem",
                border: "none",
              }}
            >
              {cancelLoading ? "Cancelando..." : "Sí, cancelar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Uninstall confirmation */}
      <AlertDialog
        open={!!uninstallTarget}
        onOpenChange={(open) => {
          if (!open) setUninstallTarget(null);
        }}
      >
        <AlertDialogContent
          style={{
            background: "var(--surf-bright)",
            borderRadius: "1.25rem",
            border: "none",
          }}
        >
          <AlertDialogHeader>
            <AlertDialogTitle
              className="flex items-center gap-2"
              style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}
            >
              <AlertTriangle className="h-5 w-5" style={{ color: "var(--warn)" }} />
              Desinstalar baterías
            </AlertDialogTitle>
            <AlertDialogDescription style={{ color: "var(--on-surf-var)" }}>
              Se desinstalarán{" "}
              <strong>
                {uninstallTarget?.batteryAssignments.length ?? 0}{" "}
                bater
                {uninstallTarget?.batteryAssignments.length === 1 ? "ía" : "ías"}
              </strong>{" "}
              del vehículo{" "}
              <span
                className="font-mono font-semibold"
                style={{ color: "var(--on-surf)" }}
              >
                {uninstallTarget?.customerBike?.serialNumber ?? ""}
              </span>{" "}
              y regresarán a inventario como IN_STOCK. ¿Confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel style={{ borderRadius: "1rem" }} disabled={uninstallLoading}>
              Cancelar
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmUninstall}
              disabled={uninstallLoading}
              style={{
                background: "var(--warn)",
                color: "#fff",
                borderRadius: "1rem",
                border: "none",
              }}
            >
              {uninstallLoading ? "Desinstalando..." : "Confirmar"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ── ReceiptGroupCard — Agrupa N órdenes del mismo modelo sin VIN ───────────────

function ReceiptGroupCard({
  group,
  canComplete,
  onMountNext,
  onCancelAll,
}: {
  group: PendingGroup;
  canComplete: boolean;
  onMountNext: () => void;
  onCancelAll: () => void;
}): React.JSX.Element {
  const count = group.orders.length;
  const required = group.perUnit * count;
  const available = group.available;

  // Chip de disponibilidad: verde / amarillo / rojo
  const batteryChip = (() => {
    if (available >= required) {
      return { label: `${available}/${required} baterías listas`, color: "var(--sec)", bg: "var(--sec-container)" };
    }
    if (available > 0) {
      return { label: `${available}/${required} baterías disponibles`, color: "var(--warn)", bg: "var(--warn-container)" };
    }
    return { label: `Sin baterías (necesita ${required})`, color: "var(--ter)", bg: "color-mix(in srgb, var(--ter) 15%, transparent)" };
  })();

  return (
    <div
      className="rounded-2xl p-4 space-y-3 transition-all"
      style={{
        background: "var(--surf-lowest)",
        boxShadow: "var(--shadow)",
        outline: "1px solid rgba(243,156,18,0.2)",
      }}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <Package className="h-4 w-4 shrink-0" style={{ color: "var(--warn)" }} />
          <div>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "0.85rem",
                fontWeight: 700,
                color: "var(--on-surf)",
              }}
            >
              {group.modeloNombre} {group.voltajeLabel}
            </p>
            <p style={{ fontSize: "0.72rem", color: "var(--on-surf-var)", marginTop: "0.1rem" }}>
              {group.colorNombre} · {group.sku}
            </p>
          </div>
        </div>
        <span
          className="shrink-0"
          style={{
            fontSize: "0.6rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "0.2rem 0.65rem",
            borderRadius: 999,
            background: "var(--warn-container)",
            color: "var(--warn)",
          }}
        >
          {count} pendiente{count !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Chip disponibilidad de baterías — OBLIGATORIO */}
      <div className="flex items-center gap-1.5">
        <span
          style={{
            fontSize: "0.68rem",
            fontWeight: 600,
            padding: "0.2rem 0.7rem",
            borderRadius: 999,
            background: batteryChip.bg,
            color: batteryChip.color,
          }}
        >
          {batteryChip.label}
        </span>
      </div>

      <p style={{ fontSize: "0.72rem", color: "var(--on-surf-var)" }}>
        Sin VIN asignado — recibidos por recepción de inventario
      </p>

      {/* Footer */}
      {canComplete && (
        <div className="flex items-center justify-end gap-2 pt-1">
          <button
            onClick={onCancelAll}
            style={{
              fontSize: "0.72rem",
              color: "var(--ter)",
              fontWeight: 500,
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "0.2rem 0.5rem",
            }}
          >
            Cancelar una
          </button>
          <button
            onClick={onMountNext}
            style={{
              fontSize: "0.72rem",
              color: "#fff",
              fontWeight: 600,
              background: "var(--velocity-gradient)",
              border: "none",
              borderRadius: "0.75rem",
              cursor: "pointer",
              padding: "0.35rem 0.85rem",
            }}
          >
            Montar siguiente
          </button>
        </div>
      )}
    </div>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function timeAgo(iso: string, now: number): string {
  const mins = Math.floor((now - new Date(iso).getTime()) / 60000);
  if (mins < 60) return `hace ${mins} min`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `hace ${hrs}h`;
  return `hace ${Math.floor(hrs / 24)} días`;
}

// ── AssemblyCard — Orden individual con VIN ────────────────────────────────────

function AssemblyCard({
  order,
  canComplete,
  onComplete,
  onCancel,
  onUninstall,
  now,
}: {
  order: AssemblyOrderRow;
  canComplete: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onUninstall: () => void;
  now: number;
}): React.JSX.Element {
  const isPending = order.status === "PENDING";
  const isCompleted = order.status === "COMPLETED";
  const statusColor = isPending ? "var(--warn)" : "var(--sec)";
  const statusBg = isPending ? "var(--warn-container)" : "var(--sec-container)";
  const statusLabel = isPending ? "Pendiente" : "Completada";

  const bike = order.customerBike;

  return (
    <div
      className="rounded-2xl p-4 space-y-3 transition-all"
      style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
    >
      {/* Top: VIN + status chip */}
      <div className="flex items-start justify-between gap-2">
        <div>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "0.85rem",
              fontWeight: 700,
              color: "var(--on-surf)",
            }}
          >
            VIN: {bike?.serialNumber ?? "—"}
          </p>
          <p style={{ fontSize: "0.72rem", color: "var(--on-surf-var)", marginTop: "0.1rem" }}>
            {[bike?.model, bike?.voltaje, bike?.color].filter(Boolean).join(" · ")}
          </p>
          {/* 4-D: chip for voltage change orders originating from a sale */}
          {order.saleId && order.voltageChangeLogId && (
            <span
              style={{
                display: "inline-block",
                marginTop: "0.2rem",
                fontSize: "0.58rem",
                fontWeight: 600,
                letterSpacing: "0.04em",
                textTransform: "uppercase" as const,
                padding: "0.15rem 0.55rem",
                borderRadius: 999,
                background: "var(--ter-container)",
                color: "var(--on-ter-container)",
              }}
            >
              ⚡ Reensamble por venta
            </span>
          )}
        </div>
        <span
          className="shrink-0"
          style={{
            fontSize: "0.6rem",
            fontWeight: 600,
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            padding: "0.2rem 0.65rem",
            borderRadius: 999,
            background: statusBg,
            color: statusColor,
          }}
        >
          {statusLabel}
        </span>
      </div>

      {/* Batteries */}
      {order.batteryAssignments.length > 0 && (
        <div className="space-y-1">
          {order.batteryAssignments.map((ba) => (
            <div key={ba.serialNumber} className="flex items-center gap-2">
              <div
                className="w-1.5 h-1.5 rounded-full shrink-0"
                style={{ background: "var(--p-bright)" }}
              />
              <span
                style={{ fontSize: "0.72rem", fontFamily: "monospace", color: "var(--on-surf)" }}
              >
                {ba.serialNumber}
              </span>
              {ba.lotReference && (
                <span style={{ fontSize: "0.65rem", color: "var(--on-surf-var)" }}>
                  · {ba.lotReference}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {isPending && order.batteryAssignments.length === 0 && (
        <p style={{ fontSize: "0.72rem", color: "var(--on-surf-var)" }}>
          Sin baterías asignadas aún
        </p>
      )}

      {/* Customer */}
      {bike?.customer && (
        <p style={{ fontSize: "0.72rem", color: "var(--on-surf-var)" }}>
          Cliente: {bike.customer.name}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <p style={{ fontSize: "0.68rem", color: "var(--on-surf-var)" }}>
          {isPending
            ? `Creada ${timeAgo(order.createdAt, now)}`
            : `Completada ${order.completedAt ? timeAgo(order.completedAt, now) : "—"} · ${order.assembledBy?.name ?? "—"}`}
        </p>

        <div className="flex items-center gap-2">
          {isPending && canComplete && (
            <>
              <button
                onClick={onCancel}
                style={{
                  fontSize: "0.72rem",
                  color: "var(--ter)",
                  fontWeight: 500,
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "0.2rem 0.5rem",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={onComplete}
                style={{
                  fontSize: "0.72rem",
                  color: "#fff",
                  fontWeight: 600,
                  background: "var(--velocity-gradient)",
                  border: "none",
                  borderRadius: "0.75rem",
                  cursor: "pointer",
                  padding: "0.35rem 0.85rem",
                }}
              >
                Completar
              </button>
            </>
          )}

          {isCompleted && canComplete && order.batteryAssignments.length > 0 && (
            <button
              onClick={onUninstall}
              style={{
                fontSize: "0.72rem",
                color: "var(--warn)",
                fontWeight: 500,
                background: "var(--warn-container)",
                border: "none",
                borderRadius: "0.75rem",
                cursor: "pointer",
                padding: "0.35rem 0.85rem",
              }}
            >
              Desinstalar
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
