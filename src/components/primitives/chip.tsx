import { Icon, type IconName } from "@/components/primitives/icon";

export type ChipVariant = "neutral" | "success" | "warn" | "error" | "info";

const VARIANT_CLASSES: Record<ChipVariant, string> = {
  neutral: "bg-[var(--surf-high)] text-[var(--on-surf)]",
  success: "bg-[var(--sec-container)] text-[var(--on-sec-container)]",
  warn:    "bg-[var(--warn-container)] text-[var(--on-surf)]",
  error:   "bg-[var(--ter-container)] text-[var(--on-ter-container)]",
  info:    "bg-[var(--p-container)] text-[var(--on-p-container)]",
};

type ChipProps = {
  variant?: ChipVariant;
  label: string;
  icon?: IconName;
};

export function Chip({ variant = "neutral", label, icon }: ChipProps) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 text-[0.625rem] font-medium tracking-[0.04em] uppercase whitespace-nowrap ${VARIANT_CLASSES[variant]}`}
    >
      {icon && <Icon name={icon} size={11} strokeWidth={1.75} />}
      {label}
    </span>
  );
}
