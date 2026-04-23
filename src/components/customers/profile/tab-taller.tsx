"use client";

// Tab Taller del perfil (BRIEF §7.4 / §11 — Sub-fase G).
// Power Grid cross-sucursal: Fecha · Folio · Bici (VIN) · Tipo · Estado
// · Sub-estado · Fecha prometida · Total · Prepago · Sucursal.
// Row expand muestra diagnóstico + ítems (incluye `isExtra`).

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { formatDate, formatMXN } from "@/lib/format";
import type { ServiceOrderRow } from "@/lib/customers/profile-tabs-data";

const TYPE_LABEL: Record<string, string> = {
  PAID: "Pagada",
  WARRANTY: "Garantía",
  COURTESY: "Cortesía",
  POLICY_MAINTENANCE: "Mant. póliza",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completada",
  DELIVERED: "Entregada",
  CANCELLED: "Cancelada",
};

const SUB_STATUS_LABEL: Record<string, string> = {
  WAITING_PARTS: "Esperando refacciones",
  WAITING_APPROVAL: "Esperando aprobación",
  PAUSED: "Pausada",
};

export function TabTaller({
  orders,
}: {
  orders: ServiceOrderRow[];
}): React.JSX.Element {
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (typeFilter !== "ALL" && o.type !== typeFilter) return false;
      if (statusFilter !== "ALL" && o.status !== statusFilter) return false;
      return true;
    });
  }, [orders, typeFilter, statusFilter]);

  if (orders.length === 0) {
    return (
      <EmptyState message="Este cliente no tiene órdenes de taller registradas." />
    );
  }

  return (
    <section
      className="rounded-[var(--r-lg)] overflow-hidden"
      style={{ background: "var(--surf-lowest)" }}
    >
      <div className="px-5 py-3 flex flex-wrap items-center gap-3">
        <FilterChips
          label="Tipo"
          active={typeFilter}
          onChange={setTypeFilter}
          options={[
            { key: "ALL", label: "Todos" },
            { key: "PAID", label: "Pagada" },
            { key: "WARRANTY", label: "Garantía" },
            { key: "COURTESY", label: "Cortesía" },
            { key: "POLICY_MAINTENANCE", label: "Mant. póliza" },
          ]}
        />
        <span
          className="h-4 w-px"
          style={{ background: "var(--ghost-border)" }}
        />
        <FilterChips
          label="Estado"
          active={statusFilter}
          onChange={setStatusFilter}
          options={[
            { key: "ALL", label: "Todos" },
            { key: "PENDING", label: "Pendiente" },
            { key: "IN_PROGRESS", label: "En proceso" },
            { key: "DELIVERED", label: "Entregada" },
            { key: "CANCELLED", label: "Cancelada" },
          ]}
        />
        <span
          className="ml-auto text-[0.6875rem]"
          style={{ color: "var(--on-surf-var)" }}
        >
          {filtered.length} de {orders.length}
        </span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr
              className="text-left text-[0.625rem] uppercase tracking-[0.05em]"
              style={{ color: "var(--on-surf-var)" }}
            >
              <th className="px-5 py-2 font-medium w-8" />
              <th className="px-2 py-2 font-medium">Fecha</th>
              <th className="px-2 py-2 font-medium">Folio</th>
              <th className="px-2 py-2 font-medium">Bici</th>
              <th className="px-2 py-2 font-medium">Tipo</th>
              <th className="px-2 py-2 font-medium">Estado</th>
              <th className="px-2 py-2 font-medium">Sub-estado</th>
              <th className="px-2 py-2 font-medium">Entrega</th>
              <th className="px-2 py-2 font-medium text-right">Total</th>
              <th className="px-2 py-2 font-medium">Prepago</th>
              <th className="px-5 py-2 font-medium">Sucursal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((o) => {
              const isOpen = expandedId === o.id;
              const bikeName =
                [o.bike?.brand, o.bike?.model].filter(Boolean).join(" ") ||
                "Bici";
              const bikeLabel = o.bike
                ? `${bikeName} · ${o.bike.serial}`
                : (o.bikeInfo ?? "Sin VIN");
              return (
                <Row key={o.id}>
                  <tr
                    className="cursor-pointer transition-colors"
                    style={{
                      background: isOpen ? "var(--surf-high)" : "transparent",
                    }}
                    onClick={() => setExpandedId(isOpen ? null : o.id)}
                  >
                    <td className="px-5 py-2.5">
                      <span style={{ color: "var(--on-surf-var)" }}>
                        <Icon
                          name={isOpen ? "chevronDown" : "chevronRight"}
                          size={12}
                        />
                      </span>
                    </td>
                    <td
                      className="px-2 py-2.5 tabular-nums whitespace-nowrap"
                      style={{ color: "var(--on-surf)" }}
                    >
                      {formatDate(o.createdAt, "short")}
                    </td>
                    <td
                      className="px-2 py-2.5 font-mono"
                      style={{ color: "var(--on-surf)" }}
                    >
                      <Link
                        href={`/workshop/${o.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {o.folio}
                      </Link>
                    </td>
                    <td
                      className="px-2 py-2.5 truncate max-w-[200px]"
                      style={{ color: "var(--on-surf-var)" }}
                      title={bikeLabel}
                    >
                      {bikeLabel}
                    </td>
                    <td className="px-2 py-2.5">
                      <Chip
                        variant={o.type === "WARRANTY" ? "info" : "neutral"}
                        label={TYPE_LABEL[o.type] ?? o.type}
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      <Chip
                        variant={statusVariant(o.status)}
                        label={STATUS_LABEL[o.status] ?? o.status}
                      />
                    </td>
                    <td className="px-2 py-2.5">
                      {o.subStatus ? (
                        <Chip
                          variant="warn"
                          label={SUB_STATUS_LABEL[o.subStatus] ?? o.subStatus}
                        />
                      ) : (
                        <span style={{ color: "var(--on-surf-var)" }}>—</span>
                      )}
                    </td>
                    <td
                      className="px-2 py-2.5 tabular-nums whitespace-nowrap"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {o.expectedDeliveryDate
                        ? formatDate(
                            new Date(`${o.expectedDeliveryDate}T12:00:00`),
                            "short",
                          )
                        : "—"}
                    </td>
                    <td
                      className="px-2 py-2.5 text-right tabular-nums font-semibold"
                      style={{ color: "var(--on-surf)" }}
                    >
                      {formatMXN(o.total)}
                    </td>
                    <td className="px-2 py-2.5">
                      {o.prepaid ? (
                        <Chip
                          variant="success"
                          label={
                            o.prepaidAmount != null
                              ? `Prepagada ${formatMXN(o.prepaidAmount)}`
                              : "Prepagada"
                          }
                        />
                      ) : (
                        <span style={{ color: "var(--on-surf-var)" }}>—</span>
                      )}
                    </td>
                    <td
                      className="px-5 py-2.5 truncate max-w-[140px]"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {o.branchName}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={11} className="px-5 py-3">
                        <ExpandedOrder order={o} />
                      </td>
                    </tr>
                  )}
                </Row>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="px-5 py-8 text-center"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  Sin órdenes con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function statusVariant(
  status: string,
): "success" | "warn" | "neutral" | "error" | "info" {
  switch (status) {
    case "DELIVERED":
      return "success";
    case "CANCELLED":
      return "error";
    case "IN_PROGRESS":
      return "info";
    case "PENDING":
      return "warn";
    default:
      return "neutral";
  }
}

function Row({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}

function ExpandedOrder({
  order,
}: {
  order: ServiceOrderRow;
}): React.JSX.Element {
  return (
    <div
      className="rounded-[var(--r-md)] p-4 flex flex-col gap-3"
      style={{ background: "var(--surf-low)" }}
    >
      {order.diagnosis && (
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[0.625rem] uppercase tracking-[0.05em] font-medium"
            style={{ color: "var(--on-surf-var)" }}
          >
            Diagnóstico
          </span>
          <p className="text-xs" style={{ color: "var(--on-surf)" }}>
            {order.diagnosis}
          </p>
        </div>
      )}

      <div>
        <p
          className="text-[0.625rem] uppercase tracking-[0.05em] font-medium mb-1.5"
          style={{ color: "var(--on-surf-var)" }}
        >
          Ítems ({order.items.length})
        </p>
        <ul className="flex flex-col gap-1">
          {order.items.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between gap-2 text-xs"
            >
              <span
                className="truncate flex items-center gap-1.5"
                style={{ color: "var(--on-surf)" }}
                title={i.description}
              >
                {i.quantity}× {i.description}
                {i.isExtra && <Chip variant="info" label="Extra" />}
                {i.isMaintenance && <Chip variant="neutral" label="Mant." />}
              </span>
              <span
                className="tabular-nums shrink-0"
                style={{ color: "var(--on-surf-var)" }}
              >
                {formatMXN(i.price * i.quantity)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/workshop/${order.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
          style={{
            borderRadius: "var(--r-full)",
            background: "var(--surf-bright)",
            color: "var(--on-surf)",
            fontFamily: "var(--font-display)",
          }}
        >
          <Icon name="arrowRight" size={13} /> Ver orden
        </Link>
        {order.userName && (
          <span
            className="text-[0.6875rem]"
            style={{ color: "var(--on-surf-var)" }}
          >
            Recibida por {order.userName}
          </span>
        )}
      </div>
    </div>
  );
}

function FilterChips({
  label,
  active,
  onChange,
  options,
}: {
  label: string;
  active: string;
  onChange: (v: string) => void;
  options: Array<{ key: string; label: string }>;
}): React.JSX.Element {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span
        className="text-[0.625rem] uppercase tracking-[0.05em] font-medium mr-0.5"
        style={{ color: "var(--on-surf-var)" }}
      >
        {label}
      </span>
      {options.map((o) => {
        const isActive = o.key === active;
        return (
          <button
            key={o.key}
            type="button"
            onClick={() => onChange(o.key)}
            className="rounded-[var(--r-full)] px-2.5 py-1 text-[0.6875rem] font-medium transition-colors"
            style={{
              background: isActive
                ? "var(--p-container)"
                : "var(--surf-high)",
              color: isActive ? "var(--on-p-container)" : "var(--on-surf-var)",
              fontWeight: isActive ? 600 : 500,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

function EmptyState({ message }: { message: string }): React.JSX.Element {
  return (
    <section
      className="rounded-[var(--r-lg)] p-10 flex flex-col items-center gap-2 text-center"
      style={{ background: "var(--surf-lowest)" }}
    >
      <p
        className="text-sm font-medium"
        style={{ color: "var(--on-surf-var)" }}
      >
        {message}
      </p>
    </section>
  );
}
