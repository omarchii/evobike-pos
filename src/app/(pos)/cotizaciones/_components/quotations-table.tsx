import Link from "next/link";
import { FileText, ChevronRight } from "lucide-react";
import QuotationStatusBadge from "@/components/quotation-status-badge";
import {
  getEffectiveStatus,
  getDaysRemaining,
  formatDate,
} from "@/lib/quotations";
import type { EffectiveStatus } from "@/lib/quotations";
import { formatMXN } from "@/lib/format";
import { cn } from "@/lib/utils";

export interface QuotationRow {
  id: string;
  folio: string;
  status: "DRAFT" | "EN_ESPERA_CLIENTE" | "EN_ESPERA_FABRICA" | "PAGADA" | "FINALIZADA" | "RECHAZADA";
  validUntil: string; // ISO
  createdAt: string;
  total: number;
  customerName: string | null;
  anonymousCustomerName: string | null;
  createdByName: string;
}

interface Props {
  quotations: QuotationRow[];
  page: number;
  totalPages: number;
  searchParams: Record<string, string | undefined>;
}

function DaysRemainingBadge({ validUntil, effectiveStatus }: { validUntil: string; effectiveStatus: EffectiveStatus }) {
  if (!["DRAFT", "EN_ESPERA_CLIENTE", "EXPIRED"].includes(effectiveStatus)) return null;

  const days = getDaysRemaining(validUntil);
  if (days <= 0) {
    return (
      <span
        className="text-[0.625rem] font-medium px-1.5 py-0.5 rounded-full"
        style={{ background: "var(--ter-container)", color: "var(--on-ter-container)" }}
      >
        Expirada
      </span>
    );
  }
  if (days === 1) {
    return (
      <span
        className="text-[0.625rem] font-medium px-1.5 py-0.5 rounded-full"
        style={{ background: "var(--warn-container)", color: "var(--warn)" }}
      >
        1 día
      </span>
    );
  }
  return (
    <span
      className="text-[0.625rem] font-medium px-1.5 py-0.5 rounded-full"
      style={{ background: "var(--sec-container)", color: "var(--on-sec-container)" }}
    >
      {days} días
    </span>
  );
}

function customerLabel(q: QuotationRow): string {
  if (q.customerName) return q.customerName;
  if (q.anonymousCustomerName) return `${q.anonymousCustomerName} (anón.)`;
  return "Sin cliente";
}

export default function QuotationsTable({ quotations, page, totalPages, searchParams }: Props) {
  if (quotations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 rounded-2xl" style={{ background: "var(--surf-lowest)" }}>
        <FileText className="h-12 w-12 mb-4" style={{ color: "var(--outline-var)" }} />
        <p className="text-sm font-medium mb-1" style={{ color: "var(--on-surf)" }}>
          No hay cotizaciones
        </p>
        <p className="text-xs mb-6" style={{ color: "var(--on-surf-var)" }}>
          Ajusta los filtros o crea tu primera cotización
        </p>
        <Link
          href="/cotizaciones/nueva"
          className="px-4 py-2 rounded-full text-xs font-semibold text-white"
          style={{ background: "var(--velocity-gradient)" }}
        >
          + Nueva cotización
        </Link>
      </div>
    );
  }

  function buildPageUrl(p: number) {
    const params = new URLSearchParams();
    Object.entries(searchParams).forEach(([k, v]) => {
      if (v && k !== "page") params.set(k, v);
    });
    params.set("page", String(p));
    return `/cotizaciones?${params.toString()}`;
  }

  return (
    <div>
      <div className="rounded-2xl overflow-hidden" style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}>
        {/* Header */}
        <div
          className="grid gap-3 px-4 py-2.5"
          style={{
            gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr 1fr 1fr 2.5rem",
            borderBottom: "1px solid var(--ghost-border)",
          }}
        >
          {["Folio", "Cliente", "Emisión", "Vigencia", "Total", "Estado", "Vendedor"].map(
            (h) => (
              <span
                key={h}
                className="text-[0.625rem] font-medium tracking-widest uppercase"
                style={{ color: "var(--on-surf-var)" }}
              >
                {h}
              </span>
            )
          )}
          <span />
        </div>

        {/* Rows */}
        {quotations.map((q) => {
          const effectiveStatus = getEffectiveStatus({ status: q.status, validUntil: q.validUntil });

          return (
            <Link
              key={q.id}
              href={`/cotizaciones/${q.id}`}
              className={cn(
                "grid gap-3 px-4 py-3 items-center transition-colors group",
                "hover:bg-[var(--surf-high)]"
              )}
              style={{ gridTemplateColumns: "1.5fr 1.5fr 1fr 1fr 1fr 1fr 1fr 2.5rem" }}
            >
              <span
                className="text-xs font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--p)" }}
              >
                {q.folio}
              </span>

              <span className="text-xs truncate" style={{ color: "var(--on-surf)" }}>
                {customerLabel(q)}
              </span>

              <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                {formatDate(q.createdAt)}
              </span>

              <span className="text-xs flex items-center gap-1" style={{ color: "var(--on-surf-var)" }}>
                {formatDate(q.validUntil)}
                <DaysRemainingBadge validUntil={q.validUntil} effectiveStatus={effectiveStatus} />
              </span>

              <span
                className="text-xs font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
              >
                {formatMXN(q.total, { decimals: 2 })}
              </span>

              <span>
                <QuotationStatusBadge status={effectiveStatus} />
              </span>

              <span className="text-xs truncate" style={{ color: "var(--on-surf-var)" }}>
                {q.createdByName}
              </span>

              <ChevronRight
                className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ color: "var(--on-surf-var)" }}
              />
            </Link>
          );
        })}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-4">
          {page > 1 && (
            <Link
              href={buildPageUrl(page - 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--surf-high)]"
              style={{ color: "var(--on-surf-var)" }}
            >
              ← Anterior
            </Link>
          )}
          <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
            Página {page} de {totalPages}
          </span>
          {page < totalPages && (
            <Link
              href={buildPageUrl(page + 1)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-colors hover:bg-[var(--surf-high)]"
              style={{ color: "var(--on-surf-var)" }}
            >
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
