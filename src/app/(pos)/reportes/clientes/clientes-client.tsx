"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import { Wallet, Download, ArrowRight } from "lucide-react";
import { ReportHeader } from "@/app/(pos)/reportes/_components/report-header";
import { ReportKpiCards } from "@/app/(pos)/reportes/_components/report-kpi-cards";
import { ReportTable } from "@/app/(pos)/reportes/_components/report-table";
import type { TableColumn } from "@/app/(pos)/reportes/_components/report-table";
import { ReportBranchFilter } from "@/app/(pos)/reportes/_components/report-branch-filter";
import { downloadCSV } from "@/lib/reportes/csv";
import { formatMXN } from "@/lib/reportes/money";
import type { ReportKPI } from "@/lib/reportes/types";
import type {
  ClienteRow,
  ClientesKpis,
  ClientesCurrentFilters,
  BranchOption,
} from "./page";

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
  minWidth: 220,
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

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

interface ClientesClientProps {
  rows: ClienteRow[];
  kpis: ClientesKpis;
  branches: BranchOption[];
  currentFilters: ClientesCurrentFilters;
  isAdmin: boolean;
  userRole: string;
}

export function ClientesClient({
  rows,
  kpis,
  branches,
  currentFilters,
  isAdmin,
  userRole,
}: ClientesClientProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  function updateParam(key: string, value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`?${params.toString()}`);
  }

  const kpiCards: ReportKPI[] = [
    {
      label: "Clientes con actividad",
      value: kpis.clientesActivos,
      format: "number",
    },
    {
      label: "Apartados activos",
      value: kpis.apartadosActivos,
      format: "number",
    },
    {
      label: "Saldo pendiente total",
      value: kpis.saldoPendienteTotal,
      format: "currency",
    },
    {
      label: "Saldo a favor acumulado",
      value: kpis.saldoAFavorTotal,
      format: "currency",
    },
  ];

  function handleCSV(): void {
    downloadCSV(
      rows.map((r) => ({
        Cliente: r.name,
        Teléfono: r.phone,
        "Compras completadas": r.comprasCount,
        "Total comprado": r.totalComprado,
        "Apartados activos": r.apartadosCount,
        "Saldo pendiente": r.saldoPendiente,
        "Saldo a favor": r.saldoAFavor,
        "Última actividad": r.ultimaActividadISO
          ? formatDate(r.ultimaActividadISO)
          : "",
      })),
      `estado-de-cuenta-clientes-${new Date().toISOString().slice(0, 10)}`,
    );
  }

  const columns: TableColumn<ClienteRow>[] = [
    {
      key: "name",
      header: "Cliente",
      render: (r) => (
        <span style={{ fontWeight: 500, color: "var(--on-surf)" }}>
          {r.name}
        </span>
      ),
    },
    {
      key: "phone",
      header: "Teléfono",
      render: (r) => (
        <span
          style={{
            color:
              r.phone === "—" ? "var(--on-surf-var)" : "var(--on-surf)",
            whiteSpace: "nowrap",
          }}
        >
          {r.phone}
        </span>
      ),
    },
    {
      key: "comprasCount",
      header: "Compras",
      align: "right",
      render: (r) => r.comprasCount.toLocaleString("es-MX"),
    },
    {
      key: "totalComprado",
      header: "Total comprado",
      align: "right",
      render: (r) => (
        <span style={{ fontWeight: 500 }}>{formatMXN(r.totalComprado)}</span>
      ),
    },
    {
      key: "apartadosCount",
      header: "Apartados",
      align: "right",
      render: (r) => r.apartadosCount.toLocaleString("es-MX"),
    },
    {
      key: "saldoPendiente",
      header: "Saldo pendiente",
      align: "right",
      render: (r) => (
        <span
          style={{
            fontWeight: 600,
            color:
              r.saldoPendiente > 0
                ? "var(--warn)"
                : "var(--on-surf-var)",
          }}
        >
          {r.saldoPendiente > 0 ? formatMXN(r.saldoPendiente) : "—"}
        </span>
      ),
    },
    {
      key: "saldoAFavor",
      header: "Saldo a favor",
      align: "right",
      render: (r) =>
        r.saldoAFavor > 0 ? (
          <span style={{ fontWeight: 500, color: "var(--p)" }}>
            {formatMXN(r.saldoAFavor)}
          </span>
        ) : (
          <span style={{ color: "var(--on-surf-var)" }}>—</span>
        ),
    },
    {
      key: "ultimaActividad",
      header: "Última actividad",
      render: (r) => (
        <span
          style={{
            color: r.ultimaActividadISO
              ? "var(--on-surf-var)"
              : "var(--on-surf-var)",
            whiteSpace: "nowrap",
          }}
        >
          {formatDate(r.ultimaActividadISO)}
        </span>
      ),
    },
    {
      key: "action",
      header: "",
      align: "right",
      render: (r) => (
        <Link
          href={`/reportes/clientes/${r.id}`}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.25rem",
            color: "var(--p)",
            fontWeight: 500,
            fontSize: "0.75rem",
            whiteSpace: "nowrap",
          }}
        >
          Ver estado
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      ),
    },
  ];

  const filtersNode = (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label style={LABEL_STYLE}>Buscar</label>
        <input
          type="search"
          placeholder="Nombre, teléfono o correo..."
          defaultValue={currentFilters.q}
          style={INPUT_STYLE}
          onBlur={(e) => updateParam("q", e.target.value.trim())}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              updateParam(
                "q",
                (e.target as HTMLInputElement).value.trim(),
              );
            }
          }}
        />
      </div>

      {isAdmin && (
        <ReportBranchFilter
          role={userRole}
          branches={branches}
          currentBranchId={currentFilters.branchId}
        />
      )}

      <div>
        <label style={LABEL_STYLE}>Saldo</label>
        <select
          defaultValue={currentFilters.hasPending}
          style={SELECT_STYLE}
          onChange={(e) => updateParam("hasPending", e.target.value)}
        >
          <option value="">Todos los clientes</option>
          <option value="true">Solo con saldo pendiente</option>
        </select>
      </div>
    </div>
  );

  const actions = (
    <button
      type="button"
      style={EXPORT_BTN_STYLE}
      onClick={handleCSV}
      disabled={rows.length === 0}
    >
      <Download className="h-3.5 w-3.5" />
      Exportar CSV
    </button>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      <ReportHeader
        title="Estado de cuenta por cliente"
        subtitle="Relación financiera actual de cada cliente: compras, apartados pendientes y saldo a favor."
        icon={Wallet}
        filters={filtersNode}
        actions={actions}
      />

      <ReportKpiCards kpis={kpiCards} />

      <section>
        <div
          className="flex items-center justify-between mb-4"
          style={{
            background:
              "linear-gradient(to bottom, var(--surf-low) 0%, transparent 100%)",
            borderRadius: "var(--r-md) var(--r-md) 0 0",
            padding: "0.875rem 0.25rem",
          }}
        >
          <div className="flex items-center gap-2">
            <Wallet
              className="h-4 w-4"
              style={{ color: "var(--on-surf-var)" }}
            />
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1rem",
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: "var(--on-surf)",
              }}
            >
              Clientes
            </h2>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "var(--on-surf-var)",
                marginLeft: "0.25rem",
              }}
            >
              · {rows.length} cliente{rows.length !== 1 ? "s" : ""}
            </span>
          </div>
        </div>

        <div
          style={{
            background: "var(--surf-lowest)",
            borderRadius: "var(--r-lg)",
            boxShadow: "var(--shadow)",
            overflow: "hidden",
          }}
        >
          <ReportTable<ClienteRow>
            columns={columns}
            rows={rows}
            keyExtractor={(row) => row.id}
            emptyMessage="No hay clientes con actividad que coincidan con los filtros."
          />
        </div>
      </section>
    </div>
  );
}
