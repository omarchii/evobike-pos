"use client";

import React, { useState, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Chip } from "@/components/primitives/chip";
import { toast } from "sonner";
import Link from "next/link";
import type {
  SerializedBoardOrder,
  SerializedDeliveredOrder,
  SerializedCancelledOrder,
  TechnicianOption,
} from "./workshop-types";

// ── Local type aliases (no Prisma enums on client) ────────────────────────────

type ServiceOrderTypeT = "PAID" | "WARRANTY" | "COURTESY" | "POLICY_MAINTENANCE";
type NonPaidType = Exclude<ServiceOrderTypeT, "PAID">;

// ── Display maps ─────────────────────────────────────────────────────────────

const TYPE_LABEL_ES: Record<NonPaidType, string> = {
  WARRANTY: "Garantía",
  COURTESY: "Cortesía",
  POLICY_MAINTENANCE: "Mantenimiento",
};

type ChipVariant = "neutral" | "success" | "warn" | "error" | "info";

const TYPE_VARIANT: Record<NonPaidType, ChipVariant> = {
  WARRANTY: "warn",
  COURTESY: "info",
  POLICY_MAINTENANCE: "neutral",
};

// ── Aging ─────────────────────────────────────────────────────────────────────

type AgingTier = "verde" | "ambar" | "rojo";

function agingTierFor(
  status: string,
  subStatus: string | null,
  createdAtMs: number,
  updatedAtMs: number,
  nowMs: number,
  type?: string,
): AgingTier | null {
  const HOUR = 3_600_000;
  const DAY = 86_400_000;

  switch (status) {
    case "PENDING": {
      const elapsed = nowMs - createdAtMs;
      if (elapsed < 4 * HOUR) return "verde";
      if (elapsed < DAY) return "ambar";
      return "rojo";
    }
    case "IN_PROGRESS": {
      if (subStatus === "WAITING_PARTS") {
        const elapsed = nowMs - updatedAtMs;
        if (type === "WARRANTY") {
          if (elapsed < 30 * DAY) return "verde";
          if (elapsed < 45 * DAY) return "ambar";
          return "rojo";
        }
        if (elapsed < 3 * DAY) return "verde";
        if (elapsed < 7 * DAY) return "ambar";
        return "rojo";
      }
      if (subStatus === "PAUSED") {
        const inPause = nowMs - updatedAtMs;
        if (inPause < DAY) return "verde";
        if (inPause < 3 * DAY) return "ambar";
        return "rojo";
      }
      const target = updatedAtMs + 48 * HOUR;
      const remaining = target - nowMs;
      if (remaining < 0) return "rojo";
      if (remaining < 48 * HOUR) return "ambar";
      return "verde";
    }
    case "COMPLETED": {
      const elapsed = nowMs - updatedAtMs;
      if (elapsed < DAY) return "verde";
      if (elapsed < 2 * DAY) return "ambar";
      return "rojo";
    }
    default:
      return null;
  }
}

const AGING_VARIANT: Record<AgingTier, ChipVariant> = {
  verde: "success",
  ambar: "warn",
  rojo: "error",
};

function formatAging(
  status: string,
  subStatus: string | null,
  createdAtMs: number,
  updatedAtMs: number,
  nowMs: number
): string {
  const HOUR = 3_600_000;

  let diffMs: number;
  if (status === "PENDING") {
    diffMs = nowMs - createdAtMs;
  } else if (status === "IN_PROGRESS" && subStatus === "PAUSED") {
    diffMs = nowMs - updatedAtMs;
  } else if (status === "IN_PROGRESS") {
    diffMs = updatedAtMs + 48 * HOUR - nowMs;
  } else {
    diffMs = nowMs - updatedAtMs;
  }

  const absMin = Math.abs(diffMs) / 60_000;
  if (absMin < 60) return `${Math.floor(absMin)}m`;
  if (absMin < 1440) return `${Math.floor(absMin / 60)}h`;
  const days = Math.floor(absMin / 1440);
  return status === "IN_PROGRESS" && diffMs < 0 ? `${days}d vencida` : `${days}d`;
}

// ── Bucketization ─────────────────────────────────────────────────────────────

type Buckets = {
  pending: SerializedBoardOrder[];
  inProgress: SerializedBoardOrder[];
  waitingParts: SerializedBoardOrder[];
  waitingApproval: SerializedBoardOrder[];
  paused: SerializedBoardOrder[];
  completed: SerializedBoardOrder[];
};

function bucketize(orders: SerializedBoardOrder[]): Buckets {
  const b: Buckets = {
    pending: [],
    inProgress: [],
    waitingParts: [],
    waitingApproval: [],
    paused: [],
    completed: [],
  };
  for (const o of orders) {
    if (o.status === "PENDING") b.pending.push(o);
    else if (o.status === "COMPLETED") b.completed.push(o);
    else if (o.status === "IN_PROGRESS") {
      if (o.subStatus === "WAITING_PARTS") b.waitingParts.push(o);
      else if (o.subStatus === "WAITING_APPROVAL") b.waitingApproval.push(o);
      else if (o.subStatus === "PAUSED") b.paused.push(o);
      else b.inProgress.push(o);
    }
  }
  return b;
}

// ── Column types ──────────────────────────────────────────────────────────────

type ColumnSlug =
  | "pending"
  | "inProgress"
  | "waitingParts"
  | "waitingApproval"
  | "paused"
  | "completed"
  | "delivered"
  | "cancelled";

const MAIN_COLUMNS: Array<{ slug: ColumnSlug; title: string }> = [
  { slug: "pending", title: "En Espera" },
  { slug: "inProgress", title: "En Reparación" },
  { slug: "waitingParts", title: "Esp. Refacciones" },
  { slug: "waitingApproval", title: "Esp. Aprobación" },
  { slug: "completed", title: "Completada" },
  { slug: "delivered", title: "Entregada hoy" },
  { slug: "cancelled", title: "Cancelada hoy" },
];

const DEFAULT_COLLAPSED: ColumnSlug[] = ["delivered", "cancelled"];

// ── DnD transition resolution ─────────────────────────────────────────────────

type Transition =
  | { statusPatch: string; subStatusPatch?: undefined }
  | { subStatusPatch: string | null; statusPatch?: undefined };

function resolveTransition(
  fromSlug: ColumnSlug,
  toSlug: ColumnSlug
): Transition | "invalid" {
  if (fromSlug === toSlug) return "invalid";
  if (fromSlug === "pending" && toSlug === "inProgress")
    return { statusPatch: "IN_PROGRESS" };
  if (fromSlug === "inProgress" && toSlug === "waitingParts")
    return { subStatusPatch: "WAITING_PARTS" };
  if (fromSlug === "waitingParts" && toSlug === "inProgress")
    return { subStatusPatch: null };
  if (fromSlug === "inProgress" && toSlug === "waitingApproval")
    return { subStatusPatch: "WAITING_APPROVAL" };
  if (fromSlug === "waitingApproval" && toSlug === "inProgress")
    return { subStatusPatch: null };
  if (fromSlug === "inProgress" && toSlug === "paused")
    return { subStatusPatch: "PAUSED" };
  if (fromSlug === "paused" && toSlug === "inProgress")
    return { subStatusPatch: null };
  if (fromSlug === "inProgress" && toSlug === "completed")
    return { statusPatch: "COMPLETED" };
  if (fromSlug === "completed" && toSlug === "delivered") {
    toast.error("Usa el botón Entregar de la ficha");
    return "invalid";
  }
  return "invalid";
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function shortName(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1][0]}.`;
}

function currentSlugForOrder(order: SerializedBoardOrder): ColumnSlug {
  if (order.status === "PENDING") return "pending";
  if (order.status === "COMPLETED") return "completed";
  if (order.subStatus === "WAITING_PARTS") return "waitingParts";
  if (order.subStatus === "WAITING_APPROVAL") return "waitingApproval";
  if (order.subStatus === "PAUSED") return "paused";
  return "inProgress";
}

// ── SVG helpers ───────────────────────────────────────────────────────────────

function ChevronDown({ className }: { className?: string }) {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className={className}>
      <path d="M2 4L6 8L10 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SelectChevron() {
  return (
    <svg width="10" height="6" viewBox="0 0 10 6" fill="none">
      <path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── OrderCard (top-level component — no closures over WorkshopBoard state) ────

interface OrderCardProps {
  order: SerializedBoardOrder;
  nowMs: number;
  canDrag: boolean;
  isDragging: boolean;
  onDragStart: (e: React.DragEvent) => void;
  onDragEnd: (e: React.DragEvent) => void;
}

function OrderCard({ order, nowMs, canDrag, isDragging, onDragStart, onDragEnd }: OrderCardProps) {
  const tier = agingTierFor(order.status, order.subStatus, order.createdAtMs, order.updatedAtMs, nowMs, order.type);

  return (
    <article
      draggable={canDrag}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`relative rounded-lg bg-[var(--surf-bright)] p-4 cursor-grab active:cursor-grabbing transition-opacity${isDragging ? " opacity-40" : ""}`}
      style={{ boxShadow: "var(--shadow)" }}
    >
      <header className="flex items-baseline justify-between gap-2">
        <Link
          href={`/workshop/${order.id}`}
          className="font-semibold text-base text-[var(--p)] hover:text-[var(--p-mid)] tracking-[-0.01em] transition-colors"
          style={{ fontFamily: "var(--font-display)" }}
          onClick={(e) => e.stopPropagation()}
        >
          #{order.folio}
        </Link>
        {tier !== null && (
          <Chip
            variant={AGING_VARIANT[tier]}
            icon="clock"
            label={formatAging(order.status, order.subStatus, order.createdAtMs, order.updatedAtMs, nowMs)}
          />
        )}
      </header>

      <p className="mt-1 text-sm text-[var(--on-surf)]">{order.customer.name}</p>

      {order.bikeDisplay && (
        <p className="mt-1 text-xs text-[var(--on-surf-var)]">{order.bikeDisplay}</p>
      )}

      {order.type !== "PAID" && (
        <div className="mt-2">
          <Chip
            variant={TYPE_VARIANT[order.type as NonPaidType]}
            label={TYPE_LABEL_ES[order.type as NonPaidType]}
          />
        </div>
      )}

      <div
        className="mt-3 h-px"
        style={{ background: "color-mix(in srgb, var(--on-surf) 6%, transparent)" }}
      />

      <footer className="mt-3 flex items-center gap-2">
        {order.assignedTech ? (
          <>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--p-container)] text-[0.625rem] font-medium text-[var(--on-p-container)]">
              {initials(order.assignedTech.name)}
            </span>
            <span className="text-xs text-[var(--on-surf-var)]">
              {shortName(order.assignedTech.name)}
            </span>
          </>
        ) : (
          <>
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--surf-low)] text-[0.625rem] text-[var(--on-surf-var)]">
              --
            </span>
            <span className="text-xs text-[var(--on-surf-var)]">Sin asignar</span>
          </>
        )}
      </footer>
    </article>
  );
}

// ── MobileActionButtons (top-level component) ─────────────────────────────────

interface MobileActionButtonsProps {
  order: SerializedBoardOrder;
  onTransition: (orderId: string, t: Transition | "invalid") => void;
}

function MobileActionButtons({ order, onTransition }: MobileActionButtonsProps) {
  const fromSlug = currentSlugForOrder(order);
  const actions: Array<{ label: string; toSlug: ColumnSlug }> = [];

  if (fromSlug === "pending") actions.push({ label: "Iniciar", toSlug: "inProgress" });
  if (fromSlug === "inProgress") {
    actions.push({ label: "Completar", toSlug: "completed" });
    actions.push({ label: "Refacciones", toSlug: "waitingParts" });
    actions.push({ label: "Aprobación", toSlug: "waitingApproval" });
    actions.push({ label: "Pausar", toSlug: "paused" });
  }
  if (fromSlug === "waitingParts" || fromSlug === "waitingApproval" || fromSlug === "paused") {
    actions.push({ label: "Reanudar", toSlug: "inProgress" });
  }

  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.map(({ label, toSlug }) => (
        <button
          key={toSlug}
          type="button"
          onClick={() => onTransition(order.id, resolveTransition(fromSlug, toSlug))}
          className="text-xs font-medium px-3 h-7 rounded-full bg-[var(--surf-low)] text-[var(--on-surf)] hover:bg-[var(--surf-high)] transition-colors"
        >
          {label}
        </button>
      ))}
    </div>
  );
}

// ── WorkshopBoard ─────────────────────────────────────────────────────────────

interface WorkshopBoardProps {
  active: SerializedBoardOrder[];
  deliveredToday: SerializedDeliveredOrder[];
  cancelledToday: SerializedCancelledOrder[];
  technicians: TechnicianOption[];
  currentUser: { id: string; role: string };
  nowMs: number;
}

export default function WorkshopBoard({
  active,
  deliveredToday,
  cancelledToday,
  technicians,
  currentUser,
  nowMs,
}: WorkshopBoardProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  // ── URL param helpers ─────────────────────────────────────────────────────

  function updateParams(updates: Record<string, string | null>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(updates)) {
      if (v === null || v === "") next.delete(k);
      else next.set(k, v);
    }
    router.replace(`?${next.toString()}`, { scroll: false });
  }

  // ── Filter state (URL-synced) ─────────────────────────────────────────────

  const techFilter = searchParams.get("tech") ?? "";
  const agingFilter = (searchParams.get("aging") ?? "") as AgingTier | "";
  const mineFilter = searchParams.get("mine") === "1";
  const typeFilter = new Set(
    (searchParams.get("type") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
  );
  const collapsedParam = searchParams.get("collapsed");
  const collapsed: Set<ColumnSlug> =
    collapsedParam !== null
      ? new Set(collapsedParam.split(",").filter(Boolean) as ColumnSlug[])
      : new Set(DEFAULT_COLLAPSED);
  const openMobile = (searchParams.get("openMobile") ?? "inProgress") as ColumnSlug;

  // ── DnD state ─────────────────────────────────────────────────────────────

  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverSlug, setDragOverSlug] = useState<ColumnSlug | null>(null);
  const dragPayloadRef = useRef<{ orderId: string; fromSlug: ColumnSlug } | null>(null);

  // ── Optimistic orders state ───────────────────────────────────────────────

  const [localOrders, setLocalOrders] = useState<SerializedBoardOrder[]>(active);

  // ── Mobile filter sheet ───────────────────────────────────────────────────

  const [filterSheetOpen, setFilterSheetOpen] = useState(false);

  // ── Filter & bucket ───────────────────────────────────────────────────────

  const filtered = localOrders.filter((o) => {
    if (techFilter && o.assignedTech?.id !== techFilter) return false;
    if (mineFilter && o.assignedTech?.id !== currentUser.id) return false;
    if (typeFilter.size > 0 && !typeFilter.has(o.type)) return false;
    if (agingFilter) {
      const tier = agingTierFor(o.status, o.subStatus, o.createdAtMs, o.updatedAtMs, nowMs, o.type);
      if (tier !== agingFilter) return false;
    }
    return true;
  });

  const buckets = bucketize(filtered);
  const hasActiveFilters = !!techFilter || !!agingFilter || mineFilter || typeFilter.size > 0;
  const totalActive =
    buckets.pending.length +
    buckets.inProgress.length +
    buckets.waitingParts.length +
    buckets.waitingApproval.length +
    buckets.paused.length +
    buckets.completed.length;

  // ── Transition handler ────────────────────────────────────────────────────

  async function handleTransition(orderId: string, t: Transition | "invalid") {
    if (t === "invalid") return;
    const order = localOrders.find((o) => o.id === orderId);
    if (!order) {
      toast.error("Orden no encontrada en el tablero");
      return;
    }
    const prev = localOrders;
    setLocalOrders((cur) =>
      cur.map((o) => {
        if (o.id !== orderId) return o;
        if (t.statusPatch !== undefined) {
          return { ...o, status: t.statusPatch as SerializedBoardOrder["status"], subStatus: null, updatedAtMs: Date.now() };
        }
        return { ...o, subStatus: (t.subStatusPatch ?? null) as SerializedBoardOrder["subStatus"], updatedAtMs: Date.now() };
      })
    );

    try {
      let res: Response;
      if (t.statusPatch !== undefined) {
        res = await fetch(`/api/workshop/orders/${orderId}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ currentStatus: order.status, branchId: order.branchId }),
        });
      } else {
        res = await fetch(`/api/service-orders/${orderId}/sub-status`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subStatus: t.subStatusPatch ?? null, branchId: order.branchId }),
        });
      }
      const result = (await res.json()) as { success: boolean; error?: string };
      if (!result.success) {
        setLocalOrders(prev);
        toast.error(result.error ?? "No se pudo actualizar la orden");
      } else {
        router.refresh();
      }
    } catch {
      setLocalOrders(prev);
      toast.error("Error de red al actualizar la orden");
    }
  }

  // ── DnD handlers ─────────────────────────────────────────────────────────

  function handleDragStart(e: React.DragEvent, orderId: string, fromSlug: ColumnSlug) {
    dragPayloadRef.current = { orderId, fromSlug };
    setDraggingId(orderId);
    e.dataTransfer.effectAllowed = "move";
  }

  function handleDragEnd() {
    setDraggingId(null);
    setDragOverSlug(null);
    dragPayloadRef.current = null;
  }

  function handleDragOver(e: React.DragEvent, toSlug: ColumnSlug) {
    e.preventDefault();
    setDragOverSlug(toSlug);
  }

  function handleDrop(e: React.DragEvent, toSlug: ColumnSlug) {
    e.preventDefault();
    setDragOverSlug(null);
    const p = dragPayloadRef.current;
    if (!p) return;
    const t = resolveTransition(p.fromSlug, toSlug);
    if (t === "invalid") {
      if (toSlug !== "delivered") toast.error("Transición no permitida");
      return;
    }
    handleTransition(p.orderId, t);
  }

  // ── Collapsed toggle ──────────────────────────────────────────────────────

  function toggleCollapsed(slug: ColumnSlug) {
    const next = new Set(collapsed);
    if (next.has(slug)) next.delete(slug);
    else next.add(slug);
    updateParams({ collapsed: next.size > 0 ? [...next].join(",") : null });
  }

  // ── Column data helpers ───────────────────────────────────────────────────

  function getActiveColumnOrders(slug: ColumnSlug): SerializedBoardOrder[] {
    switch (slug) {
      case "pending": return buckets.pending;
      case "inProgress": return buckets.inProgress;
      case "waitingParts": return buckets.waitingParts;
      case "waitingApproval": return buckets.waitingApproval;
      case "paused": return buckets.paused;
      case "completed": return buckets.completed;
      default: return [];
    }
  }

  function getColumnCount(slug: ColumnSlug): number {
    if (slug === "delivered") return deliveredToday.length;
    if (slug === "cancelled") return cancelledToday.length;
    return getActiveColumnOrders(slug).length;
  }

  // ── Simple row (delivered / cancelled) ───────────────────────────────────

  function renderSimpleRow(
    folio: string,
    customerName: string,
    updatedAtMs: number,
    variant: "delivered" | "cancelled"
  ) {
    const elapsedMin = Math.floor((nowMs - updatedAtMs) / 60_000);
    const timeLabel = elapsedMin < 60 ? `hace ${elapsedMin}m` : `hace ${Math.floor(elapsedMin / 60)}h`;
    const textColor = variant === "delivered" ? "text-[var(--sec)]" : "text-[var(--on-surf-var)]";
    return (
      <div key={folio} className="px-4 py-2.5 flex items-center justify-between gap-2">
        <span className={`text-xs font-medium shrink-0 ${textColor}`}>#{folio}</span>
        <span className="text-xs text-[var(--on-surf-var)] truncate flex-1 mx-2">{customerName}</span>
        <span className="text-[10px] text-[var(--on-surf-var)] opacity-60 shrink-0">{timeLabel}</span>
      </div>
    );
  }

  // ── Column header shared JSX ──────────────────────────────────────────────

  function renderColHeader(slug: ColumnSlug, title: string, isCollapsed: boolean) {
    const isDragTarget = dragOverSlug === slug;
    return (
      <div
        className={`flex items-center justify-between px-3 py-2.5 cursor-pointer select-none rounded-t-xl${isDragTarget ? " bg-[color-mix(in_srgb,var(--p)_12%,var(--surf-low))]" : ""}`}
        style={{ boxShadow: "0 1px 0 color-mix(in srgb, var(--on-surf) 6%, transparent)" }}
        onClick={() => toggleCollapsed(slug)}
      >
        {isCollapsed ? (
          <div className="flex flex-col items-center gap-1 w-full py-1">
            <span className="text-[10px] font-semibold text-[var(--on-surf-var)] tracking-[0.04em] uppercase [writing-mode:vertical-rl] rotate-180">
              {title}
            </span>
            <span className="text-[10px] font-bold text-[var(--on-surf-var)]">{getColumnCount(slug)}</span>
          </div>
        ) : (
          <>
            <span className="text-sm font-semibold text-[var(--on-surf)]">{title}</span>
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[var(--on-surf-var)] bg-[color-mix(in_srgb,var(--on-surf)_8%,transparent)] rounded-full px-2 py-0.5">
                {getColumnCount(slug)}
              </span>
              <ChevronDown className="text-[var(--on-surf-var)]" />
            </div>
          </>
        )}
      </div>
    );
  }

  // ── Desktop column body JSX ───────────────────────────────────────────────

  function renderDesktopColBody(slug: ColumnSlug) {
    const activeOrds = getActiveColumnOrders(slug);

    if (slug === "delivered") {
      return deliveredToday.length === 0
        ? <p className="text-center text-xs text-[var(--on-surf-var)] opacity-40 py-8">Sin entregas hoy</p>
        : deliveredToday.map((o) => renderSimpleRow(o.folio, o.customerName, o.updatedAtMs, "delivered"));
    }
    if (slug === "cancelled") {
      return cancelledToday.length === 0
        ? <p className="text-center text-xs text-[var(--on-surf-var)] opacity-40 py-8">Sin cancelaciones hoy</p>
        : cancelledToday.map((o) => renderSimpleRow(o.folio, o.customerName, o.updatedAtMs, "cancelled"));
    }
    if (activeOrds.length === 0) {
      return (
        <div className="flex items-center justify-center py-10 text-[var(--on-surf-var)] opacity-40">
          <p className="text-xs">Sin pendientes</p>
        </div>
      );
    }
    return activeOrds.map((o) => (
      <OrderCard
        key={o.id}
        order={o}
        nowMs={nowMs}
        canDrag
        isDragging={draggingId === o.id}
        onDragStart={(e) => handleDragStart(e, o.id, slug)}
        onDragEnd={handleDragEnd}
      />
    ));
  }

  // ── Filter type chips list ────────────────────────────────────────────────

  const FILTER_TYPES: NonPaidType[] = ["WARRANTY", "COURTESY", "POLICY_MAINTENANCE"];

  const AGING_LABELS: Record<AgingTier, string> = {
    verde: "Al día",
    ambar: "Por vencer",
    rojo: "Vencida",
  };

  const MOBILE_SLUG_LABELS: Record<ColumnSlug, string> = {
    pending: "En Espera",
    inProgress: "En Reparación",
    waitingParts: "Esp. Refacciones",
    waitingApproval: "Esp. Aprobación",
    paused: "Pausada",
    completed: "Completada",
    delivered: "Entregada hoy",
    cancelled: "Cancelada hoy",
  };

  const ALL_MOBILE_SLUGS: ColumnSlug[] = [
    "pending", "inProgress", "waitingParts", "waitingApproval",
    "paused", "completed", "delivered", "cancelled",
  ];

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex-1 flex flex-col gap-3 overflow-hidden">

      {/* ── Desktop header bar ── */}
      <div className="hidden md:flex items-center gap-3 flex-wrap">
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-[var(--surf-low)] text-[var(--on-surf-var)]">
          {totalActive} activas
        </span>

        {/* Técnico */}
        <div className="relative">
          <select
            value={techFilter}
            onChange={(e) => updateParams({ tech: e.target.value || null })}
            className="appearance-none h-8 pl-3 pr-8 rounded-full text-xs font-medium text-[var(--on-surf)] cursor-pointer"
            style={{ background: "var(--surf-low)", border: "none" }}
          >
            <option value="">Técnico</option>
            {technicians.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surf-var)]">
            <SelectChevron />
          </span>
        </div>

        {/* Antigüedad */}
        <div className="relative">
          <select
            value={agingFilter}
            onChange={(e) => updateParams({ aging: (e.target.value as AgingTier) || null })}
            className="appearance-none h-8 pl-3 pr-8 rounded-full text-xs font-medium text-[var(--on-surf)] cursor-pointer"
            style={{ background: "var(--surf-low)", border: "none" }}
          >
            <option value="">Antigüedad</option>
            {(Object.entries(AGING_LABELS) as [AgingTier, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
          <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surf-var)]">
            <SelectChevron />
          </span>
        </div>

        {/* Type chips */}
        {FILTER_TYPES.map((type) => {
          const isActive = typeFilter.has(type);
          return (
            <button
              key={type}
              type="button"
              onClick={() => {
                const next = new Set(typeFilter);
                if (next.has(type)) next.delete(type); else next.add(type);
                updateParams({ type: next.size > 0 ? [...next].join(",") : null });
              }}
              className={`text-xs font-medium px-3 h-8 rounded-full transition-colors ${isActive ? "bg-[var(--p)] text-[var(--on-p)]" : "bg-[var(--surf-low)] text-[var(--on-surf-var)] hover:bg-[var(--surf-high)]"}`}
            >
              {TYPE_LABEL_ES[type]}
            </button>
          );
        })}

        {/* Solo mis órdenes — TECHNICIAN only */}
        {currentUser.role === "TECHNICIAN" && (
          <button
            type="button"
            onClick={() => updateParams({ mine: mineFilter ? null : "1" })}
            className={`text-xs font-medium px-3 h-8 rounded-full transition-colors ${mineFilter ? "bg-[var(--p)] text-[var(--on-p)]" : "bg-[var(--surf-low)] text-[var(--on-surf-var)] hover:bg-[var(--surf-high)]"}`}
          >
            Solo mis órdenes
          </button>
        )}

        {hasActiveFilters && (
          <button
            type="button"
            onClick={() => updateParams({ tech: null, aging: null, mine: null, type: null })}
            className="text-[11px] font-medium text-[var(--p)] hover:text-[var(--p-mid)] transition-colors"
          >
            Limpiar filtros
          </button>
        )}

        {/* Nueva Orden — Velocity Gradient (única instancia en este board) */}
        <Link
          href="/workshop/recepcion"
          className="ml-auto flex items-center gap-1.5 h-8 px-4 rounded-full text-xs font-semibold text-[var(--on-p)] transition-opacity hover:opacity-90"
          style={{ background: "var(--velocity-gradient)" }}
        >
          + Nueva Orden
        </Link>
      </div>

      {/* ── Mobile header bar ── */}
      <div className="flex md:hidden items-center justify-between gap-3">
        <span className="text-xs font-medium text-[var(--on-surf-var)]">
          {totalActive} activas
        </span>
        <div className="flex gap-2">
          {hasActiveFilters && (
            <button
              type="button"
              onClick={() => updateParams({ tech: null, aging: null, mine: null, type: null })}
              className="text-[11px] font-medium text-[var(--p)]"
            >
              Limpiar
            </button>
          )}
          <button
            type="button"
            onClick={() => setFilterSheetOpen(true)}
            className="text-xs font-medium h-8 px-3 rounded-full bg-[var(--surf-low)] text-[var(--on-surf-var)]"
          >
            Filtros{hasActiveFilters ? ` (${[techFilter, agingFilter, mineFilter, typeFilter.size > 0].filter(Boolean).length})` : ""}
          </button>
        </div>
      </div>

      {/* ── Desktop Kanban ── */}
      <div className="hidden md:flex flex-1 gap-3 overflow-x-auto pb-3 snap-x snap-proximity scroll-px-4">
        {MAIN_COLUMNS.map((col) => {
          const isCollapsed = collapsed.has(col.slug);
          return (
            <div
              key={col.slug}
              className={`snap-start shrink-0 flex flex-col rounded-xl transition-all ${isCollapsed ? "w-12" : "min-w-[300px] max-w-[320px]"}`}
              style={{ background: "var(--surf-low)" }}
              onDragOver={col.slug !== "delivered" && col.slug !== "cancelled" ? (e) => handleDragOver(e, col.slug) : undefined}
              onDragLeave={() => setDragOverSlug(null)}
              onDrop={col.slug !== "delivered" && col.slug !== "cancelled" ? (e) => handleDrop(e, col.slug) : undefined}
            >
              {renderColHeader(col.slug, col.title, isCollapsed)}
              {!isCollapsed && (
                <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: "calc(100vh - 280px)" }}>
                  {renderDesktopColBody(col.slug)}
                </div>
              )}
            </div>
          );
        })}

        {/* Paused tray — lateral, fuera del flujo principal */}
        {(() => {
          const slug: ColumnSlug = "paused";
          const isCollapsed = collapsed.has(slug);
          const pausedOrds = buckets.paused;
          return (
            <div
              className={`snap-start shrink-0 ml-2 flex flex-col rounded-xl transition-all ${isCollapsed ? "w-12" : "min-w-[240px] max-w-[260px]"}`}
              style={{
                background: "color-mix(in srgb, var(--warn) 8%, var(--surf-low))",
                boxShadow: "-1px 0 0 color-mix(in srgb, var(--on-surf) 8%, transparent)",
              }}
              onDragOver={(e) => handleDragOver(e, slug)}
              onDragLeave={() => setDragOverSlug(null)}
              onDrop={(e) => handleDrop(e, slug)}
            >
              <div
                className={`flex items-center justify-between px-3 py-2.5 cursor-pointer select-none rounded-t-xl${dragOverSlug === slug ? " bg-[color-mix(in_srgb,var(--warn)_16%,transparent)]" : ""}`}
                style={{ boxShadow: "0 1px 0 color-mix(in srgb, var(--on-surf) 6%, transparent)" }}
                onClick={() => toggleCollapsed(slug)}
              >
                {isCollapsed ? (
                  <div className="flex flex-col items-center gap-1 w-full py-1">
                    <span className="text-[10px] font-semibold text-[var(--on-surf-var)] tracking-[0.04em] uppercase [writing-mode:vertical-rl] rotate-180">
                      Pausada
                    </span>
                    <span className="text-[10px] font-bold text-[var(--on-surf-var)]">{pausedOrds.length}</span>
                  </div>
                ) : (
                  <>
                    <span className="text-sm font-semibold text-[var(--on-surf)]">Pausada</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-[var(--on-surf-var)] bg-[color-mix(in_srgb,var(--on-surf)_8%,transparent)] rounded-full px-2 py-0.5">
                        {pausedOrds.length}
                      </span>
                      <ChevronDown className="text-[var(--on-surf-var)]" />
                    </div>
                  </>
                )}
              </div>
              {!isCollapsed && (
                <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ maxHeight: "calc(100vh - 280px)" }}>
                  {pausedOrds.length === 0
                    ? <div className="flex items-center justify-center py-10 text-[var(--on-surf-var)] opacity-40"><p className="text-xs">Sin órdenes pausadas</p></div>
                    : pausedOrds.map((o) => (
                        <OrderCard
                          key={o.id}
                          order={o}
                          nowMs={nowMs}
                          canDrag
                          isDragging={draggingId === o.id}
                          onDragStart={(e) => handleDragStart(e, o.id, slug)}
                          onDragEnd={handleDragEnd}
                        />
                      ))}
                </div>
              )}
            </div>
          );
        })()}
      </div>

      {/* ── Mobile accordion ── */}
      <div className="flex md:hidden flex-col gap-3 overflow-y-auto pb-4">
        {ALL_MOBILE_SLUGS.map((slug) => {
          const isOpen = openMobile === slug;
          const title = MOBILE_SLUG_LABELS[slug];
          const activeOrds = getActiveColumnOrders(slug);

          return (
            <div key={slug} className="rounded-xl overflow-hidden" style={{ background: "var(--surf-low)" }}>
              <button
                type="button"
                className="w-full flex items-center justify-between px-4 py-3 text-left"
                style={{ boxShadow: isOpen ? "0 1px 0 color-mix(in srgb, var(--on-surf) 6%, transparent)" : undefined }}
                onClick={() => updateParams({ openMobile: isOpen ? "" : slug })}
              >
                <span className="text-sm font-semibold text-[var(--on-surf)]">{title}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-[var(--on-surf-var)] bg-[color-mix(in_srgb,var(--on-surf)_8%,transparent)] rounded-full px-2 py-0.5">
                    {getColumnCount(slug)}
                  </span>
                  <ChevronDown className={`text-[var(--on-surf-var)] transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </div>
              </button>

              {isOpen && (
                <div className="p-3 space-y-3">
                  {slug === "delivered"
                    ? deliveredToday.length === 0
                      ? <p className="text-center text-xs text-[var(--on-surf-var)] opacity-40 py-4">Sin entregas hoy</p>
                      : deliveredToday.map((o) => renderSimpleRow(o.folio, o.customerName, o.updatedAtMs, "delivered"))
                    : slug === "cancelled"
                    ? cancelledToday.length === 0
                      ? <p className="text-center text-xs text-[var(--on-surf-var)] opacity-40 py-4">Sin cancelaciones hoy</p>
                      : cancelledToday.map((o) => renderSimpleRow(o.folio, o.customerName, o.updatedAtMs, "cancelled"))
                    : activeOrds.length === 0
                    ? <p className="text-center text-xs text-[var(--on-surf-var)] opacity-40 py-4">Sin pendientes</p>
                    : activeOrds.map((o) => (
                        <div key={o.id}>
                          <OrderCard
                            order={o}
                            nowMs={nowMs}
                            canDrag={false}
                            isDragging={false}
                            onDragStart={() => {}}
                            onDragEnd={() => {}}
                          />
                          <MobileActionButtons order={o} onTransition={handleTransition} />
                        </div>
                      ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Mobile filter sheet ── */}
      {filterSheetOpen && (
        <div className="fixed inset-0 z-50 flex items-end md:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={() => setFilterSheetOpen(false)} />
          <div
            className="relative w-full rounded-t-2xl p-6 space-y-5"
            style={{
              background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
              backdropFilter: "blur(20px)",
              WebkitBackdropFilter: "blur(20px)",
            }}
          >
            <h3 className="text-base font-semibold text-[var(--on-surf)]">Filtros</h3>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--on-surf-var)] uppercase tracking-[0.04em]">Técnico</label>
              <select
                value={techFilter}
                onChange={(e) => updateParams({ tech: e.target.value || null })}
                className="w-full h-10 rounded-lg px-3 text-sm text-[var(--on-surf)]"
                style={{ background: "var(--surf-low)", border: "none" }}
              >
                <option value="">Todos los técnicos</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>{t.name}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--on-surf-var)] uppercase tracking-[0.04em]">Antigüedad</label>
              <div className="flex gap-2 flex-wrap">
                {(Object.entries(AGING_LABELS) as [AgingTier, string][]).map(([tier, label]) => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => updateParams({ aging: agingFilter === tier ? null : tier })}
                    className={`text-xs font-medium px-3 h-8 rounded-full transition-colors ${agingFilter === tier ? "bg-[var(--p)] text-[var(--on-p)]" : "bg-[var(--surf-low)] text-[var(--on-surf-var)] hover:bg-[var(--surf-high)]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-[var(--on-surf-var)] uppercase tracking-[0.04em]">Tipo de orden</label>
              <div className="flex gap-2 flex-wrap">
                {FILTER_TYPES.map((type) => {
                  const isActive = typeFilter.has(type);
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        const next = new Set(typeFilter);
                        if (next.has(type)) next.delete(type); else next.add(type);
                        updateParams({ type: next.size > 0 ? [...next].join(",") : null });
                      }}
                      className={`text-xs font-medium px-3 h-8 rounded-full transition-colors ${isActive ? "bg-[var(--p)] text-[var(--on-p)]" : "bg-[var(--surf-low)] text-[var(--on-surf-var)] hover:bg-[var(--surf-high)]"}`}
                    >
                      {TYPE_LABEL_ES[type]}
                    </button>
                  );
                })}
              </div>
            </div>

            {currentUser.role === "TECHNICIAN" && (
              <button
                type="button"
                onClick={() => updateParams({ mine: mineFilter ? null : "1" })}
                className={`w-full h-10 rounded-lg text-sm font-medium transition-colors ${mineFilter ? "bg-[var(--p)] text-[var(--on-p)]" : "bg-[var(--surf-low)] text-[var(--on-surf-var)]"}`}
              >
                Solo mis órdenes
              </button>
            )}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={() => { updateParams({ tech: null, aging: null, mine: null, type: null }); setFilterSheetOpen(false); }}
                className="w-full text-sm font-medium text-[var(--p)]"
              >
                Limpiar filtros
              </button>
            )}

            <button
              type="button"
              onClick={() => setFilterSheetOpen(false)}
              className="w-full h-10 rounded-lg text-sm font-medium bg-[var(--surf-high)] text-[var(--on-surf)]"
            >
              Cerrar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
