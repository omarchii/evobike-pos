import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";

const createNoteSchema = z.object({
  body: z.string().trim().min(1, "El texto es obligatorio").max(4000),
  kind: z.enum(["NOTE", "PHONE_CALL", "WHATSAPP_SENT", "EMAIL_SENT"]).default("NOTE"),
  pinned: z.boolean().default(false),
});

// GET /api/customers/[id]/notes — lista con pinned primero.
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const { id: customerId } = await params;

  const notes = await prisma.customerNote.findMany({
    where: { customerId },
    orderBy: [{ pinned: "desc" }, { createdAt: "desc" }],
    take: limit,
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: notes });
}

// POST /api/customers/[id]/notes — crear (SELLER+).
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = createNoteSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { id: customerId } = await params;

  // Solo MANAGER+ puede crear con pinned=true.
  const canPin = user.role === "ADMIN" || user.role === "MANAGER";
  const pinned = parsed.data.pinned && canPin;

  const note = await prisma.customerNote.create({
    data: {
      customerId,
      authorId: user.id,
      kind: parsed.data.kind,
      body: parsed.data.body,
      pinned,
    },
    include: { author: { select: { id: true, name: true } } },
  });

  return NextResponse.json({ success: true, data: note });
}
