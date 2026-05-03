"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useRef, useState, useTransition } from "react";
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowRightLeft,
  PackagePlus,
  PackageSearch,
  AlertTriangle,
} from "lucide-react";
import Link from "next/link";
import { formatMXN } from "@/lib/format";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface VariantRow {
  id: string;
  sku: string;
  name: string;
  price: number;
  cost: number;
  stock: number;
  stockMinimo: number;
  precioDistribuidorConfirmado: boolean;
}

export interface SimpleRow {
  id: string;
  codigo: string;
  nombre: string;
  categoria: string;
  price: number;
  cost: number;
  stock: number;
  stockMinimo: number;
}

export interface BranchOption {
  id: string;
  name: string;
  code: string;
}

interface Props {
  kind: "variant" | "simple";
  variantRows: VariantRow[];
  simpleRows: SimpleRow[];
  total: number;
  page: number;
  pageSize: number;
  q: string;
  variantCount: number;
  simpleCount: number;
  branches: BranchOption[];
  selectedBranch: string;
  isAdmin: boolean;
  precioDistPendiente: boolean;
  pendienteCount: number;
}

/* ------------------------------------------------------------------ */
/*  Styles                                                             */
/* ------------------------------------------------------------------ */

const CATEGORY_LABELS: Record<string, string> = {
  ACCESORIO: "Accesorio",
  CARGADOR: "Cargador",
  REFACCION: "Refacción",
  BATERIA_STANDALONE: "Batería",
};

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function KardexClient({
  kind,
  variantRows,
  simpleRows,
  total,
  page,
  pageSize,
  q,
  variantCount,
  simpleCount,
  branches,
  selectedBranch,
  isAdmin,
  precioDistPendiente,
  pendienteCount,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const totalPages = Math.ceil(total / pageSize);

  const push = useCallback(
    (updates: Record<string, string>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v) params.set(k, v);
        else params.delete(k);
      }
      startTransition(() => {
        router.replace(`/inventario?${params.toString()}`);
      });
    },
    [router, searchParams, startTransition],
  );

  const changeKind = (k: string) => {
    const params = new URLSearchParams();
    params.set("kind", k);
    if (selectedBranch && isAdmin) params.set("branch", selectedBranch);
    startTransition(() => {
      router.replace(`/inventario?${params.toString()}`);
    });
  };

  const [searchValue, setSearchValue] = useState(q);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      push({ q: value, page: "" });
    }, 300);
  };

  const tabs = [
    { key: "variant", label: "Vehículos y Baterías", count: variantCount },
    { key: "simple", label: "Productos Simples", count: simpleCount },
  ];

  return (
    <div
      className="flex flex-col h-[calc(100vh-4rem)]"
      style={{ opacity: isPending ? 0.6 : 1, transition: "opacity 150ms" }}
    >
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1
            className="text-[2.25rem] font-bold tracking-[-0.01em] leading-none"
            style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
          >
            Inventario
          </h1>
          <p className="mt-2 text-[0.8125rem]" style={{ color: "var(--on-surf-var)" }}>
            Kardex de existencias y valorización de almacén.
          </p>
        </div>
        <div className="flex gap-3">
          <Link href="/transferencias">
            <button
              className="flex items-center gap-2 shrink-0"
              style={{
                background: "var(--surf-high)",
                color: "var(--on-surf-var)",
                borderRadius: "var(--r-full)",
                border: "none",
                fontFamily: "var(--font-body)",
                fontWeight: 500,
                fontSize: "0.875rem",
                height: 44,
                paddingInline: "1.5rem",
                cursor: "pointer",
              }}
            >
              <ArrowRightLeft className="h-4 w-4" />
              Traslados
            </button>
          </Link>
          <Link href="/inventario/recepciones/nuevo">
            <button
              className="flex items-center gap-2 shrink-0"
              style={{
                background: "var(--velocity-gradient)",
                color: "#FFFFFF",
                borderRadius: "var(--r-full)",
                border: "none",
                fontFamily: "var(--font-body)",
                fontWeight: 600,
                fontSize: "0.875rem",
                height: 44,
                paddingInline: "1.5rem",
                cursor: "pointer",
              }}
            >
              <PackagePlus className="h-4 w-4" />
              Ingresar Mercancía
            </button>
          </Link>
        </div>
      </header>

      {/* Tabs */}
      <nav
        className="flex gap-1 p-1 rounded-xl w-fit mb-4"
        style={{ background: "var(--surf-low)" }}
      >
        {tabs.map((t) => {
          const isActive = kind === t.key;
          return (
            <button
              key={t.key}
              onClick={() => changeKind(t.key)}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm font-medium transition-colors"
              style={{
                background: isActive ? "var(--surf-highest)" : "transparent",
                color: isActive ? "var(--p)" : "var(--on-surf-var)",
                fontWeight: isActive ? 600 : 400,
                border: "none",
                cursor: "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              {t.label}
              <span
                className="text-[0.625rem] font-bold rounded-full px-1.5 py-px leading-none"
                style={{
                  background: isActive ? "var(--p)" : "var(--surf-high)",
                  color: isActive ? "#fff" : "var(--on-surf-var)",
                }}
              >
                {t.count}
              </span>
            </button>
          );
        })}
      </nav>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3 items-center mb-4">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            size={15}
            style={{ color: "var(--on-surf-var)" }}
          />
          <input
            type="text"
            value={searchValue}
            placeholder={kind === "variant" ? "Buscar por SKU, modelo, color…" : "Buscar por código, nombre…"}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full text-sm rounded-xl h-9 pl-9 pr-3"
            style={{
              background: "var(--surf-low)",
              color: "var(--on-surf)",
              border: "none",
              outline: "none",
              fontFamily: "var(--font-body)",
            }}
          />
        </div>

        {isAdmin && branches.length > 1 && (
          <select
            value={selectedBranch}
            onChange={(e) => push({ branch: e.target.value, page: "" })}
            className="text-sm rounded-xl px-3 h-9"
            style={{
              background: "var(--surf-low)",
              color: "var(--on-surf)",
              border: "none",
              outline: "none",
              fontFamily: "var(--font-body)",
            }}
          >
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}

        {kind === "variant" && pendienteCount > 0 && (
          <button
            onClick={() => push({ distPendiente: precioDistPendiente ? "" : "1", page: "" })}
            className="flex items-center gap-1.5 text-sm rounded-xl px-3 h-9"
            style={{
              background: precioDistPendiente ? "var(--warn-container)" : "var(--surf-low)",
              color: precioDistPendiente ? "var(--warn)" : "var(--on-surf-var)",
              border: "none",
              cursor: "pointer",
              fontFamily: "var(--font-body)",
              fontWeight: precioDistPendiente ? 600 : 400,
            }}
          >
            <AlertTriangle size={13} />
            Precio dist. pendiente
            <span
              className="text-[0.625rem] font-bold rounded-full px-1.5 py-px leading-none"
              style={{
                background: precioDistPendiente ? "var(--warn)" : "var(--surf-high)",
                color: precioDistPendiente ? "#fff" : "var(--on-surf-var)",
              }}
            >
              {pendienteCount}
            </span>
          </button>
        )}
      </div>

      {/* Table */}
      <div
        className="flex-1 overflow-auto rounded-2xl"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {kind === "variant" ? (
          <VariantTable rows={variantRows} />
        ) : (
          <SimpleTable rows={simpleRows} />
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-4 pb-2">
          <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
            {total} resultado{total !== 1 ? "s" : ""} · Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <button
              disabled={page <= 1}
              onClick={() => push({ page: String(page - 1) })}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-30"
              style={{
                background: "var(--surf-low)",
                color: "var(--on-surf)",
                border: "none",
                cursor: page <= 1 ? "default" : "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              <ChevronLeft size={14} /> Anterior
            </button>
            <button
              disabled={page >= totalPages}
              onClick={() => push({ page: String(page + 1) })}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm disabled:opacity-30"
              style={{
                background: "var(--surf-low)",
                color: "var(--on-surf)",
                border: "none",
                cursor: page >= totalPages ? "default" : "pointer",
                fontFamily: "var(--font-body)",
              }}
            >
              Siguiente <ChevronRight size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Sub-components                                                     */
/* ------------------------------------------------------------------ */

function StockBadge({ stock, stockMinimo }: { stock: number; stockMinimo: number }) {
  const severity: "ok" | "warning" | "critical" =
    stock === 0
      ? "critical"
      : stockMinimo > 0 && stock <= stockMinimo
        ? "warning"
        : "ok";

  const bg =
    severity === "critical"
      ? "var(--ter-container)"
      : severity === "warning"
        ? "var(--warn-container)"
        : "var(--sec-container)";
  const fg =
    severity === "critical"
      ? "var(--on-ter-container)"
      : severity === "warning"
        ? "var(--warn)"
        : "var(--on-sec-container)";

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium"
      style={{ background: bg, color: fg }}
    >
      {severity === "critical" && <AlertTriangle size={10} />}
      {severity === "warning" && <AlertTriangle size={10} />}
      {stock} pzas
    </span>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
}) {
  return (
    <th
      style={{
        textAlign: align,
        fontSize: "0.6875rem",
        fontWeight: 500,
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--on-surf-var)",
        padding: "0.75rem 1rem",
        borderBottom: "1px solid var(--ghost-border)",
        fontFamily: "var(--font-body)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  mono,
}: {
  children: React.ReactNode;
  align?: "left" | "right" | "center";
  mono?: boolean;
}) {
  return (
    <td
      style={{
        textAlign: align,
        fontSize: "0.8125rem",
        color: "var(--on-surf)",
        padding: "0.625rem 1rem",
        borderBottom: "1px solid var(--ghost-border-soft)",
        fontFamily: mono ? "var(--font-mono, monospace)" : "var(--font-body)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </td>
  );
}

function EmptyState({ kind }: { kind: "variant" | "simple" }) {
  return (
    <tr>
      <td
        colSpan={kind === "variant" ? 5 : 6}
        style={{ padding: "3rem 1rem", textAlign: "center" }}
      >
        <div className="flex flex-col items-center gap-2">
          <PackageSearch size={32} style={{ color: "var(--on-surf-var)", opacity: 0.4 }} />
          <span
            className="text-sm"
            style={{ color: "var(--on-surf-var)" }}
          >
            No se encontraron productos.
          </span>
        </div>
      </td>
    </tr>
  );
}

function VariantTable({ rows }: { rows: VariantRow[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead style={{ position: "sticky", top: 0, background: "var(--surf-lowest)", zIndex: 1 }}>
        <tr>
          <Th>Producto</Th>
          <Th>SKU</Th>
          <Th align="right">Precio Venta</Th>
          <Th align="right">Costo</Th>
          <Th align="center">En Existencia</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyState kind="variant" />
        ) : (
          rows.map((r) => (
            <tr
              key={r.id}
              className="transition-colors"
              style={{ cursor: "default" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--surf-low)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Td>
                <span style={{ fontWeight: 500 }}>{r.name}</span>
              </Td>
              <Td>
                <span style={{ color: "var(--on-surf-var)" }}>{r.sku}</span>
              </Td>
              <Td align="right">
                <span style={{ fontWeight: 500, color: "var(--p)" }}>
                  {formatMXN(r.price)}
                </span>
              </Td>
              <Td align="right">
                <span style={{ color: "var(--on-surf-var)" }}>
                  {formatMXN(r.cost)}
                </span>
              </Td>
              <Td align="center">
                <StockBadge stock={r.stock} stockMinimo={r.stockMinimo} />
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}

function SimpleTable({ rows }: { rows: SimpleRow[] }) {
  return (
    <table style={{ width: "100%", borderCollapse: "collapse" }}>
      <thead style={{ position: "sticky", top: 0, background: "var(--surf-lowest)", zIndex: 1 }}>
        <tr>
          <Th>Producto</Th>
          <Th>Código</Th>
          <Th>Categoría</Th>
          <Th align="right">Precio Venta</Th>
          <Th align="right">Costo</Th>
          <Th align="center">En Existencia</Th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <EmptyState kind="simple" />
        ) : (
          rows.map((r) => (
            <tr
              key={r.id}
              className="transition-colors"
              style={{ cursor: "default" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--surf-low)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <Td>
                <span style={{ fontWeight: 500 }}>{r.nombre}</span>
              </Td>
              <Td>
                <span style={{ color: "var(--on-surf-var)" }}>{r.codigo}</span>
              </Td>
              <Td>
                <span
                  className="inline-flex px-2 py-px rounded-full text-[0.6875rem] font-medium"
                  style={{
                    background: "var(--sec-container)",
                    color: "var(--on-sec-container)",
                  }}
                >
                  {CATEGORY_LABELS[r.categoria] ?? r.categoria}
                </span>
              </Td>
              <Td align="right">
                <span style={{ fontWeight: 500, color: "var(--p)" }}>
                  {formatMXN(r.price)}
                </span>
              </Td>
              <Td align="right">
                <span style={{ color: "var(--on-surf-var)" }}>
                  {formatMXN(r.cost)}
                </span>
              </Td>
              <Td align="center">
                <StockBadge stock={r.stock} stockMinimo={r.stockMinimo} />
              </Td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
