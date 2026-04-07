"use client";

import { useState, useCallback, useEffect } from "react";
import { Wrench, Plus, AlertTriangle } from "lucide-react";
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
  customerBike: {
    id: string;
    serialNumber: string;
    model: string | null;
    color: string | null;
    voltaje: string | null;
    customer: { id: string; name: string } | null;
  };
  assembledBy: { id: string; name: string } | null;
  batteryAssignments: {
    serialNumber: string;
    status: string;
    lotReference: string | null;
  }[];
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
  initialOrders: AssemblyOrderRow[];
  canComplete: boolean;
  userRole: string;
  batteryVariants: BatteryVariantOption[];
}

// ── Board ──────────────────────────────────────────────────────────────────────

export function AssemblyBoard({
  initialOrders,
  canComplete,
}: Props): React.JSX.Element {
  const [orders, setOrders] = useState<AssemblyOrderRow[]>(initialOrders);
  const [config, setConfig] = useState<AssemblyConfigData | null>(null);
  const [newDialogOpen, setNewDialogOpen] = useState(false);
  const [completeTarget, setCompleteTarget] = useState<AssemblyOrderRow | null>(null);
  const [cancelTarget, setCancelTarget] = useState<AssemblyOrderRow | null>(null);
  const [uninstallTarget, setUninstallTarget] = useState<AssemblyOrderRow | null>(null);
  const [cancelLoading, setCancelLoading] = useState(false);
  const [uninstallLoading, setUninstallLoading] = useState(false);

  const pending = orders.filter((o) => o.status === "PENDING");
  const completed = orders.filter((o) => o.status === "COMPLETED");

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

  // ── Re-fetch orders ────────────────────────────────────────────────────────
  const refetch = useCallback(async () => {
    try {
      const res = await fetch("/api/assembly").then(
        (r) => r.json() as Promise<{ success: boolean; data?: AssemblyOrderRow[] }>
      );
      if (res.success && res.data) setOrders(res.data);
    } catch {
      toast.error("Error al actualizar la lista");
    }
  }, []);

  // ── Required batteries for an order ───────────────────────────────────────
  const getRequiredQuantity = useCallback(
    (order: AssemblyOrderRow): number => {
      if (!config) return 1;
      // Match by model nombre + voltaje label → find modeloId and voltajeId
      const modeloEntry = config.modelos.find(
        (m) => m.nombre === order.customerBike.model
      );
      if (!modeloEntry) return 1;
      const voltajeEntry = modeloEntry.voltajes.find(
        (v) => v.label === order.customerBike.voltaje
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
        body: JSON.stringify({ customerBikeId: uninstallTarget.customerBike.id }),
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

  return (
    <div className="space-y-4">
      {/* CTA */}
      <div className="flex items-center justify-end">
        <Button
          onClick={() => setNewDialogOpen(true)}
          style={{
            background: "linear-gradient(135deg, #1b4332, #2ecc71)",
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
              Pendientes ({pending.length})
            </span>
          </div>

          {pending.length === 0 ? (
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
            pending.map((order) => (
              <AssemblyCard
                key={order.id}
                order={order}
                canComplete={canComplete}
                onComplete={() => setCompleteTarget(order)}
                onCancel={() => setCancelTarget(order)}
                onUninstall={() => setUninstallTarget(order)}
              />
            ))
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
              Completadas ({completed.length})
            </span>
          </div>

          {completed.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-10 rounded-2xl"
              style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
            >
              <p style={{ fontSize: "0.8rem", color: "var(--on-surf-var)" }}>
                Sin ensambles completados
              </p>
            </div>
          ) : (
            completed.slice(0, 20).map((order) => (
              <AssemblyCard
                key={order.id}
                order={order}
                canComplete={canComplete}
                onComplete={() => setCompleteTarget(order)}
                onCancel={() => setCancelTarget(order)}
                onUninstall={() => setUninstallTarget(order)}
              />
            ))
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
          vin={completeTarget.customerBike.serialNumber}
          modelName={completeTarget.customerBike.model}
          voltajeLabel={completeTarget.customerBike.voltaje}
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
                {cancelTarget?.customerBike.serialNumber}
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
                {uninstallTarget?.customerBike.serialNumber}
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

// ── Card ───────────────────────────────────────────────────────────────────────

function AssemblyCard({
  order,
  canComplete,
  onComplete,
  onCancel,
  onUninstall,
}: {
  order: AssemblyOrderRow;
  canComplete: boolean;
  onComplete: () => void;
  onCancel: () => void;
  onUninstall: () => void;
}): React.JSX.Element {
  const isPending = order.status === "PENDING";
  const isCompleted = order.status === "COMPLETED";
  const statusColor = isPending ? "var(--warn)" : "var(--sec)";
  const statusBg = isPending ? "var(--warn-container)" : "var(--sec-container)";
  const statusLabel = isPending ? "Pendiente" : "Completada";

  const timeAgo = (iso: string): string => {
    const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
    if (mins < 60) return `hace ${mins} min`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `hace ${hrs}h`;
    return `hace ${Math.floor(hrs / 24)} días`;
  };

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
            VIN: {order.customerBike.serialNumber}
          </p>
          <p style={{ fontSize: "0.72rem", color: "var(--on-surf-var)", marginTop: "0.1rem" }}>
            {[order.customerBike.model, order.customerBike.voltaje, order.customerBike.color]
              .filter(Boolean)
              .join(" · ")}
          </p>
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
          🔋 Sin baterías asignadas aún
        </p>
      )}

      {/* Customer */}
      {order.customerBike.customer && (
        <p style={{ fontSize: "0.72rem", color: "var(--on-surf-var)" }}>
          Cliente: {order.customerBike.customer.name}
        </p>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between pt-1">
        <p style={{ fontSize: "0.68rem", color: "var(--on-surf-var)" }}>
          {isPending
            ? `Creada ${timeAgo(order.createdAt)}`
            : `Completada ${order.completedAt ? timeAgo(order.completedAt) : "—"} · ${order.assembledBy?.name ?? "—"}`}
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
                  background: "linear-gradient(135deg, #1b4332, #2ecc71)",
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
