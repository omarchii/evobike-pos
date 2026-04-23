import { Clock, User2 } from "lucide-react";
import { formatRelative } from "@/lib/format-relative";
import type { SerializedMobileOrder } from "@/lib/workshop-mobile";
import StatusBadge from "./status-badge";

interface OrderCardProps {
  order: SerializedMobileOrder;
  // `nowMs` es un timestamp estable pasado desde el server para que
  // SSR e hydrate coincidan (evita mismatch con `new Date()` cliente).
  // Polling de G.3 refresca el árbol y por tanto `nowMs`.
  nowMs: number;
  onSelect?: (order: SerializedMobileOrder) => void;
}

function firstWord(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export default function OrderCard({ order, nowMs, onSelect }: OrderCardProps) {
  const subtitleParts = [order.bikeDisplay, order.diagnosisShort].filter(Boolean);
  const subtitle = subtitleParts.length > 0 ? subtitleParts.join(" · ") : "Sin detalle";
  const relative = formatRelative(order.updatedAtIso, new Date(nowMs));
  const dimmed = order.status === "IN_PROGRESS" && order.subStatus !== null;

  const Wrapper = onSelect ? "button" : "div";

  return (
    <Wrapper
      {...(onSelect
        ? {
            type: "button" as const,
            onClick: () => onSelect(order),
          }
        : {})}
      className={`relative flex w-full items-start gap-3 overflow-hidden rounded-xl bg-[var(--surf-lowest)] p-3 text-left transition-[transform,opacity] active:scale-[0.99] ${
        dimmed ? "opacity-80" : ""
      }`}
    >
      {/* Barra izquierda — marca visual de estado activo */}
      {order.status === "IN_PROGRESS" && order.subStatus === null && (
        <span
          className="absolute inset-y-0 left-0 w-1 rounded-l-xl"
          style={{ background: "var(--p)" }}
          aria-hidden
        />
      )}
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
            {relative}
          </span>
          <span className="inline-flex min-w-0 items-center gap-1">
            <User2 className="size-3.5" aria-hidden />
            <span className="truncate">{firstWord(order.customerName)}</span>
          </span>
        </div>
      </div>
    </Wrapper>
  );
}
