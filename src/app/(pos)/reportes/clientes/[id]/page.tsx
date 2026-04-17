import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { branchWhere } from "@/lib/reportes/branch-scope";
import { parseDateRange, toDateString } from "@/lib/reportes/date-range";
import { serializeDecimal } from "@/lib/reportes/money";
import { ClienteDetalleClient } from "./cliente-detalle-client";
import type { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

export interface CustomerHeader {
  id: string;
  name: string;
  phone: string | null;
  phone2: string | null;
  email: string | null;
  rfc: string | null;
  saldoAFavor: number;
}

export interface CompraRow {
  id: string;
  folio: string;
  fechaISO: string;
  sucursal: string;
  itemsResumen: string;
  total: number;
  metodoPago: string;
  status: string;
}

export interface ApartadoRow {
  id: string;
  folio: string;
  fechaISO: string;
  total: number;
  pagado: number;
  pendiente: number;
  ultimoAbonoISO: string | null;
  expectedDeliveryISO: string | null;
}

export interface ComprasSummary {
  count: number;
  total: number;
}

export interface ApartadosSummary {
  count: number;
  totalPendiente: number;
}

export interface DetalleCurrentFilters {
  from: string;
  to: string;
  hasDateFilter: boolean;
}

const METHOD_LABELS: Record<string, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  CREDIT_BALANCE: "Saldo a favor",
  ATRATO: "Atrato",
};

type SaleWithRelations = Prisma.SaleGetPayload<{
  select: {
    id: true;
    folio: true;
    status: true;
    total: true;
    createdAt: true;
    expectedDeliveryDate: true;
    branch: { select: { name: true } };
    items: {
      select: {
        productVariantId: true;
        simpleProductId: true;
        isFreeForm: true;
        description: true;
        productVariant: {
          select: {
            modelo: { select: { nombre: true } };
            voltaje: { select: { label: true } };
          };
        };
        simpleProduct: { select: { nombre: true } };
      };
    };
    payments: {
      select: {
        amount: true;
        method: true;
        type: true;
        createdAt: true;
      };
    };
  };
}>;

function getItemsResumen(items: SaleWithRelations["items"]): string {
  const variantItems = items.filter((i) => i.productVariantId);
  if (variantItems.length > 0) {
    const uniqueIds = new Set(variantItems.map((i) => i.productVariantId));
    const first = variantItems[0];
    if (uniqueIds.size === 1 && first.productVariant) {
      return `${first.productVariant.modelo.nombre} ${first.productVariant.voltaje.label}`;
    }
    return "Mixto";
  }
  const simpleItems = items.filter((i) => i.simpleProductId);
  if (simpleItems.length > 0) {
    const first = simpleItems[0];
    if (simpleItems.length === 1 && first.simpleProduct) {
      return first.simpleProduct.nombre;
    }
    return "Varios productos";
  }
  const freeForm = items.filter((i) => i.isFreeForm);
  if (freeForm.length > 0 && freeForm[0].description) {
    return freeForm[0].description;
  }
  return "—";
}

function getPaymentLabel(payments: SaleWithRelations["payments"]): string {
  const paymentIns = payments.filter((p) => p.type === "PAYMENT_IN");
  const methods = [...new Set(paymentIns.map((p) => p.method))];
  if (methods.length === 0) return "—";
  if (methods.length === 1) return METHOD_LABELS[methods[0]] ?? methods[0];
  return "MIXTO";
}

export default async function ClienteDetallePage({
  params,
  searchParams,
}: PageProps): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;
  if (
    user.role !== "ADMIN" &&
    user.role !== "MANAGER" &&
    user.role !== "SELLER"
  ) {
    redirect("/dashboard");
  }

  const { id } = await params;
  const sp = await searchParams;

  const hasDateFilter = Boolean(sp.from ?? sp.to);
  const range = hasDateFilter
    ? parseDateRange({ from: sp.from, to: sp.to })
    : null;

  const scope = branchWhere({ role: user.role, branchId: user.branchId });
  const branchFilter: { branchId?: string } =
    scope.branchId !== undefined ? { branchId: scope.branchId } : {};

  const customer = await prisma.customer.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      phone: true,
      phone2: true,
      email: true,
      rfc: true,
      balance: true,
    },
  });

  if (!customer) notFound();

  const dateFilter: Prisma.SaleWhereInput = range
    ? { createdAt: { gte: range.from, lte: range.to } }
    : {};

  const sales = await prisma.sale.findMany({
    where: {
      customerId: id,
      ...branchFilter,
      ...dateFilter,
    },
    select: {
      id: true,
      folio: true,
      status: true,
      total: true,
      createdAt: true,
      expectedDeliveryDate: true,
      branch: { select: { name: true } },
      items: {
        select: {
          productVariantId: true,
          simpleProductId: true,
          isFreeForm: true,
          description: true,
          productVariant: {
            select: {
              modelo: { select: { nombre: true } },
              voltaje: { select: { label: true } },
            },
          },
          simpleProduct: { select: { nombre: true } },
        },
      },
      payments: {
        select: {
          amount: true,
          method: true,
          type: true,
          createdAt: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const compras: CompraRow[] = [];
  const apartados: ApartadoRow[] = [];

  let comprasCount = 0;
  let comprasTotal = 0;
  let apartadosPendiente = 0;

  for (const sale of sales) {
    const total = serializeDecimal(sale.total);

    if (sale.status === "LAYAWAY") {
      const paymentIns = sale.payments.filter((p) => p.type === "PAYMENT_IN");
      const paid = paymentIns.reduce(
        (acc, p) => acc + serializeDecimal(p.amount),
        0,
      );
      const pending = Math.max(0, total - paid);
      const lastAbonoDate =
        paymentIns
          .map((p) => p.createdAt)
          .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

      apartados.push({
        id: sale.id,
        folio: sale.folio,
        fechaISO: sale.createdAt.toISOString(),
        total,
        pagado: paid,
        pendiente: pending,
        ultimoAbonoISO: lastAbonoDate ? lastAbonoDate.toISOString() : null,
        expectedDeliveryISO: sale.expectedDeliveryDate
          ? sale.expectedDeliveryDate.toISOString()
          : null,
      });
      apartadosPendiente += pending;
      continue;
    }

    // COMPLETED o CANCELLED → sección Compras
    compras.push({
      id: sale.id,
      folio: sale.folio,
      fechaISO: sale.createdAt.toISOString(),
      sucursal: sale.branch.name,
      itemsResumen: getItemsResumen(sale.items),
      total,
      metodoPago: getPaymentLabel(sale.payments),
      status: sale.status,
    });

    if (sale.status === "COMPLETED") {
      comprasCount += 1;
      comprasTotal += total;
    }
  }

  // Guard: no-ADMIN sin actividad en su sucursal no debe ver datos personales
  // del cliente (nombre, RFC, saldo). ADMIN puede ver cualquier cliente.
  const isAdmin = user.role === "ADMIN";
  if (!isAdmin && compras.length === 0 && apartados.length === 0) {
    notFound();
  }

  const header: CustomerHeader = {
    id: customer.id,
    name: customer.name,
    phone: customer.phone,
    phone2: customer.phone2,
    email: customer.email,
    rfc: customer.rfc,
    saldoAFavor:
      serializeDecimal(customer.balance) > 0
        ? serializeDecimal(customer.balance)
        : 0,
  };

  const comprasSummary: ComprasSummary = {
    count: comprasCount,
    total: comprasTotal,
  };

  const apartadosSummary: ApartadosSummary = {
    count: apartados.length,
    totalPendiente: apartadosPendiente,
  };

  const currentFilters: DetalleCurrentFilters = {
    from: range ? toDateString(range.from) : "",
    to: range ? toDateString(new Date(range.to.getTime() - 1)) : "",
    hasDateFilter,
  };

  return (
    <ClienteDetalleClient
      customer={header}
      compras={compras}
      apartados={apartados}
      comprasSummary={comprasSummary}
      apartadosSummary={apartadosSummary}
      currentFilters={currentFilters}
    />
  );
}
