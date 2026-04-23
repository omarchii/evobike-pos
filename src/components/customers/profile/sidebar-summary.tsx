"use client";

// Sidebar sticky del tab Resumen (BRIEF §7.4): Saldo a favor, Crédito,
// Notas pinned. La acción "Recargar saldo" abre el modal rediseñado.

import { ProgressSplit } from "@/components/primitives/progress-split";
import { Icon } from "@/components/primitives/icon";
import { formatMXN, formatRelative } from "@/lib/format";
import { RechargeBalanceDialog } from "./recharge-balance-dialog";
import type { SidebarSummary as SidebarData } from "@/lib/customers/profile-data";

interface Props {
  customerId: string;
  customerName: string;
  data: SidebarData;
}

export function SidebarSummary({
  customerId,
  customerName,
  data,
}: Props): React.JSX.Element {
  const { balance, creditLimit, arPending, pinnedNotes } = data;
  const used = arPending;
  const available = Math.max(0, creditLimit - used);

  return (
    <aside className="flex flex-col gap-3">
      <Card
        title="Saldo a favor"
        icon="cash"
        accent="var(--sec)"
      >
        <p
          className="font-bold tabular-nums leading-none"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: "2rem",
            color: "var(--on-surf)",
          }}
        >
          {formatMXN(balance)}
        </p>
        <p className="text-[0.6875rem]" style={{ color: "var(--on-surf-var)" }}>
          Disponible para ventas y apartados
        </p>
        <RechargeBalanceDialog
          customerId={customerId}
          customerName={customerName}
          currentBalance={balance}
        />
      </Card>

      <Card title="Crédito" icon="commission" accent="var(--p)">
        <div className="grid grid-cols-3 gap-2 text-center">
          <Stat label="Límite" value={formatMXN(creditLimit, { compact: true })} />
          <Stat label="Usado" value={formatMXN(used, { compact: true })} />
          <Stat
            label="Disponible"
            value={formatMXN(available, { compact: true })}
          />
        </div>
        {creditLimit > 0 ? (
          <ProgressSplit
            segments={[
              { label: "Usado", value: used, color: "var(--warn)" },
              {
                label: "Disponible",
                value: available,
                color: "var(--p-bright)",
              },
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
      </Card>

      <Card title="Notas fijadas" icon="bookmark" accent="var(--data-3)">
        {pinnedNotes.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
            Sin notas fijadas.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {pinnedNotes.map((n) => (
              <li
                key={n.id}
                className="rounded-[var(--r-md)] px-3 py-2"
                style={{ background: "var(--surf-low)" }}
              >
                <p
                  className="text-xs leading-relaxed line-clamp-3"
                  style={{ color: "var(--on-surf)" }}
                >
                  {n.body}
                </p>
                <div
                  className="flex items-center gap-2 mt-1 text-[0.625rem]"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  <span>{n.authorName ?? "—"}</span>
                  <span>·</span>
                  <span>{formatRelative(n.createdAt)}</span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </aside>
  );
}

function Card({
  title,
  icon,
  accent,
  children,
}: {
  title: string;
  icon: "cash" | "commission" | "bookmark";
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
