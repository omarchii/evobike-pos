import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { listableCustomerWhere } from "@/lib/customers/service";

// GET /api/customers/stats — KPIs del directorio (BRIEF §7.2).
// Mínimo viable para Sub-fase B: totales, LTV acumulado, ticket promedio,
// saldo por cobrar total. Los deltas vs periodo anterior se añaden en Sub-fase C.
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const listWhere = listableCustomerWhere();

  const [customersTotal, ltvAgg, purchaseCount, overdueAgg] = await Promise.all([
    prisma.customer.count({ where: listWhere }),
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        status: "COMPLETED",
        customerId: { not: null },
        customer: listWhere,
      },
    }),
    prisma.sale.count({
      where: {
        status: "COMPLETED",
        customerId: { not: null },
        customer: listWhere,
      },
    }),
    // "Saldo por cobrar" = apartados (LAYAWAY) menos pagos recibidos.
    // En Sub-fase H (Finanzas) se hará el join fino. Aquí basta con sumar
    // totales de apartados vigentes como aproximación del KPI del directorio.
    prisma.sale.aggregate({
      _sum: { total: true },
      where: {
        status: "LAYAWAY",
        customerId: { not: null },
        customer: listWhere,
      },
    }),
  ]);

  const ltv = Number(ltvAgg._sum.total ?? 0);
  const avgTicket = purchaseCount > 0 ? ltv / purchaseCount : 0;
  const overdue = Number(overdueAgg._sum.total ?? 0);

  return NextResponse.json({
    success: true,
    data: {
      customersTotal,
      ltvAccumulated: ltv,
      averageTicket: avgTicket,
      accountsReceivableTotal: overdue,
    },
  });
}
