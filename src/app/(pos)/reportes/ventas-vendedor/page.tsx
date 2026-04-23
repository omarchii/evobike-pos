import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { branchWhere } from "@/lib/reportes/branch-scope";
import { parseDateRange, toDateString } from "@/lib/reportes/date-range";
import { serializeDecimal } from "@/lib/reportes/money";
import { VentasVendedorClient } from "./ventas-vendedor-client";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

const VALID_METHODS = [
  "CASH",
  "CARD",
  "TRANSFER",
  "CREDIT_BALANCE",
  "ATRATO",
] as const;
type ValidMethod = (typeof VALID_METHODS)[number];

function isValidMethod(v: string | undefined): v is ValidMethod {
  return !!v && (VALID_METHODS as readonly string[]).includes(v);
}

interface SearchParams {
  from?: string;
  to?: string;
  branchId?: string;
  userId?: string;
  method?: string;
  status?: string;
}

// ── Helpers de cálculo ────────────────────────────────────────────────────────

type SaleWithDetails = Prisma.SaleGetPayload<{
  select: {
    id: true;
    folio: true;
    userId: true;
    total: true;
    status: true;
    createdAt: true;
    user: { select: { id: true; name: true } };
    customer: { select: { name: true } };
    items: {
      select: {
        productVariantId: true;
        simpleProductId: true;
        quantity: true;
        productVariant: {
          select: {
            modelo: { select: { nombre: true } };
            voltaje: { select: { label: true } };
          };
        };
      };
    };
    payments: { where: { type: "PAYMENT_IN" }; select: { method: true } };
  };
}>;

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  CREDIT_BALANCE: "Saldo a favor",
  ATRATO: "Atrato",
};

function getModeloVoltaje(items: SaleWithDetails["items"]): {
  modelo: string;
  voltaje: string;
} {
  const variantItems = items.filter((i) => i.productVariantId);
  if (variantItems.length === 0) {
    return { modelo: "Sin modelo", voltaje: "—" };
  }
  const uniqueIds = new Set(variantItems.map((i) => i.productVariantId));
  if (uniqueIds.size === 1 && variantItems[0].productVariant) {
    const pv = variantItems[0].productVariant;
    return {
      modelo: pv.modelo.nombre,
      voltaje: pv.voltaje.label,
    };
  }
  return { modelo: "Mixto", voltaje: "—" };
}

function getPaymentLabel(payments: SaleWithDetails["payments"]): string {
  const methods = [...new Set(payments.map((p) => p.method))];
  if (methods.length === 0) return "—";
  if (methods.length === 1) return METHOD_LABELS[methods[0]] ?? methods[0];
  return "MIXTO";
}

// ── Tipos serializados para el Client Component ───────────────────────────────

export interface KpiData {
  totalVendido: number;
  tickets: number;
  ticketPromedio: number;
  unidadesVendidas: number;
  vendedoresActivos: number;
}

export interface SummaryRow {
  userId: string;
  userName: string;
  tickets: number;
  totalVendido: number;
  ticketPromedio: number;
  unidades: number;
}

export interface DetailRow {
  id: string;
  folio: string;
  clienteNombre: string;
  modelo: string;
  voltaje: string;
  fechaISO: string;
  total: number;
  metodoPago: string;
  status: string;
}

export interface UserOption {
  id: string;
  name: string;
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface CurrentFilters {
  from: string;
  to: string;
  branchId: string;
  userId: string;
  method: string;
  status: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function VentasVendedorPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/");
  }

  const isAdmin = user.role === "ADMIN";
  const params = await searchParams;

  // ── Parsear filtros ──────────────────────────────────────────────────────
  const { from: fromDate, to: toDate } = parseDateRange({
    from: params.from,
    to: params.to,
  });

  const filterBranchId = isAdmin ? (params.branchId ?? "") : "";
  const filterUserId = params.userId ?? "";
  const filterMethod = isValidMethod(params.method) ? params.method : "";
  const filterStatus = params.status === "all" ? "all" : "completed";
  const includesCancelled = filterStatus === "all";

  // ── Scope de sucursal ────────────────────────────────────────────────────
  const scope = branchWhere(
    { role: user.role, branchId: user.branchId },
    filterBranchId || undefined,
  );

  // ── Construcción del where ───────────────────────────────────────────────
  const statusFilter: Prisma.SaleWhereInput["status"] = includesCancelled
    ? { in: ["COMPLETED", "CANCELLED"] }
    : "COMPLETED";

  const saleWhere: Prisma.SaleWhereInput = {
    status: statusFilter,
    excludeFromRevenue: false,
    createdAt: { gte: fromDate, lte: toDate },
    ...(scope.branchId !== undefined ? { branchId: scope.branchId } : {}),
    ...(filterUserId ? { userId: filterUserId } : {}),
    ...(filterMethod
      ? {
          payments: {
            some: { method: filterMethod, type: "PAYMENT_IN" },
          },
        }
      : {}),
  };

  // ── Queries en paralelo ──────────────────────────────────────────────────
  const [salesRaw, usersForFilter, branches] = await Promise.all([
    prisma.sale.findMany({
      where: saleWhere,
      select: {
        id: true,
        folio: true,
        userId: true,
        total: true,
        status: true,
        createdAt: true,
        user: { select: { id: true, name: true } },
        customer: { select: { name: true } },
        items: {
          select: {
            productVariantId: true,
            simpleProductId: true,
            quantity: true,
            productVariant: {
              select: {
                modelo: { select: { nombre: true } },
                voltaje: { select: { label: true } },
              },
            },
          },
        },
        payments: {
          where: { type: "PAYMENT_IN" },
          select: { method: true },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
    // Vendedores disponibles para el filtro. Reutiliza `scope` para que ADMIN
    // con sucursal seleccionada solo vea vendedores de esa sucursal (si no,
    // el dropdown expone vendedores cuyas ventas quedarían fuera del filtro).
    prisma.user.findMany({
      where: {
        ...(scope.branchId !== undefined ? { branchId: scope.branchId } : {}),
        isActive: true,
        role: { in: ["SELLER", "MANAGER", "ADMIN"] },
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Sucursales — solo para ADMIN
    isAdmin
      ? prisma.branch.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve<BranchOption[]>([]),
  ]);

  // ── Calcular KPIs (solo ventas COMPLETED) ────────────────────────────────
  const completedSales = salesRaw.filter((s) => s.status === "COMPLETED");

  let totalVendido = 0;
  const vendedoresSet = new Set<string>();

  for (const sale of completedSales) {
    totalVendido += serializeDecimal(sale.total);
    vendedoresSet.add(sale.userId);
  }

  const tickets = completedSales.length;
  const ticketPromedio = tickets > 0 ? totalVendido / tickets : 0;
  const unidadesVendidas = completedSales.reduce(
    (acc, s) => acc + s.items.reduce((a, item) => a + item.quantity, 0),
    0,
  );
  const vendedoresActivos = vendedoresSet.size;

  const kpis: KpiData = {
    totalVendido,
    tickets,
    ticketPromedio,
    unidadesVendidas,
    vendedoresActivos,
  };

  // ── Resumen por vendedor (solo COMPLETED) ────────────────────────────────
  const summaryMap = new Map<string, SummaryRow>();

  for (const sale of completedSales) {
    const existing = summaryMap.get(sale.userId);
    const saleTotal = serializeDecimal(sale.total);
    const saleUnits = sale.items.reduce((a, item) => a + item.quantity, 0);

    if (existing) {
      existing.tickets += 1;
      existing.totalVendido += saleTotal;
      existing.unidades += saleUnits;
    } else {
      summaryMap.set(sale.userId, {
        userId: sale.userId,
        userName: sale.user.name,
        tickets: 1,
        totalVendido: saleTotal,
        ticketPromedio: 0, // se recalcula abajo
        unidades: saleUnits,
      });
    }
  }

  const summaryRows: SummaryRow[] = Array.from(summaryMap.values())
    .map((row) => ({
      ...row,
      ticketPromedio: row.tickets > 0 ? row.totalVendido / row.tickets : 0,
    }))
    .sort((a, b) => b.totalVendido - a.totalVendido);

  // ── Detalle de ventas ────────────────────────────────────────────────────
  const detailRows: DetailRow[] = salesRaw.map((sale) => {
    const { modelo, voltaje } = getModeloVoltaje(sale.items);
    return {
      id: sale.id,
      folio: sale.folio,
      clienteNombre: sale.customer?.name ?? "Sin cliente",
      modelo,
      voltaje,
      fechaISO: sale.createdAt.toISOString(),
      total: serializeDecimal(sale.total),
      metodoPago: getPaymentLabel(sale.payments),
      status: sale.status,
    };
  });

  // ── Filtros actuales (para los controles de la UI) ───────────────────────
  const currentFilters: CurrentFilters = {
    from: toDateString(fromDate),
    to: toDateString(new Date(toDate.getTime() - 1)), // quitar el ajuste de hora
    branchId: filterBranchId,
    userId: filterUserId,
    method: filterMethod,
    status: filterStatus,
  };

  const userOptions: UserOption[] = usersForFilter.map((u) => ({
    id: u.id,
    name: u.name,
  }));

  return (
    <VentasVendedorClient
      kpis={kpis}
      summaryRows={summaryRows}
      detailRows={detailRows}
      userOptions={userOptions}
      branches={branches}
      currentFilters={currentFilters}
      isAdmin={isAdmin}
      userRole={user.role}
    />
  );
}
