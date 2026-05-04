import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { PORTAL_ACCEPTABLE_STATUSES } from "@/lib/quotations";
import { send } from "@/lib/whatsapp/dispatch";

interface RouteParams {
  params: Promise<{ token: string }>;
}

function formatMXN(amount: number): string {
  return amount.toLocaleString("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  });
}

// POST /api/cotizaciones/public/[token]/accept — Q.10 mod4
//
// Endpoint público (sin auth, vía publicShareToken). El cliente que recibe
// el link acepta la cotización: status → ACEPTADA, acceptedAt = now.
//
// Idempotencia: si acceptedAt ya está set, return 200 no-op (no re-dispatch).
// TOCTOU: la transición usa updateMany con WHERE de status para defenderse de
// double-clicks o race conditions. Si validUntil pasó, 410 Gone.
//
// Side effect: dispatch QUOTATION_ACCEPTED_NOTIFY_VENDOR al vendor que creó
// la cotización (recipient = user.phone ?? branch.phone). Si ningún phone está
// disponible, marca aceptada igual y omite la notif (degrade graceful).
export async function POST(_req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const { token } = await params;

  const quotation = await prisma.quotation.findUnique({
    where: { publicShareToken: token },
    select: {
      id: true,
      folio: true,
      status: true,
      validUntil: true,
      acceptedAt: true,
      total: true,
      customerId: true,
      customer: { select: { name: true } },
      anonymousCustomerName: true,
      user: { select: { id: true, name: true, phone: true } },
      branch: { select: { name: true, phone: true } },
    },
  });

  if (!quotation) {
    return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 });
  }

  // Idempotencia: si ya tiene acceptedAt, no-op (no re-dispatch).
  if (quotation.acceptedAt) {
    return NextResponse.json({
      success: true,
      data: {
        id: quotation.id,
        folio: quotation.folio,
        status: quotation.status,
        acceptedAt: quotation.acceptedAt.toISOString(),
        alreadyAccepted: true,
      },
    });
  }

  // Defense-in-depth: si validUntil pasó pero el cron aún no estampó EXPIRED,
  // bloqueamos igual. (UI ya oculta el CTA, esto cubre llamadas directas a la API.)
  if (quotation.validUntil < new Date()) {
    return NextResponse.json(
      { success: false, error: "La cotización ha expirado" },
      { status: 410 }
    );
  }

  if (!PORTAL_ACCEPTABLE_STATUSES.includes(quotation.status)) {
    return NextResponse.json(
      {
        success: false,
        error: `Esta cotización ya no se puede aceptar (estado actual: ${quotation.status}).`,
      },
      { status: 409 }
    );
  }

  // Recipient: vendor.phone con fallback a branch.phone.
  const vendorPhone = quotation.user.phone ?? quotation.branch.phone ?? null;
  const nombreCliente =
    quotation.customer?.name ?? quotation.anonymousCustomerName ?? "Cliente";

  try {
    const acceptedAt = await prisma.$transaction(async (tx) => {
      const now = new Date();
      const updateResult = await tx.quotation.updateMany({
        where: {
          id: quotation.id,
          status: { in: PORTAL_ACCEPTABLE_STATUSES },
          acceptedAt: null,
        },
        data: { status: "ACEPTADA", acceptedAt: now },
      });

      if (updateResult.count === 0) {
        throw new ConcurrentAcceptError();
      }

      if (vendorPhone) {
        await send({
          templateKey: "QUOTATION_ACCEPTED_NOTIFY_VENDOR",
          customerId: quotation.customerId,
          recipientPhone: vendorPhone,
          variables: {
            vendedorNombre: quotation.user.name,
            folio: quotation.folio,
            clienteNombre: nombreCliente,
            total: formatMXN(Number(quotation.total)),
            sucursalNombre: quotation.branch.name,
          },
          context: { source: "manual" },
          tx,
        });
      }

      return now;
    });

    return NextResponse.json({
      success: true,
      data: {
        id: quotation.id,
        folio: quotation.folio,
        status: "ACEPTADA",
        acceptedAt: acceptedAt.toISOString(),
        notifiedVendor: !!vendorPhone,
      },
    });
  } catch (e) {
    if (e instanceof ConcurrentAcceptError) {
      const fresh = await prisma.quotation.findUnique({
        where: { id: quotation.id },
        select: { status: true, acceptedAt: true },
      });
      // Race ganado por otra request: probable que ya esté ACEPTADA — return idempotente.
      if (fresh?.acceptedAt) {
        return NextResponse.json({
          success: true,
          data: {
            id: quotation.id,
            folio: quotation.folio,
            status: fresh.status,
            acceptedAt: fresh.acceptedAt.toISOString(),
            alreadyAccepted: true,
          },
        });
      }
      return NextResponse.json(
        { success: false, error: "La cotización cambió de estado. Recarga la página." },
        { status: 409 }
      );
    }
    throw e;
  }
}

class ConcurrentAcceptError extends Error {
  constructor() {
    super("Concurrent accept detected");
    this.name = "ConcurrentAcceptError";
  }
}
