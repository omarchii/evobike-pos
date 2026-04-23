"use client";

import { CheckCircle2 } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";

type PrepaidCardProps = {
  prepaid: boolean;
  prepaidAt: string | null;
  prepaidAmount: number | null;
  /** null = pago mixto (split). Ver resolvePrepaidMethod (workshop-prepaid.ts). */
  prepaidMethod: PaymentMethod | null;
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  ATRATO: "Atrato",
  CREDIT_BALANCE: "Saldo a favor",
};

// Helpers locales: esta card es un comprobante financiero — necesitamos
// centavos exactos y hora (dos prepagos el mismo día deben distinguirse).
// formatMXN global redondea a entero y formatDate no incluye hora.
function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function PrepaidCard({
  prepaid,
  prepaidAt,
  prepaidAmount,
  prepaidMethod,
}: PrepaidCardProps) {
  if (!prepaid) return null;

  // prepaidMethod=null es válido (pago mixto). prepaidAt/Amount deberían venir
  // poblados post-E.2 + backfill; si faltan, es orden legacy pre-Hotfix.1.
  const hasCore = prepaidAt !== null && prepaidAmount !== null;
  const isSplit = hasCore && prepaidMethod === null;

  return (
    <div
      className="rounded-2xl p-5 space-y-3"
      style={{
        background: "var(--surf-lowest)",
        boxShadow: "var(--shadow)",
      }}
    >
      <h2
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.75rem",
          fontWeight: 600,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--on-surf-var)",
        }}
      >
        Pre-pago
      </h2>

      <div
        className="rounded-xl px-4 py-3 space-y-1.5"
        style={{ background: "var(--sec-container)" }}
      >
        <div className="flex items-center gap-2">
          <CheckCircle2 className="h-4 w-4" style={{ color: "var(--sec)" }} />
          <span
            style={{
              fontSize: "0.8125rem",
              fontWeight: 600,
              color: "var(--on-sec-container)",
            }}
          >
            {hasCore ? `Pagado ${formatMXN(prepaidAmount!)}` : "Pre-pagado"}
          </span>
        </div>
        {hasCore ? (
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--on-sec-container)",
              opacity: 0.85,
            }}
          >
            {formatDate(prepaidAt!)}
            {isSplit ? " · pago mixto" : ` · ${METHOD_LABEL[prepaidMethod!]}`}
          </p>
        ) : (
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--on-sec-container)",
              opacity: 0.85,
              fontStyle: "italic",
            }}
          >
            Sin detalle de fecha o método (orden previa al Hotfix.1).
          </p>
        )}
      </div>
    </div>
  );
}
