import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { isManagerPlus } from "@/lib/customers/service";
import { getCustomerCreditBalance } from "@/lib/customer-credit";

// GET /api/customers/[sourceId]/merge-preview?targetId=...
// Devuelve los counts de FKs que se reasignarán + la versión normalizada
// de las reglas antichain (BRIEF §6.1). MANAGER+.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  if (!isManagerPlus(user.role)) {
    return NextResponse.json({ success: false, error: "Requiere rol MANAGER+" }, { status: 403 });
  }

  const { id: sourceId } = await params;
  const targetId = new URL(req.url).searchParams.get("targetId")?.trim() ?? "";
  if (!targetId) {
    return NextResponse.json({ success: false, error: "targetId requerido" }, { status: 400 });
  }
  if (sourceId === targetId) {
    return NextResponse.json(
      { success: false, error: "El origen y el destino no pueden ser el mismo" },
      { status: 400 },
    );
  }

  const [source, target, sourceCredit, targetCredit] = await Promise.all([
    prisma.customer.findUnique({
      where: { id: sourceId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        rfc: true,
        creditLimit: true,
        isBusiness: true,
        razonSocial: true,
        mergedIntoId: true,
        deletedAt: true,
      },
    }),
    prisma.customer.findUnique({
      where: { id: targetId },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        rfc: true,
        creditLimit: true,
        isBusiness: true,
        razonSocial: true,
        mergedIntoId: true,
        deletedAt: true,
      },
    }),
    getCustomerCreditBalance(sourceId),
    getCustomerCreditBalance(targetId),
  ]);

  if (!source || !target) {
    return NextResponse.json({ success: false, error: "Cliente origen o destino no encontrado" }, { status: 404 });
  }

  // Antichain: rechaza igual que merge-into.
  let blocker: string | null = null;
  if (source.mergedIntoId) blocker = "El cliente origen ya fue fusionado.";
  else if (target.mergedIntoId) blocker = "El cliente destino ya fue fusionado.";
  else {
    const sourceIsATarget = await prisma.customer.findFirst({
      where: { mergedIntoId: sourceId },
      select: { id: true },
    });
    if (sourceIsATarget) {
      blocker = "El origen ya recibió una fusión previa; no puede ser fusionado hacia otro.";
    }
  }

  // Counts de FKs que se moverán.
  const [sales, serviceOrders, quotations, cashTransactions, bikes, notes, editLogs] =
    await Promise.all([
      prisma.sale.count({ where: { customerId: sourceId } }),
      prisma.serviceOrder.count({ where: { customerId: sourceId } }),
      prisma.quotation.count({ where: { customerId: sourceId } }),
      prisma.cashTransaction.count({ where: { customerId: sourceId } }),
      prisma.customerBike.count({ where: { customerId: sourceId } }),
      prisma.customerNote.count({ where: { customerId: sourceId } }),
      prisma.customerEditLog.count({ where: { customerId: sourceId } }),
    ]);

  return NextResponse.json({
    success: true,
    data: {
      source: {
        ...source,
        balance: sourceCredit.total,
        creditLimit: Number(source.creditLimit),
      },
      target: {
        ...target,
        balance: targetCredit.total,
        creditLimit: Number(target.creditLimit),
      },
      blocker,
      counts: {
        sales,
        serviceOrders,
        quotations,
        cashTransactions,
        bikes,
        notes,
        editLogs,
      },
    },
  });
}
