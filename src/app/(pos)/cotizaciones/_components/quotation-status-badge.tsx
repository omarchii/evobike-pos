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
    bg: "var(--surf-highest)",
    color: "var(--on-surf-var)",
  },
  EN_ESPERA_CLIENTE: {
    label: "En espera del cliente",
    bg: "var(--warn-container)",
    color: "var(--warn)",
  },
  EN_ESPERA_FABRICA: {
    label: "En espera de fábrica",
    bg: "var(--p-container)",
    color: "var(--on-p-container)",
  },
  ACEPTADA: {
    label: "Aceptada",
    bg: "var(--sec-container)",
    color: "var(--on-sec-container)",
  },
  PAGADA: {
    label: "Pagada",
    bg: "var(--sec-container)",
    color: "var(--on-sec-container)",
  },
  FINALIZADA: {
    label: "Finalizada",
    bg: "var(--p-container)",
    color: "var(--p)",
  },
  RECHAZADA: {
    label: "Rechazada",
    bg: "var(--ter-container)",
    color: "var(--ter)",
  },
  EXPIRED: {
    label: "Expirada",
    bg: "var(--ter-container)",
    color: "var(--on-ter-container)",
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
