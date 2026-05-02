import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSessionUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { extractPlaceholders } from "@/lib/whatsapp/render";

const updateSchema = z.object({
  bodyTemplate: z.string().min(1, "El cuerpo no puede estar vacío"),
  description: z.string().min(1, "La descripción no puede estar vacía"),
  isActive: z.boolean(),
});

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ key: string }> },
) {
  const session = await getServerSession(authOptions);
  const guard = requireSessionUser(session);
  if (!guard.ok) return guard.response;

  if (guard.user.role !== "ADMIN" && guard.user.role !== "MANAGER") {
    return NextResponse.json(
      { success: false, error: "Solo MANAGER o ADMIN" },
      { status: 403 },
    );
  }

  const { key } = await params;
  const parsed = updateSchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { bodyTemplate, description, isActive } = parsed.data;
  const requiredVariables = extractPlaceholders(bodyTemplate);

  const template = await prisma.whatsAppTemplate.update({
    where: { key },
    data: {
      bodyTemplate,
      description,
      isActive,
      requiredVariables,
      updatedByUserId: guard.user.id,
    },
  });

  return NextResponse.json({ success: true, template });
}
