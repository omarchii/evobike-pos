import type { ReportKPI } from "@/lib/reportes/types";
import { formatMXN } from "@/lib/reportes/money";

function formatValue(kpi: ReportKPI): string {
  switch (kpi.format) {
    case "currency":
      return formatMXN(kpi.value);
    case "percent":
      return `${kpi.value.toFixed(1)}%`;
    case "number":
      return kpi.value.toLocaleString("es-MX");
  }
}

interface ReportKpiCardsProps {
  kpis: ReportKPI[];
}

export function ReportKpiCards({
  kpis,
}: ReportKpiCardsProps): React.JSX.Element {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
      {kpis.map((kpi, i) => {
        const isHighlight = i === 0;
        return (
          <div
            key={kpi.label}
            className="rounded-2xl p-5"
            style={{
              background: isHighlight
                ? "var(--velocity-gradient)"
                : "var(--surf-lowest)",
              boxShadow: "var(--shadow)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.625rem",
                fontWeight: 500,
                letterSpacing: "0.05em",
                textTransform: "uppercase",
                color: isHighlight
                  ? "rgba(255,255,255,0.75)"
                  : "var(--on-surf-var)",
                marginBottom: "0.5rem",
              }}
            >
              {kpi.label}
            </p>
            <p
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.75rem",
                fontWeight: 700,
                letterSpacing: "-0.02em",
                lineHeight: 1,
                color: isHighlight ? "#ffffff" : "var(--on-surf)",
              }}
            >
              {formatValue(kpi)}
            </p>
            {kpi.trend && (
              <p
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: "0.6875rem",
                  color: isHighlight
                    ? "rgba(255,255,255,0.65)"
                    : "var(--on-surf-var)",
                  marginTop: "0.375rem",
                }}
              >
                {kpi.trend}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
