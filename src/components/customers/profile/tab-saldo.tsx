"use client";

// Tab "Saldo a favor" del perfil de cliente — Pack D.4.a.
// Lecturas: SELLER+. Ajuste: MANAGER+ via dialog.
//
// 3 secciones:
//   1. Total + breakdown FIFO (créditos activos con vencimiento)
//   2. Histórico vencidos (saldo perdido — audit)
//   3. Histórico consumos (CreditConsumption ↔ Sale)

import Link from "next/link";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { formatDate, formatMXN } from "@/lib/format";
import type {
  ActiveCreditRow,
  ConsumptionRow,
  ExpiredCreditRow,
  SaldoData,
} from "@/lib/customers/profile-saldo-data";
import type { OrigenCredito } from "@prisma/client";
import { AdjustSaldoDialog } from "./adjust-saldo-dialog";

interface Props {
  customerId: string;
  customerName: string;
  data: SaldoData;
  isManagerPlus: boolean;
}

const ORIGEN_LABELS: Record<OrigenCredito, string> = {
  CANCELACION: "Cancelación de venta",
  APARTADO_CANCELADO: "Apartado cancelado",
  DEVOLUCION: "Devolución",
  AJUSTE_MANAGER: "Ajuste MANAGER",
  MIGRACION_INICIAL: "Migración inicial",
};

export function TabSaldo({
  customerId,
  customerName,
  data,
  isManagerPlus,
}: Props): React.JSX.Element {
  const { total, active, expired, consumptions, legacyBalance } = data;

  const hasDrift = Math.abs(total - legacyBalance) > 0.01;

  return (
    <div className="flex flex-col gap-5">
      <header
        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-lg)] px-4 py-4"
        style={{ background: "var(--surf-low)" }}
      >
        <div className="flex flex-col gap-1">
          <span
            className="text-[0.625rem] uppercase tracking-[0.05em] font-medium"
            style={{ color: "var(--on-surf-var)" }}
          >
            Saldo a favor activo
          </span>
          <span
            className="font-bold tabular-nums leading-none"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2.25rem",
              color: total > 0 ? "var(--sec)" : "var(--on-surf-var)",
            }}
          >
            {formatMXN(total)}
          </span>
          <span
            className="text-[0.6875rem]"
            style={{ color: "var(--on-surf-var)" }}
          >
            {active.length} crédito{active.length === 1 ? "" : "s"} activo{active.length === 1 ? "" : "s"} · FIFO por vencimiento
          </span>
        </div>
        {isManagerPlus && (
          <div className="w-full sm:w-auto sm:min-w-[14rem]">
            <AdjustSaldoDialog
              customerId={customerId}
              customerName={customerName}
              currentTotal={total}
            />
          </div>
        )}
      </header>

      {hasDrift && isManagerPlus && (
        <div
          className="flex items-start gap-2 rounded-[var(--r-md)] px-3 py-2 text-xs"
          style={{
            background: "color-mix(in srgb, var(--warn) 12%, transparent)",
            color: "var(--warn)",
          }}
        >
          <Icon name="alert" size={14} />
          <span>
            Drift detectado entre <code>CustomerCredit</code> ({formatMXN(total)}) y{" "}
            <code>Customer.balance</code> legacy ({formatMXN(legacyBalance)}). Esperado durante
            transición Pack D — debe converger a $0 post D.5 sweep.
          </span>
        </div>
      )}

      <ActiveCreditsSection rows={active} />
      <ExpiredCreditsSection rows={expired} />
      <ConsumptionsSection rows={consumptions} />
    </div>
  );
}

function ActiveCreditsSection({ rows }: { rows: ActiveCreditRow[] }): React.JSX.Element {
  return (
    <section
      className="rounded-[var(--r-lg)] p-4 flex flex-col gap-3"
      style={{ background: "var(--surf-lowest)" }}
    >
      <header>
        <h2
          className="text-sm font-semibold tracking-[-0.01em]"
          style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}
        >
          Créditos activos (FIFO)
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
          Se consumen por orden de vencimiento (más próximo primero).
        </p>
      </header>

      {rows.length === 0 ? (
        <p
          className="text-sm py-6 text-center"
          style={{ color: "var(--on-surf-var)" }}
        >
          Sin créditos activos.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((c, idx) => (
            <ActiveCreditCard key={c.id} row={c} index={idx + 1} />
          ))}
        </ul>
      )}
    </section>
  );
}

function ActiveCreditCard({
  row,
  index,
}: {
  row: ActiveCreditRow;
  index: number;
}): React.JSX.Element {
  const now = Date.now();
  const expiresMs = row.expiresAt.getTime();
  const daysToExpire = Math.ceil((expiresMs - now) / (24 * 60 * 60 * 1000));
  const expiringSoon = daysToExpire <= 30;

  return (
    <li
      className="rounded-[var(--r-md)] p-3 flex flex-col gap-2"
      style={{ background: "var(--surf-low)" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span
            className="text-[0.6875rem] font-semibold tabular-nums px-1.5 py-0.5"
            style={{
              borderRadius: "var(--r-full)",
              background: "var(--surf-high)",
              color: "var(--on-surf-var)",
              minWidth: "1.5rem",
              textAlign: "center",
            }}
          >
            #{index}
          </span>
          <span className="text-xs font-medium" style={{ color: "var(--on-surf)" }}>
            {ORIGEN_LABELS[row.origenTipo]}
          </span>
          {row.isMigracionInicial && (
            <Chip variant="warn" label="CLIENT-PENDING-G2" />
          )}
        </div>
        <span
          className="font-bold tabular-nums"
          style={{
            color: "var(--sec)",
            fontFamily: "var(--font-display)",
            fontSize: "1.125rem",
          }}
        >
          {formatMXN(row.balance)}
          {row.balance < row.monto && (
            <span
              className="text-[0.6875rem] ml-1"
              style={{ color: "var(--on-surf-var)" }}
            >
              / {formatMXN(row.monto)}
            </span>
          )}
        </span>
      </div>

      <div
        className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[0.6875rem]"
        style={{ color: "var(--on-surf-var)" }}
      >
        <span>
          <Icon name="calendar" size={11} /> Acreditado{" "}
          {formatDate(row.createdAt)}
        </span>
        <span style={{ color: expiringSoon ? "var(--warn)" : "var(--on-surf-var)" }}>
          <Icon name="clock" size={11} /> Vence {formatDate(row.expiresAt)}
          {daysToExpire > 0 && ` (en ${daysToExpire}d)`}
          {daysToExpire <= 0 && " (vencido — pendiente cron)"}
        </span>
        {row.alertSentAt && (
          <span>
            <Icon name="bell" size={11} /> Alerta 90d enviada{" "}
            {formatDate(row.alertSentAt)}
          </span>
        )}
      </div>

      {row.notes && (
        <p
          className="text-xs italic px-2 py-1.5 rounded-[var(--r-sm)]"
          style={{
            background: "var(--surf-lowest)",
            color: "var(--on-surf-var)",
          }}
        >
          {row.notes}
        </p>
      )}
    </li>
  );
}

function ExpiredCreditsSection({ rows }: { rows: ExpiredCreditRow[] }): React.JSX.Element {
  if (rows.length === 0) return <></>;

  const totalLost = rows.reduce((s, r) => s + r.balanceLost, 0);

  return (
    <section
      className="rounded-[var(--r-lg)] p-4 flex flex-col gap-3"
      style={{ background: "var(--surf-lowest)" }}
    >
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2
            className="text-sm font-semibold tracking-[-0.01em]"
            style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}
          >
            Vencidos — saldo perdido
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
            Auditoría de créditos expirados.
          </p>
        </div>
        {totalLost > 0 && (
          <span
            className="text-xs font-semibold tabular-nums"
            style={{ color: "var(--warn)" }}
          >
            Perdido: {formatMXN(totalLost)}
          </span>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs" style={{ color: "var(--on-surf)" }}>
          <thead>
            <tr style={{ color: "var(--on-surf-var)" }}>
              <Th>Acreditado</Th>
              <Th>Origen</Th>
              <Th>Venció</Th>
              <Th align="right">Monto</Th>
              <Th align="right">Saldo perdido</Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} style={{ borderTop: "1px solid var(--surf-low)" }}>
                <Td>{formatDate(r.createdAt)}</Td>
                <Td>{ORIGEN_LABELS[r.origenTipo]}</Td>
                <Td>{formatDate(r.expiredAt)}</Td>
                <Td align="right" className="tabular-nums">
                  {formatMXN(r.monto)}
                </Td>
                <Td align="right" className="tabular-nums">
                  <span style={{ color: r.balanceLost > 0 ? "var(--warn)" : "var(--on-surf-var)" }}>
                    {formatMXN(r.balanceLost)}
                  </span>
                </Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ConsumptionsSection({ rows }: { rows: ConsumptionRow[] }): React.JSX.Element {
  return (
    <section
      className="rounded-[var(--r-lg)] p-4 flex flex-col gap-3"
      style={{ background: "var(--surf-lowest)" }}
    >
      <header>
        <h2
          className="text-sm font-semibold tracking-[-0.01em]"
          style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}
        >
          Consumos
        </h2>
        <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
          Aplicaciones de saldo a ventas. Negativos = re-acreditaciones (cancel/return).
        </p>
      </header>

      {rows.length === 0 ? (
        <p
          className="text-sm py-6 text-center"
          style={{ color: "var(--on-surf-var)" }}
        >
          Sin consumos registrados.
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs" style={{ color: "var(--on-surf)" }}>
            <thead>
              <tr style={{ color: "var(--on-surf-var)" }}>
                <Th>Fecha</Th>
                <Th>Venta</Th>
                <Th>Tipo CashTx</Th>
                <Th align="right">Monto</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} style={{ borderTop: "1px solid var(--surf-low)" }}>
                  <Td>{formatDate(r.createdAt)}</Td>
                  <Td>
                    {r.saleId && r.saleFolio ? (
                      <Link href={`/ventas/${r.saleId}`} style={{ color: "var(--p)" }}>
                        {r.saleFolio}
                      </Link>
                    ) : (
                      <span style={{ color: "var(--on-surf-var)" }}>—</span>
                    )}
                  </Td>
                  <Td>
                    <span style={{ color: "var(--on-surf-var)" }}>
                      {r.cashTransactionType}
                    </span>
                  </Td>
                  <Td align="right" className="tabular-nums">
                    <span
                      style={{ color: r.amount >= 0 ? "var(--warn)" : "var(--sec)" }}
                    >
                      {r.amount >= 0 ? "−" : "+"}
                      {formatMXN(Math.abs(r.amount))}
                    </span>
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function Th({
  children,
  align,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}): React.JSX.Element {
  return (
    <th
      className="py-2 px-2 text-[0.625rem] uppercase tracking-[0.05em] font-medium"
      style={{ textAlign: align ?? "left" }}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align,
  className,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}): React.JSX.Element {
  return (
    <td
      className={`py-2 px-2 whitespace-nowrap${className ? ` ${className}` : ""}`}
      style={{ textAlign: align ?? "left" }}
    >
      {children}
    </td>
  );
}
