import { z } from "zod";
import { Prisma, type ServiceOrderApprovalChannel } from "@prisma/client";

// Esquema canónico de los ítems dentro de ServiceOrderApproval.itemsJson.
// Usado al crear el approval (valida el payload entrante) y al responder
// (valida lo que se leyó de la BD antes de materializar ServiceOrderItems).
export const approvalItemSchema = z.object({
  nombre: z.string().min(1).max(200),
  cantidad: z.number().int().positive(),
  precio: z.number().nonnegative(),
  subtotal: z.number().nonnegative(),
});

export type ApprovalItem = z.infer<typeof approvalItemSchema>;

export const approvalItemsJsonSchema = z.array(approvalItemSchema).min(1);

export class ApprovalNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalNotFoundError";
  }
}

export class ApprovalAlreadyRespondedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalAlreadyRespondedError";
  }
}

export class ApprovalItemsCorruptError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ApprovalItemsCorruptError";
  }
}

interface ApplyApprovalArgs {
  approvalId: string;
  serviceOrderId: string;
  decision: "APPROVED" | "REJECTED";
  channel: ServiceOrderApprovalChannel;
  note: string | null;
}

interface ApplyApprovalResult {
  approvalId: string;
  status: "APPROVED" | "REJECTED";
  orderTotal: number;
}

// Aplica la respuesta (APPROVED|REJECTED) a un ServiceOrderApproval
// dentro de una transacción abierta. Si APPROVED, materializa los ítems
// del snapshot como ServiceOrderItem con isExtra=true, recalcula totales
// de la orden y limpia subStatus=WAITING_APPROVAL si corresponde.
//
// Lanza:
//   ApprovalNotFoundError            → 404
//   ApprovalAlreadyRespondedError    → 409
//   ApprovalItemsCorruptError        → 500 (itemsJson inválido en BD)
export async function applyApprovalDecisionTx(
  tx: Prisma.TransactionClient,
  args: ApplyApprovalArgs,
): Promise<ApplyApprovalResult> {
  const approval = await tx.serviceOrderApproval.findUnique({
    where: { id: args.approvalId },
    select: {
      id: true,
      serviceOrderId: true,
      status: true,
      itemsJson: true,
    },
  });

  if (!approval || approval.serviceOrderId !== args.serviceOrderId) {
    throw new ApprovalNotFoundError("Aprobación no encontrada");
  }
  if (approval.status !== "PENDING") {
    throw new ApprovalAlreadyRespondedError(
      "La aprobación ya fue respondida",
    );
  }

  await tx.serviceOrderApproval.update({
    where: { id: args.approvalId },
    data: {
      status: args.decision,
      channel: args.channel,
      respondedAt: new Date(),
      respondedNote: args.note,
    },
  });

  if (args.decision === "APPROVED") {
    const parsed = approvalItemsJsonSchema.safeParse(approval.itemsJson);
    if (!parsed.success) {
      throw new ApprovalItemsCorruptError(
        "El snapshot de la aprobación está corrupto",
      );
    }

    for (const it of parsed.data) {
      await tx.serviceOrderItem.create({
        data: {
          serviceOrderId: args.serviceOrderId,
          description: it.nombre,
          quantity: it.cantidad,
          price: new Prisma.Decimal(it.precio),
          isExtra: true,
        },
      });
    }
  }

  // Recalcular totales (cambia si APPROVED creó ítems; idempotente si REJECTED).
  const items = await tx.serviceOrderItem.findMany({
    where: { serviceOrderId: args.serviceOrderId },
    select: { price: true, quantity: true },
  });
  const subtotal = items.reduce(
    (acc, it) => acc + Number(it.price) * it.quantity,
    0,
  );

  // Si la orden estaba esperando aprobación, limpia el sub-estado
  // independientemente del decision (APPROVED o REJECTED destrabaran la orden).
  const order = await tx.serviceOrder.findUnique({
    where: { id: args.serviceOrderId },
    select: { status: true, subStatus: true },
  });

  await tx.serviceOrder.update({
    where: { id: args.serviceOrderId },
    data: {
      subtotal,
      total: subtotal,
      subStatus:
        order?.status === "IN_PROGRESS" && order.subStatus === "WAITING_APPROVAL"
          ? null
          : undefined,
    },
  });

  return {
    approvalId: args.approvalId,
    status: args.decision,
    orderTotal: subtotal,
  };
}
