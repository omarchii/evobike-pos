"use client";

import * as React from "react";
import { formatMXN } from "@/lib/format";
import type {
  PnlData,
  BranchPnlData,
  ExpenseCategoryKey,
  CashExpenseCategoryKey,
} from "./queries";
import {
  OPEX_CATEGORY_LABELS,
  CASH_EXPENSE_LABELS,
} from "./queries";

// ── Tipos internos ────────────────────────────────────────────────────────────

interface PnlTableProps {
  data: PnlData;
  compareData: PnlData | null;
  view: "consolidado" | "comparativa";
}

interface ColDef {
  key: string;
  label: string;
  data: BranchPnlData;
  compareData: BranchPnlData | null;
}

// ── Helpers de celda ──────────────────────────────────────────────────────────

function DeltaChip({ current, prev }: { current: number; prev: number | null }) {
  if (prev === null || prev === 0) return null;
  const pct = ((current - prev) / Math.abs(prev)) * 100;
  const positive = pct >= 0;
  return (
    <span
      className="ml-1.5 text-[0.6rem] font-medium"
      style={{ color: positive ? "var(--sec)" : "var(--ter)" }}
    >
      {positive ? "+" : ""}
      {pct.toFixed(1)}%
    </span>
  );
}

function AmountCell({
  current,
  prev,
  isNegative = false,
}: {
  current: number;
  prev: number | null;
  isNegative?: boolean;
}) {
  return (
    <td
      className="px-4 text-right tabular-nums"
      style={{ paddingTop: "var(--density-cell-y)", paddingBottom: "var(--density-cell-y)" }}
    >
      <span
        className="text-sm font-medium"
        style={{ color: isNegative && current > 0 ? "var(--ter)" : "var(--on-surf)" }}
      >
        {isNegative && current > 0 ? `(${formatMXN(current)})` : formatMXN(current)}
      </span>
      {prev !== null && <DeltaChip current={current} prev={prev} />}
    </td>
  );
}

// ── Fila de subtotal (= Margen) ───────────────────────────────────────────────

function SubtotalRow({
  label,
  cols,
  getVal,
  getPrev,
}: {
  label: string;
  cols: ColDef[];
  getVal: (d: BranchPnlData) => number;
  getPrev: (d: BranchPnlData | null) => number | null;
}) {
  return (
    <tr style={{ background: "var(--surf-low)" }}>
      <td
        className="px-4 text-sm font-semibold"
        style={{
          color: "var(--on-surf)",
          minHeight: "var(--density-row)",
          paddingTop: "var(--density-cell-y)",
          paddingBottom: "var(--density-cell-y)",
        }}
      >
        {label}
      </td>
      {cols.map((col) => (
        <AmountCell
          key={col.key}
          current={getVal(col.data)}
          prev={getPrev(col.compareData)}
        />
      ))}
    </tr>
  );
}

// ── Fila normal ───────────────────────────────────────────────────────────────

function DataRow({
  label,
  cols,
  getVal,
  getPrev,
  isDeductive = false,
  isCollapseHeader = false,
  expanded,
  onToggle,
}: {
  label: string;
  cols: ColDef[];
  getVal: (d: BranchPnlData) => number;
  getPrev: (d: BranchPnlData | null) => number | null;
  isDeductive?: boolean;
  isCollapseHeader?: boolean;
  expanded?: boolean;
  onToggle?: () => void;
}) {
  return (
    <tr
      onClick={isCollapseHeader ? onToggle : undefined}
      style={{
        cursor: isCollapseHeader ? "pointer" : "default",
        minHeight: "var(--density-row)",
      }}
      className={isCollapseHeader ? "hover:bg-[var(--surf-high)] transition-colors" : ""}
    >
      <td
        className="px-4 text-sm"
        style={{
          color: "var(--on-surf)",
          paddingTop: "var(--density-cell-y)",
          paddingBottom: "var(--density-cell-y)",
        }}
      >
        <span className="flex items-center gap-1.5">
          {isDeductive && (
            <span className="font-medium" style={{ color: "var(--on-surf-var)" }}>
              (−)
            </span>
          )}
          <span>{label}</span>
          {isCollapseHeader && (
            <span
              className="ml-auto text-[0.65rem] transition-transform duration-200"
              style={{
                color: "var(--on-surf-var)",
                transform: expanded ? "rotate(180deg)" : "rotate(0deg)",
              }}
              aria-hidden="true"
            >
              ▼
            </span>
          )}
        </span>
      </td>
      {cols.map((col) => (
        <AmountCell
          key={col.key}
          current={getVal(col.data)}
          prev={getPrev(col.compareData)}
          isNegative={isDeductive}
        />
      ))}
    </tr>
  );
}

// ── Filas de categorías colapsables ──────────────────────────────────────────

function CollapseRows({
  expanded,
  children,
}: {
  expanded: boolean;
  children: React.ReactNode;
}) {
  return (
    <tr style={{ padding: 0 }}>
      <td colSpan={99} style={{ padding: 0 }}>
        <div
          className="[transition:max-height_0.2s_ease-in-out,opacity_0.2s_ease] [@media(prefers-reduced-motion:reduce)]:transition-none overflow-hidden"
          style={{
            maxHeight: expanded ? "2000px" : "0",
            opacity: expanded ? 1 : 0,
          }}
          aria-hidden={!expanded}
        >
          <table className="w-full">
            <tbody>{children}</tbody>
          </table>
        </div>
      </td>
    </tr>
  );
}

function CategorySubRow({
  label,
  cols,
  amounts,
  compareAmounts,
}: {
  label: string;
  cols: ColDef[];
  amounts: number[];
  compareAmounts: (number | null)[];
}) {
  return (
    <tr>
      <td
        className="pl-10 pr-4 text-xs"
        style={{
          color: "var(--on-surf-var)",
          paddingTop: "calc(var(--density-cell-y) * 0.7)",
          paddingBottom: "calc(var(--density-cell-y) * 0.7)",
        }}
      >
        {label}
      </td>
      {cols.map((col, i) => (
        <td
          key={col.key}
          className="px-4 text-right tabular-nums text-xs"
          style={{
            color: "var(--on-surf-var)",
            paddingTop: "calc(var(--density-cell-y) * 0.7)",
            paddingBottom: "calc(var(--density-cell-y) * 0.7)",
          }}
        >
          {formatMXN(amounts[i] ?? 0)}
          {compareAmounts[i] != null && (
            <DeltaChip current={amounts[i] ?? 0} prev={compareAmounts[i]} />
          )}
        </td>
      ))}
    </tr>
  );
}

// ── Tabla principal ───────────────────────────────────────────────────────────

export function PnlTable({ data, compareData, view }: PnlTableProps) {
  const [opexExpanded, setOpexExpanded] = React.useState(false);
  const [cashExpanded, setCashExpanded] = React.useState(false);

  // Construir columnas según el modo de vista
  let cols: ColDef[];
  if (view === "comparativa" && data.branches.length > 1) {
    const branchCols: ColDef[] = data.branches.map((b) => ({
      key: b.id,
      label: b.code,
      data: data.byBranch[b.id] ?? zeroData(),
      compareData: compareData?.byBranch[b.id] ?? null,
    }));
    cols = [
      ...branchCols,
      {
        key: "__total__",
        label: "Total",
        data: data.consolidated,
        compareData: compareData?.consolidated ?? null,
      },
    ];
  } else {
    cols = [
      {
        key: "__total__",
        label: "Total",
        data: data.consolidated,
        compareData: compareData?.consolidated ?? null,
      },
    ];
  }

  // Categorías con al menos un importe > 0 (para no mostrar filas vacías)
  const opexCategories = Object.keys(OPEX_CATEGORY_LABELS).filter(
    (k) => (data.consolidated.opexBancarioByCategoria[k as ExpenseCategoryKey] ?? 0) > 0,
  ) as ExpenseCategoryKey[];

  const cashCategories = Object.keys(CASH_EXPENSE_LABELS).filter(
    (k) =>
      (data.consolidated.gastosEfectivoByCategoria[k as CashExpenseCategoryKey] ?? 0) > 0,
  ) as CashExpenseCategoryKey[];

  return (
    <div
      className="overflow-hidden rounded-[var(--r-lg)]"
      style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
    >
      <table className="w-full border-collapse">
        {/* Header */}
        <thead>
          <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
            <th
              className="px-4 py-3 text-left text-[0.6875rem] font-medium uppercase tracking-[0.05em]"
              style={{ color: "var(--on-surf-var)" }}
            >
              Concepto
            </th>
            {cols.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-right text-[0.6875rem] font-medium uppercase tracking-[0.05em]"
                style={{ color: "var(--on-surf-var)" }}
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Ingresos brutos */}
          <DataRow
            label="Ingresos brutos"
            cols={cols}
            getVal={(d) => d.ingresos}
            getPrev={(d) => d?.ingresos ?? null}
          />

          {/* COGS */}
          <DataRow
            label="Costo de ventas"
            cols={cols}
            getVal={(d) => d.cogs}
            getPrev={(d) => d?.cogs ?? null}
            isDeductive
          />

          {/* = Margen bruto */}
          <SubtotalRow
            label="= Margen bruto"
            cols={cols}
            getVal={(d) => d.margenBruto}
            getPrev={(d) => d?.margenBruto ?? null}
          />

          {/* Gastos banco/tarjeta/transferencia (colapsable) */}
          <DataRow
            label="Gastos banco / tarjeta / transferencia"
            cols={cols}
            getVal={(d) => d.opexBancario}
            getPrev={(d) => d?.opexBancario ?? null}
            isDeductive
            isCollapseHeader
            expanded={opexExpanded}
            onToggle={() => setOpexExpanded((v) => !v)}
          />
          <CollapseRows expanded={opexExpanded}>
            {opexCategories.map((cat) => {
              const amounts = cols.map(
                (col) => col.data.opexBancarioByCategoria[cat] ?? 0,
              );
              const compareAmounts = cols.map(
                (col) => col.compareData?.opexBancarioByCategoria[cat] ?? null,
              );
              return (
                <CategorySubRow
                  key={cat}
                  label={OPEX_CATEGORY_LABELS[cat]}
                  cols={cols}
                  amounts={amounts}
                  compareAmounts={compareAmounts}
                />
              );
            })}
          </CollapseRows>

          {/* Comisiones pagadas */}
          <DataRow
            label="Comisiones pagadas"
            cols={cols}
            getVal={(d) => d.comisionesPagadas}
            getPrev={(d) => d?.comisionesPagadas ?? null}
            isDeductive
          />

          {/* Gastos de caja (colapsable) */}
          <DataRow
            label="Gastos de caja"
            cols={cols}
            getVal={(d) => d.gastosEfectivo}
            getPrev={(d) => d?.gastosEfectivo ?? null}
            isDeductive
            isCollapseHeader
            expanded={cashExpanded}
            onToggle={() => setCashExpanded((v) => !v)}
          />
          <CollapseRows expanded={cashExpanded}>
            {cashCategories.map((cat) => {
              const amounts = cols.map(
                (col) => col.data.gastosEfectivoByCategoria[cat] ?? 0,
              );
              const compareAmounts = cols.map(
                (col) =>
                  col.compareData?.gastosEfectivoByCategoria[cat] ?? null,
              );
              return (
                <CategorySubRow
                  key={cat}
                  label={CASH_EXPENSE_LABELS[cat]}
                  cols={cols}
                  amounts={amounts}
                  compareAmounts={compareAmounts}
                />
              );
            })}
          </CollapseRows>

          {/* = Margen operativo */}
          <SubtotalRow
            label="= Margen operativo"
            cols={cols}
            getVal={(d) => d.margenOperativo}
            getPrev={(d) => d?.margenOperativo ?? null}
          />
        </tbody>
      </table>
    </div>
  );
}

// Utilidad local
function zeroData(): BranchPnlData {
  return {
    ingresos: 0,
    cogs: 0,
    margenBruto: 0,
    opexBancario: 0,
    opexBancarioByCategoria: {},
    comisionesPagadas: 0,
    gastosEfectivo: 0,
    gastosEfectivoByCategoria: {},
    margenOperativo: 0,
  };
}
