import type { BranchedSessionUser } from "@/lib/auth-types";
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as BranchedSessionUser | undefined;
  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  const branchFilter = user.role === "ADMIN" ? {} : { branchId: user.branchId };

  // Auto-expire solicitudes vencidas antes de listar. Barato: una sola UPDATE con índice
  // (branchId, status). No rompe nada si ninguna está vencida.
  const now = new Date();
  await prisma.authorizationRequest.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: now },
      ...branchFilter,
    },
    data: { status: "EXPIRED", resolvedAt: now },
  });

  const pending = await prisma.authorizationRequest.findMany({
    where: {
      status: "PENDING",
      ...branchFilter,
      // El manager no ve sus propias solicitudes (no puede auto-aprobarlas).
      requestedBy: { not: user.id },
    },
    select: {
      id: true,
      branchId: true,
      tipo: true,
      mode: true,
      saleId: true,
      requestedBy: true,
      monto: true,
      motivo: true,
      expiresAt: true,
      createdAt: true,
      requester: { select: { name: true } },
      sale: { select: { folio: true, total: true } },
      branch: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({
    success: true,
    data: pending.map((r) => ({
      id: r.id,
      branchId: r.branchId,
      branchCode: r.branch?.code ?? null,
      branchName: r.branch?.name ?? null,
      tipo: r.tipo,
      mode: r.mode,
      saleId: r.saleId,
      saleFolio: r.sale?.folio ?? null,
      saleTotal: r.sale?.total ? Number(r.sale.total) : null,
      requestedBy: r.requestedBy,
      requesterName: r.requester?.name ?? null,
      monto: r.monto ? Number(r.monto) : null,
      motivo: r.motivo,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
    })),
  });
}
