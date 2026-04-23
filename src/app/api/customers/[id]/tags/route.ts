import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { isManagerPlus, writeCustomerEditLog } from "@/lib/customers/service";

const patchSchema = z.object({
  add: z.array(z.string().trim().min(1).max(32)).optional(),
  remove: z.array(z.string().trim().min(1).max(32)).optional(),
});

// PATCH /api/customers/[id]/tags — add/remove tags manuales. MANAGER+.
export async function PATCH(
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

  const body: unknown = await req.json();
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ success: false, error: "Cuerpo inválido" }, { status: 400 });
  }

  const { id } = await params;
  const add = parsed.data.add ?? [];
  const remove = parsed.data.remove ?? [];
  if (!add.length && !remove.length) {
    return NextResponse.json({ success: true, data: { unchanged: true } });
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.customer.findUnique({ where: { id }, select: { tags: true } });
      if (!current) return null;

      const tagSet = new Set(current.tags);
      for (const t of add) tagSet.add(t);
      for (const t of remove) tagSet.delete(t);
      const nextTags = Array.from(tagSet).sort();

      const updated = await tx.customer.update({
        where: { id },
        data: { tags: nextTags },
        select: { id: true, tags: true },
      });

      await writeCustomerEditLog(tx, {
        customerId: id,
        userId: user.id,
        entries: [
          {
            field: "tags",
            oldValue: JSON.stringify(current.tags),
            newValue: JSON.stringify(nextTags),
          },
        ],
      });

      return updated;
    });

    if (!result) {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: result });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }
    console.error("[api/customers/[id]/tags PATCH]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
