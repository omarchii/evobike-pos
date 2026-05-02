"use client";

import { useState } from "react";
import type { SupplierStatement } from "@/lib/queries/supplier-statement";

interface SupplierProfile {
  id: string;
  nombre: string;
  rfc: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  notas: string | null;
  isActive: boolean;
}

const moneyFmt = new Intl.NumberFormat("es-MX", {
  style: "currency",
  currency: "MXN",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const dateFmt = new Intl.DateTimeFormat("es-MX", {
  day: "2-digit",
  month: "short",
  year: "numeric",
  timeZone: "America/Merida",
});

function formatMoney(n: number): string {
  return moneyFmt.format(n);
}

function formatDateTime(d: Date): string {
  return dateFmt.format(d);
}

function formatYmd(s: string | null): string {
  if (!s) return "—";
  const [y, m, d] = s.split("-");
  if (!y || !m || !d) return s;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return dateFmt.format(date);
}

const ESTADO_PAGO_LABELS: Record<string, { label: string; color: string }> = {
  PAGADA: { label: "Pagada", color: "var(--sec)" },
  PENDIENTE: { label: "Pendiente", color: "#dc2626" },
  CREDITO: { label: "Crédito", color: "#d97706" },
};

const FORMA_PAGO_LABELS: Record<string, string> = {
  CONTADO: "Contado",
  CREDITO: "Crédito",
  TRANSFERENCIA: "Transferencia",
};

type Tab = "datos" | "inventario" | "gastos";

export function SupplierStatementView({
  supplier,
  statement,
  categoryLabels,
  backLink,
}: {
  supplier: SupplierProfile;
  statement: SupplierStatement;
  categoryLabels: Record<string, string>;
  backLink: React.ReactNode;
}) {
  const [tab, setTab] = useState<Tab>("datos");

  const inv = statement.inventory.totals;
  const exp = statement.expenses.totals;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="space-y-1">
        {backLink}
        <div className="flex items-center gap-3 flex-wrap">
          <h1
            className="text-3xl font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {supplier.nombre}
          </h1>
          {!supplier.isActive && (
            <span
              className="inline-block px-2.5 py-1 rounded-full text-xs font-medium"
              style={{
                background: "var(--surf-high)",
                color: "var(--on-surf-var)",
              }}
            >
              Inactivo
            </span>
          )}
        </div>
        <p className="text-sm text-[var(--on-surf-var)]">
          {supplier.rfc ? `RFC ${supplier.rfc}` : "Sin RFC"}
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Kpi label="Recepciones" value={String(inv.count)} />
        <Kpi
          label="Total facturado"
          value={formatMoney(inv.totalFacturado)}
          featured
        />
        <Kpi
          label="Pendiente de pago"
          value={formatMoney(inv.totalPendiente)}
          tone={inv.totalPendiente > 0 ? "warn" : "neutral"}
        />
        <Kpi label="Gastos en caja" value={formatMoney(exp.total)} />
      </div>

      {inv.vencidasCount > 0 && (
        <div
          className="rounded-xl px-4 py-3 text-sm flex items-start gap-3"
          style={{ background: "rgba(220, 38, 38, 0.08)", color: "#dc2626" }}
        >
          <span className="font-semibold">
            {inv.vencidasCount} recepción{inv.vencidasCount === 1 ? "" : "es"} vencida{inv.vencidasCount === 1 ? "" : "s"}
          </span>
          <span className="text-[var(--on-surf-var)]">
            Total vencido: {formatMoney(inv.vencidasTotal)}
          </span>
        </div>
      )}

      <div className="flex items-center gap-1 border-b" style={{ borderColor: "var(--ghost-border-soft)" }}>
        <TabButton active={tab === "datos"} onClick={() => setTab("datos")}>
          Datos
        </TabButton>
        <TabButton
          active={tab === "inventario"}
          onClick={() => setTab("inventario")}
        >
          Inventario ({inv.count})
        </TabButton>
        <TabButton active={tab === "gastos"} onClick={() => setTab("gastos")}>
          Gastos ({exp.count})
        </TabButton>
      </div>

      {tab === "datos" && <DatosTab supplier={supplier} />}

      {tab === "inventario" && (
        <InventarioTab
          rows={statement.inventory.rows}
          proximoVencimiento={inv.proximoVencimiento}
        />
      )}

      {tab === "gastos" && (
        <GastosTab
          rows={statement.expenses.rows}
          porCategoria={exp.porCategoria}
          categoryLabels={categoryLabels}
        />
      )}
    </div>
  );
}

function Kpi({
  label,
  value,
  featured,
  tone,
}: {
  label: string;
  value: string;
  featured?: boolean;
  tone?: "neutral" | "warn";
}) {
  return (
    <div
      className="rounded-xl p-4"
      style={{
        background: featured ? "var(--p-container)" : "var(--surf-lowest)",
        color: featured ? "var(--on-p-container)" : "var(--on-surf)",
        boxShadow: "var(--shadow)",
      }}
    >
      <div
        className="text-[0.6875rem] uppercase tracking-widest font-medium"
        style={{
          color: featured ? "var(--on-p-container)" : "var(--on-surf-var)",
          opacity: featured ? 0.85 : 1,
        }}
      >
        {label}
      </div>
      <div
        className="text-xl font-semibold mt-1 tabular-nums"
        style={{
          fontFamily: "var(--font-display)",
          color: tone === "warn" ? "#dc2626" : undefined,
        }}
      >
        {value}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className="px-4 py-2.5 text-sm font-medium border-b-2 transition-colors"
      style={{
        borderColor: active ? "var(--p)" : "transparent",
        color: active ? "var(--p)" : "var(--on-surf-var)",
      }}
    >
      {children}
    </button>
  );
}

function DatosTab({ supplier }: { supplier: SupplierProfile }) {
  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
    >
      <DataRow label="Nombre" value={supplier.nombre} />
      <DataRow label="RFC" value={supplier.rfc ?? "—"} />
      <DataRow label="Contacto" value={supplier.contacto ?? "—"} />
      <DataRow label="Teléfono" value={supplier.telefono ?? "—"} />
      <DataRow label="Email" value={supplier.email ?? "—"} />
      <DataRow label="Dirección" value={supplier.direccion ?? "—"} />
      <DataRow label="Notas" value={supplier.notas ?? "—"} multiline />
    </div>
  );
}

function DataRow({
  label,
  value,
  multiline,
}: {
  label: string;
  value: string;
  multiline?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-[160px_1fr] gap-2">
      <div
        className="text-xs uppercase tracking-widest font-medium"
        style={{ color: "var(--on-surf-var)" }}
      >
        {label}
      </div>
      <div
        className="text-sm"
        style={{
          color: "var(--on-surf)",
          whiteSpace: multiline ? "pre-wrap" : "normal",
        }}
      >
        {value}
      </div>
    </div>
  );
}

function InventarioTab({
  rows,
  proximoVencimiento,
}: {
  rows: SupplierStatement["inventory"]["rows"];
  proximoVencimiento: string | null;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState message="Este proveedor aún no tiene recepciones de inventario registradas." />
    );
  }

  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
    >
      {proximoVencimiento && (
        <div
          className="px-5 py-3 text-xs"
          style={{
            background: "var(--surf-low)",
            color: "var(--on-surf-var)",
          }}
        >
          Próximo vencimiento pendiente: <strong>{formatYmd(proximoVencimiento)}</strong>
        </div>
      )}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
              <Th>Fecha</Th>
              <Th>Folio</Th>
              <Th>Sucursal</Th>
              <Th>Forma de pago</Th>
              <Th>Estado</Th>
              <Th>Vencimiento</Th>
              <Th align="right">Total</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const estado = ESTADO_PAGO_LABELS[r.estadoPago] ?? {
                label: r.estadoPago,
                color: "var(--on-surf-var)",
              };
              return (
                <tr
                  key={r.id}
                  style={{
                    borderBottom: "1px solid var(--ghost-border-soft)",
                  }}
                >
                  <td className="px-5 py-3 text-[var(--on-surf-var)] tabular-nums">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-[var(--on-surf)]">
                    {r.folioFacturaProveedor ?? (
                      <span style={{ color: "var(--on-surf-var)" }}>—</span>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[var(--on-surf-var)]">
                    {r.branchName}
                  </td>
                  <td className="px-5 py-3 text-[var(--on-surf-var)]">
                    {FORMA_PAGO_LABELS[r.formaPagoProveedor] ?? r.formaPagoProveedor}
                  </td>
                  <td className="px-5 py-3">
                    <span
                      className="inline-block px-2.5 py-0.5 rounded-full text-xs font-medium"
                      style={{
                        background: "var(--surf-high)",
                        color: estado.color,
                      }}
                    >
                      {estado.label}
                    </span>
                  </td>
                  <td className="px-5 py-3 text-[var(--on-surf-var)] tabular-nums">
                    {formatYmd(r.fechaVencimiento)}
                  </td>
                  <td
                    className="px-5 py-3 text-right tabular-nums font-medium"
                    style={{ color: "var(--on-surf)" }}
                  >
                    {formatMoney(r.totalPagado)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function GastosTab({
  rows,
  porCategoria,
  categoryLabels,
}: {
  rows: SupplierStatement["expenses"]["rows"];
  porCategoria: SupplierStatement["expenses"]["totals"]["porCategoria"];
  categoryLabels: Record<string, string>;
}) {
  if (rows.length === 0) {
    return (
      <EmptyState message="Este proveedor aún no tiene gastos registrados en caja." />
    );
  }

  return (
    <div className="space-y-4">
      {porCategoria.length > 0 && (
        <div
          className="rounded-2xl p-5"
          style={{
            background: "var(--surf-lowest)",
            boxShadow: "var(--shadow)",
          }}
        >
          <div
            className="text-xs uppercase tracking-widest font-medium mb-3"
            style={{ color: "var(--on-surf-var)" }}
          >
            Por categoría
          </div>
          <div className="space-y-2">
            {porCategoria.map((c) => (
              <div
                key={c.category}
                className="flex items-center justify-between text-sm"
              >
                <span className="text-[var(--on-surf)]">
                  {categoryLabels[c.category] ?? c.category}
                  <span
                    className="ml-2 text-xs"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    ({c.count})
                  </span>
                </span>
                <span className="tabular-nums font-medium">
                  {formatMoney(c.total)}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                <Th>Fecha</Th>
                <Th>Sucursal</Th>
                <Th>Categoría</Th>
                <Th>Concepto</Th>
                <Th align="right">Monto</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((e) => (
                <tr
                  key={e.id}
                  style={{
                    borderBottom: "1px solid var(--ghost-border-soft)",
                  }}
                >
                  <td className="px-5 py-3 text-[var(--on-surf-var)] tabular-nums">
                    {formatDateTime(e.createdAt)}
                  </td>
                  <td className="px-5 py-3 text-[var(--on-surf-var)]">
                    {e.branchName}
                  </td>
                  <td className="px-5 py-3 text-[var(--on-surf)]">
                    {e.expenseCategory
                      ? categoryLabels[e.expenseCategory] ?? e.expenseCategory
                      : "—"}
                  </td>
                  <td className="px-5 py-3 text-[var(--on-surf-var)] truncate max-w-md">
                    {e.notes ?? "—"}
                  </td>
                  <td
                    className="px-5 py-3 text-right tabular-nums font-medium"
                    style={{ color: "var(--on-surf)" }}
                  >
                    {formatMoney(e.amount)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div
      className="rounded-2xl p-10 text-center text-sm"
      style={{
        background: "var(--surf-lowest)",
        color: "var(--on-surf-var)",
        boxShadow: "var(--shadow)",
      }}
    >
      {message}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-5 py-3 text-xs font-medium uppercase tracking-widest"
      style={{
        color: "var(--on-surf-var)",
        textAlign: align,
      }}
    >
      {children}
    </th>
  );
}
