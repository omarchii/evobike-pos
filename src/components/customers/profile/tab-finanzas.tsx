"use client";

// Tab Finanzas del perfil (BRIEF §7.4 — Sub-fase H). MANAGER+ only.
// Panel izquierdo: Saldo por cobrar, Crédito, Saldo a favor.
// Panel derecho: Movimientos (toggle Abonos/Cargos/Todos) + Pagos parciales.

import { useMemo, useState } from "react";
import Link from "next/link";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { ProgressSplit } from "@/components/primitives/progress-split";
import { formatDate, formatMXN } from "@/lib/format";
import { RechargeBalanceDialog } from "./recharge-balance-dialog";
import { EditCreditLimitDialog } from "./edit-credit-limit-dialog";
import { methodLabel, type FinanzasData, type MovementRow } from "@/lib/customers/profile-finanzas-data";

interface Props {
  customerId: string;
  customerName: string;
  data: FinanzasData;
}

type MovementFilter = "ALL" | "PAYMENT" | "CHARGE";

export function TabFinanzas({
  customerId,
  customerName,
  data,
}: Props): React.JSX.Element {
  const [filter, setFilter] = useState<MovementFilter>("ALL");

  const { balance, creditLimit, arPending, arOverdueDays, layaways, movements } = data;
  const creditAvailable = Math.max(0, creditLimit - arPending);

  const filteredMovements = useMemo(
    () => movements.filter((m) => filter === "ALL" || m.type === filter),
    [movements, filter],
  );

  const today = new Date();

  return (
    <div className="flex flex-col gap-5">
      <header
        className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--r-lg)] px-4 py-3"
        style={{ background: "var(--surf-low)" }}
      >
        <div
          className="flex items-center gap-3 text-xs"
          style={{ color: "var(--on-surf-var)" }}
        >
          <span>
            Corte al{" "}
            <strong style={{ color: "var(--on-surf)" }}>
              {formatDate(today, "medium")}
            </strong>
          </span>
          <span>·</span>
          <span>Moneda MXN</span>
        </div>
        <button
          disabled
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-[var(--r-full)] text-xs font-semibold opacity-60 cursor-not-allowed"
          style={{
            background: "var(--surf-high)",
            color: "var(--on-surf-var)",
            fontFamily: "var(--font-display)",
          }}
          title="PDF de estado de cuenta — llega en Sub-fase K"
        >
          <Icon name="download" size={13} />
          Estado de cuenta PDF
        </button>
      </header>

      <div className="grid grid-cols-3 gap-5 max-[1100px]:grid-cols-1">
        <aside className="col-span-1 flex flex-col gap-3">
          <Card
            title="Saldo por cobrar"
            icon="cash"
            accent={arPending > 0 ? "var(--warn)" : "var(--on-surf-var)"}
          >
            <p
              className="font-bold tabular-nums leading-none"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2rem",
                color: arPending > 0 ? "var(--warn)" : "var(--on-surf)",
              }}
            >
              {formatMXN(arPending)}
            </p>
            {arOverdueDays != null && arOverdueDays > 0 ? (
              <Chip variant="warn" label={`Vencido por ${arOverdueDays} día${arOverdueDays === 1 ? "" : "s"}`} />
            ) : (
              <p
                className="text-[0.6875rem]"
                style={{ color: "var(--on-surf-var)" }}
              >
                {arPending > 0
                  ? "Apartados sin pagar completamente"
                  : "Sin apartados pendientes"}
              </p>
            )}
          </Card>

          <Card title="Crédito" icon="commission" accent="var(--p)">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat label="Límite" value={formatMXN(creditLimit, { compact: true })} />
              <Stat label="Usado" value={formatMXN(arPending, { compact: true })} />
              <Stat label="Disponible" value={formatMXN(creditAvailable, { compact: true })} />
            </div>
            {creditLimit > 0 ? (
              <ProgressSplit
                segments={[
                  { label: "Usado", value: arPending, color: "var(--warn)" },
                  { label: "Disponible", value: creditAvailable, color: "var(--p-bright)" },
                ]}
                height={6}
              />
            ) : (
              <p
                className="text-[0.6875rem] text-center"
                style={{ color: "var(--on-surf-var)" }}
              >
                Sin límite de crédito autorizado.
              </p>
            )}
            <EditCreditLimitDialog
              customerId={customerId}
              currentLimit={creditLimit}
            />
          </Card>

          <Card title="Saldo a favor" icon="cash" accent="var(--sec)">
            <p
              className="font-bold tabular-nums leading-none"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
                color: "var(--on-surf)",
              }}
            >
              {formatMXN(balance)}
            </p>
            <p
              className="text-[0.6875rem]"
              style={{ color: "var(--on-surf-var)" }}
            >
              Disponible para ventas y apartados
            </p>
            <RechargeBalanceDialog
              customerId={customerId}
              customerName={customerName}
              currentBalance={balance}
            />
          </Card>
        </aside>

        <div className="col-span-2 flex flex-col gap-5 min-w-0">
          <section
            className="rounded-[var(--r-lg)] p-4 flex flex-col gap-3"
            style={{ background: "var(--surf-lowest)" }}
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <h2
                className="text-sm font-semibold tracking-[-0.01em]"
                style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}
              >
                Movimientos
              </h2>
              <div
                className="flex items-center gap-1 p-1 rounded-[var(--r-md)]"
                style={{ background: "var(--surf-low)" }}
              >
                {(
                  [
                    { key: "PAYMENT", label: "Abonos" },
                    { key: "CHARGE", label: "Cargos" },
                    { key: "ALL", label: "Todos" },
                  ] as const
                ).map((f) => {
                  const active = filter === f.key;
                  return (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className="px-3 py-1 text-xs font-medium"
                      style={{
                        borderRadius: "var(--r-sm)",
                        background: active ? "var(--surf-bright)" : "transparent",
                        color: active ? "var(--on-surf)" : "var(--on-surf-var)",
                        fontWeight: active ? 600 : 500,
                      }}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>
            </header>

            <MovementsTable movements={filteredMovements} />
          </section>

          {layaways.length > 0 && (
            <section
              className="rounded-[var(--r-lg)] p-4 flex flex-col gap-3"
              style={{ background: "var(--surf-lowest)" }}
            >
              <header>
                <h2
                  className="text-sm font-semibold tracking-[-0.01em]"
                  style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}
                >
                  Pagos parciales — apartados
                </h2>
                <p
                  className="text-xs mt-0.5"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  Desglose de abonos por apartado activo.
                </p>
              </header>
              <ul className="flex flex-col gap-3">
                {layaways.map((l) => {
                  const progressPct = l.total > 0 ? Math.min(1, l.paid / l.total) : 0;
                  return (
                    <li
                      key={l.id}
                      className="rounded-[var(--r-md)] p-3 flex flex-col gap-2"
                      style={{ background: "var(--surf-low)" }}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <Link
                            href={`/ventas/${l.id}`}
                            className="text-sm font-semibold"
                            style={{ color: "var(--p)", fontFamily: "var(--font-display)" }}
                          >
                            {l.folio}
                          </Link>
                          <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                            · {l.branchName}
                          </span>
                          <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                            · {formatDate(l.createdAt)}
                          </span>
                        </div>
                        <span
                          className="text-xs font-semibold tabular-nums"
                          style={{ color: "var(--on-surf)" }}
                        >
                          {formatMXN(l.paid)}{" "}
                          <span style={{ color: "var(--on-surf-var)" }}>
                            / {formatMXN(l.total)}
                          </span>
                        </span>
                      </div>
                      <ProgressSplit
                        segments={[
                          { label: "Pagado", value: l.paid, color: "var(--sec)" },
                          { label: "Pendiente", value: l.outstanding, color: "var(--warn)" },
                        ]}
                        height={6}
                      />
                      <div className="flex items-center justify-between text-[0.6875rem]">
                        <span style={{ color: "var(--on-surf-var)" }}>
                          {Math.round(progressPct * 100)}% pagado
                        </span>
                        {l.outstanding > 0 && (
                          <span
                            className="font-semibold tabular-nums"
                            style={{ color: "var(--warn)" }}
                          >
                            Pendiente {formatMXN(l.outstanding)}
                          </span>
                        )}
                      </div>
                      {l.payments.length > 0 && (
                        <details className="mt-1">
                          <summary
                            className="cursor-pointer text-[0.6875rem] font-medium"
                            style={{ color: "var(--on-surf-var)" }}
                          >
                            {l.payments.length} abono{l.payments.length === 1 ? "" : "s"}
                          </summary>
                          <ul className="mt-2 flex flex-col gap-1.5">
                            {l.payments.map((p) => (
                              <li
                                key={p.id}
                                className="flex items-center justify-between gap-2 text-xs"
                              >
                                <span style={{ color: "var(--on-surf-var)" }}>
                                  {formatDate(p.createdAt)} · {methodLabel(p.method)}
                                  {p.reference ? ` · ${p.reference}` : ""}
                                </span>
                                <span
                                  className="font-semibold tabular-nums"
                                  style={{ color: "var(--on-surf)" }}
                                >
                                  {formatMXN(p.amount)}
                                </span>
                              </li>
                            ))}
                          </ul>
                        </details>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

function MovementsTable({ movements }: { movements: MovementRow[] }): React.JSX.Element {
  if (movements.length === 0) {
    return (
      <p
        className="text-sm py-8 text-center"
        style={{ color: "var(--on-surf-var)" }}
      >
        Sin movimientos registrados.
      </p>
    );
  }

  // Saldo acumulado: recorremos desde el más antiguo.
  const reversed = [...movements].reverse();
  const withBalance: Array<MovementRow & { runningBalance: number }> = [];
  let running = 0;
  for (const m of reversed) {
    running += m.type === "PAYMENT" ? m.amount : -m.amount;
    withBalance.push({ ...m, runningBalance: running });
  }
  const ordered = withBalance.reverse();

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ color: "var(--on-surf)" }}>
        <thead>
          <tr style={{ color: "var(--on-surf-var)" }}>
            <Th>Fecha</Th>
            <Th>Descripción</Th>
            <Th>Folio</Th>
            <Th>Método</Th>
            <Th align="right">Abono</Th>
            <Th align="right">Cargo</Th>
            <Th align="right">Acumulado</Th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((m) => (
            <tr
              key={m.id}
              style={{ borderTop: "1px solid var(--surf-low)" }}
            >
              <Td>{formatDate(m.createdAt)}</Td>
              <Td>
                <span className="inline-flex items-center gap-1.5">
                  <Icon
                    name={m.type === "PAYMENT" ? "arrowDown" : "arrowUp"}
                    size={11}
                  />
                  {m.description}
                </span>
              </Td>
              <Td>
                {m.folioHref ? (
                  <Link href={m.folioHref} style={{ color: "var(--p)" }}>
                    {m.folio}
                  </Link>
                ) : (
                  <span style={{ color: "var(--on-surf-var)" }}>—</span>
                )}
              </Td>
              <Td>
                <span style={{ color: "var(--on-surf-var)" }}>
                  {methodLabel(m.method)}
                </span>
              </Td>
              <Td align="right">
                {m.type === "PAYMENT" ? (
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: "var(--sec)" }}
                  >
                    {formatMXN(m.amount)}
                  </span>
                ) : (
                  <span style={{ color: "var(--on-surf-var)" }}>—</span>
                )}
              </Td>
              <Td align="right">
                {m.type === "CHARGE" ? (
                  <span
                    className="font-semibold tabular-nums"
                    style={{ color: "var(--warn)" }}
                  >
                    {formatMXN(m.amount)}
                  </span>
                ) : (
                  <span style={{ color: "var(--on-surf-var)" }}>—</span>
                )}
              </Td>
              <Td align="right">
                <span
                  className="font-semibold tabular-nums"
                  style={{
                    color: m.runningBalance >= 0 ? "var(--on-surf)" : "var(--warn)",
                  }}
                >
                  {formatMXN(m.runningBalance)}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
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
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}): React.JSX.Element {
  return (
    <td
      className="py-2 px-2 whitespace-nowrap"
      style={{ textAlign: align ?? "left" }}
    >
      {children}
    </td>
  );
}

function Card({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon: "cash" | "commission";
  accent: string;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section
      className="rounded-[var(--r-lg)] p-4 flex flex-col gap-3"
      style={{ background: "var(--surf-lowest)" }}
    >
      <header className="flex items-center justify-between">
        <p
          className="text-[0.625rem] uppercase tracking-[0.05em] font-medium"
          style={{ color: "var(--on-surf-var)" }}
        >
          {title}
        </p>
        <span style={{ color: accent }}>
          <Icon name={icon} size={14} />
        </span>
      </header>
      {children}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <span
        className="text-[0.5625rem] uppercase tracking-[0.04em]"
        style={{ color: "var(--on-surf-var)" }}
      >
        {label}
      </span>
      <span
        className="text-xs font-semibold tabular-nums"
        style={{ color: "var(--on-surf)" }}
      >
        {value}
      </span>
    </div>
  );
}
