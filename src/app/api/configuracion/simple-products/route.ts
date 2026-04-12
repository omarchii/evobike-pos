import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { normalizeModeloAplicable } from "@/lib/products";
import { z } from "zod";

interface SessionUser {
  id: string;
  branchId: string | null;
  role: string;
}

const CATEGORIAS = ["ACCESORIO", "CARGADOR", "REFACCION", "BATERIA_STANDALONE"] as const;

function requireAdmin(user: SessionUser | undefined): NextResponse | null {
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const includeInactive = searchParams.get("includeInactive") === "true";
  const categoria = searchParams.get("categoria");

  const items = await prisma.simpleProduct.findMany({
    where: {
      ...(includeInactive ? {} : { isActive: true }),
      ...(categoria ? { categoria: categoria as (typeof CATEGORIAS)[number] } : {}),
    },
    orderBy: [{ isActive: "desc" }, { categoria: "asc" }, { nombre: "asc" }],
  });
  return NextResponse.json({ success: true, data: items });
}

const createSchema = z.object({
  codigo: z.string().min(1),
  nombre: z.string().min(1),
  descripcion: z.string().nullable().optional(),
  categoria: z.enum(CATEGORIAS),
  modeloAplicable: z.string().nullable().optional(),
  precioPublico: z.number().nonnegative(),
  precioMayorista: z.number().nonnegative(),
  stockMinimo: z.number().int().nonnegative().optional(),
  stockMaximo: z.number().int().nonnegative().optional(),
});

export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  const denied = requireAdmin(user);
  if (denied) return denied;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ success: false, error: "JSON inválido" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const dup = await prisma.simpleProduct.findUnique({
    where: { codigo: parsed.data.codigo },
  });
  if (dup) {
    return NextResponse.json(
      { success: false, error: "Ya existe un producto con ese código" },
      { status: 409 },
    );
  }

  const created = await prisma.simpleProduct.create({
    data: {
      ...parsed.data,
      descripcion: parsed.data.descripcion ?? null,
      modeloAplicable: normalizeModeloAplicable(parsed.data.modeloAplicable),
      stockMinimo: parsed.data.stockMinimo ?? 0,
      stockMaximo: parsed.data.stockMaximo ?? 0,
    },
  });
  return NextResponse.json({ success: true, data: created });
}
