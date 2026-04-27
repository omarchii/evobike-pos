import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

function requireAdmin(user: SessionUser | undefined): NextResponse | null {
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }
  return null;
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  const denied = requireAdmin(user);
  if (denied) return denied;

  const { id } = await params;
  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) {
    return NextResponse.json(
      { success: false, error: "Sucursal no encontrada" },
      { status: 404 },
    );
  }
  return NextResponse.json({ success: true, data: branch });
}

const patchSchema = z.object({
  name: z.string().min(1).optional(),
  rfc: z.string().nullable().optional(),
  razonSocial: z.string().nullable().optional(),
  regimenFiscal: z.string().nullable().optional(),
  street: z.string().nullable().optional(),
  extNum: z.string().nullable().optional(),
  intNum: z.string().nullable().optional(),
  colonia: z.string().nullable().optional(),
  city: z.string().nullable().optional(),
  state: z.string().nullable().optional(),
  zip: z.string().nullable().optional(),
  phone: z.string().nullable().optional(),
  email: z.string().email("Email inválido").nullable().or(z.literal("")).optional(),
  website: z.string().nullable().optional(),
  terminosCotizacion: z.string().nullable().optional(),
  terminosPedido: z.string().nullable().optional(),
  terminosPoliza: z.string().nullable().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  const denied = requireAdmin(user);
  if (denied) return denied;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON inválido" },
      { status: 400 },
    );
  }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }

  const existing = await prisma.branch.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Sucursal no encontrada" },
      { status: 404 },
    );
  }

  const data: Record<string, string | null> = {};
  for (const [k, v] of Object.entries(parsed.data)) {
    if (v === undefined) continue;
    data[k] = v === "" ? null : (v as string | null);
  }

  const updated = await prisma.branch.update({ where: { id }, data });
  return NextResponse.json({ success: true, data: updated });
}
