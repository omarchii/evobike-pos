import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";

// GET /api/customers/[id]/timeline — 7 fuentes agregadas (BRIEF §7.4 Resumen).
//
// Paginación offset-based. Deuda conocida §13: degrada a partir de ~500
// eventos. Cuando ocurra, refactor a cursor opaco.
//
// Filtros opcionales:
//   ?sources=sale,workshop,quotation,note,payment,balance   (lista, default: todas)
//   ?from=ISO&to=ISO                                        (rango)
//   ?limit=50&offset=0

type TimelineKind =
  | "SALE"
  | "LAYAWAY"
  | "PAYMENT"
  | "SERVICE_ORDER"
  | "QUOTATION"
  | "BALANCE_TOPUP"
  | "NOTE";

type TimelineEvent = {
  id: string;
  kind: TimelineKind;
  at: string;
  title: string;
  meta: Record<string, unknown>;
};

const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: customerId } = await params;
  const url = new URL(req.url);
  const limit = Math.min(Number(url.searchParams.get("limit") ?? DEFAULT_LIMIT), MAX_LIMIT);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
  const sourcesParam = url.searchParams.get("sources");
  const fromParam = url.searchParams.get("from");
  const toParam = url.searchParams.get("to");

  const from = fromParam ? new Date(fromParam) : null;
  const to = toParam ? new Date(toParam) : null;
  const df: Prisma.DateTimeFilter | undefined =
    from || to
      ? {
          ...(from ? { gte: from } : {}),
          ...(to ? { lte: to } : {}),
        }
      : undefined;

  const allowed = new Set<TimelineKind>([
    "SALE",
    "LAYAWAY",
    "PAYMENT",
    "SERVICE_ORDER",
    "QUOTATION",
    "BALANCE_TOPUP",
    "NOTE",
  ]);
  const wanted = sourcesParam
    ? new Set(
        sourcesParam
          .split(",")
          .map((s) => s.trim().toUpperCase())
          .filter((s): s is TimelineKind => allowed.has(s as TimelineKind)),
      )
    : allowed;

  const results: TimelineEvent[] = [];

  if (wanted.has("SALE") || wanted.has("LAYAWAY")) {
    const sales = await prisma.sale.findMany({
      where: { customerId, ...(df ? { createdAt: df } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        folio: true,
        total: true,
        status: true,
        createdAt: true,
        branchId: true,
        userId: true,
      },
    });
    for (const s of sales) {
      const kind: TimelineKind = s.status === "LAYAWAY" ? "LAYAWAY" : "SALE";
      if (!wanted.has(kind)) continue;
      results.push({
        id: `sale:${s.id}`,
        kind,
        at: s.createdAt.toISOString(),
        title: `${kind === "LAYAWAY" ? "Apartado" : "Venta"} ${s.folio}`,
        meta: {
          saleId: s.id,
          folio: s.folio,
          total: Number(s.total),
          status: s.status,
          branchId: s.branchId,
          userId: s.userId,
        },
      });
    }
  }

  if (wanted.has("PAYMENT") || wanted.has("BALANCE_TOPUP")) {
    const txs = await prisma.cashTransaction.findMany({
      where: {
        customerId,
        type: "PAYMENT_IN",
        ...(df ? { createdAt: df } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        amount: true,
        method: true,
        reference: true,
        saleId: true,
        createdAt: true,
      },
    });
    for (const t of txs) {
      const kind: TimelineKind = t.saleId ? "PAYMENT" : "BALANCE_TOPUP";
      if (!wanted.has(kind)) continue;
      results.push({
        id: `tx:${t.id}`,
        kind,
        at: t.createdAt.toISOString(),
        title: kind === "PAYMENT" ? "Pago / Abono" : "Recarga saldo a favor",
        meta: {
          amount: Number(t.amount),
          method: t.method,
          reference: t.reference,
          saleId: t.saleId,
        },
      });
    }
  }

  if (wanted.has("SERVICE_ORDER")) {
    const sos = await prisma.serviceOrder.findMany({
      where: { customerId, ...(df ? { createdAt: df } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        folio: true,
        total: true,
        status: true,
        createdAt: true,
        branchId: true,
        customerBikeId: true,
      },
    });
    for (const o of sos) {
      results.push({
        id: `so:${o.id}`,
        kind: "SERVICE_ORDER",
        at: o.createdAt.toISOString(),
        title: `Orden taller ${o.folio}`,
        meta: {
          serviceOrderId: o.id,
          folio: o.folio,
          total: Number(o.total),
          status: o.status,
          branchId: o.branchId,
          customerBikeId: o.customerBikeId,
        },
      });
    }
  }

  if (wanted.has("QUOTATION")) {
    const qs = await prisma.quotation.findMany({
      where: { customerId, ...(df ? { createdAt: df } : {}) },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        folio: true,
        total: true,
        status: true,
        createdAt: true,
        branchId: true,
        validUntil: true,
      },
    });
    for (const q of qs) {
      results.push({
        id: `q:${q.id}`,
        kind: "QUOTATION",
        at: q.createdAt.toISOString(),
        title: `Cotización ${q.folio}`,
        meta: {
          quotationId: q.id,
          folio: q.folio,
          total: Number(q.total),
          status: q.status,
          branchId: q.branchId,
          validUntil: q.validUntil,
        },
      });
    }
  }

  if (wanted.has("NOTE")) {
    const notes = await prisma.customerNote.findMany({
      where: { customerId, ...(df ? { createdAt: df } : {}) },
      orderBy: { createdAt: "desc" },
      include: { author: { select: { id: true, name: true } } },
    });
    for (const n of notes) {
      results.push({
        id: `note:${n.id}`,
        kind: "NOTE",
        at: n.createdAt.toISOString(),
        title: n.kind === "NOTE" ? "Nota" : `Interacción ${n.kind}`,
        meta: {
          noteId: n.id,
          kind: n.kind,
          body: n.body,
          pinned: n.pinned,
          author: n.author,
        },
      });
    }
  }

  results.sort((a, b) => (a.at < b.at ? 1 : -1));
  const total = results.length;
  const slice = results.slice(offset, offset + limit);

  return NextResponse.json({
    success: true,
    data: slice,
    pagination: { total, limit, offset },
  });
}
