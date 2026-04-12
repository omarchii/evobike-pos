/** Shared chip de estado para recepciones de inventario.
 *  Usado en /inventario/recepciones (listado) y /inventario/recepciones/[id] (detalle).
 *  No requiere "use client" — sin hooks ni APIs de browser.
 */

function daysUntil(iso: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(iso);
  due.setHours(0, 0, 0, 0);
  return Math.round((due.getTime() - now.getTime()) / 86_400_000);
}

interface ReceiptStatusBadgeProps {
  estadoPago: string;
  fechaVencimiento: string | null;
}

export function ReceiptStatusBadge({
  estadoPago,
  fechaVencimiento,
}: ReceiptStatusBadgeProps) {
  let bg: string;
  let color: string;
  let label: string;

  if (estadoPago === "PAGADA") {
    bg = "var(--sec-container)";
    color = "var(--on-sec-container)";
    label = "Pagada";
  } else if (estadoPago === "PENDIENTE") {
    bg = "var(--warn-container)";
    color = "var(--warn)";
    label = "Pendiente";
  } else {
    // CREDITO — urgency from fechaVencimiento
    const days =
      fechaVencimiento !== null ? daysUntil(fechaVencimiento) : null;
    if (days !== null && days < 0) {
      bg = "var(--ter-container)";
      color = "var(--on-ter-container)";
    } else if (days !== null && days <= 7) {
      bg = "var(--warn-container)";
      color = "var(--warn)";
    } else {
      bg = "color-mix(in srgb, var(--warn) 12%, transparent)";
      color = "var(--warn)";
    }
    label = "Crédito";
  }

  return (
    <span
      style={{
        background: bg,
        color,
        borderRadius: "var(--r-full)",
        padding: "0.2rem 0.65rem",
        fontSize: "0.625rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        fontFamily: "var(--font-body)",
        whiteSpace: "nowrap",
      }}
    >
      {label}
    </span>
  );
}

export { daysUntil };
