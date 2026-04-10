import { cn } from "@/lib/utils";
import type { EffectiveStatus } from "@/lib/quotations";

interface Props {
  status: EffectiveStatus;
  size?: "sm" | "md";
}

const CONFIG: Record<
  EffectiveStatus,
  { label: string; bg: string; color: string }
> = {
  DRAFT: {
    label: "Borrador",
    bg: "var(--warn-container)",
    color: "var(--warn)",
  },
  SENT: {
    label: "Enviada",
    bg: "var(--p-container)",
    color: "var(--on-p-container)",
  },
  CONVERTED: {
    label: "Convertida",
    bg: "var(--sec-container)",
    color: "var(--on-sec-container)",
  },
  EXPIRED: {
    label: "Expirada",
    bg: "var(--ter-container)",
    color: "var(--on-ter-container)",
  },
  CANCELLED: {
    label: "Cancelada",
    bg: "var(--surf-highest)",
    color: "var(--on-surf-var)",
  },
};

export default function QuotationStatusBadge({ status, size = "sm" }: Props) {
  const { label, bg, color } = CONFIG[status];
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full font-medium tracking-wider uppercase",
        size === "sm" ? "px-2.5 py-0.5 text-[0.625rem]" : "px-3 py-1 text-xs"
      )}
      style={{ background: bg, color }}
    >
      {label}
    </span>
  );
}
