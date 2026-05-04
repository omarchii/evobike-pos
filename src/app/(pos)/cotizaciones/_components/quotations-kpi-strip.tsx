import { formatMXN } from "@/lib/format";

interface Props {
  active: number;
  acceptedPending: number;
  convertedThisMonth: number;
  pendingValue: number;
  conversionRate: number;
}

export default function QuotationsKpiStrip({
  active,
  acceptedPending,
  convertedThisMonth,
  pendingValue,
  conversionRate,
}: Props) {
  const cards = [
    {
      label: "Cotizaciones activas",
      value: String(active),
      sub: "Vigentes en cualquier estado abierto",
      gradient: true,
    },
    {
      label: "Aceptadas (pend. pago)",
      value: String(acceptedPending),
      sub: "Cliente aceptó vía portal",
      gradient: false,
    },
    {
      label: "Convertidas este mes",
      value: String(convertedThisMonth),
      sub: "Venta o pedido generado",
      gradient: false,
    },
    {
      label: "Valor pendiente",
      value: formatMXN(pendingValue, { decimals: 2 }),
      sub: "Suma de activas vigentes",
      gradient: false,
    },
    {
      label: "Tasa de conversión",
      value: `${conversionRate.toFixed(1)}%`,
      sub: "Convertidas / total del mes",
      gradient: false,
    },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
      {cards.map((card) => (
        <div
          key={card.label}
          className="rounded-2xl p-5"
          style={
            card.gradient
              ? {
                  background: "var(--velocity-gradient)",
                  boxShadow: "var(--shadow)",
                }
              : {
                  background: "var(--surf-lowest)",
                  boxShadow: "var(--shadow)",
                }
          }
        >
          <p
            className="text-[0.625rem] font-medium tracking-widest uppercase mb-1"
            style={{ color: card.gradient ? "rgba(255,255,255,0.75)" : "var(--on-surf-var)" }}
          >
            {card.label}
          </p>
          <p
            className="text-3xl font-bold tracking-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: card.gradient ? "#ffffff" : "var(--on-surf)",
              letterSpacing: "-0.02em",
            }}
          >
            {card.value}
          </p>
          <p
            className="text-xs mt-1"
            style={{ color: card.gradient ? "rgba(255,255,255,0.65)" : "var(--on-surf-var)" }}
          >
            {card.sub}
          </p>
        </div>
      ))}
    </div>
  );
}
