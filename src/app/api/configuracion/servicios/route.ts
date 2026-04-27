import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

function canManage(user: SessionUser | undefined): boolean {
  return !!user && (user.role === "ADMIN" || user.role === "MANAGER");
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!canManage(user)) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

  const { searchParams } = req.nextUrl;
  const qBranchId = searchParams.get("branchId");
  const includeInactive = searchParams.get("includeInactive") === "true";

  const branchFilter =
    user!.role === "ADMIN"
      ? qBranchId
        ? { branchId: qBranchId }
        : {}
      : { branchId: user!.branchId! };

  const services = await prisma.serviceCatalog.findMany({
    where: {
      ...branchFilter,
      ...(includeInactive ? {} : { isActive: true }),
    },
    include: { branch: { select: { id: true, code: true, name: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  const data = services.map((s) => ({
    id: s.id,
    name: s.name,
    basePrice: Number(s.basePrice),
    isActive: s.isActive,
    esMantenimiento: s.esMantenimiento,
    branchId: s.branchId,
    branchCode: s.branch?.code ?? null,
    branchName: s.branch?.name ?? null,
  }));

  return NextResponse.json({ success: true, data });
}

const createSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  basePrice: z.number().nonnegative("El precio debe ser ≥ 0"),
  branchId: z.string().uuid().optional(),
  esMantenimiento: z.boolean().optional().default(false),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!canManage(user)) {
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

  const branchId =
    user!.role === "ADMIN"
      ? parsed.data.branchId ?? user!.branchId
      : user!.branchId;

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Sucursal requerida" },
      { status: 400 },
    );
  }

  const branch = await prisma.branch.findUnique({ where: { id: branchId } });
  if (!branch) {
    return NextResponse.json(
      { success: false, error: "Sucursal no encontrada" },
      { status: 404 },
    );
  }

  const created = await prisma.serviceCatalog.create({
    data: {
      name: parsed.data.name,
      basePrice: parsed.data.basePrice,
      branchId,
      esMantenimiento: parsed.data.esMantenimiento,
    },
    include: { branch: { select: { id: true, code: true, name: true } } },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: created.id,
      name: created.name,
      basePrice: Number(created.basePrice),
      isActive: created.isActive,
      esMantenimiento: created.esMantenimiento,
      branchId: created.branchId,
      branchCode: created.branch?.code ?? null,
      branchName: created.branch?.name ?? null,
    },
  });
}
