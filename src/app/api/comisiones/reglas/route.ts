import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// ── GET — List commission rules ─────────────────────────────────────────────

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  const { searchParams } = req.nextUrl;
  const includeInactive = searchParams.get("includeInactive") === "true";
  const queryBranchId = searchParams.get("branchId");

  let branchFilter: { branchId: string } | Record<string, never>;
  if (user.role === "ADMIN") {
    branchFilter = queryBranchId ? { branchId: queryBranchId } : {};
  } else {
    if (!user.branchId) {
      return NextResponse.json(
        { success: false, error: "Sin sucursal asignada" },
        { status: 400 },
      );
    }
    branchFilter = { branchId: user.branchId };
  }

  const rules = await prisma.commissionRule.findMany({
    where: {
      ...branchFilter,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: {
      modelo: { select: { id: true, nombre: true } },
    },
    orderBy: [{ role: "asc" }, { createdAt: "desc" }],
  });

  const data = rules.map((r) => ({
    id: r.id,
    role: r.role,
    commissionType: r.commissionType,
    value: Number(r.value),
    modeloId: r.modeloId,
    modeloNombre: r.modelo?.nombre ?? null,
    isActive: r.isActive,
    branchId: r.branchId,
    createdAt: r.createdAt.toISOString(),
  }));

  return NextResponse.json({ success: true, data });
}

// ── POST — Create commission rule ───────────────────────────────────────────

const createSchema = z.object({
  role: z.enum(["SELLER", "TECHNICIAN", "MANAGER"]),
  commissionType: z.enum(["PERCENTAGE", "FIXED_AMOUNT"]),
  value: z.number().positive("El valor debe ser positivo"),
  modeloId: z.string().uuid().nullable(),
  branchId: z.string().uuid().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
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

  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const { role, commissionType, value, modeloId } = parsed.data;

  const branchId =
    user.role === "ADMIN"
      ? parsed.data.branchId ?? user.branchId
      : user.branchId;

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Sucursal requerida" },
      { status: 400 },
    );
  }

  if (user.role === "ADMIN" && parsed.data.branchId) {
    const branch = await prisma.branch.findUnique({ where: { id: branchId } });
    if (!branch) {
      return NextResponse.json(
        { success: false, error: "Sucursal no encontrada" },
        { status: 404 },
      );
    }
  }

  // Check for duplicate active rule (same role + modelo + branch)
  const existing = await prisma.commissionRule.findFirst({
    where: {
      branchId,
      role,
      modeloId: modeloId ?? null,
      isActive: true,
    },
  });

  if (existing) {
    const target = modeloId ? "ese modelo" : "todos los modelos";
    return NextResponse.json(
      {
        success: false,
        error: `Ya existe una regla activa para ${role} en ${target}. Desactívala primero.`,
      },
      { status: 409 },
    );
  }

  // Validate modeloId exists if provided
  if (modeloId) {
    const modelo = await prisma.modelo.findUnique({ where: { id: modeloId } });
    if (!modelo) {
      return NextResponse.json(
        { success: false, error: "Modelo no encontrado" },
        { status: 404 },
      );
    }
  }

  const rule = await prisma.commissionRule.create({
    data: {
      role,
      commissionType,
      value,
      modeloId,
      branchId,
    },
    include: {
      modelo: { select: { id: true, nombre: true } },
    },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: rule.id,
      role: rule.role,
      commissionType: rule.commissionType,
      value: Number(rule.value),
      modeloId: rule.modeloId,
      modeloNombre: rule.modelo?.nombre ?? null,
      isActive: rule.isActive,
      branchId: rule.branchId,
      createdAt: rule.createdAt.toISOString(),
    },
  });
}
