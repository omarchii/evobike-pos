import type { Metadata } from "next";

// Este page se sirve cuando el endpoint interno llama `notFound()` por:
//   - token no existe en la BD
//   - order existe pero `publicTokenEnabled === false` (revocado por staff)
// No diferenciamos externamente para evitar enumeración de tokens.
// No mostramos CTA WhatsApp porque en este estado no tenemos `branch`
// para armar el href; el copy dirige al cliente a contactar su sucursal
// por los canales que ya conozca.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  title: "Enlace no disponible · EvoBike",
};

export default function TallerPortalNotFound() {
  return (
    <>
      <style>{`
        .evobike-portal-404 {
          --p: #1b4332;
          --surface: #f8fafa;
          --surf-lowest: #ffffff;
          --on-surf: #131b2e;
          --on-surf-var: #3d5247;
          --outline-var: #b2ccc0;
          --font-display: "Space Grotesk", "Inter", -apple-system, sans-serif;
          --font-body: "Inter", -apple-system, "Segoe UI", sans-serif;

          min-height: 100vh;
          background: #f8fafa;
          color: #131b2e;
          font-family: var(--font-body);
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 1.5rem;
        }
      `}</style>

      <div className="evobike-portal-404">
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            textAlign: "center" as const,
            padding: "2rem 1.5rem",
            background: "var(--surf-lowest)",
            borderRadius: "1rem",
            boxShadow: "0px 8px 24px -6px rgba(19, 27, 46, 0.08)",
          }}
        >
          <h1
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.5rem",
              fontWeight: 700,
              letterSpacing: "-0.02em",
              color: "var(--p)",
              lineHeight: 1,
              marginBottom: "1.25rem",
            }}
          >
            EvoBike
          </h1>

          <svg
            width="56"
            height="56"
            viewBox="0 0 24 24"
            fill="none"
            stroke="var(--on-surf-var)"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{
              margin: "0 auto 1.25rem",
              display: "block",
              opacity: 0.7,
            }}
            aria-hidden="true"
          >
            <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
            <line x1="12" y1="9" x2="12" y2="13" />
            <line x1="12" y1="17" x2="12.01" y2="17" />
          </svg>

          <h2
            style={{
              fontSize: "1.125rem",
              fontWeight: 600,
              color: "var(--on-surf)",
              marginBottom: "0.5rem",
            }}
          >
            Enlace no disponible
          </h2>

          <p
            style={{
              fontSize: "0.875rem",
              color: "var(--on-surf-var)",
              lineHeight: 1.5,
            }}
          >
            Este enlace no es válido o fue desactivado.
            <br />
            Contacta a tu sucursal para obtener el estado actual de tu servicio.
          </p>
        </div>
      </div>
    </>
  );
}
