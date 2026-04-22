"use client";

import { CheckCircle2 } from "lucide-react";
import type { PaymentMethod } from "@prisma/client";

type PrepaidCardProps = {
  prepaid: boolean;
  prepaidAt: string | null;
  prepaidAmount: number | null;
  prepaidMethod: PaymentMethod | null;
};

const METHOD_LABEL: Record<PaymentMethod, string> = {
  CASH: "Efectivo",
  CARD: "Tarjeta",
  TRANSFER: "Transferencia",
  ATRATO: "Atrato",
  CREDIT_BALANCE: "Saldo a favor",
};

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

  // Caso enriquecido (Hotfix.1+ con datos completos).
  const hasFullData =
    prepaidAt !== null && prepaidAmount !== null && prepaidMethod !== null;

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
            {hasFullData
              ? `Pagado ${formatMXN(prepaidAmount!)}`
              : "Pre-pagado"}
          </span>
        </div>
        {hasFullData ? (
          <p
            style={{
              fontSize: "0.75rem",
              color: "var(--on-sec-container)",
              opacity: 0.85,
            }}
          >
            {formatDate(prepaidAt!)} · {METHOD_LABEL[prepaidMethod!]}
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
