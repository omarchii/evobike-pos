"use client";

import { useState, useTransition } from "react";
import {
  ArrowRight,
  CheckCircle2,
  CornerUpLeft,
  MessageCircleQuestion,
  Pause,
  Play,
  Wrench,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import type { ServiceOrderSubStatus } from "@prisma/client";
import type { SerializedMobileOrder } from "@/lib/workshop-mobile";
import { mobileFetch } from "./mobile-fetch";

interface ActionSheetProps {
  order: SerializedMobileOrder | null;
  onClose: () => void;
  onMutated: () => void;
}

type SubStatusChoice = {
  value: ServiceOrderSubStatus;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

const SUB_STATUS_CHOICES: SubStatusChoice[] = [
  { value: "WAITING_PARTS", label: "Esperando pieza", icon: Wrench },
  { value: "WAITING_APPROVAL", label: "Esperando aprobación", icon: MessageCircleQuestion },
  { value: "PAUSED", label: "Pausar", icon: Pause },
];

export default function ActionSheet({ order, onClose, onMutated }: ActionSheetProps) {
  // `showSubMenu` alterna entre el menú principal y la lista de motivos
  // de espera. Mantenemos ambos dentro del mismo Sheet — menos nodos y
  // nada de anidar Radix Dialogs.
  const [showSubMenu, setShowSubMenu] = useState(false);
  const [isPending, startTransition] = useTransition();

  const open = order !== null;

  const resetAndClose = () => {
    setShowSubMenu(false);
    onClose();
  };

  const handleOpenChange = (next: boolean) => {
    if (!next) resetAndClose();
  };

  if (!order) {
    // Mantenemos el Sheet en el árbol aunque order sea null para que la
    // animación de cierre tenga algo a qué aferrarse.
    return (
      <Sheet open={false} onOpenChange={handleOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-2xl border-[var(--outline-var)]/30 bg-[var(--surf-low)] text-[var(--on-surf)]"
        />
      </Sheet>
    );
  }

  const run = (fn: () => Promise<void>) => {
    if (isPending) return;
    startTransition(async () => {
      try {
        await fn();
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Error al actualizar la orden";
        toast.error(msg);
      }
    });
  };

  const afterMutation = (message: string) => {
    toast.success(message);
    // Cerrar sheet ANTES de onMutated (que dispara router.refresh). Si la
    // acción hizo desaparecer la card, el sheet no queda flotando sobre
    // DOM vacío.
    resetAndClose();
    onMutated();
  };

  const doAdvanceStatus = (from: "PENDING" | "IN_PROGRESS") => {
    run(async () => {
      await mobileFetch(`/api/workshop/orders/${order.id}/status`, {
        method: "PATCH",
        body: { currentStatus: from },
      });
      afterMutation(from === "PENDING" ? "Orden iniciada" : "Orden completada");
    });
  };

  const doRelease = () => {
    run(async () => {
      await mobileFetch(`/api/service-orders/${order.id}/assign`, {
        method: "PATCH",
        body: { assignedTechId: null },
      });
      afterMutation(`Soltaste #${order.folio}`);
    });
  };

  const doSetSubStatus = (value: ServiceOrderSubStatus | null) => {
    run(async () => {
      await mobileFetch(`/api/service-orders/${order.id}/sub-status`, {
        method: "POST",
        body: { subStatus: value },
      });
      afterMutation(value === null ? "Trabajo reanudado" : "Motivo actualizado");
    });
  };

  const isPending_ = order.status === "PENDING";
  const isActive = order.status === "IN_PROGRESS" && order.subStatus === null;
  const isWaiting = order.status === "IN_PROGRESS" && order.subStatus !== null;
  const isCompleted = order.status === "COMPLETED";

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetContent
        side="bottom"
        className="gap-0 rounded-t-2xl border-[var(--outline-var)]/30 bg-[var(--surf-low)] text-[var(--on-surf)]"
      >
        <SheetHeader className="pb-2">
          <SheetTitle className="text-[var(--on-surf)]">
            #{order.folio}
          </SheetTitle>
          <p className="text-xs text-[var(--on-surf-var)]">
            {order.customerName}
            {order.bikeDisplay ? ` · ${order.bikeDisplay}` : ""}
          </p>
        </SheetHeader>

        <div className="flex flex-col gap-2 px-4 pb-6">
          {showSubMenu ? (
            <>
              {SUB_STATUS_CHOICES.map((choice) => (
                <ActionButton
                  key={choice.value}
                  icon={choice.icon}
                  label={choice.label}
                  onClick={() => doSetSubStatus(choice.value)}
                  disabled={isPending}
                />
              ))}
              <ActionButton
                icon={CornerUpLeft}
                label="Volver"
                onClick={() => setShowSubMenu(false)}
                disabled={isPending}
                variant="ghost"
              />
            </>
          ) : (
            <>
              {isPending_ && (
                <>
                  <ActionButton
                    icon={Play}
                    label="Iniciar"
                    onClick={() => doAdvanceStatus("PENDING")}
                    disabled={isPending}
                    variant="primary"
                  />
                  <ActionButton
                    icon={CornerUpLeft}
                    label="Soltar orden"
                    onClick={doRelease}
                    disabled={isPending}
                    variant="ghost"
                  />
                </>
              )}

              {isActive && (
                <>
                  <ActionButton
                    icon={Pause}
                    label="En espera"
                    onClick={() => setShowSubMenu(true)}
                    disabled={isPending}
                  />
                  <ActionButton
                    icon={CheckCircle2}
                    label="Completar"
                    onClick={() => doAdvanceStatus("IN_PROGRESS")}
                    disabled={isPending}
                    variant="primary"
                  />
                  <ActionButton
                    icon={CornerUpLeft}
                    label="Soltar orden"
                    onClick={doRelease}
                    disabled={isPending}
                    variant="ghost"
                  />
                </>
              )}

              {isWaiting && (
                <>
                  <ActionButton
                    icon={Play}
                    label="Reanudar"
                    onClick={() => doSetSubStatus(null)}
                    disabled={isPending}
                    variant="primary"
                  />
                  <ActionButton
                    icon={Pause}
                    label="Cambiar motivo"
                    onClick={() => setShowSubMenu(true)}
                    disabled={isPending}
                  />
                  <ActionButton
                    icon={CornerUpLeft}
                    label="Soltar orden"
                    onClick={doRelease}
                    disabled={isPending}
                    variant="ghost"
                  />
                </>
              )}

              <Link
                href={`/workshop/${order.id}`}
                className="group flex w-full items-center gap-3 rounded-xl bg-[var(--surf-lowest)] px-4 py-3 text-sm font-medium text-[var(--on-surf)] transition-opacity active:scale-[0.99]"
              >
                <ArrowRight className="size-4 opacity-70" aria-hidden />
                <span className="flex-1 text-left">
                  {isCompleted ? "Ver ficha completa" : "Ver ficha completa"}
                </span>
              </Link>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}

interface ActionButtonProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  variant?: "default" | "primary" | "ghost";
}

function ActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  variant = "default",
}: ActionButtonProps) {
  const styles =
    variant === "primary"
      ? {
          background: "var(--p-container)",
          color: "var(--on-p-container)",
        }
      : variant === "ghost"
        ? { background: "transparent", color: "var(--on-surf-var)" }
        : {
            background: "var(--surf-lowest)",
            color: "var(--on-surf)",
          };

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-sm font-medium transition-[transform,opacity] active:scale-[0.99] disabled:opacity-60"
      style={styles}
    >
      <Icon className="size-4" aria-hidden />
      <span className="flex-1 text-left">{label}</span>
    </button>
  );
}
