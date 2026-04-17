"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight, ChevronLeft, ChevronRight, Download, Repeat2 } from "lucide-react";
import type { CSSProperties } from "react";
import type { StockTransferStatus } from "@prisma/client";
import { ReportHeader } from "@/app/(pos)/reportes/_components/report-header";
import { ReportKpiCards } from "@/app/(pos)/reportes/_components/report-kpi-cards";
import { ReportTable } from "@/app/(pos)/reportes/_components/report-table";
import type { TableColumn } from "@/app/(pos)/reportes/_components/report-table";
import { ReportDateFilter } from "@/app/(pos)/reportes/_components/report-date-filter";
import { downloadCSV } from "@/lib/reportes/csv";
import type { ReportKPI } from "@/lib/reportes/types";
import { TransferStatusBadge } from "@/components/transfer-status-badge";
import type {
  TransferenciaRow,
  TransferenciasKpis,
  BranchOption,
  TransferenciasReportFilters,
} from "./page";

// ── Estilos ───────────────────────────────────────────────────────────────────

const LABEL_STYLE: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.6875rem",
  fontWeight: 500,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--on-surf-var)",
  display: "block",
  marginBottom: "0.25rem",
};

const SELECT_STYLE: CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-md)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  height: 36,
  padding: "0 2rem 0 0.75rem",
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233d5247' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.6rem center",
  minWidth: 160,
};

const INPUT_STYLE: CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-md)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  height: 36,
  padding: "0 0.75rem",
  outline: "none",
  minWidth: 200,
};

const EXPORT_BTN_STYLE: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.375rem",
  background: "var(--surf-high)",
  color: "var(--p)",
  border: "none",
  borderRadius: "var(--r-full)",
  fontFamily: "var(--font-body)",
  fontWeight: 500,
  fontSize: "0.8125rem",
  height: 32,
  paddingInline: "0.875rem",
  cursor: "pointer",
};

const STATUS_LABELS: Record<string, string> = {
  SOLICITADA: "Solicitada",
  BORRADOR: "Borrador",
  EN_TRANSITO: "En tránsito",
  RECIBIDA: "Recibida",
  CANCELADA: "Cancelada",
};

// ── Props ─────────────────────────────────────────────────────────────────────

interface Props {
  rows: TransferenciaRow[];
  kpis: TransferenciasKpis;
  branches: BranchOption[];
  currentFilters: TransferenciasReportFilters;
  isAdmin: boolean;
  total: number;
  page: number;
  pageSize: number;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function TransferenciasReportClient({
  rows,
  kpis,
  branches,
  currentFilters,
  isAdmin,
  total,
  page,
  pageSize,
}: Props): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();
  const totalPages = Math.ceil(total / pageSize);

  function push(overrides: Record<string, string>): void {
    const params = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(overrides)) {
      if (v) params.set(k, v);
      else params.delete(k);
    }
    router.replace(`?${params.toString()}`);
  }

  // ── KPIs ──────────────────────────────────────────────────────────────────
  const kpiCards: ReportKPI[] = [
    { label: "Total en rango", value: kpis.totalEnRango, format: "number" },
    { label: "En tránsito", value: kpis.enTransito, format: "number" },
    { label: "Recibidas", value: kpis.recibidas, format: "number" },
    { label: "Canceladas", value: kpis.canceladas, format: "number" },
  ];

  // ── CSV export ────────────────────────────────────────────────────────────
  function handleCSV(): void {
    downloadCSV(
      rows.map((r) => ({
        Folio: r.folio,
        Fecha: new Date(r.createdAt).toLocaleDateString("es-MX"),
        Origen: r.fromBranchName,
        Destino: r.toBranchName,
        Estado: STATUS_LABELS[r.status] ?? r.status,
        "N° ítems": r.totalItems,
        "Qty enviada": r.cantidadTotalEnviada,
        "Qty recibida": r.cantidadTotalRecibida,
        "Creada por": r.creadoPorNombre,
        "Motivo cancelación": r.motivoCancelacion ?? "",
      })),
      `transferencias-${currentFilters.from}-${currentFilters.to}`,
    );
  }

  // ── Columnas de tabla ─────────────────────────────────────────────────────
  const columns: TableColumn<TransferenciaRow>[] = [
    {
      key: "folio",
      header: "Folio",
      render: (row) => (
        <Link
          href={`/transferencias/${row.id}`}
          style={{
            color: "var(--p)",
            fontFamily: "var(--font-body)",
            fontWeight: 600,
            fontSize: "0.8125rem",
            textDecoration: "none",
          }}
        >
          {row.folio}
        </Link>
      ),
    },
    {
      key: "createdAt",
      header: "Fecha",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--on-surf-var)" }}>
          {new Date(row.createdAt).toLocaleDateString("es-MX", {
            day: "2-digit",
            month: "short",
            year: "numeric",
          })}
        </span>
      ),
    },
    {
      key: "branches",
      header: "Origen → Destino",
      render: (row) => (
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            color: "var(--on-surf)",
          }}
        >
          {row.fromBranchName}
          <ArrowRight className="h-3 w-3 shrink-0" style={{ color: "var(--on-surf-var)" }} />
          {row.toBranchName}
        </span>
      ),
    },
    {
      key: "status",
      header: "Estado",
      render: (row) => (
        <TransferStatusBadge status={row.status as StockTransferStatus} />
      ),
    },
    {
      key: "totalItems",
      header: "Ítems",
      align: "right",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--on-surf)" }}>
          {row.totalItems}
        </span>
      ),
    },
    {
      key: "enviada",
      header: "Qty enviada",
      align: "right",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--on-surf)" }}>
          {row.cantidadTotalEnviada}
        </span>
      ),
    },
    {
      key: "recibida",
      header: "Qty recibida",
      align: "right",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--on-surf)" }}>
          {row.cantidadTotalRecibida}
        </span>
      ),
    },
    {
      key: "creadoPor",
      header: "Creada por",
      render: (row) => (
        <span style={{ fontFamily: "var(--font-body)", fontSize: "0.8125rem", color: "var(--on-surf-var)" }}>
          {row.creadoPorNombre}
        </span>
      ),
    },
  ];

  // ── Filtros ───────────────────────────────────────────────────────────────
  const filtersNode = (
    <div className="flex flex-wrap items-end gap-3">
      <ReportDateFilter currentFrom={currentFilters.from} currentTo={currentFilters.to} />

      <div>
        <label style={LABEL_STYLE}>Estado</label>
        <select
          style={SELECT_STYLE}
          defaultValue={currentFilters.status}
          onChange={(e) => push({ status: e.target.value, page: "" })}
        >
          <option value="">Todos</option>
          <option value="SOLICITADA">Solicitada</option>
          <option value="BORRADOR">Borrador</option>
          <option value="EN_TRANSITO">En tránsito</option>
          <option value="RECIBIDA">Recibida</option>
          <option value="CANCELADA">Cancelada</option>
        </select>
      </div>

      {isAdmin && (
        <>
          <div>
            <label style={LABEL_STYLE}>Sucursal origen</label>
            <select
              style={SELECT_STYLE}
              defaultValue={currentFilters.fromBranchId}
              onChange={(e) => push({ fromBranchId: e.target.value, page: "" })}
            >
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label style={LABEL_STYLE}>Sucursal destino</label>
            <select
              style={SELECT_STYLE}
              defaultValue={currentFilters.toBranchId}
              onChange={(e) => push({ toBranchId: e.target.value, page: "" })}
            >
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
        </>
      )}

      <div>
        <label style={LABEL_STYLE}>Buscar folio</label>
        <input
          type="text"
          placeholder="TRF-..."
          style={INPUT_STYLE}
          defaultValue={currentFilters.q}
          onChange={(e) => push({ q: e.target.value, page: "" })}
        />
      </div>
    </div>
  );

  const actionsNode = (
    <button style={EXPORT_BTN_STYLE} onClick={handleCSV}>
      <Download className="h-3.5 w-3.5" />
      Exportar CSV
    </button>
  );

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      <ReportHeader
        title="Transferencias"
        subtitle="Movimientos de stock entre sucursales"
        icon={Repeat2}
        filters={filtersNode}
        actions={actionsNode}
      />

      <ReportKpiCards kpis={kpiCards} />

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="p-5 space-y-4">
          <h2
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1rem",
              fontWeight: 600,
              color: "var(--on-surf)",
            }}
          >
            Detalle de transferencias
          </h2>

          <ReportTable<TransferenciaRow>
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.id}
            emptyMessage="No hay transferencias en el rango seleccionado"
          />

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <span
                className="text-xs"
                style={{ color: "var(--on-surf-var)", fontFamily: "var(--font-body)" }}
              >
                {total} resultado{total !== 1 ? "s" : ""}
              </span>
              <div className="flex items-center gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => push({ page: String(page - 1) })}
                  className="flex items-center justify-center rounded-xl w-9 h-9 transition-colors disabled:opacity-40"
                  style={{ background: "var(--surf-low)", color: "var(--on-surf-var)" }}
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span
                  className="text-sm"
                  style={{ color: "var(--on-surf)", fontFamily: "var(--font-body)" }}
                >
                  {page} / {totalPages}
                </span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => push({ page: String(page + 1) })}
                  className="flex items-center justify-center rounded-xl w-9 h-9 transition-colors disabled:opacity-40"
                  style={{ background: "var(--surf-low)", color: "var(--on-surf-var)" }}
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
