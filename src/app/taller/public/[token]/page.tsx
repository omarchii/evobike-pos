import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  buildPortalWhatsappHref,
  parsePhotoUrls,
} from "@/lib/workshop";
import { approvalItemsJsonSchema } from "@/lib/workshop-approvals";
import type {
  ServiceOrderStatus,
  ServiceOrderSubStatus,
  ServiceOrderApprovalStatus,
} from "@prisma/client";
import ApprovalActions from "./_components/approval-actions";

export const dynamic = "force-dynamic";

// Portales públicos con token nunca deben indexarse — filtran info de clientes.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Estado de servicio · EvoBike",
};

// ─── Helpers de formato (locales es-MX, sin pasar por @/lib/format que
//     descarta centavos/hora — ver feedback_financial_formatters.md) ──────
function formatMoney(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

function formatDateShort(d: Date): string {
  return d.toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatDateTime(d: Date): string {
  return d.toLocaleString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ─── Hero reactivo ───────────────────────────────────────────────────────
type HeroTone = "info" | "warn" | "success" | "muted";
interface Hero {
  chip: string;
  chipTone: HeroTone;
  title: string;
}

function computeHero(
  status: ServiceOrderStatus,
  subStatus: ServiceOrderSubStatus | null,
  vehicle: string,
): Hero {
  if (status === "CANCELLED") {
    return {
      chip: "Cancelado",
      chipTone: "muted",
      title: "Este servicio fue cancelado",
    };
  }
  if (status === "DELIVERED") {
    return {
      chip: "Entregado",
      chipTone: "success",
      title: "Gracias por confiar en nosotros",
    };
  }
  if (status === "COMPLETED") {
    return {
      chip: "Listo para recoger",
      chipTone: "success",
      title: `Tu ${vehicle} está listo`,
    };
  }
  if (status === "IN_PROGRESS") {
    if (subStatus === "WAITING_APPROVAL") {
      return {
        chip: "Acción requerida",
        chipTone: "warn",
        title: "Necesitamos tu confirmación",
      };
    }
    if (subStatus === "WAITING_PARTS") {
      return {
        chip: "En espera de refacciones",
        chipTone: "info",
        title: "Ordenamos los componentes",
      };
    }
    return {
      chip: "En servicio",
      chipTone: "info",
      title: `Estamos trabajando en tu ${vehicle}`,
    };
  }
  // PENDING
  return {
    chip: "Recibido",
    chipTone: "info",
    title: `Recibimos tu ${vehicle}`,
  };
}

const chipToneStyle: Record<HeroTone, { bg: string; fg: string }> = {
  info: { bg: "#a8e6cf", fg: "#1b4332" },
  warn: { bg: "#fef9e7", fg: "#b7791f" },
  success: { bg: "#d8f3dc", fg: "#1b4332" },
  muted: { bg: "#e5e5e5", fg: "#525252" },
};

// ─── Timeline (5 pasos deterministas) ────────────────────────────────────
type StepState = "done" | "current" | "pending";
interface TimelineStep {
  label: string;
  state: StepState;
  timestamp: Date | null;
}

interface TimelineSourceApproval {
  status: ServiceOrderApprovalStatus;
  requestedAt: Date;
  respondedAt: Date | null;
}

function computeTimeline(args: {
  status: ServiceOrderStatus;
  subStatus: ServiceOrderSubStatus | null;
  createdAt: Date;
  updatedAt: Date;
  approvals: TimelineSourceApproval[]; // desc por requestedAt
}): TimelineStep[] {
  const { status, subStatus, createdAt, updatedAt, approvals } = args;
  const hasApprovals = approvals.length > 0;
  const pendingApproval = approvals.find((a) => a.status === "PENDING");
  const respondedDesc = approvals.filter((a) => a.respondedAt !== null);
  const oldestApproval =
    approvals.length > 0 ? approvals[approvals.length - 1] : null;

  // 1. Recepción
  const step1: TimelineStep = {
    label: "Recepción",
    state: "done",
    timestamp: createdAt,
  };

  // 2. Diagnóstico
  const diagDone =
    status === "IN_PROGRESS" ||
    status === "COMPLETED" ||
    status === "DELIVERED" ||
    hasApprovals;
  const step2: TimelineStep = {
    label: "Diagnóstico",
    state: diagDone ? "done" : "pending",
    timestamp: diagDone ? oldestApproval?.requestedAt ?? updatedAt : null,
  };

  // 3. Confirmación — siempre visible, estado según approvals
  let step3State: StepState = "pending";
  if (pendingApproval) step3State = "current";
  else if (
    approvals.some((a) => a.status === "APPROVED" || a.status === "REJECTED")
  ) {
    step3State = "done";
  }
  const step3: TimelineStep = {
    label: "Confirmación",
    state: step3State,
    timestamp: respondedDesc[0]?.respondedAt ?? null,
  };

  // 4. Ejecución
  const execDone =
    (status === "IN_PROGRESS" && subStatus !== "WAITING_APPROVAL") ||
    status === "COMPLETED" ||
    status === "DELIVERED";
  const step4: TimelineStep = {
    label: "Ejecución",
    state: execDone ? "done" : "pending",
    timestamp: null,
  };

  // 5. Entrega
  const step5: TimelineStep = {
    label: "Entrega",
    state: status === "DELIVERED" ? "done" : "pending",
    timestamp: status === "DELIVERED" ? updatedAt : null,
  };

  return [step1, step2, step3, step4, step5];
}

// ─── Parseo defensivo del snapshot de approval.itemsJson ─────────────────
interface ApprovalItem {
  nombre: string;
  cantidad: number;
  precio: number;
  subtotal: number;
}
function parseApprovalItems(raw: unknown): ApprovalItem[] | null {
  const parsed = approvalItemsJsonSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

// ═════════════════════════════════════════════════════════════════════════

interface RouteParams {
  params: Promise<{ token: string }>;
}

export default async function TallerPortalPublicPage({ params }: RouteParams) {
  const { token } = await params;

  const order = await prisma.serviceOrder.findUnique({
    where: { publicToken: token },
    select: {
      folio: true,
      status: true,
      subStatus: true,
      bikeInfo: true,
      total: true,
      publicTokenEnabled: true,
      prepaid: true,
      prepaidAt: true,
      prepaidAmount: true,
      photoUrls: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: {
          name: true,
          colonia: true,
          city: true,
          phone: true,
          whatsappTemplateTaller: true,
        },
      },
      approvals: {
        select: {
          id: true,
          itemsJson: true,
          totalEstimado: true,
          status: true,
          requestedAt: true,
          respondedAt: true,
          respondedNote: true,
          expiresAt: true,
        },
        orderBy: { requestedAt: "desc" },
      },
    },
  });

  if (!order || !order.publicTokenEnabled) notFound();

  // Label usado dentro de frases del hero ("Recibimos tu X", "Tu X está
  // listo"). `bikeInfo` es descriptivo libre ("Trek Marlin 5"). Fallback
  // genérico "bicicleta" si null/vacío.
  const vehicleLabel = order.bikeInfo?.trim() || "bicicleta";

  const hero = computeHero(order.status, order.subStatus, vehicleLabel);
  const timeline = computeTimeline({
    status: order.status,
    subStatus: order.subStatus,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    approvals: order.approvals,
  });

  const whatsappHref = buildPortalWhatsappHref({
    branchPhone: order.branch.phone,
    template: order.branch.whatsappTemplateTaller,
    folio: order.folio,
  });

  const photos = parsePhotoUrls(order.photoUrls);
  const pendingApproval = order.approvals.find((a) => a.status === "PENDING");
  const respondedApprovals = order.approvals.filter(
    (a) => a.status === "APPROVED" || a.status === "REJECTED",
  );
  const total = Number(order.total);
  const prepaidAmount =
    order.prepaidAmount !== null ? Number(order.prepaidAmount) : null;

  const branchLocation = [order.branch.colonia, order.branch.city]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <style>{`
        .evobike-portal {
          --p: #1b4332;
          --p-mid: #2d6a4f;
          --p-bright: #2ecc71;
          --p-container: #a8e6cf;
          --on-p-container: #1b4332;
          --sec-container: #d8f3dc;
          --on-sec-container: #1b4332;
          --warn: #f39c12;
          --warn-container: #fef9e7;
          --on-warn-container: #b7791f;
          --surface: #f8fafa;
          --surf-low: #f0f7f4;
          --surf-lowest: #ffffff;
          --on-surf: #131b2e;
          --on-surf-var: #3d5247;
          --outline-var: #b2ccc0;
          --shadow-sm: 0px 2px 8px -2px rgba(19, 27, 46, 0.06);
          --shadow-md: 0px 8px 24px -6px rgba(19, 27, 46, 0.08);
          --font-display: "Space Grotesk", "Inter", -apple-system, sans-serif;
          --font-body: "Inter", -apple-system, "Segoe UI", sans-serif;

          min-height: 100vh;
          background: #f8fafa;
          color: #131b2e;
          font-family: var(--font-body);
          padding-bottom: calc(5.5rem + env(safe-area-inset-bottom, 0px));
        }
        .portal-inner {
          max-width: 520px;
          margin: 0 auto;
          padding: 1.5rem 1.25rem 1rem;
        }
        .portal-card {
          background: var(--surf-lowest);
          border-radius: 1rem;
          padding: 1.25rem;
          box-shadow: var(--shadow-sm);
          margin-bottom: 1rem;
        }
        .portal-card-title {
          font-size: 0.6875rem;
          font-weight: 500;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--on-surf-var);
          margin-bottom: 0.75rem;
        }
        .portal-chip {
          display: inline-flex;
          align-items: center;
          gap: 0.35rem;
          font-size: 0.75rem;
          font-weight: 600;
          padding: 0.3rem 0.7rem;
          border-radius: 9999px;
          letter-spacing: 0.01em;
        }
        .portal-sticky-cta {
          position: fixed;
          left: 0;
          right: 0;
          bottom: 0;
          padding: 0.75rem 1.25rem calc(0.75rem + env(safe-area-inset-bottom, 0px));
          background: rgba(248, 250, 250, 0.92);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          border-top: 1px solid rgba(178, 204, 192, 0.4);
          display: flex;
          justify-content: center;
          z-index: 50;
        }
        .portal-sticky-cta a {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 0.5rem;
          width: 100%;
          max-width: 472px;
          padding: 0.85rem 1rem;
          border-radius: 9999px;
          background: #25d366;
          color: #ffffff;
          font-weight: 600;
          font-size: 0.9375rem;
          text-decoration: none;
          box-shadow: 0 4px 14px rgba(37, 211, 102, 0.32);
        }
        .portal-sticky-cta a:active {
          transform: translateY(1px);
        }
        .portal-photos-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 0.5rem;
        }
        @media (min-width: 480px) {
          .portal-photos-grid {
            grid-template-columns: repeat(4, 1fr);
          }
        }
        .portal-photo-tile {
          display: block;
          aspect-ratio: 1 / 1;
          border-radius: 0.625rem;
          overflow: hidden;
          background: var(--surf-low);
          border: 1px solid rgba(178, 204, 192, 0.35);
        }
        .portal-photo-tile img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .portal-history details {
          border-top: 1px solid rgba(178, 204, 192, 0.3);
          padding: 0.75rem 0;
        }
        .portal-history details:first-of-type {
          border-top: none;
          padding-top: 0;
        }
        .portal-history summary {
          list-style: none;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 0.5rem;
        }
        .portal-history summary::-webkit-details-marker {
          display: none;
        }
        .portal-history summary .chevron {
          transition: transform 0.2s;
          color: var(--on-surf-var);
        }
        .portal-history details[open] summary .chevron {
          transform: rotate(180deg);
        }
      `}</style>

      <div className="evobike-portal">
        <div className="portal-inner">
          {/* ── Branch header ─────────────────────────────────────────── */}
          <div style={{ marginBottom: "1.25rem" }}>
            <h1
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--p)",
                lineHeight: 1,
                marginBottom: "0.3rem",
              }}
            >
              EvoBike
            </h1>
            <p
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--on-surf)",
                marginBottom: "0.15rem",
              }}
            >
              {order.branch.name}
            </p>
            {branchLocation && (
              <p
                style={{
                  fontSize: "0.75rem",
                  color: "var(--on-surf-var)",
                }}
              >
                {branchLocation}
              </p>
            )}
            <p
              style={{
                fontSize: "0.6875rem",
                letterSpacing: "0.08em",
                textTransform: "uppercase",
                color: "var(--on-surf-var)",
                marginTop: "0.75rem",
              }}
            >
              Folio {order.folio}
            </p>
          </div>

          {/* ── Hero reactivo ─────────────────────────────────────────── */}
          <div
            className="portal-card"
            style={{
              background:
                hero.chipTone === "warn"
                  ? "linear-gradient(135deg, #fff8e1 0%, #ffffff 60%)"
                  : hero.chipTone === "success"
                  ? "linear-gradient(135deg, #e8f7ef 0%, #ffffff 60%)"
                  : hero.chipTone === "muted"
                  ? "#f5f5f5"
                  : "linear-gradient(135deg, #e8f7ef 0%, #ffffff 60%)",
              padding: "1.5rem 1.25rem",
            }}
          >
            <span
              className="portal-chip"
              style={{
                background: chipToneStyle[hero.chipTone].bg,
                color: chipToneStyle[hero.chipTone].fg,
              }}
            >
              {hero.chip}
            </span>
            <h2
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                color: "var(--on-surf)",
                lineHeight: 1.2,
                margin: "0.85rem 0 0.4rem",
              }}
            >
              {hero.title}
            </h2>
            {order.bikeInfo && (
              <p
                style={{
                  fontSize: "0.875rem",
                  color: "var(--on-surf-var)",
                }}
              >
                {order.bikeInfo}
              </p>
            )}
            <div
              style={{
                marginTop: "1rem",
                paddingTop: "0.85rem",
                borderTop: "1px solid rgba(178, 204, 192, 0.35)",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.75rem",
                alignItems: "center",
                justifyContent: "space-between",
              }}
            >
              <div>
                <p
                  style={{
                    fontSize: "0.6875rem",
                    color: "var(--on-surf-var)",
                    marginBottom: "0.15rem",
                  }}
                >
                  Total estimado
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.375rem",
                    fontWeight: 700,
                    color: "var(--on-surf)",
                    lineHeight: 1,
                  }}
                >
                  {formatMoney(total)}
                </p>
              </div>
              {order.prepaid && prepaidAmount !== null && (
                <div style={{ textAlign: "right" as const }}>
                  <span
                    className="portal-chip"
                    style={{
                      background: "#d8f3dc",
                      color: "#1b4332",
                    }}
                  >
                    Anticipo {formatMoney(prepaidAmount)}
                  </span>
                  {order.prepaidAt && (
                    <p
                      style={{
                        fontSize: "0.6875rem",
                        color: "var(--on-surf-var)",
                        marginTop: "0.3rem",
                      }}
                    >
                      {formatDateShort(order.prepaidAt)}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* ── Timeline ─────────────────────────────────────────────── */}
          <div className="portal-card">
            <p className="portal-card-title">Progreso</p>
            <ol style={{ listStyle: "none", padding: 0, margin: 0 }}>
              {timeline.map((step, idx) => {
                const isLast = idx === timeline.length - 1;
                const dotBg =
                  step.state === "done"
                    ? "var(--p)"
                    : step.state === "current"
                    ? "#ffffff"
                    : "var(--surf-low)";
                const dotBorder =
                  step.state === "current"
                    ? "3px solid var(--p-bright)"
                    : step.state === "done"
                    ? "3px solid var(--p)"
                    : "3px solid rgba(178, 204, 192, 0.6)";
                const dotShadow =
                  step.state === "current"
                    ? "0 0 0 6px rgba(46, 204, 113, 0.18)"
                    : "none";
                const labelColor =
                  step.state === "pending"
                    ? "var(--on-surf-var)"
                    : "var(--on-surf)";
                const labelWeight = step.state === "current" ? 600 : 500;
                return (
                  <li
                    key={step.label}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1.25rem 1fr",
                      gap: "0.85rem",
                      position: "relative" as const,
                      paddingBottom: isLast ? 0 : "0.85rem",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column" as const,
                        alignItems: "center",
                        position: "relative" as const,
                      }}
                    >
                      <span
                        style={{
                          width: "0.9rem",
                          height: "0.9rem",
                          borderRadius: "9999px",
                          background: dotBg,
                          border: dotBorder,
                          boxShadow: dotShadow,
                          marginTop: "0.2rem",
                          flexShrink: 0,
                          transition: "background 0.2s",
                        }}
                      />
                      {!isLast && (
                        <span
                          style={{
                            flex: 1,
                            width: 2,
                            background:
                              step.state === "done"
                                ? "var(--p)"
                                : "rgba(178, 204, 192, 0.5)",
                            marginTop: "0.1rem",
                            minHeight: "1rem",
                          }}
                        />
                      )}
                    </div>
                    <div style={{ paddingTop: "0.1rem" }}>
                      <p
                        style={{
                          fontSize: "0.9375rem",
                          fontWeight: labelWeight,
                          color: labelColor,
                          lineHeight: 1.2,
                        }}
                      >
                        {step.label}
                      </p>
                      {step.timestamp && (
                        <p
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--on-surf-var)",
                            marginTop: "0.15rem",
                          }}
                        >
                          {formatDateTime(step.timestamp)}
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>

          {/* ── Approval card estática (PENDING) ─────────────────────── */}
          {pendingApproval && (
            <div
              className="portal-card"
              style={{
                borderLeft: "4px solid var(--warn)",
                paddingLeft: "1rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  gap: "0.75rem",
                  marginBottom: "0.85rem",
                }}
              >
                <div>
                  <p className="portal-card-title" style={{ marginBottom: "0.2rem" }}>
                    Recomendación adicional
                  </p>
                  <p
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--on-surf-var)",
                    }}
                  >
                    Solicitado el {formatDateTime(pendingApproval.requestedAt)}
                  </p>
                </div>
                <span
                  className="portal-chip"
                  style={{
                    background: chipToneStyle.warn.bg,
                    color: chipToneStyle.warn.fg,
                  }}
                >
                  Pendiente
                </span>
              </div>
              <ApprovalItemsList rawItemsJson={pendingApproval.itemsJson} />
              <div
                style={{
                  marginTop: "0.85rem",
                  paddingTop: "0.75rem",
                  borderTop: "1px solid rgba(178, 204, 192, 0.35)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    fontSize: "0.8125rem",
                    color: "var(--on-surf-var)",
                  }}
                >
                  Total estimado
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "1.125rem",
                    fontWeight: 700,
                    color: "var(--on-surf)",
                  }}
                >
                  {formatMoney(Number(pendingApproval.totalEstimado))}
                </span>
              </div>
              <ApprovalActions
                approvalId={pendingApproval.id}
                token={token}
                expiresAt={pendingApproval.expiresAt}
              />
            </div>
          )}

          {/* ── Historial approvals RESPONDED ────────────────────────── */}
          {respondedApprovals.length > 0 && (
            <div className="portal-card portal-history">
              <p className="portal-card-title">Historial</p>
              {respondedApprovals.map((a, idx) => {
                const isFirst = idx === 0;
                const statusLabel =
                  a.status === "APPROVED"
                    ? a.respondedNote === "EXPIRED"
                      ? "Expirada"
                      : "Aprobada"
                    : "Rechazada";
                const tone: HeroTone =
                  a.status === "APPROVED" && a.respondedNote !== "EXPIRED"
                    ? "success"
                    : "muted";
                return (
                  <details key={a.id} open={isFirst}>
                    <summary>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.5rem",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          className="portal-chip"
                          style={{
                            background: chipToneStyle[tone].bg,
                            color: chipToneStyle[tone].fg,
                          }}
                        >
                          {statusLabel}
                        </span>
                        {a.respondedAt && (
                          <span
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--on-surf-var)",
                            }}
                          >
                            {formatDateTime(a.respondedAt)}
                          </span>
                        )}
                      </div>
                      <svg
                        className="chevron"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <polyline points="6 9 12 15 18 9" />
                      </svg>
                    </summary>
                    <div style={{ marginTop: "0.75rem" }}>
                      <ApprovalItemsList rawItemsJson={a.itemsJson} />
                      <div
                        style={{
                          marginTop: "0.75rem",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          fontSize: "0.8125rem",
                        }}
                      >
                        <span style={{ color: "var(--on-surf-var)" }}>
                          Total
                        </span>
                        <span
                          style={{
                            fontWeight: 600,
                            color: "var(--on-surf)",
                          }}
                        >
                          {formatMoney(Number(a.totalEstimado))}
                        </span>
                      </div>
                    </div>
                  </details>
                );
              })}
            </div>
          )}

          {/* ── Galería fotos de recepción ───────────────────────────── */}
          {photos.length > 0 && (
            <div className="portal-card">
              <p className="portal-card-title">Fotos de recepción</p>
              <div className="portal-photos-grid">
                {photos.map((url, i) => (
                  <a
                    key={`${url}-${i}`}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="portal-photo-tile"
                    aria-label={`Foto ${i + 1} de recepción`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" loading="lazy" />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── Footer legend ────────────────────────────────────────── */}
          <p
            style={{
              textAlign: "center" as const,
              fontSize: "0.75rem",
              color: "var(--on-surf-var)",
              marginTop: "1.5rem",
              lineHeight: 1.6,
              opacity: 0.8,
            }}
          >
            Esta página se actualiza automáticamente. Si tienes alguna duda,
            comunícate con tu sucursal.
          </p>
        </div>

        {/* ── Sticky CTA WhatsApp ───────────────────────────────────── */}
        {whatsappHref && (
          <div className="portal-sticky-cta">
            <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
              </svg>
              Hablar con un asesor
            </a>
          </div>
        )}
      </div>
    </>
  );
}

// ─── Sub-componente: lista de ítems de un approval ───────────────────────
function ApprovalItemsList({ rawItemsJson }: { rawItemsJson: unknown }) {
  const items = parseApprovalItems(rawItemsJson);
  if (!items) {
    return (
      <p
        style={{
          fontSize: "0.8125rem",
          color: "var(--on-surf-var)",
          fontStyle: "italic",
        }}
      >
        No pudimos mostrar los detalles. Contacta al taller.
      </p>
    );
  }
  return (
    <ul style={{ listStyle: "none", padding: 0, margin: 0 }}>
      {items.map((it, i) => (
        <li
          key={`${it.nombre}-${i}`}
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "0.75rem",
            padding: "0.5rem 0",
            borderBottom:
              i === items.length - 1
                ? "none"
                : "1px dashed rgba(178, 204, 192, 0.4)",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <p
              style={{
                fontSize: "0.875rem",
                fontWeight: 500,
                color: "var(--on-surf)",
                lineHeight: 1.3,
              }}
            >
              {it.nombre}
            </p>
            <p
              style={{
                fontSize: "0.75rem",
                color: "var(--on-surf-var)",
                marginTop: "0.15rem",
              }}
            >
              {it.cantidad} × {formatMoney(it.precio)}
            </p>
          </div>
          <span
            style={{
              fontSize: "0.875rem",
              fontWeight: 600,
              color: "var(--on-surf)",
              whiteSpace: "nowrap" as const,
            }}
          >
            {formatMoney(it.subtotal)}
          </span>
        </li>
      ))}
    </ul>
  );
}
