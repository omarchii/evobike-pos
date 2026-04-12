import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

interface SessionUser {
  id: string;
  branchId: string | null;
  role: string;
}

// ── GET — List commission records ───────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = req.nextUrl;
  const fromParam = searchParams.get("from");
  const toParam = searchParams.get("to");
  const statusParam = searchParams.get("status"); // comma-separated
  const userIdParam = searchParams.get("userId");
  const branchIdParam = searchParams.get("branchId");

  const now = new Date();
  const defaultFrom = new Date(now.getFullYear(), now.getMonth(), 1);
  const fromDate = fromParam ? new Date(fromParam) : defaultFrom;
  const toDate = toParam ? new Date(toParam + "T23:59:59.999Z") : now;

  const statuses = statusParam
    ? statusParam.split(",").filter(Boolean)
    : [];

  // Build where clause based on role
  // CommissionRecord → user.branchId for branch-based filtering
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {
    createdAt: { gte: fromDate, lte: toDate },
    ...(statuses.length > 0 && { status: { in: statuses } }),
  };

  if (user.role === "SELLER") {
    // Sellers can only see their own commissions
    where.userId = user.id;
  } else if (user.role === "MANAGER") {
    // Managers see their branch's commissions
    const branchId = user.branchId;
    if (!branchId) {
      return NextResponse.json({ success: false, error: "Sin sucursal asignada" }, { status: 400 });
    }
    where.user = { branchId };
    if (userIdParam) where.userId = userIdParam;
  } else if (user.role === "ADMIN") {
    // Admins see all, optionally filtered by branch
    if (branchIdParam) {
      where.user = { branchId: branchIdParam };
    }
    if (userIdParam) where.userId = userIdParam;
  } else {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const records = await prisma.commissionRecord.findMany({
    where,
    include: {
      user: { select: { id: true, name: true, role: true, branchId: true } },
      sale: { select: { folio: true, total: true } },
      rule: { select: { commissionType: true, value: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // KPI aggregates
  let totalPending = 0;
  let totalApproved = 0;
  let totalPaid = 0;

  const data = records.map((r) => {
    const amount = Number(r.amount);
    if (r.status === "PENDING") totalPending += amount;
    else if (r.status === "APPROVED") totalApproved += amount;
    else if (r.status === "PAID") totalPaid += amount;

    return {
      id: r.id,
      userId: r.userId,
      userName: r.user.name,
      userRole: r.user.role,
      branchId: r.user.branchId,
      saleId: r.saleId,
      saleFolio: r.sale.folio,
      saleTotal: Number(r.sale.total),
      amount,
      status: r.status,
      commissionType: r.rule.commissionType,
      ruleValue: Number(r.rule.value),
      createdAt: r.createdAt.toISOString(),
    };
  });

  return NextResponse.json({
    success: true,
    data: {
      items: data,
      kpis: {
        totalPending: Math.round(totalPending * 100) / 100,
        totalApproved: Math.round(totalApproved * 100) / 100,
        totalPaid: Math.round(totalPaid * 100) / 100,
      },
    },
  });
}

// ── PATCH — Batch update commission status ──────────────────────────────────

const batchSchema = z.object({
  ids: z.array(z.string().uuid()).min(1, "Se requiere al menos un ID"),
  status: z.enum(["APPROVED", "PAID"]),
});

export async function PATCH(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  // Only MANAGER and ADMIN can update commissions
  if (user.role !== "MANAGER" && user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  // MANAGER can only approve (PENDING → APPROVED), not pay
  // ADMIN can approve or pay

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }

  const parsed = batchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { ids, status } = parsed.data;

  if (status === "PAID" && user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "Solo ADMIN puede marcar comisiones como pagadas" },
      { status: 403 },
    );
  }

  // Validate that all requested records are in the expected prior status
  const expectedPrior = status === "APPROVED" ? "PENDING" : "APPROVED";

  const records = await prisma.commissionRecord.findMany({
    where: { id: { in: ids } },
    select: { id: true, status: true, userId: true, user: { select: { branchId: true } } },
  });

  if (records.length !== ids.length) {
    return NextResponse.json(
      { success: false, error: "Uno o más IDs no encontrados" },
      { status: 404 },
    );
  }

  // Check branch access for MANAGER
  if (user.role === "MANAGER") {
    const managerBranchId = user.branchId;
    const outsideBranch = records.some((r) => r.user.branchId !== managerBranchId);
    if (outsideBranch) {
      return NextResponse.json(
        { success: false, error: "No autorizado para comisiones de otra sucursal" },
        { status: 403 },
      );
    }
  }

  const invalidStatus = records.filter((r) => r.status !== expectedPrior);
  if (invalidStatus.length > 0) {
    return NextResponse.json(
      {
        success: false,
        error: `${invalidStatus.length} registro(s) no están en estado ${expectedPrior}`,
      },
      { status: 422 },
    );
  }

  const result = await prisma.commissionRecord.updateMany({
    where: { id: { in: ids } },
    data: { status },
  });

  return NextResponse.json({
    success: true,
    data: { updated: result.count },
  });
}
