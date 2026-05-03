import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import {
  getEffectiveStatus,
  getDaysRemaining,
  formatDate,
} from "@/lib/quotations";
import PrintButton from "./_components/print-button";

// Comprobante público: usa precisión financiera local (centavos obligatorios).
// NO reemplazar por @/lib/format/formatMXN — el global por defecto redondea a
// entero. Ver feedback_financial_formatters.
function formatMXN(value: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(value);
}

export const dynamic = "force-dynamic";

// Portales públicos con token nunca deben indexarse — filtran info
// del cliente (nombre, teléfono, precios, folios).
export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

interface RouteParams {
  params: Promise<{ token: string }>;
}

export default async function PublicCotizacionPage({ params }: RouteParams) {
  const { token } = await params;

  const q = await prisma.quotation.findUnique({
    where: { publicShareToken: token },
    include: {
      branch: { select: { name: true, address: true } },
      customer: { select: { name: true, phone: true, email: true } },
      items: {
        include: {
          productVariant: {
            include: {
              modelo: { select: { nombre: true } },
              color: { select: { nombre: true } },
              voltaje: { select: { label: true } },
              capacidad: { select: { nombre: true } },
            },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (!q) notFound();

  const effectiveStatus = getEffectiveStatus({
    status: q.status,
    validUntil: q.validUntil,
  });
  const daysRemaining = getDaysRemaining(q.validUntil);
  const subtotal = Number(q.subtotal);
  const discount = Number(q.discountAmount);
  const total = Number(q.total);
  const isExpired = effectiveStatus === "EXPIRED";

  const hasCustomer = !!q.customerId && !!q.customer;
  const hasAnonymous =
    !hasCustomer && (!!q.anonymousCustomerName || !!q.anonymousCustomerPhone);

  const daysChipStyle =
    daysRemaining <= 0
      ? { background: "#fdecea", color: "#7b241c" }
      : daysRemaining === 1
      ? { background: "#fef9e7", color: "#f39c12" }
      : { background: "#d8f3dc", color: "#1b4332" };

  const daysLabel =
    daysRemaining <= 0
      ? "Expirada"
      : daysRemaining === 1
      ? "Vence mañana"
      : `${daysRemaining} días`;

  return (
    <>
      {/* Force light mode tokens regardless of user's theme preference */}
      <style>{`
        .evobike-public-doc {
          --p: #1b4332;
          --p-mid: #2d6a4f;
          --p-bright: #2ecc71;
          --p-container: #a8e6cf;
          --on-p: #ffffff;
          --on-p-container: #1b4332;
          --sec: #52b788;
          --sec-container: #d8f3dc;
          --on-sec-container: #1b4332;
          --ter: #e74c3c;
          --ter-container: #fdecea;
          --on-ter-container: #7b241c;
          --warn: #f39c12;
          --warn-container: #fef9e7;
          --surface: #f8fafa;
          --surf-low: #f0f7f4;
          --surf-lowest: #ffffff;
          --surf-high: #dcf0e8;
          --on-surf: #131b2e;
          --on-surf-var: #3d5247;
          --outline-var: #b2ccc0;
          --shadow: 0px 12px 32px -4px rgba(19, 27, 46, 0.06);
          --font-display: "Space Grotesk", sans-serif;
          --font-body: "Inter", -apple-system, sans-serif;

          min-height: 100vh;
          background: #f8fafa;
          color: #131b2e;
          font-family: "Inter", -apple-system, sans-serif;
        }

        @media print {
          @page {
            margin: 1.5cm;
            size: letter;
          }

          .no-print {
            display: none !important;
          }

          /* Quitar min-height: 100vh — Safari lo respeta literalmente */
          .evobike-public-doc {
            background: #ffffff !important;
            color: #000000 !important;
            min-height: auto !important;
          }

          /* Compactar padding del wrapper interior */
          .doc-inner {
            padding-top: 0.75rem !important;
            padding-bottom: 0.75rem !important;
          }

          /* Compactar espaciado entre secciones */
          .doc-biz-header {
            margin-bottom: 0.625rem !important;
          }
          .doc-quot-header {
            margin-bottom: 0.625rem !important;
          }
          .doc-separator {
            margin: 0.375rem 0 !important;
          }

          /* Folio masivo → tamaño print-friendly */
          .doc-folio {
            font-size: 2.25rem !important;
            margin-bottom: 0.5rem !important;
          }

          /* Cards de cliente/tabla: quitar sombra, compactar */
          .doc-card {
            box-shadow: none !important;
            margin-bottom: 0.5rem !important;
            padding: 0.625rem 1rem !important;
          }
          .doc-customer-label {
            margin-bottom: 0.25rem !important;
          }
          .doc-items-wrapper {
            margin-bottom: 0.5rem !important;
          }

          /* Evitar que una fila se corte entre páginas */
          .item-row {
            page-break-inside: avoid;
            break-inside: avoid;
          }

          /* Mantener totales siempre juntos */
          .totals-separator {
            border-top: 1px solid rgba(0, 0, 0, 0.18) !important;
            page-break-inside: avoid;
            break-inside: avoid;
            padding: 0.625rem 1rem !important;
            gap: 0.35rem !important;
          }

          /* Header de tabla: no separar del primer row */
          .table-header-row {
            border-bottom: 1px solid rgba(0, 0, 0, 0.18) !important;
            page-break-after: avoid;
            break-after: avoid;
          }

          /* Filas alternas: sin tonal shift en papel */
          .table-row-alt {
            background: #ffffff !important;
          }

          /* Banner de expiración: rojo brillante → gris oscuro */
          .expiry-banner {
            background: #333333 !important;
            color: #ffffff !important;
          }

          /* Desactivar glassmorphism */
          .evobike-public-doc * {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
        }
      `}</style>

      <div className="evobike-public-doc">
        {/* ── Expiry banner ─────────────────────────────────────────────── */}
        {isExpired && (
          <div
            className="expiry-banner w-full py-3 px-6 text-center text-sm font-semibold tracking-wide"
            style={{ background: "#e74c3c", color: "#ffffff" }}
          >
            COTIZACIÓN EXPIRADA — Esta cotización ya no es válida
          </div>
        )}

        <div className="doc-inner" style={{ maxWidth: 800, margin: "0 auto", padding: "3rem 1.5rem 6rem" }}>
          {/* ── Business header ───────────────────────────────────────────── */}
          <div className="doc-biz-header" style={{ marginBottom: "2.5rem" }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "2rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "#1b4332",
                marginBottom: "0.25rem",
                lineHeight: 1,
              }}
            >
              EvoBike
            </h1>
            <p
              style={{
                fontSize: "0.9375rem",
                fontWeight: 500,
                color: "var(--on-surf)",
                marginBottom: "0.2rem",
              }}
            >
              {q.branch.name}
            </p>
            {q.branch.address && (
              <p style={{ fontSize: "0.875rem", color: "var(--on-surf-var)" }}>
                {q.branch.address}
              </p>
            )}
          </div>

          {/* ── Quotation header ──────────────────────────────────────────── */}
          <div className="doc-quot-header" style={{ marginBottom: "2rem" }}>
            <p
              style={{
                fontSize: "0.625rem",
                fontWeight: 500,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: "var(--on-surf-var)",
                marginBottom: "0.5rem",
              }}
            >
              Cotización
            </p>
            <p
              className="doc-folio"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "clamp(2.25rem, 6vw, 3.5rem)",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--on-surf)",
                lineHeight: 1,
                marginBottom: "1.25rem",
              }}
            >
              {q.folio}
            </p>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem" }}>
              <div>
                <p
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--on-surf-var)",
                    marginBottom: "0.2rem",
                  }}
                >
                  Fecha de emisión
                </p>
                <p
                  style={{
                    fontSize: "0.9375rem",
                    fontWeight: 500,
                    color: "var(--on-surf)",
                  }}
                >
                  {formatDate(q.createdAt)}
                </p>
              </div>
              <div>
                <p
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--on-surf-var)",
                    marginBottom: "0.2rem",
                  }}
                >
                  Válida hasta
                </p>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <p
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 500,
                      color: "var(--on-surf)",
                    }}
                  >
                    {formatDate(q.validUntil)}
                  </p>
                  <span
                    style={{
                      fontSize: "0.625rem",
                      fontWeight: 500,
                      padding: "0.2rem 0.5rem",
                      borderRadius: "9999px",
                      ...daysChipStyle,
                    }}
                  >
                    {daysLabel}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* ── Visual separator ──────────────────────────────────────────── */}
          <div
            className="doc-separator"
            style={{
              height: 1,
              background: "rgba(178,204,192,0.35)",
              margin: "0 0 2rem",
            }}
          />

          {/* ── Customer block ────────────────────────────────────────────── */}
          <div
            className="doc-card"
            style={{
              background: "var(--surf-lowest)",
              borderRadius: "1rem",
              padding: "1.25rem 1.5rem",
              marginBottom: "1.25rem",
              boxShadow: "var(--shadow)",
            }}
          >
            <p
              className="doc-customer-label"
              style={{
                fontSize: "0.625rem",
                fontWeight: 500,
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--on-surf-var)",
                marginBottom: "0.75rem",
              }}
            >
              Cliente
            </p>
            {hasCustomer && q.customer ? (
              <div>
                <p
                  style={{
                    fontSize: "1rem",
                    fontWeight: 600,
                    color: "var(--on-surf)",
                    marginBottom: "0.25rem",
                  }}
                >
                  {q.customer.name}
                </p>
                {q.customer.phone && (
                  <p style={{ fontSize: "0.875rem", color: "var(--on-surf-var)" }}>
                    {q.customer.phone}
                  </p>
                )}
                {q.customer.email && (
                  <p style={{ fontSize: "0.875rem", color: "var(--on-surf-var)" }}>
                    {q.customer.email}
                  </p>
                )}
              </div>
            ) : hasAnonymous ? (
              <div>
                {q.anonymousCustomerName && (
                  <p
                    style={{
                      fontSize: "1rem",
                      fontWeight: 600,
                      color: "var(--on-surf)",
                      marginBottom: "0.25rem",
                    }}
                  >
                    {q.anonymousCustomerName}
                  </p>
                )}
                {q.anonymousCustomerPhone && (
                  <p style={{ fontSize: "0.875rem", color: "var(--on-surf-var)" }}>
                    {q.anonymousCustomerPhone}
                  </p>
                )}
              </div>
            ) : (
              <p style={{ fontSize: "0.875rem", color: "var(--on-surf-var)" }}>
                Sin asignar
              </p>
            )}
          </div>

          {/* ── Items table ───────────────────────────────────────────────── */}
          <div
            className="doc-card doc-items-wrapper"
            style={{
              background: "var(--surf-lowest)",
              borderRadius: "1rem",
              overflow: "hidden",
              marginBottom: "1.5rem",
              boxShadow: "var(--shadow)",
            }}
          >
            {/* Table header */}
            <div
              className="table-header-row"
              style={{
                display: "grid",
                gridTemplateColumns: "2fr 0.6fr 1.1fr 1.1fr",
                gap: "1rem",
                padding: "0.75rem 1.5rem",
                borderBottom: "1px solid rgba(178,204,192,0.18)",
              }}
            >
              {["Descripción", "Cant.", "Precio unitario", "Total"].map((h) => (
                <span
                  key={h}
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase" as const,
                    color: "var(--on-surf-var)",
                  }}
                >
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            {q.items.map((item, i) => {
              const isAlt = i % 2 === 1;
              const ahSuffix = item.productVariant?.capacidad ? ` · ${item.productVariant.capacidad.nombre}` : "";
              const catalogMeta = item.productVariant
                ? `${item.productVariant.modelo.nombre} · ${item.productVariant.voltaje.label}${ahSuffix} · ${item.productVariant.color.nombre}`
                : null;

              return (
                <div
                  key={item.id}
                  className={isAlt ? "item-row table-row-alt" : "item-row"}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "2fr 0.6fr 1.1fr 1.1fr",
                    gap: "1rem",
                    padding: "0.875rem 1.5rem",
                    alignItems: "center",
                    background: isAlt ? "var(--surf-low)" : "var(--surf-lowest)",
                  }}
                >
                  <div>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.5rem",
                        flexWrap: "wrap" as const,
                      }}
                    >
                      {item.isFreeForm && (
                        <span
                          style={{
                            fontSize: "0.5625rem",
                            fontWeight: 500,
                            padding: "0.15rem 0.5rem",
                            borderRadius: "9999px",
                            background: "rgba(178,204,192,0.22)",
                            color: "var(--on-surf-var)",
                            border: "1px solid rgba(178,204,192,0.45)",
                            flexShrink: 0,
                            letterSpacing: "0.04em",
                          }}
                        >
                          Línea libre
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: "0.875rem",
                          fontWeight: 500,
                          color: "var(--on-surf)",
                        }}
                      >
                        {item.description}
                      </span>
                    </div>
                    {catalogMeta && (
                      <p
                        style={{
                          fontSize: "0.625rem",
                          color: "var(--on-surf-var)",
                          marginTop: "0.2rem",
                        }}
                      >
                        {catalogMeta}
                      </p>
                    )}
                  </div>
                  <span
                    style={{ fontSize: "0.875rem", color: "var(--on-surf)" }}
                  >
                    {item.quantity}
                  </span>
                  <span
                    style={{ fontSize: "0.875rem", color: "var(--on-surf)" }}
                  >
                    {formatMXN(Number(item.unitPrice))}
                  </span>
                  <span
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "0.9375rem",
                      fontWeight: 600,
                      color: "var(--on-surf)",
                    }}
                  >
                    {formatMXN(Number(item.lineTotal))}
                  </span>
                </div>
              );
            })}

            {/* Totals */}
            <div
              className="totals-separator"
              style={{
                borderTop: "1px solid rgba(178,204,192,0.18)",
                padding: "1.25rem 1.5rem",
                display: "flex",
                flexDirection: "column" as const,
                alignItems: "flex-end",
                gap: "0.6rem",
              }}
            >
              <div style={{ display: "flex", gap: "3rem", alignItems: "center" }}>
                <span
                  style={{ fontSize: "0.8125rem", color: "var(--on-surf-var)" }}
                >
                  Subtotal
                </span>
                <span
                  style={{ fontSize: "0.9375rem", fontWeight: 500, color: "var(--on-surf)" }}
                >
                  {formatMXN(subtotal)}
                </span>
              </div>
              {discount > 0 && (
                <div style={{ display: "flex", gap: "3rem", alignItems: "center" }}>
                  <span
                    style={{ fontSize: "0.8125rem", color: "var(--on-surf-var)" }}
                  >
                    Descuento
                  </span>
                  <span
                    style={{
                      fontSize: "0.9375rem",
                      fontWeight: 500,
                      color: "#e74c3c",
                    }}
                  >
                    −{formatMXN(discount)}
                  </span>
                </div>
              )}
              <div
                style={{
                  display: "flex",
                  gap: "3rem",
                  alignItems: "center",
                  marginTop: "0.25rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid rgba(178,204,192,0.18)",
                  width: "100%",
                  justifyContent: "flex-end",
                }}
              >
                <span
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: 600,
                    color: "var(--on-surf)",
                  }}
                >
                  Total
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "2rem",
                    fontWeight: 700,
                    letterSpacing: "-0.02em",
                    color: "var(--on-surf)",
                    lineHeight: 1,
                  }}
                >
                  {formatMXN(total)}
                </span>
              </div>
            </div>
          </div>

          {/* ── Footer legend ─────────────────────────────────────────────── */}
          <p
            style={{
              textAlign: "center",
              fontSize: "0.75rem",
              fontStyle: "italic",
              color: "var(--on-surf-var)",
              lineHeight: 1.7,
              marginTop: "2rem",
              opacity: 0.75,
            }}
          >
            Los precios mostrados son válidos únicamente el día de emisión de
            esta cotización. Vigencia: 7 días.
          </p>
        </div>

        {/* Print button — client component, hidden in @media print via .no-print */}
        <PrintButton />
      </div>
    </>
  );
}
