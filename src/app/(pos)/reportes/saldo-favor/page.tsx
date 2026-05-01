// Reporte global "Saldo a favor" — Pack D.4.b.
// MANAGER+ only. Read-only. 3 secciones con query params:
//   ?venceEn=N        — créditos activos que vencen en <= N días
//   ?sinUsoMasDe=N    — créditos sin uso (createdAt < now - N días) y aún activos
//   ?vencidoMes=YYYY-MM — saldo perdido del mes (CC.expiredAt en el mes)
//   ?branch=<id>      — filtra por customer activo en sucursal (ADMIN only)
//
// Sin params → muestra "próximos vencimientos" + "sin uso" defaults
// (SALDO_VENCIMIENTO_PROXIMO_DEFAULT_DAYS / SALDO_SIN_USO_DEFAULT_DAYS).

import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate, formatMXN } from "@/lib/format";
import {
  SALDO_FILTER_MAX_DAYS,
  SALDO_REPORT_SECTION_LIMIT,
  SALDO_SIN_USO_DEFAULT_DAYS,
  SALDO_VENCIMIENTO_PROXIMO_DEFAULT_DAYS,
} from "@/lib/config/saldo";
import type { OrigenCredito } from "@prisma/client";

export const dynamic = "force-dynamic";

interface SearchParams {
  venceEn?: string;
  sinUsoMasDe?: string;
  vencidoMes?: string;
  branch?: string;
}

const ORIGEN_LABELS: Record<OrigenCredito, string> = {
  CANCELACION: "Cancelación",
  APARTADO_CANCELADO: "Apartado cancelado",
  DEVOLUCION: "Devolución",
  AJUSTE_MANAGER: "Ajuste MANAGER",
  RECARGA_CLIENTE: "Recarga cliente",
  MIGRACION_INICIAL: "Migración inicial",
};

function parseDays(raw: string | undefined, fallback: number): number {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  return Math.min(n, SALDO_FILTER_MAX_DAYS);
}

function parseYearMonth(raw: string | undefined): { from: Date; to: Date } | null {
  if (!raw) return null;
  const m = /^(\d{4})-(\d{2})$/.exec(raw);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  if (month < 1 || month > 12) return null;
  const from = new Date(year, month - 1, 1);
  const to = new Date(year, month, 1);
  return { from, to };
}

interface RowProx {
  id: string;
  customerId: string;
  customerName: string;
  balance: number;
  monto: number;
  expiresAt: Date;
  daysToExpire: number;
  origenTipo: OrigenCredito;
  isMigracionInicial: boolean;
}

interface RowSinUso {
  id: string;
  customerId: string;
  customerName: string;
  balance: number;
  createdAt: Date;
  daysSinceCreated: number;
  origenTipo: OrigenCredito;
  alertSentAt: Date | null;
}

interface RowVencido {
  id: string;
  customerId: string;
  customerName: string;
  balanceLost: number;
  expiredAt: Date;
  origenTipo: OrigenCredito;
}

export default async function SaldoFavorReportPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");
  const role = session.user.role;
  if (role !== "MANAGER" && role !== "ADMIN") redirect("/reportes");
  const isAdmin = role === "ADMIN";

  const params = await searchParams;
  const venceEnDays = parseDays(params.venceEn, SALDO_VENCIMIENTO_PROXIMO_DEFAULT_DAYS);
  const sinUsoDays = parseDays(params.sinUsoMasDe, SALDO_SIN_USO_DEFAULT_DAYS);
  const vencidoRange = parseYearMonth(params.vencidoMes);
  const filterBranchId = isAdmin ? (params.branch ?? "").trim() : "";

  const now = new Date();
  const venceCutoff = new Date(now.getTime() + venceEnDays * 24 * 60 * 60 * 1000);
  const sinUsoCutoff = new Date(now.getTime() - sinUsoDays * 24 * 60 * 60 * 1000);

  // ── Branch scope: customers con Sale en la sucursal filtrada (ADMIN). ──────
  let customerIdScope: string[] | null = null;
  if (filterBranchId) {
    const ids = await prisma.sale.findMany({
      where: { branchId: filterBranchId, customerId: { not: null } },
      select: { customerId: true },
      distinct: ["customerId"],
    });
    customerIdScope = ids
      .map((s) => s.customerId)
      .filter((id): id is string => id != null);
  }

  const customerScopeFilter = customerIdScope ? { customerId: { in: customerIdScope } } : {};

  // ── 1. Próximos vencimientos ───────────────────────────────────────────────
  const proxRaw = await prisma.customerCredit.findMany({
    where: {
      expiredAt: null,
      balance: { gt: 0 },
      expiresAt: { lte: venceCutoff },
      ...customerScopeFilter,
    },
    orderBy: { expiresAt: "asc" },
    take: SALDO_REPORT_SECTION_LIMIT,
    select: {
      id: true,
      monto: true,
      balance: true,
      origenTipo: true,
      expiresAt: true,
      customerId: true,
      customer: { select: { name: true } },
    },
  });
  const proxRows: RowProx[] = proxRaw.map((c) => ({
    id: c.id,
    customerId: c.customerId,
    customerName: c.customer.name,
    balance: Number(c.balance),
    monto: Number(c.monto),
    expiresAt: c.expiresAt,
    daysToExpire: Math.ceil((c.expiresAt.getTime() - now.getTime()) / (24 * 60 * 60 * 1000)),
    origenTipo: c.origenTipo,
    isMigracionInicial: c.origenTipo === "MIGRACION_INICIAL",
  }));
  const proxTotal = proxRows.reduce((s, r) => s + r.balance, 0);

  // ── 2. Sin uso > N días ────────────────────────────────────────────────────
  const sinUsoRaw = await prisma.customerCredit.findMany({
    where: {
      expiredAt: null,
      balance: { gt: 0 },
      createdAt: { lt: sinUsoCutoff },
      ...customerScopeFilter,
    },
    orderBy: { createdAt: "asc" },
    take: SALDO_REPORT_SECTION_LIMIT,
    select: {
      id: true,
      balance: true,
      origenTipo: true,
      createdAt: true,
      alertSentAt: true,
      customerId: true,
      customer: { select: { name: true } },
    },
  });
  const sinUsoRows: RowSinUso[] = sinUsoRaw.map((c) => ({
    id: c.id,
    customerId: c.customerId,
    customerName: c.customer.name,
    balance: Number(c.balance),
    createdAt: c.createdAt,
    daysSinceCreated: Math.floor(
      (now.getTime() - c.createdAt.getTime()) / (24 * 60 * 60 * 1000),
    ),
    origenTipo: c.origenTipo,
    alertSentAt: c.alertSentAt,
  }));
  const sinUsoTotal = sinUsoRows.reduce((s, r) => s + r.balance, 0);

  // ── 3. Saldo perdido del mes ──────────────────────────────────────────────
  const vencidoRows: RowVencido[] = vencidoRange
    ? await prisma.customerCredit
        .findMany({
          where: {
            expiredAt: { gte: vencidoRange.from, lt: vencidoRange.to },
            balance: { gt: 0 },
            ...customerScopeFilter,
          },
          orderBy: { expiredAt: "desc" },
          take: SALDO_REPORT_SECTION_LIMIT,
          select: {
            id: true,
            balance: true,
            origenTipo: true,
            expiredAt: true,
            customerId: true,
            customer: { select: { name: true } },
          },
        })
        .then((rows) =>
          rows.map((c) => ({
            id: c.id,
            customerId: c.customerId,
            customerName: c.customer.name,
            balanceLost: Number(c.balance),
            expiredAt: c.expiredAt!,
            origenTipo: c.origenTipo,
          })),
        )
    : [];
  const vencidoTotal = vencidoRows.reduce((s, r) => s + r.balanceLost, 0);

  // ── Branches para selector ADMIN ──────────────────────────────────────────
  const branches = isAdmin
    ? await prisma.branch.findMany({
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      })
    : [];

  return (
    <div className="space-y-6 p-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Saldo a favor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Reporte global de créditos activos y vencidos. Drill-down al perfil por cliente.
        </p>
      </header>

      <FilterForm
        venceEnDays={venceEnDays}
        sinUsoDays={sinUsoDays}
        vencidoMesRaw={params.vencidoMes ?? ""}
        filterBranchId={filterBranchId}
        branches={branches}
        isAdmin={isAdmin}
      />

      <Section
        title="Próximos vencimientos"
        subtitle={`Créditos activos que vencen en ${venceEnDays} día${venceEnDays === 1 ? "" : "s"} o menos.`}
        total={proxTotal}
        count={proxRows.length}
      >
        {proxRows.length === 0 ? (
          <Empty>Sin créditos próximos a vencer.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <Th>Cliente</Th>
                  <Th>Origen</Th>
                  <Th>Saldo</Th>
                  <Th>Vence</Th>
                  <Th>Días</Th>
                </tr>
              </thead>
              <tbody>
                {proxRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <Td>
                      <Link
                        href={`/customers/${r.customerId}?tab=saldo`}
                        className="text-[var(--p)] hover:underline"
                      >
                        {r.customerName}
                      </Link>
                      {r.isMigracionInicial && (
                        <span
                          className="ml-2 inline-block px-1.5 py-0.5 text-[0.5625rem] uppercase tracking-[0.04em] font-medium rounded-[var(--r-full)]"
                          style={{
                            background: "var(--warn-container)",
                            color: "var(--on-surf)",
                          }}
                        >
                          CLIENT-PENDING-G2
                        </span>
                      )}
                    </Td>
                    <Td>{ORIGEN_LABELS[r.origenTipo]}</Td>
                    <Td className="tabular-nums font-semibold">{formatMXN(r.balance)}</Td>
                    <Td>{formatDate(r.expiresAt)}</Td>
                    <Td className="tabular-nums">
                      {r.daysToExpire <= 0 ? (
                        <span className="text-[var(--warn)]">vencido</span>
                      ) : (
                        `${r.daysToExpire}d`
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      <Section
        title="Sin uso"
        subtitle={`Créditos activos creados hace más de ${sinUsoDays} día${sinUsoDays === 1 ? "" : "s"}.`}
        total={sinUsoTotal}
        count={sinUsoRows.length}
      >
        {sinUsoRows.length === 0 ? (
          <Empty>Sin créditos en este rango.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left">
                <tr>
                  <Th>Cliente</Th>
                  <Th>Origen</Th>
                  <Th>Saldo</Th>
                  <Th>Acreditado</Th>
                  <Th>Antigüedad</Th>
                  <Th>Alerta 90d</Th>
                </tr>
              </thead>
              <tbody>
                {sinUsoRows.map((r) => (
                  <tr key={r.id} className="border-t">
                    <Td>
                      <Link
                        href={`/customers/${r.customerId}?tab=saldo`}
                        className="text-[var(--p)] hover:underline"
                      >
                        {r.customerName}
                      </Link>
                    </Td>
                    <Td>{ORIGEN_LABELS[r.origenTipo]}</Td>
                    <Td className="tabular-nums font-semibold">{formatMXN(r.balance)}</Td>
                    <Td>{formatDate(r.createdAt)}</Td>
                    <Td className="tabular-nums">{r.daysSinceCreated}d</Td>
                    <Td>
                      {r.alertSentAt ? (
                        <span className="text-[var(--on-surf-var)]">
                          {formatDate(r.alertSentAt)}
                        </span>
                      ) : (
                        <span className="text-[var(--on-surf-var)]">—</span>
                      )}
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Section>

      {vencidoRange && (
        <Section
          title={`Saldo perdido — ${params.vencidoMes}`}
          subtitle="Créditos que vencieron en el mes con balance > 0 al expirar."
          total={vencidoTotal}
          count={vencidoRows.length}
        >
          {vencidoRows.length === 0 ? (
            <Empty>Sin saldo perdido en este mes.</Empty>
          ) : (
            <div className="overflow-x-auto rounded-md border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left">
                  <tr>
                    <Th>Cliente</Th>
                    <Th>Origen</Th>
                    <Th>Venció</Th>
                    <Th>Perdido</Th>
                  </tr>
                </thead>
                <tbody>
                  {vencidoRows.map((r) => (
                    <tr key={r.id} className="border-t">
                      <Td>
                        <Link
                          href={`/customers/${r.customerId}?tab=saldo`}
                          className="text-[var(--p)] hover:underline"
                        >
                          {r.customerName}
                        </Link>
                      </Td>
                      <Td>{ORIGEN_LABELS[r.origenTipo]}</Td>
                      <Td>{formatDate(r.expiredAt)}</Td>
                      <Td className="tabular-nums font-semibold text-[var(--warn)]">
                        {formatMXN(r.balanceLost)}
                      </Td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>
      )}
    </div>
  );
}

function FilterForm({
  venceEnDays,
  sinUsoDays,
  vencidoMesRaw,
  filterBranchId,
  branches,
  isAdmin,
}: {
  venceEnDays: number;
  sinUsoDays: number;
  vencidoMesRaw: string;
  filterBranchId: string;
  branches: { id: string; name: string }[];
  isAdmin: boolean;
}): React.JSX.Element {
  return (
    <form
      method="GET"
      className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 p-3 rounded-md border"
    >
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-[var(--on-surf-var)]">Vence en (días)</span>
        <input
          type="number"
          name="venceEn"
          defaultValue={venceEnDays}
          min={1}
          max={SALDO_FILTER_MAX_DAYS}
          className="px-2 py-1.5 rounded-[var(--r-md)] border bg-[var(--surf-lowest)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-[var(--on-surf-var)]">Sin uso desde (días)</span>
        <input
          type="number"
          name="sinUsoMasDe"
          defaultValue={sinUsoDays}
          min={1}
          max={SALDO_FILTER_MAX_DAYS}
          className="px-2 py-1.5 rounded-[var(--r-md)] border bg-[var(--surf-lowest)]"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-medium text-[var(--on-surf-var)]">Saldo perdido del mes</span>
        <input
          type="month"
          name="vencidoMes"
          defaultValue={vencidoMesRaw}
          className="px-2 py-1.5 rounded-[var(--r-md)] border bg-[var(--surf-lowest)]"
        />
      </label>
      {isAdmin && (
        <label className="flex flex-col gap-1 text-xs">
          <span className="font-medium text-[var(--on-surf-var)]">Sucursal</span>
          <select
            name="branch"
            defaultValue={filterBranchId}
            className="px-2 py-1.5 rounded-[var(--r-md)] border bg-[var(--surf-lowest)]"
          >
            <option value="">Todas</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        </label>
      )}
      <div className="sm:col-span-2 lg:col-span-4 flex justify-end">
        <button
          type="submit"
          className="px-4 py-1.5 text-xs font-semibold rounded-[var(--r-full)]"
          style={{ background: "var(--velocity-gradient)", color: "var(--on-p)" }}
        >
          Aplicar filtros
        </button>
      </div>
    </form>
  );
}

function Section({
  title,
  subtitle,
  total,
  count,
  children,
}: {
  title: string;
  subtitle: string;
  total: number;
  count: number;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <section className="space-y-3">
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-xs text-muted-foreground">{subtitle}</p>
        </div>
        <div className="text-right text-xs">
          <div className="font-semibold tabular-nums text-base">{formatMXN(total)}</div>
          <div className="text-muted-foreground">
            {count} crédito{count === 1 ? "" : "s"}
          </div>
        </div>
      </header>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <p className="text-sm text-muted-foreground py-4">{children}</p>;
}

function Th({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <th className="px-3 py-2 font-medium">{children}</th>;
}

function Td({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): React.JSX.Element {
  return <td className={`px-3 py-2${className ? ` ${className}` : ""}`}>{children}</td>;
}
