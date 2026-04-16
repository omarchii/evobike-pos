"use client";

import { AlertTriangle, ChevronDown } from "lucide-react";
import { formatMXN } from "@/lib/quotations";

export interface DriftItem {
  itemId: string;
  description: string;
  frozenPrice: number;
  currentPrice: number;
  drift: "higher" | "lower" | "none";
  difference: number;
}

export interface Manager {
  id: string;
  name: string;
}

interface PriceDriftAlertProps {
  drifts: DriftItem[];
  useOriginalPrices: boolean;
  onUseOriginalPricesChange: (value: boolean) => void;
  authorizedById: string | null;
  onAuthorizedByIdChange: (value: string | null) => void;
  managers: Manager[];
}

const SELECT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontWeight: 400,
  fontSize: "0.875rem",
  height: 44,
  cursor: "pointer",
  width: "100%",
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  appearance: "none",
  WebkitAppearance: "none",
};

// Items that drift higher (current > frozen) require manager auth if user wants original prices
function hasHigherDrift(drifts: DriftItem[]): boolean {
  return drifts.some((d) => d.drift === "higher");
}

export default function PriceDriftAlert({
  drifts,
  useOriginalPrices,
  onUseOriginalPricesChange,
  authorizedById,
  onAuthorizedByIdChange,
  managers,
}: PriceDriftAlertProps) {
  const relevantDrifts = drifts.filter((d) => d.drift !== "none");
  if (relevantDrifts.length === 0) return null;

  const needsAuth = useOriginalPrices && hasHigherDrift(drifts);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-2.5">
        <div
          className="flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold shrink-0"
          style={{ background: "var(--warn-container)", color: "var(--warn)" }}
        >
          1
        </div>
        <h3
          className="text-sm font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
        >
          Validación de Precios
        </h3>
      </div>

      {/* Warning card */}
      <div
        className="rounded-2xl p-4 space-y-3"
        style={{ background: "color-mix(in srgb, var(--warn-container) 60%, transparent)" }}
      >
        <div className="flex items-start gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" style={{ color: "var(--warn)" }} />
          <p className="text-xs" style={{ color: "var(--on-surf)" }}>
            Los precios de algunos productos en el catálogo cambiaron desde que se generó esta cotización.
          </p>
        </div>

        {/* Price drift table */}
        <div
          className="rounded-xl overflow-hidden"
          style={{ background: "var(--surf-lowest)" }}
        >
          {/* Table header */}
          <div
            className="grid gap-3 px-4 py-2"
            style={{
              gridTemplateColumns: "2fr 1fr 1fr 1fr",
              borderBottom: "1px solid var(--ghost-border)",
            }}
          >
            {["Producto", "Cotizado", "Actual", "Diferencia"].map((h) => (
              <span
                key={h}
                className="text-[0.6rem] font-medium tracking-widest uppercase"
                style={{ color: "var(--on-surf-var)" }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows — only items with actual drift */}
          {relevantDrifts.map((item, i) => (
            <div
              key={item.itemId}
              className="grid gap-3 px-4 py-2.5 items-center"
              style={{
                gridTemplateColumns: "2fr 1fr 1fr 1fr",
                background: i % 2 === 1 ? "var(--surf-low)" : "var(--surf-lowest)",
              }}
            >
              <span
                className="text-xs truncate"
                style={{ color: "var(--on-surf)" }}
                title={item.description}
              >
                {item.description}
              </span>
              <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                {formatMXN(item.frozenPrice)}
              </span>
              <span className="text-xs" style={{ color: "var(--on-surf)" }}>
                {formatMXN(item.currentPrice)}
              </span>
              <span
                className="text-xs font-semibold"
                style={{
                  color: item.drift === "higher" ? "var(--ter)" : "var(--secondary)",
                }}
              >
                {item.drift === "higher"
                  ? `+${formatMXN(item.difference)}`
                  : `−${formatMXN(Math.abs(item.difference))}`}
              </span>
            </div>
          ))}
        </div>

        {/* Toggle */}
        <div className="flex items-center justify-between gap-4 pt-1">
          <div>
            <p className="text-xs font-medium" style={{ color: "var(--on-surf)" }}>
              Mantener precios originales de la cotización
            </p>
            <p className="text-[0.625rem] mt-0.5" style={{ color: "var(--on-surf-var)" }}>
              Por defecto se usarán los precios actualizados del catálogo.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={useOriginalPrices}
            onClick={() => {
              onUseOriginalPricesChange(!useOriginalPrices);
              if (!useOriginalPrices === false) onAuthorizedByIdChange(null);
            }}
            className="relative shrink-0 transition-colors"
            style={{
              width: 44,
              height: 24,
              borderRadius: 12,
              background: useOriginalPrices ? "var(--primary)" : "var(--surf-high)",
              cursor: "pointer",
              border: "none",
            }}
          >
            <span
              className="absolute top-1 transition-transform"
              style={{
                left: useOriginalPrices ? 22 : 4,
                width: 16,
                height: 16,
                borderRadius: "50%",
                background: "white",
                display: "block",
              }}
            />
          </button>
        </div>

        {/* Auth selector — only if toggle ON and has higher drift */}
        {needsAuth && (
          <div className="space-y-2 pt-1">
            <div
              className="flex items-start gap-2 rounded-xl px-3 py-2"
              style={{ background: "var(--ter-container)" }}
            >
              <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" style={{ color: "var(--ter)" }} />
              <p className="text-xs" style={{ color: "var(--on-ter-container)" }}>
                Honrar precios menores al catálogo actual requiere autorización de gerente.
              </p>
            </div>
            <label className="text-xs font-medium block" style={{ color: "var(--on-surf-var)" }}>
              Gerente autorizador *
            </label>
            <div className="relative">
              <select
                value={authorizedById ?? ""}
                onChange={(e) => onAuthorizedByIdChange(e.target.value || null)}
                style={SELECT_STYLE}
              >
                <option value="">Seleccionar gerente...</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none h-4 w-4"
                style={{ color: "var(--on-surf-var)" }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
