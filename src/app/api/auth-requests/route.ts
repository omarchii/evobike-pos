import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  REMOTE_EXPIRATION_MS,
  validatePinForBranch,
} from "@/lib/authorizations";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
  name?: string | null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }

  const { searchParams } = req.nextUrl;
  const tipo = searchParams.get("tipo");
  const status = searchParams.get("status");
  const fromDate = searchParams.get("fromDate");
  const toDate = searchParams.get("toDate");
  const branchIdParam = searchParams.get("branchId");
  const limitParam = searchParams.get("limit");

  const where: Prisma.AuthorizationRequestWhereInput = {};
  if (user.role === "ADMIN") {
    if (branchIdParam) where.branchId = branchIdParam;
  } else {
    where.branchId = user.branchId;
  }
  if (tipo && (tipo === "CANCELACION" || tipo === "DESCUENTO")) {
    where.tipo = tipo;
  }
  if (
    status &&
    (status === "PENDING" ||
      status === "APPROVED" ||
      status === "REJECTED" ||
      status === "EXPIRED")
  ) {
    where.status = status;
  }
  if (fromDate || toDate) {
    where.createdAt = {};
    if (fromDate) where.createdAt.gte = new Date(fromDate);
    if (toDate) where.createdAt.lte = new Date(toDate);
  }

  const limit = limitParam ? Math.min(Number(limitParam) || 100, 500) : 100;

  const records = await prisma.authorizationRequest.findMany({
    where,
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
      requester: { select: { name: true } },
      approver: { select: { name: true } },
      sale: { select: { folio: true, total: true } },
      branch: { select: { code: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({
    success: true,
    data: records.map((r) => ({
      id: r.id,
      branchId: r.branchId,
      branchCode: r.branch?.code ?? null,
      branchName: r.branch?.name ?? null,
      tipo: r.tipo,
      status: r.status,
      mode: r.mode,
      saleId: r.saleId,
      saleFolio: r.sale?.folio ?? null,
      saleTotal: r.sale?.total ? Number(r.sale.total) : null,
      requestedBy: r.requestedBy,
      requesterName: r.requester?.name ?? null,
      approvedBy: r.approvedBy,
      approverName: r.approver?.name ?? null,
      monto: r.monto ? Number(r.monto) : null,
      motivo: r.motivo,
      rejectReason: r.rejectReason,
      expiresAt: r.expiresAt,
      createdAt: r.createdAt,
      resolvedAt: r.resolvedAt,
    })),
  });
}

const baseSchema = z.object({
  tipo: z.enum(["CANCELACION", "DESCUENTO"]),
  mode: z.enum(["PRESENCIAL", "REMOTA"]),
  saleId: z.string().optional(),
  monto: z.number().positive().optional(),
  motivo: z.string().trim().max(500).optional(),
  pin: z.string().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 401 },
    );
  }
  if (!user.branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON inválido" },
      { status: 400 },
    );
  }

  const parsed = baseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const { tipo, mode, saleId, monto, motivo, pin } = parsed.data;

  // Reglas cruzadas
  if (tipo === "CANCELACION") {
    if (!saleId) {
      return NextResponse.json(
        { success: false, error: "saleId requerido para cancelaciones" },
        { status: 400 },
      );
    }
    if (monto !== undefined) {
      return NextResponse.json(
        { success: false, error: "No se espera monto en cancelaciones" },
        { status: 400 },
      );
    }
  } else {
    if (monto === undefined) {
      return NextResponse.json(
        { success: false, error: "monto requerido para descuentos" },
        { status: 400 },
      );
    }
  }
  if (mode === "PRESENCIAL" && !pin) {
    return NextResponse.json(
      { success: false, error: "PIN requerido en modo presencial" },
      { status: 400 },
    );
  }

  // Validar venta asociada
  if (saleId) {
    const sale = await prisma.sale.findUnique({
      where: { id: saleId },
      select: { id: true, branchId: true, status: true, total: true },
    });
    if (!sale) {
      return NextResponse.json(
        { success: false, error: "Venta no encontrada" },
        { status: 404 },
      );
    }
    if (sale.branchId !== user.branchId && user.role !== "ADMIN") {
      return NextResponse.json(
        { success: false, error: "Venta de otra sucursal" },
        { status: 403 },
      );
    }
    if (tipo === "CANCELACION" && sale.status !== "COMPLETED") {
      return NextResponse.json(
        { success: false, error: `La venta no está en estado COMPLETED (actual: ${sale.status})` },
        { status: 400 },
      );
    }
  }

  if (mode === "PRESENCIAL") {
    const manager = await validatePinForBranch(pin!, user.branchId);
    if (!manager) {
      return NextResponse.json(
        { success: false, error: "PIN incorrecto" },
        { status: 401 },
      );
    }
    if (manager.id === user.id) {
      return NextResponse.json(
        { success: false, error: "No puedes autorizar tu propia solicitud" },
        { status: 400 },
      );
    }

    const now = new Date();
    const created = await prisma.authorizationRequest.create({
      data: {
        branchId: user.branchId,
        tipo,
        status: "APPROVED",
        mode: "PRESENCIAL",
        saleId: saleId ?? null,
        requestedBy: user.id,
        approvedBy: manager.id,
        monto: monto ?? null,
        motivo: motivo ?? null,
        resolvedAt: now,
      },
      select: {
        id: true,
        status: true,
        tipo: true,
        mode: true,
        monto: true,
        saleId: true,
        resolvedAt: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...created,
        monto: created.monto ? Number(created.monto) : null,
        approverName: manager.name,
      },
    });
  }

  // REMOTA
  const expiresAt = new Date(Date.now() + REMOTE_EXPIRATION_MS);
  const created = await prisma.authorizationRequest.create({
    data: {
      branchId: user.branchId,
      tipo,
      status: "PENDING",
      mode: "REMOTA",
      saleId: saleId ?? null,
      requestedBy: user.id,
      monto: monto ?? null,
      motivo: motivo ?? null,
      expiresAt,
    },
    select: {
      id: true,
      status: true,
      tipo: true,
      mode: true,
      monto: true,
      saleId: true,
      expiresAt: true,
      createdAt: true,
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      ...created,
      monto: created.monto ? Number(created.monto) : null,
    },
  });
}
