import type { ServiceOrderStatus, ServiceOrderSubStatus } from "@prisma/client";

interface StatusBadgeProps {
  status: ServiceOrderStatus;
  subStatus: ServiceOrderSubStatus | null;
}

interface BadgeSpec {
  label: string;
  // Usamos tokens CSS (globals.css) en vez de clases Tailwind de color para
  // mantener una única fuente de verdad — el mismo chip responde a light/
  // dark sin duplicar clases. `bg` es el contenedor y `fg` el texto.
  bg: string;
  fg: string;
}

function specFor(status: ServiceOrderStatus, subStatus: ServiceOrderSubStatus | null): BadgeSpec {
  if (status === "COMPLETED") {
    return { label: "Lista", bg: "var(--sec-container)", fg: "var(--on-sec-container)" };
  }
  if (status === "PENDING") {
    return { label: "Pendiente", bg: "var(--warn-container)", fg: "var(--warn)" };
  }
  // IN_PROGRESS
  if (subStatus === "WAITING_PARTS") {
    return { label: "Espera pieza", bg: "var(--ter-container)", fg: "var(--on-ter-container)" };
  }
  if (subStatus === "WAITING_APPROVAL") {
    return { label: "Espera aprobación", bg: "var(--ter-container)", fg: "var(--on-ter-container)" };
  }
  if (subStatus === "PAUSED") {
    return { label: "Pausada", bg: "var(--surf-dim)", fg: "var(--on-surf-var)" };
  }
  return { label: "En trabajo", bg: "var(--p-container)", fg: "var(--on-p-container)" };
}

export default function StatusBadge({ status, subStatus }: StatusBadgeProps) {
  const spec = specFor(status, subStatus);
  return (
    <span
      className="inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium tracking-tight"
      style={{ background: spec.bg, color: spec.fg }}
    >
      {spec.label}
    </span>
  );
}
