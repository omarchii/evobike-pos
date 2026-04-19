"use client";

import * as React from "react";
import { Icon } from "@/components/primitives/icon";
import { formatMXN, formatDate } from "@/lib/format";
import type { SalesTableRow } from "./queries";

type SortKey = "folio" | "fecha" | "total";
type SortDir = "asc" | "desc";

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completada",
  LAYAWAY: "Apartado",
  CANCELLED: "Cancelada",
};

type SortIconProps = { col: SortKey; sortKey: SortKey; sortDir: SortDir };

function SortIcon({ col, sortKey, sortDir }: SortIconProps) {
  if (sortKey !== col) return <Icon name="minus" size={10} />;
  return <Icon name={sortDir === "asc" ? "arrowUp" : "arrowDown"} size={10} />;
}

type SalesTableProps = {
  rows: SalesTableRow[];
  onRowClick: (id: string) => void;
};

export function SalesTable({ rows, onRowClick }: SalesTableProps) {
  const [sortKey, setSortKey] = React.useState<SortKey>("fecha");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  const sorted = [...rows].sort((a, b) => {
    let cmp = 0;
    if (sortKey === "folio") {
      cmp = a.folio.localeCompare(b.folio);
    } else if (sortKey === "fecha") {
      cmp = a.fecha.localeCompare(b.fecha);
    } else if (sortKey === "total") {
      cmp = a.total - b.total;
    }
    return sortDir === "asc" ? cmp : -cmp;
  });

  return (
    <div
      className="overflow-hidden rounded-[var(--r-lg)]"
      style={{ background: "var(--surf-lowest)" }}
    >
      <div
        className="flex items-center justify-between px-5 py-4"
        style={{ borderBottom: "1px solid var(--ghost-border)" }}
      >
        <div>
          <h3
            className="text-[0.9375rem] font-semibold tracking-[-0.01em]"
            style={{ color: "var(--on-surf)" }}
          >
            Registros del período
          </h3>
          <p className="mt-0.5 text-xs" style={{ color: "var(--on-surf-var)" }}>
            {rows.length} ventas · click para ver detalle
          </p>
        </div>
      </div>

      <div style={{ maxHeight: 480, overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr
              style={{
                position: "sticky",
                top: 0,
                background: "var(--surf-lowest)",
                zIndex: 1,
                borderBottom: "1px solid var(--ghost-border)",
              }}
            >
              {(
                [
                  { key: "folio" as SortKey, label: "Folio" },
                  { key: "fecha" as SortKey, label: "Fecha" },
                ] as const
              ).map(({ key, label }) => (
                <th
                  key={key}
                  onClick={() => handleSort(key)}
                  className="cursor-pointer select-none px-4 py-3 text-left"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--on-surf-var)",
                  }}
                >
                  <span className="inline-flex items-center gap-1">
                    {label}
                    <SortIcon col={key} sortKey={sortKey} sortDir={sortDir} />
                  </span>
                </th>
              ))}
              {["Cliente", "Vendedor", "Método", "Items"].map((h) => (
                <th
                  key={h}
                  className="px-4 py-3 text-left"
                  style={{
                    fontSize: "0.6875rem",
                    fontWeight: 500,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    color: "var(--on-surf-var)",
                  }}
                >
                  {h}
                </th>
              ))}
              <th
                className="cursor-pointer select-none px-4 py-3 text-right"
                onClick={() => handleSort("total")}
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--on-surf-var)",
                }}
              >
                <span className="inline-flex items-center justify-end gap-1">
                  Total <SortIcon col="total" sortKey={sortKey} sortDir={sortDir} />
                </span>
              </th>
              <th
                className="px-4 py-3 text-left"
                style={{
                  fontSize: "0.6875rem",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--on-surf-var)",
                }}
              >
                Estado
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((row) => (
              <tr
                key={row.id}
                onClick={() => onRowClick(row.id)}
                className="cursor-pointer transition-colors"
                style={{ borderTop: "1px solid var(--ghost-border)", height: "var(--density-row)" }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "var(--surf-high)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                <td
                  className="px-4 text-xs font-semibold tabular-nums"
                  style={{ color: "var(--p)", paddingBlock: "var(--density-cell-y)" }}
                >
                  {row.folio}
                </td>
                <td className="px-4 text-xs" style={{ color: "var(--on-surf-var)", paddingBlock: "var(--density-cell-y)" }}>
                  {formatDate(new Date(row.fecha), "short")}
                </td>
                <td className="px-4 text-xs font-medium" style={{ color: "var(--on-surf)", paddingBlock: "var(--density-cell-y)" }}>
                  {row.clienteNombre}
                </td>
                <td className="px-4 text-xs" style={{ color: "var(--on-surf-var)", paddingBlock: "var(--density-cell-y)" }}>
                  {row.vendedorNombre}
                </td>
                <td className="px-4 text-xs" style={{ color: "var(--on-surf-var)", paddingBlock: "var(--density-cell-y)" }}>
                  {row.metodoPago}
                </td>
                <td
                  className="px-4 text-xs tabular-nums"
                  style={{ color: "var(--on-surf-var)", paddingBlock: "var(--density-cell-y)" }}
                >
                  {row.items}
                </td>
                <td
                  className="px-4 text-right text-xs font-semibold tabular-nums"
                  style={{ color: "var(--on-surf)", paddingBlock: "var(--density-cell-y)" }}
                >
                  {formatMXN(row.total)}
                </td>
                <td className="px-4" style={{ paddingBlock: "var(--density-cell-y)" }}>
                  <span
                    className="rounded-[var(--r-full)] px-2 py-0.5 text-[0.625rem] font-medium"
                    style={{
                      background:
                        row.status === "COMPLETED"
                          ? "var(--sec-container)"
                          : row.status === "LAYAWAY"
                            ? "var(--warn-container)"
                            : "var(--ter-container)",
                      color:
                        row.status === "COMPLETED"
                          ? "var(--on-sec-container)"
                          : row.status === "LAYAWAY"
                            ? "var(--warn)"
                            : "var(--on-ter-container)",
                    }}
                  >
                    {STATUS_LABELS[row.status] ?? row.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {sorted.length === 0 && (
          <div
            className="py-12 text-center text-sm"
            style={{ color: "var(--on-surf-var)" }}
          >
            Sin ventas para los filtros seleccionados
          </div>
        )}
      </div>
    </div>
  );
}
