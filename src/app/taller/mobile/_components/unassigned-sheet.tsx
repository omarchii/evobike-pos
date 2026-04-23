"use client";

import { useEffect, useState, useTransition } from "react";
import { Clock, Inbox, User2 } from "lucide-react";
import { toast } from "sonner";
import { formatRelative } from "@/lib/format-relative";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { SerializedMobileOrder } from "@/lib/workshop-mobile";
import StatusBadge from "./status-badge";
import { mobileFetch } from "./mobile-fetch";

interface UnassignedSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  branchName: string;
  currentUserId: string;
  onMutated: () => void;
}

type FetchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "ok"; orders: SerializedMobileOrder[] };

export default function UnassignedSheet({
  open,
  onOpenChange,
  branchName,
  currentUserId,
  onMutated,
}: UnassignedSheetProps) {
  const [state, setState] = useState<FetchState>({ kind: "idle" });
  const [claiming, startClaim] = useTransition();
  const [claimingId, setClaimingId] = useState<string | null>(null);

  // Fetch al abrir. AbortController para descartar respuestas de un sheet
  // que se cerró antes de que el servidor responda.
  useEffect(() => {
    if (!open) {
      setState({ kind: "idle" });
      return;
    }
    const ctrl = new AbortController();
    setState({ kind: "loading" });
    mobileFetch<SerializedMobileOrder[]>("/api/workshop/orders/unassigned", {
      signal: ctrl.signal,
    })
      .then((orders) => setState({ kind: "ok", orders }))
      .catch((err: unknown) => {
        if (ctrl.signal.aborted) return;
        const message =
          err instanceof Error ? err.message : "No se pudo cargar la lista";
        setState({ kind: "error", message });
      });
    return () => ctrl.abort();
  }, [open]);

  const handleClaim = (orderId: string, folio: string) => {
    if (claiming) return;
    setClaimingId(orderId);
    startClaim(async () => {
      try {
        await mobileFetch(`/api/service-orders/${orderId}/assign`, {
          method: "PATCH",
          body: { assignedTechId: currentUserId },
        });
        toast.success(`Tomaste #${folio}`);
        onOpenChange(false);
        onMutated();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "No se pudo tomar la orden";
        toast.error(msg);
      } finally {
        setClaimingId(null);
      }
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="max-h-[80vh] gap-0 overflow-hidden rounded-t-2xl border-[var(--outline-var)]/30 bg-[var(--surf-low)] text-[var(--on-surf)]"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-[var(--on-surf)]">
            Sin asignar en {branchName}
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 pb-6">
          {state.kind === "loading" && (
            <p className="py-10 text-center text-sm text-[var(--on-surf-var)]">
              Cargando…
            </p>
          )}

          {state.kind === "error" && (
            <p className="py-10 text-center text-sm text-[var(--warn)]">
              {state.message}
            </p>
          )}

          {state.kind === "ok" && state.orders.length === 0 && (
            <div className="flex flex-col items-center gap-2 py-10 text-center">
              <Inbox className="size-8 opacity-40" aria-hidden />
              <p className="text-sm text-[var(--on-surf-var)]">
                No hay órdenes sin asignar en {branchName} por ahora.
              </p>
            </div>
          )}

          {state.kind === "ok" && state.orders.length > 0 && (
            <div className="space-y-2">
              {state.orders.map((o) => (
                <UnassignedCard
                  key={o.id}
                  order={o}
                  loading={claimingId === o.id}
                  disabled={claiming}
                  onClaim={() => handleClaim(o.id, o.folio)}
                />
              ))}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface UnassignedCardProps {
  order: SerializedMobileOrder;
  loading: boolean;
  disabled: boolean;
  onClaim: () => void;
}

function UnassignedCard({ order, loading, disabled, onClaim }: UnassignedCardProps) {
  const subtitleParts = [order.bikeDisplay, order.diagnosisShort].filter(Boolean);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : "Sin detalle";
  return (
    <button
      type="button"
      onClick={onClaim}
      disabled={disabled}
      className="flex w-full items-start gap-3 rounded-xl bg-[var(--surf-lowest)] p-3 text-left transition-[transform,opacity] active:scale-[0.99] disabled:opacity-60"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <span className="font-[var(--font-display)] text-base font-semibold leading-none text-[var(--on-surf)]">
            #{order.folio}
          </span>
          <StatusBadge status={order.status} subStatus={order.subStatus} />
        </div>
        <p className="mt-1.5 truncate text-sm text-[var(--on-surf-var)]">{subtitle}</p>
        <div className="mt-2 flex items-center gap-3 text-[11px] text-[var(--on-surf-var)]">
          <span className="inline-flex items-center gap-1">
            <Clock className="size-3.5" aria-hidden />
            {formatRelative(order.createdAtIso)}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <User2 className="size-3.5" aria-hidden />
            <span className="truncate">{order.customerName}</span>
          </span>
        </div>
      </div>
      <span
        className="shrink-0 self-center rounded-full px-3 py-1.5 text-xs font-medium"
        style={{ background: "var(--p-container)", color: "var(--on-p-container)" }}
      >
        {loading ? "…" : "Tomar"}
      </span>
    </button>
  );
}
