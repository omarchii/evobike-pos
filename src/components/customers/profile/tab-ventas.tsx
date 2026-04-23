"use client";

// Tab Ventas del perfil (BRIEF §7.4 / §11 — Sub-fase G).
// Power Grid cross-sucursal: Fecha · Folio · Tipo · Total · Descuento ·
// Método · Vendedor · Sucursal · Estado. Row expand muestra ítems,
// internalNote (MANAGER) y `warrantyDocReady`.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { formatDate, formatMXN } from "@/lib/format";
import type { SaleRow } from "@/lib/customers/profile-tabs-data";

type TypeFilter = "ALL" | "CONTADO" | "APARTADO";
type StatusFilter = "ALL" | "COMPLETED" | "LAYAWAY" | "CANCELLED";

const STATUS_LABEL: Record<string, string> = {
  COMPLETED: "Completada",
  LAYAWAY: "Apartado",
  CANCELLED: "Cancelada",
};

const METHOD_LABEL: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  CREDIT_BALANCE: "Saldo a favor",
  ATRATO: "Atrato",
};

export function TabVentas({
  sales,
}: {
  sales: SaleRow[];
}): React.JSX.Element {
  const [typeFilter, setTypeFilter] = useState<TypeFilter>("ALL");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    return sales.filter((s) => {
      if (typeFilter !== "ALL" && s.saleType !== typeFilter) return false;
      if (statusFilter !== "ALL" && s.status !== statusFilter) return false;
      return true;
    });
  }, [sales, typeFilter, statusFilter]);

  if (sales.length === 0) {
    return <EmptyState message="Este cliente no tiene ventas registradas." />;
  }

  return (
    <section
      className="rounded-[var(--r-lg)] overflow-hidden"
      style={{ background: "var(--surf-lowest)" }}
    >
      <div className="px-5 py-3 flex flex-wrap items-center gap-3">
        <FilterChips<TypeFilter>
          label="Tipo"
          active={typeFilter}
          onChange={setTypeFilter}
          options={[
            { key: "ALL", label: "Todos" },
            { key: "CONTADO", label: "Contado" },
            { key: "APARTADO", label: "Apartado" },
          ]}
        />
        <span
          className="h-4 w-px"
          style={{ background: "var(--ghost-border)" }}
        />
        <FilterChips<StatusFilter>
          label="Estado"
          active={statusFilter}
          onChange={setStatusFilter}
          options={[
            { key: "ALL", label: "Todos" },
            { key: "COMPLETED", label: "Completadas" },
            { key: "LAYAWAY", label: "Apartadas" },
            { key: "CANCELLED", label: "Canceladas" },
          ]}
        />
        <span
          className="ml-auto text-[0.6875rem]"
          style={{ color: "var(--on-surf-var)" }}
        >
          {filtered.length} de {sales.length}
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
              <th className="px-2 py-2 font-medium">Tipo</th>
              <th className="px-2 py-2 font-medium text-right">Total</th>
              <th className="px-2 py-2 font-medium text-right">Descuento</th>
              <th className="px-2 py-2 font-medium">Método</th>
              <th className="px-2 py-2 font-medium">Vendedor</th>
              <th className="px-2 py-2 font-medium">Sucursal</th>
              <th className="px-5 py-2 font-medium">Estado</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => {
              const isOpen = expandedId === s.id;
              const pctPaid = s.total > 0 ? s.paidSum / s.total : 0;
              return (
                <Row key={s.id}>
                  <tr
                    className="cursor-pointer transition-colors"
                    style={{
                      background: isOpen
                        ? "var(--surf-high)"
                        : "transparent",
                    }}
                    onClick={() => setExpandedId(isOpen ? null : s.id)}
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
                      {formatDate(s.createdAt, "short")}
                    </td>
                    <td
                      className="px-2 py-2.5 font-mono"
                      style={{ color: "var(--on-surf)" }}
                    >
                      <Link
                        href={`/sales/${s.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {s.folio}
                      </Link>
                    </td>
                    <td className="px-2 py-2.5">
                      <Chip
                        variant={
                          s.saleType === "APARTADO" ? "warn" : "neutral"
                        }
                        label={s.saleType}
                      />
                    </td>
                    <td
                      className="px-2 py-2.5 text-right tabular-nums font-semibold"
                      style={{ color: "var(--on-surf)" }}
                    >
                      {formatMXN(s.total)}
                    </td>
                    <td
                      className="px-2 py-2.5 text-right tabular-nums"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {s.discount > 0 ? formatMXN(s.discount) : "—"}
                    </td>
                    <td
                      className="px-2 py-2.5"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {s.methodsUsed
                        .map((m) => METHOD_LABEL[m] ?? m)
                        .join(", ") || "—"}
                    </td>
                    <td
                      className="px-2 py-2.5 truncate max-w-[160px]"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {s.userName ?? "—"}
                    </td>
                    <td
                      className="px-2 py-2.5 truncate max-w-[140px]"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {s.branchName}
                    </td>
                    <td className="px-5 py-2.5">
                      {s.status === "LAYAWAY" ? (
                        <Chip
                          variant="warn"
                          label={`${Math.round(pctPaid * 100)}% pagado`}
                        />
                      ) : (
                        <Chip
                          variant={
                            s.status === "CANCELLED" ? "error" : "success"
                          }
                          label={STATUS_LABEL[s.status] ?? s.status}
                        />
                      )}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={10} className="px-5 py-3">
                        <ExpandedSale sale={s} pctPaid={pctPaid} />
                      </td>
                    </tr>
                  )}
                </Row>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={10}
                  className="px-5 py-8 text-center"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  Sin ventas con los filtros aplicados.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function Row({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}

function ExpandedSale({
  sale,
  pctPaid,
}: {
  sale: SaleRow;
  pctPaid: number;
}): React.JSX.Element {
  return (
    <div
      className="rounded-[var(--r-md)] p-4 flex flex-col gap-3"
      style={{ background: "var(--surf-low)" }}
    >
      <div className="flex flex-wrap items-center gap-2">
        {sale.warrantyDocReady ? (
          <Chip variant="success" label="Póliza lista" />
        ) : (
          <Chip variant="warn" label="Póliza pendiente" />
        )}
        {sale.status === "LAYAWAY" && (
          <>
            <span
              className="text-[0.6875rem]"
              style={{ color: "var(--on-surf-var)" }}
            >
              Pagado {formatMXN(sale.paidSum)} / {formatMXN(sale.total)} (
              {Math.round(pctPaid * 100)}%)
            </span>
            {sale.outstanding > 0 && (
              <Chip
                variant="warn"
                label={`Por cobrar ${formatMXN(sale.outstanding)}`}
              />
            )}
          </>
        )}
        {sale.expectedDeliveryDate && (
          <span
            className="text-[0.6875rem]"
            style={{ color: "var(--on-surf-var)" }}
          >
            Entrega estimada · {formatDate(sale.expectedDeliveryDate, "medium")}
          </span>
        )}
      </div>

      <div className="grid grid-cols-[1fr_1fr] max-[800px]:grid-cols-1 gap-5">
        <div>
          <p
            className="text-[0.625rem] uppercase tracking-[0.05em] font-medium mb-1.5"
            style={{ color: "var(--on-surf-var)" }}
          >
            Ítems ({sale.items.length})
          </p>
          <ul className="flex flex-col gap-1">
            {sale.items.map((i) => (
              <li
                key={i.id}
                className="flex items-baseline justify-between gap-2 text-xs"
              >
                <span
                  className="truncate"
                  style={{ color: "var(--on-surf)" }}
                  title={i.description}
                >
                  {i.quantity}× {i.description}
                </span>
                <span
                  className="tabular-nums shrink-0"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  {formatMXN(i.price * i.quantity - i.discount)}
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-2">
          {sale.notes && (
            <ExpandedNote label="Notas del ticket" value={sale.notes} />
          )}
          {sale.internalNote && (
            <ExpandedNote
              label="Nota interna (MANAGER)"
              value={sale.internalNote}
            />
          )}
          <div className="flex items-center gap-2 mt-1">
            <Link
              href={`/sales/${sale.id}`}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
              style={{
                borderRadius: "var(--r-full)",
                background: "var(--surf-bright)",
                color: "var(--on-surf)",
                fontFamily: "var(--font-display)",
              }}
            >
              <Icon name="arrowRight" size={13} /> Ver venta
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExpandedNote({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5">
      <span
        className="text-[0.625rem] uppercase tracking-[0.05em] font-medium"
        style={{ color: "var(--on-surf-var)" }}
      >
        {label}
      </span>
      <p className="text-xs" style={{ color: "var(--on-surf)" }}>
        {value}
      </p>
    </div>
  );
}

function FilterChips<T extends string>({
  label,
  active,
  onChange,
  options,
}: {
  label: string;
  active: T;
  onChange: (v: T) => void;
  options: Array<{ key: T; label: string }>;
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
