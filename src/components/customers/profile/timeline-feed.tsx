"use client";

// Timeline unificado del perfil (BRIEF §7.4 Resumen).
// Consume /api/customers/[id]/timeline. Filtros por tipo (chips toggleables)
// y rango de fechas. Paginación offset-based con botón "Cargar más".

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "@/components/primitives/icon";
import { formatMXN, formatRelative, formatDate } from "@/lib/format";

type TimelineKind =
  | "SALE"
  | "LAYAWAY"
  | "PAYMENT"
  | "SERVICE_ORDER"
  | "QUOTATION"
  | "BALANCE_TOPUP"
  | "NOTE";

interface TimelineEvent {
  id: string;
  kind: TimelineKind;
  at: string;
  title: string;
  meta: Record<string, unknown>;
}

interface TimelineResponse {
  success: boolean;
  data: TimelineEvent[];
  pagination: { total: number; limit: number; offset: number };
  error?: string;
}

const PAGE_SIZE = 50;

const KIND_META: Record<
  TimelineKind,
  { icon: IconName; label: string; color: string }
> = {
  SALE: { icon: "sales", label: "Venta", color: "var(--p)" },
  LAYAWAY: { icon: "layaway", label: "Apartado", color: "var(--warn)" },
  PAYMENT: { icon: "cash", label: "Pago", color: "var(--sec)" },
  SERVICE_ORDER: { icon: "wrench", label: "Taller", color: "var(--data-3)" },
  QUOTATION: { icon: "invoice", label: "Cotización", color: "var(--data-4)" },
  BALANCE_TOPUP: { icon: "cash", label: "Recarga", color: "var(--sec)" },
  NOTE: { icon: "bookmark", label: "Nota", color: "var(--on-surf-var)" },
};

const FILTER_CHIPS: Array<{ key: TimelineKind | "ALL"; label: string }> = [
  { key: "ALL", label: "Todos" },
  { key: "SALE", label: "Ventas" },
  { key: "LAYAWAY", label: "Apartados" },
  { key: "PAYMENT", label: "Pagos" },
  { key: "SERVICE_ORDER", label: "Taller" },
  { key: "QUOTATION", label: "Cotizaciones" },
  { key: "BALANCE_TOPUP", label: "Recargas" },
  { key: "NOTE", label: "Notas" },
];

interface Props {
  customerId: string;
  /** Bumped por el padre tras crear una nota nueva, para refrescar. */
  refreshKey?: number;
}

export function TimelineFeed({ customerId, refreshKey = 0 }: Props): React.JSX.Element {
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [active, setActive] = useState<TimelineKind | "ALL">("ALL");
  const [error, setError] = useState<string | null>(null);

  const sourcesParam = useMemo(() => {
    if (active === "ALL") return "";
    return `&sources=${active}`;
  }, [active]);

  const fetchPage = useCallback(
    async (nextOffset: number, replace: boolean): Promise<void> => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/customers/${customerId}/timeline?limit=${PAGE_SIZE}&offset=${nextOffset}${sourcesParam}`,
        );
        const json = (await res.json()) as TimelineResponse;
        if (!json.success) {
          setError(json.error ?? "No se pudo cargar el timeline");
          return;
        }
        setTotal(json.pagination.total);
        setOffset(nextOffset + json.data.length);
        setEvents((prev) => (replace ? json.data : [...prev, ...json.data]));
      } catch {
        setError("Error de red");
      } finally {
        setLoading(false);
      }
    },
    [customerId, sourcesParam],
  );

  useEffect(() => {
    void fetchPage(0, true);
  }, [fetchPage, refreshKey]);

  const hasMore = events.length < total;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {FILTER_CHIPS.map((c) => {
            const isActive = active === c.key;
            return (
              <button
                key={c.key}
                onClick={() => setActive(c.key)}
                className="rounded-[var(--r-full)] px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
                style={{
                  background: isActive ? "var(--p-container)" : "var(--surf-high)",
                  color: isActive ? "var(--on-p-container)" : "var(--on-surf-var)",
                  fontWeight: isActive ? 600 : 500,
                }}
              >
                {c.label}
              </button>
            );
          })}
        </div>
        <span className="text-[0.6875rem]" style={{ color: "var(--on-surf-var)" }}>
          {total} evento{total === 1 ? "" : "s"}
        </span>
      </div>

      {error && (
        <div
          className="rounded-[var(--r-md)] p-3 text-xs"
          style={{
            background: "var(--ter-container)",
            color: "var(--on-ter-container)",
          }}
        >
          {error}
        </div>
      )}

      <ol className="flex flex-col gap-1.5">
        {events.length === 0 && !loading && (
          <li
            className="text-center text-xs py-8"
            style={{ color: "var(--on-surf-var)" }}
          >
            Sin actividad registrada para este filtro.
          </li>
        )}
        {events.map((ev) => (
          <TimelineRow key={ev.id} event={ev} />
        ))}
      </ol>

      <div className="flex justify-center pt-1">
        {loading && (
          <span
            className="text-[0.6875rem]"
            style={{ color: "var(--on-surf-var)" }}
          >
            Cargando…
          </span>
        )}
        {!loading && hasMore && (
          <button
            onClick={() => void fetchPage(offset, false)}
            className="rounded-[var(--r-full)] px-4 py-1.5 text-xs font-medium"
            style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
          >
            Cargar más ({total - events.length})
          </button>
        )}
      </div>
    </div>
  );
}

function TimelineRow({ event }: { event: TimelineEvent }): React.JSX.Element {
  const meta = KIND_META[event.kind];
  const at = new Date(event.at);
  const detail = describeEvent(event);
  const href = hrefForEvent(event);

  const body = (
    <div
      className="flex items-start gap-3 rounded-[var(--r-md)] px-3 py-2.5 transition-colors"
      style={{ background: "var(--surf-lowest)" }}
    >
      <span
        className="h-7 w-7 rounded-full flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: "color-mix(in srgb, var(--p) 10%, transparent)",
          color: meta.color,
        }}
      >
        <Icon name={meta.icon} size={14} />
      </span>
      <div className="flex-1 min-w-0">
        <div className="flex items-baseline justify-between gap-2 flex-wrap">
          <p
            className="text-sm font-semibold truncate"
            style={{ color: "var(--on-surf)" }}
          >
            {event.title}
          </p>
          <span
            className="text-[0.6875rem] tabular-nums shrink-0"
            style={{ color: "var(--on-surf-var)" }}
            title={formatDate(at, "medium")}
          >
            {formatRelative(at)}
          </span>
        </div>
        {detail && (
          <p
            className="text-xs mt-0.5 line-clamp-2"
            style={{ color: "var(--on-surf-var)" }}
          >
            {detail}
          </p>
        )}
      </div>
    </div>
  );

  if (href) {
    return (
      <li>
        <Link href={href} className="block">
          {body}
        </Link>
      </li>
    );
  }
  return <li>{body}</li>;
}

function describeEvent(ev: TimelineEvent): string {
  const m = ev.meta;
  switch (ev.kind) {
    case "SALE":
    case "LAYAWAY": {
      const total = typeof m.total === "number" ? formatMXN(m.total) : "";
      const status = typeof m.status === "string" ? m.status : "";
      return [total, status].filter(Boolean).join(" · ");
    }
    case "PAYMENT":
    case "BALANCE_TOPUP": {
      const amount = typeof m.amount === "number" ? formatMXN(m.amount) : "";
      const method = typeof m.method === "string" ? m.method : "";
      const ref = typeof m.reference === "string" ? m.reference : "";
      return [amount, method, ref].filter(Boolean).join(" · ");
    }
    case "SERVICE_ORDER": {
      const total = typeof m.total === "number" ? formatMXN(m.total) : "";
      const status = typeof m.status === "string" ? m.status : "";
      return [total, status].filter(Boolean).join(" · ");
    }
    case "QUOTATION": {
      const total = typeof m.total === "number" ? formatMXN(m.total) : "";
      const status = typeof m.status === "string" ? m.status : "";
      return [total, status].filter(Boolean).join(" · ");
    }
    case "NOTE": {
      const body = typeof m.body === "string" ? m.body : "";
      const author = typeof m.author === "object" && m.author !== null ? (m.author as { name?: string }).name ?? "" : "";
      return [author, body].filter(Boolean).join(" — ");
    }
    default:
      return "";
  }
}

function hrefForEvent(ev: TimelineEvent): string | null {
  const m = ev.meta;
  switch (ev.kind) {
    case "SALE":
    case "LAYAWAY":
      return typeof m.saleId === "string" ? `/sales/${m.saleId}` : null;
    case "PAYMENT":
      return typeof m.saleId === "string" ? `/sales/${m.saleId}` : null;
    case "SERVICE_ORDER":
      return typeof m.serviceOrderId === "string" ? `/workshop/${m.serviceOrderId}` : null;
    case "QUOTATION":
      return typeof m.quotationId === "string" ? `/cotizaciones/${m.quotationId}` : null;
    default:
      return null;
  }
}

