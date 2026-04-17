import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { Prisma } from "@prisma/client";
import { HistorialCortes } from "./historial-cortes";
import { parseLocalDate } from "@/lib/reportes/date-range";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  branchId: string | null;
  role: string;
}

function getString(val: string | string[] | undefined): string | undefined {
  if (!val) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

// ── Row shapes ───────────────────────────────────────────────────────────────

export interface CorteRow {
  id: string;
  branchId: string;
  branchName: string;
  operadorName: string;
  openedAt: string;
  closedAt: string; // siempre set porque status = CLOSED
  efectivoEsperado: number | null; // closingAmt - diferencia (null en sesiones legacy)
  efectivoContado: number | null; // closingAmt
  diferencia: number | null; // campo persistido al cerrar
  autorizadorName: string | null; // authorizedBy.name o closeAuthorization.approver.name
  isClosed: boolean;
}

export interface HistorialKpis {
  totalCortes: number;
  efectivoEsperadoAcumulado: number;
  efectivoContadoAcumulado: number;
  diferenciaNeta: number; // suma con signo
  cortesConDiferencia: number; // |diferencia| > 0.01
}

export interface OperadorOption {
  id: string;
  name: string;
}

export interface SucursalOption {
  id: string;
  name: string;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default async function HistorialCortesPage({
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const isAdmin = user.role === "ADMIN";
  const params = await searchParams;

  const fromParam = getString(params.from);
  const toParam = getString(params.to);
  const userIdParam = getString(params.userId);
  const branchIdParam = isAdmin ? getString(params.branchId) : undefined;

  // Defaults: mes actual
  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromDate =
    (fromParam ? parseLocalDate(fromParam, false) : null) ?? defaultFrom;
  const toDate =
    (toParam ? parseLocalDate(toParam, true) : null) ?? now;

  // Scope de sucursal
  const effectiveBranchId: string | null = isAdmin
    ? (branchIdParam ?? null)
    : (user.branchId ?? null);

  if (!isAdmin && !effectiveBranchId) redirect("/dashboard");

  const where: Prisma.CashRegisterSessionWhereInput = {
    status: "CLOSED",
    closedAt: { gte: fromDate, lte: toDate },
    ...(effectiveBranchId ? { branchId: effectiveBranchId } : {}),
    ...(userIdParam ? { userId: userIdParam } : {}),
  };

  const [sessions, operadores, sucursales] = await Promise.all([
    prisma.cashRegisterSession.findMany({
      where,
      orderBy: { closedAt: "desc" },
      include: {
        branch: { select: { id: true, name: true } },
        user: { select: { name: true } },
        authorizedBy: { select: { name: true } },
        closeAuthorization: {
          select: { approver: { select: { name: true } } },
        },
      },
    }),
    // Dropdown operadores (scoped al branch si aplica)
    prisma.user.findMany({
      where: {
        sessions: {
          some: effectiveBranchId ? { branchId: effectiveBranchId } : {},
        },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Dropdown sucursales solo ADMIN
    isAdmin
      ? prisma.branch.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve([] as { id: string; name: string }[]),
  ]);

  const round = (n: number): number => Math.round(n * 100) / 100;

  const rows: CorteRow[] = sessions.map((s) => {
    const efectivoContado =
      s.closingAmt !== null ? round(Number(s.closingAmt)) : null;
    const diferencia =
      s.diferencia !== null ? round(Number(s.diferencia)) : null;
    // efectivoEsperado = closingAmt - diferencia (solo cuando ambos existen)
    const efectivoEsperado =
      efectivoContado !== null && diferencia !== null
        ? round(efectivoContado - diferencia)
        : null;

    const autorizadorName =
      s.closeAuthorization?.approver?.name ??
      s.authorizedBy?.name ??
      null;

    return {
      id: s.id,
      branchId: s.branchId,
      branchName: s.branch.name,
      operadorName: s.user.name ?? "—",
      openedAt: s.openedAt.toISOString(),
      closedAt: s.closedAt!.toISOString(),
      efectivoEsperado,
      efectivoContado,
      diferencia,
      autorizadorName,
      isClosed: s.status === "CLOSED",
    };
  });

  // KPIs
  let efectivoEsperadoAcumulado = 0;
  let efectivoContadoAcumulado = 0;
  let diferenciaNeta = 0;
  let cortesConDiferencia = 0;

  for (const r of rows) {
    efectivoEsperadoAcumulado += r.efectivoEsperado ?? 0;
    efectivoContadoAcumulado += r.efectivoContado ?? 0;
    diferenciaNeta += r.diferencia ?? 0;
    if (Math.abs(r.diferencia ?? 0) > 0.01) cortesConDiferencia++;
  }

  const kpis: HistorialKpis = {
    totalCortes: rows.length,
    efectivoEsperadoAcumulado: round(efectivoEsperadoAcumulado),
    efectivoContadoAcumulado: round(efectivoContadoAcumulado),
    diferenciaNeta: round(diferenciaNeta),
    cortesConDiferencia,
  };

  const operadorOptions: OperadorOption[] = operadores.map((u) => ({
    id: u.id,
    name: u.name ?? "—",
  }));

  const sucursalOptions: SucursalOption[] = sucursales.map((b) => ({
    id: b.id,
    name: b.name,
  }));

  return (
    <HistorialCortes
      rows={rows}
      kpis={kpis}
      operadores={operadorOptions}
      sucursales={sucursalOptions}
      isAdmin={isAdmin}
      currentFilters={{
        from: fromParam ?? defaultFrom.toISOString().substring(0, 10),
        to: toParam ?? now.toISOString().substring(0, 10),
        userId: userIdParam ?? "",
        branchId: branchIdParam ?? "",
      }}
    />
  );
}
