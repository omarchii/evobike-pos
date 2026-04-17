"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";
import {
  Wallet,
  Download,
  ArrowLeft,
  Receipt,
  PackageCheck,
  Mail,
  Phone,
  FileText,
} from "lucide-react";
import { ReportHeader } from "@/app/(pos)/reportes/_components/report-header";
import { ReportTable } from "@/app/(pos)/reportes/_components/report-table";
import type { TableColumn } from "@/app/(pos)/reportes/_components/report-table";
import { downloadCSV } from "@/lib/reportes/csv";
import { formatMXN } from "@/lib/reportes/money";
import type {
  CustomerHeader,
  CompraRow,
  ApartadoRow,
  ComprasSummary,
  ApartadosSummary,
  DetalleCurrentFilters,
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

const SECTION_HEADER_STYLE: CSSProperties = {
  fontFamily: "var(--font-display)",
  fontSize: "1rem",
  fontWeight: 700,
  letterSpacing: "-0.01em",
  color: "var(--on-surf)",
};

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function StatusBadge({ status }: { status: string }): React.JSX.Element {
  const isCancelled = status === "CANCELLED";
  const bg = isCancelled ? "var(--surf-high)" : "var(--sec-container)";
  const color = isCancelled ? "var(--on-surf-var)" : "var(--on-sec-container)";
  const label = isCancelled ? "Cancelada" : "Completada";

  return (
    <span
      style={{
        display: "inline-block",
        background: bg,
        color,
        borderRadius: "var(--r-full)",
        padding: "0.15rem 0.55rem",
        fontSize: "0.625rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontFamily: "var(--font-body)",
      }}
    >
      {label}
    </span>
  );
}

interface ClienteDetalleClientProps {
  customer: CustomerHeader;
  compras: CompraRow[];
  apartados: ApartadoRow[];
  comprasSummary: ComprasSummary;
  apartadosSummary: ApartadosSummary;
  currentFilters: DetalleCurrentFilters;
}

export function ClienteDetalleClient({
  customer,
  compras,
  apartados,
  comprasSummary,
  apartadosSummary,
  currentFilters,
}: ClienteDetalleClientProps): React.JSX.Element {
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

  function clearDateFilter(): void {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("from");
    params.delete("to");
    router.replace(`?${params.toString()}`);
  }

  function handleCSV(): void {
    const comprasRows = compras.map((c) => ({
      Sección: "Compras",
      Folio: c.folio,
      Fecha: formatDate(c.fechaISO),
      Sucursal: c.sucursal,
      Detalle: c.itemsResumen,
      Total: c.total,
      "Método de pago": c.metodoPago,
      Pagado: "",
      Pendiente: "",
      "Último abono": "",
      "Entrega estimada": "",
      Estado: c.status === "CANCELLED" ? "Cancelada" : "Completada",
    }));
    const apartadosRows = apartados.map((a) => ({
      Sección: "Apartado",
      Folio: a.folio,
      Fecha: formatDate(a.fechaISO),
      Sucursal: "",
      Detalle: "",
      Total: a.total,
      "Método de pago": "",
      Pagado: a.pagado,
      Pendiente: a.pendiente,
      "Último abono": a.ultimoAbonoISO ? formatDate(a.ultimoAbonoISO) : "",
      "Entrega estimada": a.expectedDeliveryISO
        ? formatDate(a.expectedDeliveryISO)
        : "",
      Estado: "Apartado",
    }));

    const combined = [...comprasRows, ...apartadosRows];
    const safeName = customer.name.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
    const dateSuffix = currentFilters.hasDateFilter
      ? `${currentFilters.from}-${currentFilters.to}`
      : "historial";
    downloadCSV(combined, `estado-cuenta-${safeName}-${dateSuffix}`);
  }

  const comprasColumns: TableColumn<CompraRow>[] = [
    {
      key: "folio",
      header: "Folio",
      render: (r) => (
        <Link
          href={`/ventas/${r.id}`}
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            color: "var(--p)",
            whiteSpace: "nowrap",
          }}
        >
          {r.folio}
        </Link>
      ),
    },
    {
      key: "fecha",
      header: "Fecha",
      render: (r) => (
        <span
          style={{ whiteSpace: "nowrap", color: "var(--on-surf-var)" }}
        >
          {formatDate(r.fechaISO)}
        </span>
      ),
    },
    {
      key: "sucursal",
      header: "Sucursal",
      render: (r) => (
        <span style={{ color: "var(--on-surf-var)" }}>{r.sucursal}</span>
      ),
    },
    {
      key: "items",
      header: "Items",
      render: (r) => (
        <span
          style={{
            color:
              r.itemsResumen === "—" || r.itemsResumen === "Mixto"
                ? "var(--on-surf-var)"
                : "var(--on-surf)",
          }}
        >
          {r.itemsResumen}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (r) => (
        <span
          style={{
            fontWeight: 600,
            textDecoration:
              r.status === "CANCELLED" ? "line-through" : "none",
            color:
              r.status === "CANCELLED"
                ? "var(--on-surf-var)"
                : "var(--on-surf)",
          }}
        >
          {formatMXN(r.total)}
        </span>
      ),
    },
    {
      key: "metodo",
      header: "Método",
      render: (r) => (
        <span
          style={{
            color:
              r.status === "CANCELLED"
                ? "var(--on-surf-var)"
                : "var(--on-surf)",
          }}
        >
          {r.metodoPago}
        </span>
      ),
    },
    {
      key: "estado",
      header: "Estado",
      render: (r) => <StatusBadge status={r.status} />,
    },
  ];

  const apartadosColumns: TableColumn<ApartadoRow>[] = [
    {
      key: "folio",
      header: "Folio",
      render: (r) => (
        <Link
          href={`/pedidos/${r.id}`}
          style={{
            fontFamily: "var(--font-body)",
            fontWeight: 500,
            color: "var(--p)",
            whiteSpace: "nowrap",
          }}
        >
          {r.folio}
        </Link>
      ),
    },
    {
      key: "fecha",
      header: "Fecha",
      render: (r) => (
        <span style={{ whiteSpace: "nowrap", color: "var(--on-surf-var)" }}>
          {formatDate(r.fechaISO)}
        </span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (r) => (
        <span style={{ fontWeight: 500 }}>{formatMXN(r.total)}</span>
      ),
    },
    {
      key: "pagado",
      header: "Pagado",
      align: "right",
      render: (r) => (
        <span style={{ color: "var(--on-surf-var)" }}>
          {formatMXN(r.pagado)}
        </span>
      ),
    },
    {
      key: "pendiente",
      header: "Pendiente",
      align: "right",
      render: (r) => (
        <span
          style={{
            fontWeight: 600,
            color:
              r.pendiente > 0 ? "var(--warn)" : "var(--on-surf-var)",
          }}
        >
          {r.pendiente > 0 ? formatMXN(r.pendiente) : "—"}
        </span>
      ),
    },
    {
      key: "ultimoAbono",
      header: "Último abono",
      render: (r) => (
        <span style={{ whiteSpace: "nowrap", color: "var(--on-surf-var)" }}>
          {formatDate(r.ultimoAbonoISO)}
        </span>
      ),
    },
    {
      key: "entrega",
      header: "Entrega estimada",
      render: (r) => (
        <span style={{ whiteSpace: "nowrap", color: "var(--on-surf-var)" }}>
          {formatDate(r.expectedDeliveryISO)}
        </span>
      ),
    },
  ];

  const filtersNode = (
    <div className="flex flex-wrap items-end gap-3">
      <div>
        <label style={LABEL_STYLE}>Desde</label>
        <input
          type="date"
          defaultValue={currentFilters.from}
          style={INPUT_STYLE}
          onChange={(e) => updateParam("from", e.target.value)}
        />
      </div>
      <div>
        <label style={LABEL_STYLE}>Hasta</label>
        <input
          type="date"
          defaultValue={currentFilters.to}
          style={INPUT_STYLE}
          onChange={(e) => updateParam("to", e.target.value)}
        />
      </div>
      {currentFilters.hasDateFilter && (
        <button
          type="button"
          onClick={clearDateFilter}
          style={{
            ...EXPORT_BTN_STYLE,
            background: "transparent",
            color: "var(--on-surf-var)",
          }}
        >
          Limpiar rango
        </button>
      )}
    </div>
  );

  const actions = (
    <button
      type="button"
      style={EXPORT_BTN_STYLE}
      onClick={handleCSV}
      disabled={compras.length === 0 && apartados.length === 0}
    >
      <Download className="h-3.5 w-3.5" />
      Exportar CSV
    </button>
  );

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      <div>
        <Link
          href="/reportes/clientes"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.375rem",
            color: "var(--on-surf-var)",
            fontFamily: "var(--font-body)",
            fontSize: "0.8125rem",
            marginBottom: "1rem",
          }}
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a clientes
        </Link>
      </div>

      <ReportHeader
        title={customer.name}
        subtitle="Estado de cuenta: historial de compras, apartados activos y saldo a favor."
        icon={Wallet}
        filters={filtersNode}
        actions={actions}
      />

      {/* Cabecera del cliente */}
      <section
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4"
        style={{
          background: "var(--surf-lowest)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow)",
          padding: "1.25rem",
        }}
      >
        {/* Contacto */}
        <div>
          <p style={LABEL_STYLE}>Contacto</p>
          <div className="space-y-1">
            <div className="flex items-center gap-1.5">
              <Phone
                className="h-3.5 w-3.5"
                style={{ color: "var(--on-surf-var)" }}
              />
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.875rem",
                  color: customer.phone
                    ? "var(--on-surf)"
                    : "var(--on-surf-var)",
                }}
              >
                {customer.phone ?? "Sin teléfono"}
              </span>
            </div>
            {customer.phone2 && (
              <div className="flex items-center gap-1.5">
                <Phone
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--on-surf-var)" }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.875rem",
                    color: "var(--on-surf-var)",
                  }}
                >
                  {customer.phone2}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Mail
                className="h-3.5 w-3.5"
                style={{ color: "var(--on-surf-var)" }}
              />
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.875rem",
                  color: customer.email
                    ? "var(--on-surf)"
                    : "var(--on-surf-var)",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {customer.email ?? "Sin correo"}
              </span>
            </div>
            {customer.rfc && (
              <div className="flex items-center gap-1.5">
                <FileText
                  className="h-3.5 w-3.5"
                  style={{ color: "var(--on-surf-var)" }}
                />
                <span
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.875rem",
                    color: "var(--on-surf-var)",
                  }}
                >
                  RFC {customer.rfc}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Saldo a favor */}
        <div>
          <p style={LABEL_STYLE}>Saldo a favor</p>
          {customer.saldoAFavor > 0 ? (
            <span
              style={{
                display: "inline-block",
                background: "var(--sec-container)",
                color: "var(--on-sec-container)",
                borderRadius: "var(--r-full)",
                padding: "0.3rem 0.75rem",
                fontSize: "0.875rem",
                fontWeight: 600,
                fontFamily: "var(--font-body)",
              }}
            >
              {formatMXN(customer.saldoAFavor)}
            </span>
          ) : (
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.875rem",
                color: "var(--on-surf-var)",
              }}
            >
              Sin saldo a favor
            </span>
          )}
        </div>

        {/* Compras completadas */}
        <div>
          <p style={LABEL_STYLE}>Compras completadas</p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.25rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--on-surf)",
              lineHeight: 1.1,
            }}
          >
            {formatMXN(comprasSummary.total)}
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              color: "var(--on-surf-var)",
              marginTop: "0.25rem",
            }}
          >
            {comprasSummary.count} compra
            {comprasSummary.count !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Apartados activos */}
        <div>
          <p style={LABEL_STYLE}>Saldo pendiente (apartados)</p>
          <p
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.25rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color:
                apartadosSummary.totalPendiente > 0
                  ? "var(--warn)"
                  : "var(--on-surf)",
              lineHeight: 1.1,
            }}
          >
            {apartadosSummary.totalPendiente > 0
              ? formatMXN(apartadosSummary.totalPendiente)
              : "—"}
          </p>
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              color: "var(--on-surf-var)",
              marginTop: "0.25rem",
            }}
          >
            {apartadosSummary.count} apartado
            {apartadosSummary.count !== 1 ? "s" : ""}
            {apartadosSummary.count > 0 ? " activo" : ""}
            {apartadosSummary.count > 1 ? "s" : ""}
          </p>
        </div>
      </section>

      {/* Sección: Compras */}
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
            <Receipt
              className="h-4 w-4"
              style={{ color: "var(--on-surf-var)" }}
            />
            <h2 style={SECTION_HEADER_STYLE}>Compras</h2>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "var(--on-surf-var)",
                marginLeft: "0.25rem",
              }}
            >
              · {compras.length} registro{compras.length !== 1 ? "s" : ""}
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
          <ReportTable<CompraRow>
            columns={comprasColumns}
            rows={compras}
            keyExtractor={(row) => row.id}
            emptyMessage="Este cliente no tiene compras registradas en el período."
          />
        </div>
      </section>

      {/* Sección: Apartados activos */}
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
            <PackageCheck
              className="h-4 w-4"
              style={{ color: "var(--on-surf-var)" }}
            />
            <h2 style={SECTION_HEADER_STYLE}>Apartados activos</h2>
            <span
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.75rem",
                color: "var(--on-surf-var)",
                marginLeft: "0.25rem",
              }}
            >
              · {apartados.length} apartado{apartados.length !== 1 ? "s" : ""}
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
          <ReportTable<ApartadoRow>
            columns={apartadosColumns}
            rows={apartados}
            keyExtractor={(row) => row.id}
            emptyMessage="Este cliente no tiene apartados activos."
          />
        </div>
      </section>

      {compras.some((c) => c.status === "CANCELLED") && (
        <div
          style={{
            background: "var(--surf-low)",
            borderRadius: "var(--r-md)",
            padding: "0.75rem 1rem",
          }}
        >
          <p
            style={{
              fontFamily: "var(--font-body)",
              fontSize: "0.75rem",
              color: "var(--on-surf-var)",
            }}
          >
            Las ventas canceladas aparecen con monto tachado y no suman en el
            total comprado ni en el saldo a favor del cliente.
          </p>
        </div>
      )}
    </div>
  );
}
