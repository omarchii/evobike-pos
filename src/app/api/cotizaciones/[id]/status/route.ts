import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBranchedUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import { getEffectiveStatus } from "@/lib/quotations";
import { PaymentMethod, QuotationStatus } from "@prisma/client";

interface RouteParams {
  params: Promise<{ id: string }>;
}

type Action = "ENVIAR_A_FABRICA" | "NOTIFICAR_CLIENTE" | "REGISTRAR_PAGO";

const VALID_FROM: Record<Action, QuotationStatus[]> = {
  ENVIAR_A_FABRICA: ["EN_ESPERA_CLIENTE"],
  NOTIFICAR_CLIENTE: ["EN_ESPERA_FABRICA"],
  // Q.3 mod4 — DRAFT incluido (caso presencial: vendedor crea cotización y cliente paga al instante).
  // Q.10 mod4 — ACEPTADA incluido (cliente aceptó vía portal, vendedor cobra después).
  REGISTRAR_PAGO: ["DRAFT", "EN_ESPERA_CLIENTE", "EN_ESPERA_FABRICA", "ACEPTADA"],
};

const TARGET_STATUS: Record<Action, QuotationStatus> = {
  ENVIAR_A_FABRICA: "EN_ESPERA_FABRICA",
  NOTIFICAR_CLIENTE: "EN_ESPERA_CLIENTE",
  REGISTRAR_PAGO: "PAGADA",
};

// REGISTRAR_PAGO solo permite los métodos directos. Saldo a favor (CREDIT_BALANCE)
// y financieras (ATRATO) requieren flujos dedicados — no exponer en este path simple.
const PAYMENT_METHODS_ALLOWED: PaymentMethod[] = ["CASH", "CARD", "TRANSFER"];

// POST /api/cotizaciones/[id]/status
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const guard = requireBranchedUser(session);
  if (!guard.ok) return guard.response;
  const { id: userId, branchId, role } = guard.user;

  if (!["SELLER", "MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
  }

  const { id } = await params;

  let action: Action;
  let paymentMethod: PaymentMethod | null = null;
  let paymentReference: string | null = null;
  try {
    const body = (await req.json()) as {
      action?: unknown;
      method?: unknown;
      reference?: unknown;
    };
    if (
      body.action !== "ENVIAR_A_FABRICA" &&
      body.action !== "NOTIFICAR_CLIENTE" &&
      body.action !== "REGISTRAR_PAGO"
    ) {
      return NextResponse.json(
        { success: false, error: "Acción inválida" },
        { status: 400 }
      );
    }
    action = body.action;

    if (action === "REGISTRAR_PAGO") {
      if (
        typeof body.method !== "string" ||
        !PAYMENT_METHODS_ALLOWED.includes(body.method as PaymentMethod)
      ) {
        return NextResponse.json(
          { success: false, error: "Método de pago inválido (CASH, CARD o TRANSFER)" },
          { status: 400 }
        );
      }
      paymentMethod = body.method as PaymentMethod;

      if (body.reference !== undefined && body.reference !== null) {
        if (typeof body.reference !== "string") {
          return NextResponse.json(
            { success: false, error: "Referencia inválida" },
            { status: 400 }
          );
        }
        const trimmed = body.reference.trim();
        if (trimmed.length > 0) paymentReference = trimmed.slice(0, 120);
      }
    }
  } catch {
    return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 });
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    select: {
      id: true,
      status: true,
      branchId: true,
      validUntil: true,
      total: true,
      customerId: true,
      folio: true,
    },
  });

  if (!quotation) {
    return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 });
  }

  if (role !== "ADMIN" && quotation.branchId !== branchId) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  // Idempotencia REGISTRAR_PAGO: si ya está PAGADA, no-op (no duplica CashTransaction).
  if (action === "REGISTRAR_PAGO" && quotation.status === "PAGADA") {
    return NextResponse.json({
      success: true,
      data: {
        id: quotation.id,
        folio: quotation.folio,
        status: quotation.status,
        alreadyPaid: true,
      },
    });
  }

  // Check expiration (defense-in-depth: aunque el cron Q.3 ya materialice EXPIRED en DB,
  // mantener `getEffectiveStatus` cubre el caso de cron caído 1 día).
  const effectiveStatus = getEffectiveStatus({
    status: quotation.status,
    validUntil: quotation.validUntil,
  });

  if (effectiveStatus === "EXPIRED") {
    return NextResponse.json(
      { success: false, error: "La cotización ha expirado" },
      { status: 409 }
    );
  }

  // Validate transition (against actual DB status, not effective).
  const validFrom = VALID_FROM[action];
  if (!validFrom.includes(quotation.status)) {
    return NextResponse.json(
      {
        success: false,
        error: `Transición inválida: la acción '${action}' no es permitida desde el estado '${quotation.status}'.`,
      },
      { status: 422 }
    );
  }

  const newStatus = TARGET_STATUS[action];

  // REGISTRAR_PAGO: necesita CashTransaction PAYMENT_IN linkeado a cotización
  // dentro de la misma transaction que el update de status, para que el contrato
  // Q.3↔Q.12 sea atómico (POS verá la cotización PAGADA SOLO si CashTransaction
  // existe con quotationId = X).
  if (action === "REGISTRAR_PAGO") {
    // Buscar sesión abierta del usuario en la sucursal de la cotización.
    // Decisión cliente A.2 2026-04-30: siempre requiere caja para registrar PAYMENT_IN.
    const openSession = await prisma.cashRegisterSession.findFirst({
      where: {
        userId,
        branchId: quotation.branchId,
        closedAt: null,
        status: "OPEN",
      },
      select: { id: true },
      orderBy: { openedAt: "desc" },
    });

    if (!openSession) {
      return NextResponse.json(
        {
          success: false,
          error:
            "No hay sesión de caja abierta en la sucursal de la cotización. Abre una sesión antes de registrar el pago.",
        },
        { status: 409 }
      );
    }

    try {
      const result = await prisma.$transaction(async (tx) => {
        // Update atómico con WHERE de status para defender contra clicks concurrentes.
        const updateResult = await tx.quotation.updateMany({
          where: {
            id,
            status: { in: validFrom },
          },
          data: { status: newStatus },
        });

        if (updateResult.count === 0) {
          // Otra request transicionó la cotización entre el findUnique y el update.
          throw new ConcurrentTransitionError();
        }

        await tx.cashTransaction.create({
          data: {
            sessionId: openSession.id,
            quotationId: quotation.id,
            customerId: quotation.customerId,
            userId,
            type: "PAYMENT_IN",
            method: paymentMethod!,
            amount: quotation.total,
            reference: paymentReference,
            collectionStatus: "COLLECTED",
            collectedAt: new Date(),
          },
        });

        const fresh = await tx.quotation.findUniqueOrThrow({
          where: { id },
          select: { id: true, folio: true, status: true, updatedAt: true },
        });
        return fresh;
      });

      return NextResponse.json({
        success: true,
        data: {
          id: result.id,
          folio: result.folio,
          status: result.status,
          updatedAt: result.updatedAt.toISOString(),
        },
      });
    } catch (e) {
      if (e instanceof ConcurrentTransitionError) {
        return NextResponse.json(
          {
            success: false,
            error: "La cotización cambió de estado mientras procesábamos el pago. Recarga e intenta de nuevo.",
          },
          { status: 409 }
        );
      }
      throw e;
    }
  }

  // Non-payment transitions: simple status flip (sin CashTransaction).
  const updated = await prisma.quotation.update({
    where: { id },
    data: { status: newStatus },
    select: { id: true, folio: true, status: true, updatedAt: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: updated.id,
      folio: updated.folio,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

class ConcurrentTransitionError extends Error {
  constructor() {
    super("Concurrent transition detected");
    this.name = "ConcurrentTransitionError";
  }
}
