import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import type { ModeloCategoria } from "@prisma/client";
import PosTerminal, { type PrefilledQuotation } from "./pos-terminal";
import { CONVERTIBLE_STATUSES } from "@/lib/quotations";

export const dynamic = "force-dynamic";

interface AuthUser {
  id: string;
  name?: string | null;
  email?: string | null;
  role: string;
  branchId: string;
  branchName: string;
}

interface PageProps {
  searchParams: Promise<{ quotationId?: string }>;
}

export default async function PointOfSalePage({ searchParams }: PageProps) {
  const session = await getServerSession(authOptions);
  const authUser = session?.user as AuthUser | undefined;
  const branchId = authUser?.branchId ?? "";

  // Q.12 mod4 — handoff desde detalle de cotización: ?quotationId=X.
  // Resolvemos la cotización + (Path A) el pago previo para que PosTerminal
  // pueda pre-llenar carrito, cliente, descuento y mostrar el panel "ya pagado".
  const { quotationId } = await searchParams;
  let prefilledQuotation: PrefilledQuotation | null = null;
  if (quotationId && authUser) {
    prefilledQuotation = await loadPrefilledQuotation(quotationId, authUser);
  }

  // Vehicle variants only — baterías standalone se venden vía SimpleProduct,
  // no desde el grid de unidades.
  const rawVariants = await prisma.productVariant.findMany({
    where: { modelo: { esBateria: false } },
    include: {
      modelo: true,
      color: true,
      voltaje: true,
      capacidad: true,
      stocks: true,
    },
    orderBy: { sku: "asc" },
  });

  // Group variants by modelo, compute branch stock
  const modeloMap = new Map<
    string,
    {
      id: string;
      nombre: string;
      descripcion: string | null;
      imageUrl: string | null;
      requiere_vin: boolean;
      categoria: ModeloCategoria | null;
      variants: {
        id: string;
        sku: string;
        precio: number;
        costo: number;
        stockInBranch: number;
        colorId: string;
        colorNombre: string;
        voltajeId: string;
        voltajeValor: number;
        voltajeLabel: string;
      }[];
    }
  >();

  for (const v of rawVariants) {
    if (!modeloMap.has(v.modelo_id)) {
      modeloMap.set(v.modelo_id, {
        id: v.modelo.id,
        nombre: v.modelo.nombre,
        descripcion: v.modelo.descripcion,
        imageUrl: v.modelo.imageUrl,
        requiere_vin: v.modelo.requiere_vin,
        categoria: v.modelo.categoria,
        variants: [],
      });
    }
    const stockInBranch = branchId
      ? (v.stocks.find((s) => s.branchId === branchId)?.quantity ?? 0)
      : v.stocks.reduce((a, s) => a + s.quantity, 0);

    modeloMap.get(v.modelo_id)!.variants.push({
      id: v.id,
      sku: v.sku,
      precio: Number(v.precioPublico),
      costo: Number(v.costo),
      stockInBranch,
      colorId: v.color_id,
      colorNombre: v.color.nombre,
      voltajeId: v.voltaje_id,
      voltajeValor: v.voltaje.valor,
      voltajeLabel: v.capacidad ? `${v.voltaje.label} · ${v.capacidad.nombre}` : v.voltaje.label,
    });
  }

  const modelos = Array.from(modeloMap.values()).map((m) => ({
    ...m,
    minPrice: m.variants.length > 0 ? Math.min(...m.variants.map((v) => v.precio)) : 0,
    totalStockInBranch: m.variants.reduce((a, v) => a + v.stockInBranch, 0),
  }));

  // Customers + saldo a favor activo (CustomerCredit por Pack D.4.c/D.5).
  // Aggregate por customerId en una sola query — N+1 safe.
  const rawCustomers = await prisma.customer.findMany({ orderBy: { name: "asc" } });
  const creditAggregates = await prisma.customerCredit.groupBy({
    by: ["customerId"],
    where: { expiredAt: null, balance: { gt: 0 } },
    _sum: { balance: true },
  });
  const creditTotalsByCustomer = new Map<string, number>();
  for (const row of creditAggregates) {
    creditTotalsByCustomer.set(row.customerId, Number(row._sum.balance ?? 0));
  }
  const customers = rawCustomers.map((c) => {
    const saldoAFavor = creditTotalsByCustomer.get(c.id) ?? 0;
    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      phone2: c.phone2,
      email: c.email,
      balance: saldoAFavor,
      creditLimit: Number(c.creditLimit),
      creditBalanceTotal: saldoAFavor,
    };
  });

  // Battery configurations
  const rawBatteryConfigs = await prisma.batteryConfiguration.findMany({
    select: { modeloId: true, voltajeId: true, quantity: true },
  });
  const batteryConfigs = rawBatteryConfigs.map((bc) => ({
    modeloId: bc.modeloId,
    voltajeId: bc.voltajeId,
    quantity: bc.quantity,
  }));

  // Available batteries in this branch
  const availableBatteriesCount = branchId
    ? await prisma.battery.count({ where: { status: "IN_STOCK", branchId } })
    : 0;

  // SimpleProducts (accesorios, cargadores, refacciones, baterías standalone) + stock por sucursal
  const rawSimpleProducts = await prisma.simpleProduct.findMany({
    where: { isActive: true },
    include: { stocks: true },
    orderBy: { nombre: "asc" },
  });
  const simpleProducts = rawSimpleProducts.map((sp) => {
    const stockInBranch = branchId
      ? (sp.stocks.find((s) => s.branchId === branchId)?.quantity ?? 0)
      : sp.stocks.reduce((a, s) => a + s.quantity, 0);
    return {
      id: sp.id,
      codigo: sp.codigo,
      nombre: sp.nombre,
      descripcion: sp.descripcion,
      categoria: sp.categoria,
      modeloAplicable: sp.modeloAplicable,
      precioPublico: Number(sp.precioPublico),
      imageUrl: sp.imageUrl,
      stockInBranch,
    };
  });

  const sellerName = authUser?.name ?? "";
  const branchName = authUser?.branchName ?? "";
  const userRole = authUser?.role ?? "SELLER";

  // Remote stock: other branches, quantity > 0, for visible products only
  const visibleVariantIds = rawVariants.map((v) => v.id);
  const visibleSimpleIds = rawSimpleProducts.map((sp) => sp.id);

  const rawRemoteStocks =
    branchId && (visibleVariantIds.length > 0 || visibleSimpleIds.length > 0)
      ? await prisma.stock.findMany({
          where: {
            branchId: { not: branchId },
            quantity: { gt: 0 },
            OR: [
              ...(visibleVariantIds.length > 0
                ? [{ productVariantId: { in: visibleVariantIds } }]
                : []),
              ...(visibleSimpleIds.length > 0
                ? [{ simpleProductId: { in: visibleSimpleIds } }]
                : []),
            ],
          },
          select: {
            productVariantId: true,
            simpleProductId: true,
            branchId: true,
            quantity: true,
            branch: { select: { name: true } },
          },
        })
      : [];

  // Serialize as [key, entries[]][] — Map not JSON-serializable
  const remoteStockMapRaw = new Map<
    string,
    { branchId: string; branchName: string; quantity: number }[]
  >();
  for (const s of rawRemoteStocks) {
    const key = s.productVariantId
      ? `v:${s.productVariantId}`
      : s.simpleProductId
        ? `s:${s.simpleProductId}`
        : null;
    if (!key) continue;
    const arr = remoteStockMapRaw.get(key) ?? [];
    arr.push({ branchId: s.branchId, branchName: s.branch.name, quantity: s.quantity });
    remoteStockMapRaw.set(key, arr);
  }
  const remoteStockEntries = Array.from(remoteStockMapRaw.entries());

  return (
    <div className="absolute inset-0 flex flex-col overflow-hidden">
      <PosTerminal
        modelos={modelos}
        customers={customers}
        batteryConfigs={batteryConfigs}
        availableBatteriesCount={availableBatteriesCount}
        simpleProducts={simpleProducts}
        branchId={branchId}
        sellerName={sellerName}
        branchName={branchName}
        userRole={userRole}
        remoteStockEntries={remoteStockEntries}
        prefilledQuotation={prefilledQuotation}
      />
    </div>
  );
}

// Q.12 mod4 — loader server-side para handoff desde cotización.
// Devuelve null si la cotización no existe, no es convertible, ya fue convertida,
// o el usuario no tiene permiso para verla. PosTerminal entonces se renderiza
// como flujo normal (sin warn al usuario — el handoff fue mal-formado).
async function loadPrefilledQuotation(
  quotationId: string,
  authUser: AuthUser,
): Promise<PrefilledQuotation | null> {
  const q = await prisma.quotation.findUnique({
    where: { id: quotationId },
    include: {
      customer: { select: { id: true, name: true, phone: true, phone2: true, email: true } },
      items: {
        include: {
          productVariant: {
            include: {
              modelo: { select: { id: true, nombre: true, requiere_vin: true } },
              color: { select: { id: true, nombre: true } },
              voltaje: { select: { id: true, valor: true, label: true } },
              capacidad: { select: { nombre: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!q) return null;
  if (q.convertedToSaleId) return null; // ya convertida
  if (!CONVERTIBLE_STATUSES.includes(q.status)) return null;
  if (authUser.role !== "ADMIN" && q.branchId !== authUser.branchId) return null;

  // Path A — cotización ya PAGADA: traer pago previo para mostrar panel "ya pagado".
  let paidContext: PrefilledQuotation["paidContext"] = null;
  if (q.status === "PAGADA") {
    const paidTx = await prisma.cashTransaction.findFirst({
      where: { quotationId: q.id, type: "PAYMENT_IN", saleId: null },
      select: {
        id: true,
        method: true,
        amount: true,
        reference: true,
        createdAt: true,
      },
    });
    if (!paidTx) return null; // estado inconsistente — abortar handoff
    paidContext = {
      method: paidTx.method,
      amount: Number(paidTx.amount),
      reference: paidTx.reference,
      paidAt: paidTx.createdAt.toISOString(),
    };
  }

  return {
    id: q.id,
    folio: q.folio,
    // status ya pasó CONVERTIBLE_STATUSES.includes; el cast estrecha al subset.
    status: q.status as PrefilledQuotation["status"],
    total: Number(q.total),
    subtotal: Number(q.subtotal),
    discountAmount: Number(q.discountAmount),
    internalNote: q.internalNote ?? null,
    branchId: q.branchId,
    customerId: q.customerId,
    customer: q.customer
      ? {
          id: q.customer.id,
          name: q.customer.name,
          phone: q.customer.phone,
          phone2: q.customer.phone2,
          email: q.customer.email,
        }
      : null,
    anonymousCustomerName: q.anonymousCustomerName,
    anonymousCustomerPhone: q.anonymousCustomerPhone,
    items: q.items.map((it) => {
      const pv = it.productVariant;
      return {
        quotationItemId: it.id,
        productVariantId: it.productVariantId,
        description: it.description,
        isFreeForm: it.isFreeForm,
        quantity: it.quantity,
        unitPrice: Number(it.unitPrice),
        // Catálogo: detalles del variant para reconstruir CartItem en POS.
        variant: pv
          ? {
              id: pv.id,
              sku: pv.sku,
              modeloId: pv.modelo.id,
              modeloNombre: pv.modelo.nombre,
              requiereVin: pv.modelo.requiere_vin,
              colorNombre: pv.color.nombre,
              voltajeId: pv.voltaje.id,
              voltajeLabel: pv.capacidad
                ? `${pv.voltaje.label} · ${pv.capacidad.nombre}`
                : pv.voltaje.label,
            }
          : null,
      };
    }),
    paidContext,
  };
}
