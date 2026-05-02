import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

function isManagerOrAdmin(role: string | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

const optionalNullable = z
  .union([z.string().trim(), z.null()])
  .optional()
  .transform((v) => {
    if (v === undefined) return undefined;
    if (v === null) return null;
    return v.length > 0 ? v : null;
  });

const patchSchema = z.object({
  nombre: z.string().trim().min(1).optional(),
  rfc: optionalNullable,
  contacto: optionalNullable,
  telefono: optionalNullable,
  email: z
    .union([z.string().trim().email("Email inválido"), z.literal(""), z.null()])
    .optional()
    .transform((v) => {
      if (v === undefined) return undefined;
      if (v === null || v === "") return null;
      return v;
    }),
  direccion: optionalNullable,
  notas: optionalNullable,
  isActive: z.boolean().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user || !isManagerOrAdmin(user.role)) {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }

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

  const existing = await prisma.supplier.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json(
      { success: false, error: "Proveedor no encontrado" },
      { status: 404 },
    );
  }

  const updated = await prisma.supplier.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json({ success: true, data: updated });
}
