import type { SessionUser } from "@/lib/auth-types";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { headers } from "next/headers";
import QRCode from "qrcode";
import { LabelActions } from "./_components/label-actions";

export const dynamic = "force-dynamic";

const TYPE_CHIP: Record<string, { bg: string; color: string; label: string }> = {
  PAID: { bg: "#f0f7f4", color: "#3d5247", label: "Pagada" },
  WARRANTY: { bg: "#d8f3dc", color: "#1b4332", label: "Garantía" },
  COURTESY: { bg: "#e8f5f0", color: "#2d6a4f", label: "Cortesía" },
  POLICY_MAINTENANCE: { bg: "#fef9e7", color: "#f39c12", label: "Mantenimiento Póliza" },
};

export default async function EtiquetaPage(props: {
  params: Promise<{ id: string }>;
}) {
  const params = await props.params;

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/login");
  }

  const { branchId, role } = session.user as unknown as SessionUser;

  const order = await prisma.serviceOrder.findUnique({
    where: { id: params.id },
    select: {
      id: true,
      folio: true,
      type: true,
      publicToken: true,
      createdAt: true,
      branchId: true,
      customer: { select: { name: true } },
      branch: { select: { name: true } },
    },
  });

  if (!order) notFound();

  if (role !== "ADMIN" && order.branchId !== branchId) {
    notFound();
  }

  const headersList = await headers();
  const host = headersList.get("host") ?? "localhost:3000";
  const scheme = host.startsWith("localhost") ? "http" : "https";
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? `${scheme}://${host}`;
  const publicUrl = `${appUrl}/taller/public/${order.publicToken}`;

  const qrDataUrl = await QRCode.toDataURL(publicUrl, {
    width: 192,
    margin: 1,
    color: { dark: "#000000", light: "#ffffff" },
  });

  const chip = TYPE_CHIP[order.type] ?? TYPE_CHIP.PAID;

  const dateFormatted = new Intl.DateTimeFormat("es-MX", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "America/Merida",
  }).format(new Date(order.createdAt));

  return (
    <>
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
          display: flex;
          align-items: center;
          justify-content: center;
        }

        @media print {
          @page {
            size: letter landscape;
            margin: 1.5cm;
          }

          .no-print {
            display: none !important;
          }

          .evobike-public-doc {
            background: #ffffff !important;
            color: #000000 !important;
            min-height: auto !important;
            display: block !important;
          }

          .etiqueta {
            box-shadow: none !important;
            page-break-inside: avoid;
            break-inside: avoid;
          }

          .evobike-public-doc * {
            backdrop-filter: none !important;
            -webkit-backdrop-filter: none !important;
          }
        }
      `}</style>

      <div className="evobike-public-doc">
        <LabelActions />

        {/* Label card */}
        <div
          className="etiqueta"
          style={{
            background: "#ffffff",
            borderRadius: "1.25rem",
            padding: "2.5rem 3rem",
            boxShadow: "0 8px 40px rgba(19,27,46,0.10)",
            maxWidth: "720px",
            width: "100%",
            margin: "2rem 1.5rem",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: "2rem",
            }}
          >
            {/* Left: order info */}
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Brand */}
              <p
                style={{
                  fontSize: "0.625rem",
                  fontWeight: 500,
                  letterSpacing: "0.12em",
                  textTransform: "uppercase",
                  color: "#3d5247",
                  marginBottom: "0.5rem",
                }}
              >
                EvoBike — Orden de taller
              </p>

              {/* Folio */}
              <p
                style={{
                  fontFamily: "var(--font-display)",
                  fontSize: "3.5rem",
                  fontWeight: 700,
                  letterSpacing: "-0.03em",
                  color: "#131b2e",
                  lineHeight: 1,
                  marginBottom: "1.25rem",
                }}
              >
                {order.folio}
              </p>

              {/* Type chip */}
              <span
                style={{
                  display: "inline-block",
                  padding: "0.25rem 0.75rem",
                  borderRadius: "9999px",
                  fontSize: "0.6875rem",
                  fontWeight: 600,
                  letterSpacing: "0.04em",
                  background: chip.bg,
                  color: chip.color,
                  marginBottom: "1.75rem",
                }}
              >
                {chip.label}
              </span>

              {/* Customer */}
              <div style={{ marginBottom: "0.75rem" }}>
                <p
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#3d5247",
                    marginBottom: "0.25rem",
                  }}
                >
                  Cliente
                </p>
                <p
                  style={{
                    fontSize: "1rem",
                    fontWeight: 500,
                    color: "#131b2e",
                  }}
                >
                  {order.customer.name}
                </p>
              </div>

              {/* Date */}
              <div style={{ marginBottom: "0.75rem" }}>
                <p
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#3d5247",
                    marginBottom: "0.25rem",
                  }}
                >
                  Fecha de recepción
                </p>
                <p style={{ fontSize: "0.9375rem", color: "#131b2e" }}>
                  {dateFormatted}
                </p>
              </div>

              {/* Branch */}
              <div>
                <p
                  style={{
                    fontSize: "0.625rem",
                    fontWeight: 500,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    color: "#3d5247",
                    marginBottom: "0.25rem",
                  }}
                >
                  Sucursal
                </p>
                <p style={{ fontSize: "0.9375rem", color: "#131b2e" }}>
                  {order.branch.name}
                </p>
              </div>
            </div>

            {/* Right: QR code */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "0.5rem",
                flexShrink: 0,
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={qrDataUrl}
                alt={`QR de seguimiento — orden ${order.folio}`}
                width={192}
                height={192}
                style={{
                  display: "block",
                  borderRadius: "0.5rem",
                  border: "1px solid #e8f0eb",
                }}
              />
              <p
                style={{
                  fontSize: "0.5625rem",
                  color: "#3d5247",
                  textAlign: "center",
                  maxWidth: "10rem",
                  lineHeight: 1.4,
                }}
              >
                Escanea para seguimiento
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Auto-print with delay to let QR render */}
      <script
        dangerouslySetInnerHTML={{
          __html: `setTimeout(function(){ window.print(); }, 300);`,
        }}
      />
    </>
  );
}
