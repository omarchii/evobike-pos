import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { validatePinForBranch, expireIfNeeded } from "@/lib/authorizations";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

const schema = z.object({
  action: z.enum(["APPROVE", "REJECT"]),
  pin: z.string().regex(/^\d{4,6}$/, "PIN inválido"),
  rejectReason: z.string().trim().max(500).optional(),
});

export async function POST(
  req: NextRequest,
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

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { success: false, error: "JSON inválido" },
      { status: 400 },
    );
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const { action, pin, rejectReason } = parsed.data;

  const record = await prisma.authorizationRequest.findUnique({
    where: { id },
    select: {
      id: true,
      branchId: true,
      status: true,
      requestedBy: true,
      expiresAt: true,
    },
  });
  if (!record) {
    return NextResponse.json(
      { success: false, error: "Solicitud no encontrada" },
      { status: 404 },
    );
  }
  if (user.role !== "ADMIN" && record.branchId !== user.branchId) {
    return NextResponse.json(
      { success: false, error: "Solicitud de otra sucursal" },
      { status: 403 },
    );
  }

  const effectiveStatus = await expireIfNeeded(record);
  if (effectiveStatus !== "PENDING") {
    return NextResponse.json(
      { success: false, error: `La solicitud ya no está pendiente (estado: ${effectiveStatus})` },
      { status: 409 },
    );
  }

  const manager = await validatePinForBranch(pin, record.branchId);
  if (!manager) {
    return NextResponse.json(
      { success: false, error: "PIN incorrecto" },
      { status: 401 },
    );
  }
  if (manager.id === record.requestedBy) {
    return NextResponse.json(
      { success: false, error: "No puedes autorizar tu propia solicitud" },
      { status: 400 },
    );
  }

  // Resolución atómica con guard por status=PENDING para evitar double-approve en carreras.
  const now = new Date();
  const result = await prisma.authorizationRequest.updateMany({
    where: { id: record.id, status: "PENDING" },
    data: {
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      approvedBy: manager.id,
      resolvedAt: now,
      rejectReason: action === "REJECT" ? (rejectReason ?? null) : null,
    },
  });
  if (result.count === 0) {
    return NextResponse.json(
      { success: false, error: "La solicitud fue resuelta por otro manager" },
      { status: 409 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      id: record.id,
      status: action === "APPROVE" ? "APPROVED" : "REJECTED",
      approverName: manager.name,
      resolvedAt: now,
    },
  });
}
