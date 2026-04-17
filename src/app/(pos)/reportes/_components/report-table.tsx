"use client";

import type { ReactNode } from "react";
import { ReportEmptyState } from "./report-empty-state";

export interface TableColumn<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  align?: "left" | "right" | "center";
}

interface ReportTableProps<T> {
  columns: TableColumn<T>[];
  rows: T[];
  keyExtractor: (row: T, index: number) => string;
  isLoading?: boolean;
  emptyMessage?: string;
}

export function ReportTable<T>({
  columns,
  rows,
  keyExtractor,
  isLoading,
  emptyMessage,
}: ReportTableProps<T>): React.JSX.Element {
  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center py-16"
        style={{ color: "var(--on-surf-var)" }}
      >
        <p style={{ fontFamily: "var(--font-body)", fontSize: "0.875rem" }}>
          Cargando...
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return <ReportEmptyState message={emptyMessage} />;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full" style={{ borderCollapse: "collapse" }}>
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.75rem",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--on-surf-var)",
                  padding: "0.5rem 0.75rem",
                  borderBottom: "1px solid var(--ghost-border)",
                  textAlign: col.align ?? "left",
                  whiteSpace: "nowrap",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={keyExtractor(row, i)}
              className="group"
              style={{
                borderBottom: "1px solid var(--ghost-border)",
              }}
            >
              {columns.map((col) => (
                <td
                  key={col.key}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.75rem",
                    color: "var(--on-surf)",
                    padding: "0.5625rem 0.75rem",
                    textAlign: col.align ?? "left",
                  }}
                >
                  {col.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
