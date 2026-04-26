import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";
import QuotationStatusBadge from "../_components/quotation-status-badge";
import QuotationActionsBar from "./_components/quotation-actions-bar";
import {
  getEffectiveStatus,
  getDaysRemaining,
  formatMXN,
  formatDate,
} from "@/lib/quotations";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
  branchName?: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

export default async function CotizacionDetallePage({ params }: RouteParams) {
  const session = await getServerSession(authOptions);
  const user = session?.user as SessionUser | undefined;
  if (!user?.branchId) notFound();

  const { id } = await params;

  // Preload managers + customers for the convert dialog
  const [managers, rawCustomers] = await Promise.all([
    prisma.user.findMany({
      where: { role: { in: ["MANAGER", "ADMIN"] } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.customer.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, phone: true, phone2: true, email: true, balance: true, creditLimit: true },
    }),
  ]);
  const customers = rawCustomers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    phone2: c.phone2,
    email: c.email,
    balance: Number(c.balance),
    creditLimit: Number(c.creditLimit),
  }));

  const q = await prisma.quotation.findUnique({
    where: { id },
    include: {
      branch: { select: { name: true, code: true } },
      user: { select: { name: true } },
      customer: { select: { id: true, name: true, phone: true, email: true } },
      discountAuthorizedBy: { select: { name: true } },
      convertedByUser: { select: { name: true } },
      convertedInBranch: { select: { name: true } },
      convertedToSale: { select: { folio: true } },
      items: {
        include: {
          productVariant: {
            include: {
              modelo: { select: { nombre: true } },
              color: { select: { nombre: true } },
              voltaje: { select: { label: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!q) notFound();

  // Permission: non-admin can only see their branch
  if (user.role !== "ADMIN" && q.branchId !== user.branchId) notFound();

  const effectiveStatus = getEffectiveStatus({ status: q.status, validUntil: q.validUntil });
  const daysRemaining = getDaysRemaining(q.validUntil);
  const subtotal = Number(q.subtotal);
  const discount = Number(q.discountAmount);
  const total = Number(q.total);

  // Customer label
  const customerLabel = (() => {
    if (q.customer) return q.customer.name;
    if (q.anonymousCustomerName) {
      const phone = q.anonymousCustomerPhone ? ` · ${q.anonymousCustomerPhone}` : "";
      return `Anónimo: ${q.anonymousCustomerName}${phone}`;
    }
    return "Sin cliente";
  })();

  const crossBranch =
    q.convertedInBranchId && q.convertedInBranchId !== q.branchId;

  return (
    <div className="pb-32">
      {/* Back nav */}
      <div className="mb-5">
        <Link
          href="/cotizaciones"
          className="inline-flex items-center gap-1.5 text-sm transition-colors hover:opacity-70"
          style={{ color: "var(--on-surf-var)" }}
        >
          <ChevronLeft className="h-4 w-4" />
          Cotizaciones
        </Link>
      </div>

      {/* HERO */}
      <div className="mb-8">
        <div className="flex flex-wrap items-center gap-3 mb-1">
          <h1
            className="text-4xl font-bold tracking-tight"
            style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
          >
            {q.folio}
          </h1>
          <QuotationStatusBadge status={effectiveStatus} size="md" />
        </div>
        <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
          Creada por {q.user.name} en {q.branch.name} · {formatDate(q.createdAt)}
        </p>
      </div>

      {/* Key data strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {/* Cliente */}
        <div className="rounded-xl p-4" style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}>
          <p className="text-[0.625rem] font-medium tracking-widest uppercase mb-1" style={{ color: "var(--on-surf-var)" }}>
            Cliente
          </p>
          <p className="text-sm font-semibold" style={{ color: "var(--on-surf)" }}>
            {customerLabel}
          </p>
        </div>

        {/* Fecha emisión */}
        <div className="rounded-xl p-4" style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}>
          <p className="text-[0.625rem] font-medium tracking-widest uppercase mb-1" style={{ color: "var(--on-surf-var)" }}>
            Fecha emisión
          </p>
          <p className="text-sm font-semibold" style={{ color: "var(--on-surf)" }}>
            {formatDate(q.createdAt)}
          </p>
        </div>

        {/* Vigencia */}
        <div className="rounded-xl p-4" style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}>
          <p className="text-[0.625rem] font-medium tracking-widest uppercase mb-1" style={{ color: "var(--on-surf-var)" }}>
            Vigencia
          </p>
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold" style={{ color: "var(--on-surf)" }}>
              {formatDate(q.validUntil)}
            </p>
            {["DRAFT", "SENT", "EXPIRED"].includes(effectiveStatus) && (
              <span
                className="text-[0.625rem] font-medium px-1.5 py-0.5 rounded-full"
                style={
                  daysRemaining <= 0
                    ? { background: "var(--ter-container)", color: "var(--on-ter-container)" }
                    : daysRemaining === 1
                    ? { background: "var(--warn-container)", color: "var(--warn)" }
                    : { background: "var(--sec-container)", color: "var(--on-sec-container)" }
                }
              >
                {daysRemaining <= 0 ? "Expirada" : `${daysRemaining}d`}
              </span>
            )}
          </div>
        </div>

        {/* Total */}
        <div
          className="rounded-xl p-4"
          style={{ background: "var(--velocity-gradient)", boxShadow: "var(--shadow)" }}
        >
          <p className="text-[0.625rem] font-medium tracking-widest uppercase mb-1" style={{ color: "rgba(255,255,255,0.7)" }}>
            Total
          </p>
          <p
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "#ffffff" }}
          >
            {formatMXN(total)}
          </p>
        </div>
      </div>

      {/* Converted info */}
      {effectiveStatus === "FINALIZADA" && q.convertedToSale && (
        <div
          className="flex items-start gap-3 rounded-2xl p-4 mb-6"
          style={{ background: "var(--sec-container)" }}
        >
          <FileText className="h-5 w-5 mt-0.5 shrink-0" style={{ color: "var(--on-sec-container)" }} />
          <div>
            <p className="text-sm font-semibold" style={{ color: "var(--on-sec-container)" }}>
              Convertida a venta{" "}
              <span className="font-bold">{q.convertedToSale.folio}</span>
              {q.convertedAt && ` el ${formatDate(q.convertedAt)}`}
              {q.convertedByUser && ` por ${q.convertedByUser.name}`}
            </p>
          </div>
        </div>
      )}

      {/* Cross-branch warning */}
      {crossBranch && q.convertedInBranch && (
        <div
          className="flex items-start gap-3 rounded-2xl p-4 mb-6"
          style={{ background: "var(--warn-container)" }}
        >
          <p className="text-sm" style={{ color: "var(--warn)" }}>
            Cotización generada en {q.branch.name}, convertida en {q.convertedInBranch.name}
          </p>
        </div>
      )}

      {/* Items table */}
      <div
        className="rounded-2xl overflow-hidden mb-6"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {/* Header */}
        <div
          className="grid gap-4 px-5 py-3"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            borderBottom: "1px solid var(--ghost-border)",
          }}
        >
          {["Descripción", "Cantidad", "Precio unitario", "Total"].map((h) => (
            <span
              key={h}
              className="text-[0.625rem] font-medium tracking-widest uppercase"
              style={{ color: "var(--on-surf-var)" }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Rows */}
        {q.items.map((item, i) => {
          const isAlt = i % 2 === 1;
          const catalogMeta = item.productVariant
            ? `${item.productVariant.modelo.nombre} · ${item.productVariant.voltaje.label} · ${item.productVariant.color.nombre}`
            : null;

          return (
            <div
              key={item.id}
              className="grid gap-4 px-5 py-3 items-center"
              style={{
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                background: isAlt ? "var(--surf-low)" : "var(--surf-lowest)",
              }}
            >
              <div>
                <div className="flex items-center gap-2">
                  {item.isFreeForm && (
                    <span
                      className="text-[0.625rem] font-medium px-1.5 py-0.5 rounded-full shrink-0"
                      style={{ background: "var(--p-container)", color: "var(--on-p-container)" }}
                    >
                      Línea libre
                    </span>
                  )}
                  <span className="text-xs font-medium" style={{ color: "var(--on-surf)" }}>
                    {item.description}
                  </span>
                </div>
                {catalogMeta && (
                  <p className="text-[0.625rem] mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                    {catalogMeta}
                  </p>
                )}
              </div>
              <span className="text-xs" style={{ color: "var(--on-surf)" }}>
                {item.quantity}
              </span>
              <span className="text-xs" style={{ color: "var(--on-surf)" }}>
                {formatMXN(Number(item.unitPrice))}
              </span>
              <span
                className="text-sm font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
              >
                {formatMXN(Number(item.lineTotal))}
              </span>
            </div>
          );
        })}

        {/* Totals */}
        <div
          className="px-5 py-4 flex flex-col items-end gap-2"
          style={{ borderTop: "1px solid var(--ghost-border)" }}
        >
          <div className="flex gap-8 items-center">
            <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
              Subtotal
            </span>
            <span className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
              {formatMXN(subtotal)}
            </span>
          </div>
          {discount > 0 && (
            <div className="flex gap-8 items-center">
              <div className="text-right">
                <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                  Descuento
                </span>
                {q.discountAuthorizedBy && (
                  <p className="text-[0.625rem]" style={{ color: "var(--on-surf-var)" }}>
                    Autorizado por {q.discountAuthorizedBy.name}
                  </p>
                )}
              </div>
              <span className="text-sm font-medium" style={{ color: "var(--ter)" }}>
                −{formatMXN(discount)}
              </span>
            </div>
          )}
          <div className="flex gap-8 items-center">
            <span className="text-sm font-semibold" style={{ color: "var(--on-surf)" }}>
              Total
            </span>
            <span
              className="text-2xl font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              {formatMXN(total)}
            </span>
          </div>
        </div>
      </div>

      {/* Internal note */}
      {q.internalNote && (
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
          <p
            className="text-[0.625rem] font-medium tracking-widest uppercase mb-2"
            style={{ color: "var(--on-surf-var)" }}
          >
            Nota interna
          </p>
          <p className="text-sm" style={{ color: "var(--on-surf)" }}>
            {q.internalNote}
          </p>
        </div>
      )}

      {/* Cancellation info */}
      {effectiveStatus === "RECHAZADA" && q.cancelReason && (
        <div
          className="rounded-2xl p-5 mb-6"
          style={{ background: "var(--ter-container)", boxShadow: "var(--shadow)" }}
        >
          <p
            className="text-[0.625rem] font-medium tracking-widest uppercase mb-2"
            style={{ color: "var(--on-ter-container)" }}
          >
            Motivo de cancelación
          </p>
          <p className="text-sm" style={{ color: "var(--on-ter-container)" }}>
            {q.cancelReason}
          </p>
          {q.cancelledAt && (
            <p className="text-[0.625rem] mt-1" style={{ color: "var(--on-ter-container)" }}>
              Cancelada el {formatDate(q.cancelledAt)}
            </p>
          )}
        </div>
      )}

      {/* Actions bar (client component) */}
      <QuotationActionsBar
        quotationId={id}
        effectiveStatus={effectiveStatus}
        quotation={{
          id: q.id,
          folio: q.folio,
          publicShareToken: q.publicShareToken,
          validUntil: q.validUntil,
          branchId: q.branchId,
          branchName: q.branch.name,
          subtotal,
          discountAmount: discount,
          total,
          customerId: q.customerId ?? null,
          customerName: q.customer?.name ?? null,
          customerPhone: q.customer?.phone ?? null,
          customerEmail: q.customer?.email ?? null,
          anonymousCustomerName: q.anonymousCustomerName ?? null,
          anonymousCustomerPhone: q.anonymousCustomerPhone ?? null,
          itemCount: q.items.length,
        }}
        managers={managers}
        customers={customers}
        currentUserBranchId={user.branchId}
        currentUserBranchName={user.branchName ?? ""}
      />
    </div>
  );
}
