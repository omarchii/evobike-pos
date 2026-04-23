"use client";

// Tab Cotizaciones del perfil (BRIEF §7.4 / §11 — Sub-fase G).
// Power Grid cross-sucursal: Fecha · Folio · Vigencia · Total · Estado
// (efectivo) · Sucursal · Acciones. Row expand muestra ítems + nota
// interna (si aplica).

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { formatDate, formatMXN } from "@/lib/format";
import type { QuotationRow } from "@/lib/customers/profile-tabs-data";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Borrador",
  EN_ESPERA_CLIENTE: "Esperando cliente",
  EN_ESPERA_FABRICA: "Esperando fábrica",
  PAGADA: "Pagada",
  FINALIZADA: "Finalizada",
  RECHAZADA: "Rechazada",
  CONVERTIDA: "Convertida a venta",
  CANCELADA: "Cancelada",
  EXPIRADA: "Expirada",
};

export function TabCotizaciones({
  quotations,
}: {
  quotations: QuotationRow[];
}): React.JSX.Element {
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (statusFilter === "ALL") return quotations;
    return quotations.filter((q) => q.effectiveStatus === statusFilter);
  }, [quotations, statusFilter]);

  if (quotations.length === 0) {
    return (
      <EmptyState message="Este cliente no tiene cotizaciones registradas." />
    );
  }

  return (
    <section
      className="rounded-[var(--r-lg)] overflow-hidden"
      style={{ background: "var(--surf-lowest)" }}
    >
      <div className="px-5 py-3 flex flex-wrap items-center gap-3">
        <FilterChips
          label="Estado"
          active={statusFilter}
          onChange={setStatusFilter}
          options={[
            { key: "ALL", label: "Todos" },
            { key: "DRAFT", label: "Borrador" },
            { key: "EN_ESPERA_CLIENTE", label: "Esperando cliente" },
            { key: "EN_ESPERA_FABRICA", label: "Esperando fábrica" },
            { key: "CONVERTIDA", label: "Convertidas" },
            { key: "EXPIRADA", label: "Expiradas" },
          ]}
        />
        <span
          className="ml-auto text-[0.6875rem]"
          style={{ color: "var(--on-surf-var)" }}
        >
          {filtered.length} de {quotations.length}
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
              <th className="px-2 py-2 font-medium">Vigencia</th>
              <th className="px-2 py-2 font-medium text-right">Total</th>
              <th className="px-2 py-2 font-medium text-right">Descuento</th>
              <th className="px-2 py-2 font-medium">Estado</th>
              <th className="px-2 py-2 font-medium">Vendedor</th>
              <th className="px-5 py-2 font-medium">Sucursal</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((q) => {
              const isOpen = expandedId === q.id;
              return (
                <Row key={q.id}>
                  <tr
                    className="cursor-pointer transition-colors"
                    style={{
                      background: isOpen ? "var(--surf-high)" : "transparent",
                    }}
                    onClick={() => setExpandedId(isOpen ? null : q.id)}
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
                      {formatDate(q.createdAt, "short")}
                    </td>
                    <td
                      className="px-2 py-2.5 font-mono"
                      style={{ color: "var(--on-surf)" }}
                    >
                      <Link
                        href={`/cotizaciones/${q.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:underline"
                      >
                        {q.folio}
                      </Link>
                    </td>
                    <td
                      className="px-2 py-2.5 tabular-nums whitespace-nowrap"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {formatDate(q.validUntil, "short")}
                    </td>
                    <td
                      className="px-2 py-2.5 text-right tabular-nums font-semibold"
                      style={{ color: "var(--on-surf)" }}
                    >
                      {formatMXN(q.total)}
                    </td>
                    <td
                      className="px-2 py-2.5 text-right tabular-nums"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {q.discount > 0 ? formatMXN(q.discount) : "—"}
                    </td>
                    <td className="px-2 py-2.5">
                      <Chip
                        variant={statusVariant(q.effectiveStatus)}
                        label={
                          STATUS_LABEL[q.effectiveStatus] ?? q.effectiveStatus
                        }
                      />
                    </td>
                    <td
                      className="px-2 py-2.5 truncate max-w-[160px]"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {q.userName ?? "—"}
                    </td>
                    <td
                      className="px-5 py-2.5 truncate max-w-[140px]"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {q.branchName}
                    </td>
                  </tr>
                  {isOpen && (
                    <tr>
                      <td colSpan={9} className="px-5 py-3">
                        <ExpandedQuotation q={q} />
                      </td>
                    </tr>
                  )}
                </Row>
              );
            })}
            {filtered.length === 0 && (
              <tr>
                <td
                  colSpan={9}
                  className="px-5 py-8 text-center"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  Sin cotizaciones con los filtros aplicados.
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
    case "CONVERTIDA":
    case "PAGADA":
    case "FINALIZADA":
      return "success";
    case "EXPIRADA":
    case "CANCELADA":
    case "RECHAZADA":
      return "error";
    case "EN_ESPERA_CLIENTE":
    case "EN_ESPERA_FABRICA":
      return "warn";
    case "DRAFT":
      return "info";
    default:
      return "neutral";
  }
}

function Row({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <>{children}</>;
}

function ExpandedQuotation({
  q,
}: {
  q: QuotationRow;
}): React.JSX.Element {
  return (
    <div
      className="rounded-[var(--r-md)] p-4 flex flex-col gap-3"
      style={{ background: "var(--surf-low)" }}
    >
      <div>
        <p
          className="text-[0.625rem] uppercase tracking-[0.05em] font-medium mb-1.5"
          style={{ color: "var(--on-surf-var)" }}
        >
          Ítems ({q.items.length})
        </p>
        <ul className="flex flex-col gap-1">
          {q.items.map((i) => (
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
                {formatMXN(i.lineTotal)}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {q.internalNote && (
        <div className="flex flex-col gap-0.5">
          <span
            className="text-[0.625rem] uppercase tracking-[0.05em] font-medium"
            style={{ color: "var(--on-surf-var)" }}
          >
            Nota interna
          </span>
          <p className="text-xs" style={{ color: "var(--on-surf)" }}>
            {q.internalNote}
          </p>
        </div>
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Link
          href={`/cotizaciones/${q.id}`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
          style={{
            borderRadius: "var(--r-full)",
            background: "var(--surf-bright)",
            color: "var(--on-surf)",
            fontFamily: "var(--font-display)",
          }}
        >
          <Icon name="arrowRight" size={13} /> Ver cotización
        </Link>
        {q.convertedToSaleId && (
          <Link
            href={`/sales/${q.convertedToSaleId}`}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
            style={{
              borderRadius: "var(--r-full)",
              background: "var(--sec-container)",
              color: "var(--on-sec-container)",
              fontFamily: "var(--font-display)",
            }}
          >
            <Icon name="sales" size={13} /> Venta asociada
          </Link>
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
