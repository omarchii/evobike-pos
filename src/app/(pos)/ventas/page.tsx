import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { SalesHistoryTable } from "./sales-history-table";
import type { Prisma } from "@prisma/client";
import { parseLocalDate } from "@/lib/reportes/date-range";
import { normalizeForSearch } from "@/lib/customers/normalize";
import { branchWhere, getViewBranchId } from "@/lib/branch-filter";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  branchId: string | null;
  role: string;
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export interface SaleListItem {
  id: string;
  folio: string;
  createdAt: string;
  customerName: string | null;
  userName: string;
  status: string;
  orderType: string | null;
  total: number;
  paymentMethod: string | null;
}

export interface SellerOption {
  id: string;
  name: string;
}

function getString(val: string | string[] | undefined): string | undefined {
  if (!val) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

export default async function VentasPage({ searchParams }: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) notFound();

  const { id: sessionUserId, role } = user;

  const params = await searchParams;
  const fromParam = getString(params.from);
  const toParam = getString(params.to);
  const userIdParam = getString(params.userId);
  const statusParam = getString(params.status);
  const paymentMethodParam = getString(params.paymentMethod);
  const folioParam = getString(params.folio);
  const customerParam = getString(params.customer);
  const cursorParam = getString(params.cursor);

  // Filtro de sucursal: admin respeta getViewBranchId (URL efímero > cookie > Global);
  // manager/seller quedan forzados a su sucursal asignada.
  const viewBranchId = await getViewBranchId(params);

  // Default date range: last 30 days
  const now = new Date();
  const defaultFrom = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const fromDate =
    (fromParam ? parseLocalDate(fromParam, false) : null) ?? defaultFrom;
  const toDate =
    (toParam ? parseLocalDate(toParam, true) : null) ?? now;

  // Build where clause
  const where: Prisma.SaleWhereInput = {
    createdAt: { gte: fromDate, lte: toDate },
    ...branchWhere(viewBranchId),
  };

  if (role === "SELLER") {
    where.userId = sessionUserId;
  } else if (userIdParam) {
    // MANAGER/ADMIN: filtro opcional por vendedor
    where.userId = userIdParam;
  }

  if (statusParam) {
    const statuses = statusParam.split(",").map((s) => s.trim()).filter(Boolean);
    if (statuses.length > 0) {
      where.status = {
        in: statuses as ("COMPLETED" | "LAYAWAY" | "CANCELLED")[],
      };
    }
  }

  if (folioParam) {
    where.folio = { contains: folioParam, mode: "insensitive" };
  }

  if (customerParam) {
    where.customer = { nameNormalized: { contains: normalizeForSearch(customerParam) } };
  }

  if (paymentMethodParam) {
    const methods = paymentMethodParam.split(",").map((m) => m.trim()).filter(Boolean);
    if (methods.length > 0) {
      where.payments = {
        some: {
          method: {
            in: methods as ("CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE" | "ATRATO")[],
          },
        },
      };
    }
  }

  const LIMIT = 25;

  const [totalCount, rawItems, sellers] = await Promise.all([
    prisma.sale.count({ where }),
    prisma.sale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: LIMIT + 1,
      ...(cursorParam && { cursor: { id: cursorParam }, skip: 1 }),
      select: {
        id: true,
        folio: true,
        createdAt: true,
        status: true,
        orderType: true,
        total: true,
        customer: { select: { name: true } },
        user: { select: { name: true } },
        payments: {
          take: 1,
          orderBy: { createdAt: "asc" },
          select: { method: true },
        },
      },
    }),
    // Fetch sellers for the filter select (scoped al mismo branch que la vista)
    prisma.user.findMany({
      where: {
        role: { in: ["SELLER", "MANAGER", "ADMIN"] },
        ...branchWhere(viewBranchId),
        ...(role === "SELLER" ? { id: sessionUserId } : {}),
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const hasMore = rawItems.length > LIMIT;
  const items = hasMore ? rawItems.slice(0, LIMIT) : rawItems;
  const nextCursor = hasMore ? (items[items.length - 1]?.id ?? null) : null;

  const saleItems: SaleListItem[] = items.map((sale) => ({
    id: sale.id,
    folio: sale.folio,
    createdAt: sale.createdAt.toISOString(),
    customerName: sale.customer?.name ?? null,
    userName: sale.user.name ?? "–",
    status: sale.status as string,
    orderType: sale.orderType as string | null,
    total: Number(sale.total),
    paymentMethod: sale.payments[0]?.method ?? null,
  }));

  const sellerOptions: SellerOption[] = sellers.map((s) => ({
    id: s.id,
    name: s.name ?? "–",
  }));

  const currentFilters = {
    from: fromParam ?? defaultFrom.toISOString().substring(0, 10),
    to: toParam ?? now.toISOString().substring(0, 10),
    userId: userIdParam ?? "",
    status: statusParam ?? "",
    paymentMethod: paymentMethodParam ?? "",
    folio: folioParam ?? "",
    customer: customerParam ?? "",
  };

  return (
    <SalesHistoryTable
      initialItems={saleItems}
      initialNextCursor={nextCursor}
      totalCount={totalCount}
      sellers={sellerOptions}
      currentFilters={currentFilters}
      role={role}
    />
  );
}
