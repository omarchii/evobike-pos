import { Truck } from "lucide-react";
import type { StockTransferStatus } from "@prisma/client";
import { cn } from "@/lib/utils";

interface Props {
  status: StockTransferStatus;
  size?: "sm" | "md";
}

type Config = { label: string; bg: string; color: string; withIcon?: true };

const CONFIG: Record<StockTransferStatus, Config> = {
  SOLICITADA:  { label: "Solicitada",  bg: "var(--warn-container)",  color: "var(--warn)" },
  BORRADOR:    { label: "Borrador",    bg: "var(--surf-highest)",    color: "var(--on-surf-var)" },
  EN_TRANSITO: { label: "En tránsito", bg: "var(--p-container)",     color: "var(--on-p-container)", withIcon: true },
  RECIBIDA:    { label: "Recibida",    bg: "var(--sec-container)",   color: "var(--on-sec-container)" },
  CANCELADA:   { label: "Cancelada",   bg: "var(--ter-container)",   color: "var(--on-ter-container)" },
};

export function TransferStatusBadge({ status, size = "sm" }: Props) {
  const { label, bg, color, withIcon } = CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full font-medium tracking-[0.04em] uppercase",
        size === "sm" ? "px-2.5 py-0.5 text-[0.625rem]" : "px-3 py-1 text-xs",
      )}
      style={{ background: bg, color, fontFamily: "var(--font-body)" }}
    >
      {withIcon && <Truck className="h-3 w-3 shrink-0" />}
      {label}
    </span>
  );
}
