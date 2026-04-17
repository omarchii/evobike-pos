import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import {
  applyApprovalDecisionTx,
  ApprovalNotFoundError,
  ApprovalAlreadyRespondedError,
  ApprovalItemsCorruptError,
} from "@/lib/workshop-approvals";

// Sin auth. El cliente final aprueba/rechaza desde el portal público.
// Canal forzado: WHATSAPP_PUBLIC (registro del canal de comunicación con
// el que se solicitó la aprobación).
//
// Idempotencia: si el approval ya fue respondido, retorna 409. No hay
// rate-limit explícito; el status PENDING actúa como único-uso.
export const dynamic = "force-dynamic";

const publicRespondSchema = z.object({
  decision: z.enum(["APPROVED", "REJECTED"]),
  note: z.string().max(500).optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ token: string; approvalId: string }> },
): Promise<NextResponse> {
  const { token, approvalId } = await params;

  const body: unknown = await req.json().catch(() => ({}));
  const parsed = publicRespondSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  try {
    // Validar token → cargar serviceOrderId
    const order = await prisma.serviceOrder.findUnique({
      where: { publicToken: token },
      select: {
        id: true,
        publicTokenEnabled: true,
        status: true,
      },
    });
    if (!order || !order.publicTokenEnabled) {
      return NextResponse.json(
        { success: false, error: "Orden no encontrada" },
        { status: 404 },
      );
    }
    if (order.status === "DELIVERED" || order.status === "CANCELLED") {
      return NextResponse.json(
        {
          success: false,
          error: "Esta orden ya no admite cambios",
        },
        { status: 422 },
      );
    }

    const result = await prisma.$transaction((tx) =>
      applyApprovalDecisionTx(tx, {
        approvalId,
        serviceOrderId: order.id,
        decision: input.decision,
        channel: "WHATSAPP_PUBLIC",
        note: input.note ?? null,
      }),
    );

    return NextResponse.json({
      success: true,
      data: { approvalId: result.approvalId, status: result.status },
    });
  } catch (error: unknown) {
    if (error instanceof ApprovalNotFoundError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 404 },
      );
    }
    if (error instanceof ApprovalAlreadyRespondedError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 409 },
      );
    }
    if (error instanceof ApprovalItemsCorruptError) {
      console.error(
        "[api/service-orders/public/[token]/approvals/[approvalId]/respond] itemsJson corrupto",
        { token, approvalId },
      );
      return NextResponse.json(
        { success: false, error: "La aprobación no puede procesarse" },
        { status: 500 },
      );
    }
    console.error("[api/service-orders/public/[token]/approvals/[approvalId]/respond POST]", error);
    return NextResponse.json(
      { success: false, error: "Error al procesar la aprobación" },
      { status: 500 },
    );
  }
}
