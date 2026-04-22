import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
  buildWorkshopWhatsappLink,
  type WhatsappLinkReason,
} from "@/lib/workshop";
import { computeApprovalExpiresAt } from "@/lib/workshop-approval-expiry";
import { resolveOperationalBranchId } from "@/lib/branch-scope";
import type { SessionUser } from "@/lib/auth-types";

const approvalItemSchema = z.object({
  nombre: z.string().min(1).max(200),
  cantidad: z.number().int().positive(),
  precio: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
});

const approvalSchema = z.object({
  items: z.array(approvalItemSchema).min(1, "Se requiere al menos un ítem"),
  channel: z.literal("WHATSAPP_PUBLIC").optional(),
});

const STATUS_LABELS_ES: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Terminada",
  DELIVERED: "Entregada",
  CANCELLED: "Cancelada",
};

const SUB_STATUS_LABELS_ES: Record<string, string> = {
  WAITING_PARTS: "Esperando refacciones",
  WAITING_APPROVAL: "Esperando aprobación",
  PAUSED: "Pausada",
};

// POST /api/service-orders/[id]/approvals
// Crea un ServiceOrderApproval con los ítems extra propuestos. Si el orden
// está IN_PROGRESS, la transacción también setea subStatus=WAITING_APPROVAL.
//
// Si channel=WHATSAPP_PUBLIC, arma el link wa.me con la plantilla de la
// sucursal. El approval SIEMPRE se crea; la respuesta discrimina vía
// `whatsappReason` por qué el link puede venir null:
//   - TEMPLATE_NOT_CONFIGURED → sucursal sin Branch.whatsappTemplateTaller
//     (o sin publicToken asignado a la orden).
//   - CUSTOMER_HAS_NO_PHONE   → cliente sin teléfono válido.
//   - null                    → link armado correctamente.
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autenticado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const userId = user.id;
  const branchId = await resolveOperationalBranchId({ user });
  if (branchId === "__none__") {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 },
    );
  }
  if (user.role === "SELLER") {
    return NextResponse.json(
      { success: false, error: "Sin permisos para crear aprobaciones" },
      { status: 403 },
    );
  }

  const { id: serviceOrderId } = await params;

  const body: unknown = await req.json();
  const parsed = approvalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
      { status: 400 },
    );
  }
  const input = parsed.data;

  // Validación server-side de subtotales y total.
  let totalEstimado = new Prisma.Decimal(0);
  for (const it of input.items) {
    const computed = new Prisma.Decimal(it.precio).mul(it.cantidad).toDecimalPlaces(2);
    const given = new Prisma.Decimal(it.subtotal).toDecimalPlaces(2);
    if (!computed.equals(given)) {
      return NextResponse.json(
        {
          success: false,
          error: `El subtotal de "${it.nombre}" no coincide con cantidad × precio`,
        },
        { status: 422 },
      );
    }
    totalEstimado = totalEstimado.add(computed);
  }

  try {
    await requireActiveUser(session);

    const order = await prisma.serviceOrder.findUnique({
      where: { id: serviceOrderId },
      select: {
        id: true,
        branchId: true,
        status: true,
        subStatus: true,
        folio: true,
        publicToken: true,
        publicTokenEnabled: true,
        customer: { select: { phone: true } },
        branch: { select: { whatsappTemplateTaller: true } },
      },
    });
    if (!order) {
      return NextResponse.json({ success: false, error: "Orden no encontrada" }, { status: 404 });
    }
    if (order.branchId !== branchId) {
      return NextResponse.json(
        { success: false, error: "Sin acceso a esta orden" },
        { status: 403 },
      );
    }
    if (order.status !== "PENDING" && order.status !== "IN_PROGRESS") {
      return NextResponse.json(
        {
          success: false,
          error:
            "Solo se pueden solicitar aprobaciones en órdenes pendientes o en proceso",
        },
        { status: 422 },
      );
    }

    const expiresAt = computeApprovalExpiresAt();

    const approvalId = await prisma.$transaction(async (tx) => {
      const created = await tx.serviceOrderApproval.create({
        data: {
          serviceOrderId,
          itemsJson: input.items as unknown as Prisma.InputJsonValue,
          totalEstimado,
          createdByUserId: userId,
          status: "PENDING",
          expiresAt,
        },
        select: { id: true },
      });

      if (order.status === "IN_PROGRESS" && order.subStatus !== "WAITING_APPROVAL") {
        await tx.serviceOrder.update({
          where: { id: serviceOrderId },
          data: { subStatus: "WAITING_APPROVAL" },
        });
      }

      return created.id;
    });

    // ── WhatsApp link (opcional, no bloqueante) ──
    let whatsappUrl: string | null = null;
    let whatsappReason: WhatsappLinkReason = null;
    if (input.channel === "WHATSAPP_PUBLIC") {
      const canBuildPublicLink =
        order.publicToken != null && order.publicTokenEnabled === true;
      if (!canBuildPublicLink) {
        whatsappReason = "TEMPLATE_NOT_CONFIGURED";
      } else {
        const subStatusLabel = order.subStatus
          ? SUB_STATUS_LABELS_ES[order.subStatus]
          : null;
        const estadoLabel =
          subStatusLabel ?? STATUS_LABELS_ES[order.status] ?? order.status;
        const totalStr = new Intl.NumberFormat("es-MX", {
          style: "currency",
          currency: "MXN",
        }).format(totalEstimado.toNumber());
        const publicUrl = `${req.nextUrl.origin}/taller/public/${order.publicToken}`;
        const built = buildWorkshopWhatsappLink({
          template: order.branch.whatsappTemplateTaller,
          customerPhone: order.customer?.phone ?? null,
          folio: order.folio,
          estado: estadoLabel,
          total: totalStr,
          publicUrl,
        });
        whatsappUrl = built.url;
        whatsappReason = built.reason;
      }
    }

    return NextResponse.json({
      success: true,
      data: {
        approvalId,
        expiresAt: expiresAt.toISOString(),
        whatsappUrl,
        whatsappReason,
      },
    });
  } catch (error: unknown) {
    if (error instanceof UserInactiveError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 },
      );
    }
    console.error("[api/service-orders/[id]/approvals POST]", error);
    const message =
      error instanceof Error ? error.message : "Error al crear la aprobación";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
