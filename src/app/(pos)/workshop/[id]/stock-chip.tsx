"use client";

type Props = {
  qty: number;
  available: number | null;
};

// Semáforo de stock para refacciones (no para servicios manuales).
//   🟢 stock holgado:   available >= qty + 5
//   🟡 justo lo nec.:   qty <= available < qty + 5
//   🔴 insuficiente:    available < qty
//
// `available === null` significa "sin dato" (todavía no terminó el primer
// fetch del polling). Mostramos guion para evitar parpadeo de color.
export function StockChip({ qty, available }: Props) {
  if (available === null) {
    return (
      <span
        className="shrink-0"
        style={{
          background: "var(--surf-high)",
          color: "var(--on-surf-var)",
          borderRadius: 9999,
          padding: "1px 6px",
          fontSize: "0.5625rem",
          fontWeight: 500,
          letterSpacing: "0.04em",
        }}
        title="Stock no disponible aún"
      >
        — stock
      </span>
    );
  }

  let bg = "var(--p-container)";
  let color = "var(--on-p-container)";
  let label = `${available} en stock`;
  if (available < qty) {
    bg = "var(--ter-container)";
    color = "var(--ter)";
    label = `${available} (faltan ${qty - available})`;
  } else if (available < qty + 5) {
    bg = "var(--warn-container)";
    color = "var(--warn)";
    label = `${available} en stock`;
  }
  return (
    <span
      className="shrink-0"
      style={{
        background: bg,
        color,
        borderRadius: 9999,
        padding: "1px 6px",
        fontSize: "0.5625rem",
        fontWeight: 500,
        letterSpacing: "0.04em",
      }}
      title={`Disponible: ${available} · Cantidad pedida: ${qty}`}
    >
      {label}
    </span>
  );
}
