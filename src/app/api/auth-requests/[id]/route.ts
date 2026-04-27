import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { expireIfNeeded } from "@/lib/authorizations";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const { id } = await params;

  const record = await prisma.authorizationRequest.findUnique({
    where: { id },
    select: {
      id: true,
      branchId: true,
      tipo: true,
      status: true,
      mode: true,
      saleId: true,
      requestedBy: true,
      approvedBy: true,
      monto: true,
      motivo: true,
      rejectReason: true,
      expiresAt: true,
      createdAt: true,
      resolvedAt: true,
      requester: { select: { id: true, name: true } },
      approver: { select: { id: true, name: true } },
      sale: { select: { id: true, folio: true } },
    },
  });

  if (!record) {
    return NextResponse.json(
      { success: false, error: "Solicitud no encontrada" },
      { status: 404 },
    );
  }

  const isRequester = record.requestedBy === user.id;
  const isManagerSameBranch =
    (user.role === "MANAGER" || user.role === "ADMIN") &&
    (user.role === "ADMIN" || record.branchId === user.branchId);
  if (!isRequester && !isManagerSameBranch) {
    return NextResponse.json(
      { success: false, error: "Sin acceso a esta solicitud" },
      { status: 403 },
    );
  }

  const effectiveStatus = await expireIfNeeded({
    id: record.id,
    status: record.status,
    expiresAt: record.expiresAt,
  });

  return NextResponse.json({
    success: true,
    data: {
      id: record.id,
      branchId: record.branchId,
      tipo: record.tipo,
      status: effectiveStatus,
      mode: record.mode,
      saleId: record.saleId,
      saleFolio: record.sale?.folio ?? null,
      requestedBy: record.requestedBy,
      requesterName: record.requester?.name ?? null,
      approvedBy: record.approvedBy,
      approverName: record.approver?.name ?? null,
      monto: record.monto ? Number(record.monto) : null,
      motivo: record.motivo,
      rejectReason: record.rejectReason,
      expiresAt: record.expiresAt,
      createdAt: record.createdAt,
      resolvedAt:
        effectiveStatus === "EXPIRED" && !record.resolvedAt
          ? new Date()
          : record.resolvedAt,
    },
  });
}
