"use client";

import { useState } from "react";
import { toast } from "sonner";
import { PackagePlus, Package, ChevronRight, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NewBatteryLotDialog, type BatteryVariantOption } from "./new-battery-lot-dialog";

// ── Types ──────────────────────────────────────────────────────────────────────

export interface BatteryLotRow {
  id: string;
  supplier: string | null;
  reference: string | null;
  receivedAt: string;
  productVariantSku: string;
  batteryTypeName: string;
  registeredBy: string;
  totalBatteries: number;
  inStock: number;
  installed: number;
}

interface Props {
  initialLots: BatteryLotRow[];
  batteryVariants: BatteryVariantOption[];
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// ── Component ──────────────────────────────────────────────────────────────────

export function BatteryLotsPanel({ initialLots, batteryVariants }: Props): React.JSX.Element {
  const [lots, setLots] = useState<BatteryLotRow[]>(initialLots);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshLots = async (): Promise<void> => {
    setIsRefreshing(true);
    try {
      const res = await fetch("/api/batteries/lots?limit=50");
      const data: { success: boolean; data?: BatteryLotRow[] } = await res.json();
      if (data.success && data.data) {
        setLots(data.data);
      }
    } catch {
      toast.error("Error al actualizar la lista de lotes");
    } finally {
      setIsRefreshing(false);
    }
  };

  const totalInStock = lots.reduce((sum, l) => sum + l.inStock, 0);
  const totalBatteries = lots.reduce((sum, l) => sum + l.totalBatteries, 0);

  return (
    <div className="space-y-5">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          {/* KPI pill */}
          <div
            className="flex items-center gap-2 px-4 py-2 rounded-xl"
            style={{ background: "var(--sec-container)" }}
          >
            <Zap className="h-4 w-4" style={{ color: "var(--p-bright)" }} />
            <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--on-sec-container)" }}>
              {totalInStock.toLocaleString("es-MX")} disponibles
            </span>
            <span style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>
              / {totalBatteries.toLocaleString("es-MX")} total
            </span>
          </div>
        </div>

        <Button
          onClick={() => setIsDialogOpen(true)}
          className="font-semibold"
          style={{
            background: "var(--velocity-gradient)",
            color: "#ffffff",
            borderRadius: "1.5rem",
            border: "none",
            fontSize: "0.8rem",
            height: "2.25rem",
            paddingLeft: "1rem",
            paddingRight: "1rem",
          }}
        >
          <PackagePlus className="h-4 w-4 mr-1.5" />
          Registrar Lote
        </Button>
      </div>

      {/* Table */}
      {lots.length === 0 ? (
        <div
          className="flex flex-col items-center justify-center py-16 rounded-2xl"
          style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
          <Package className="h-10 w-10 mb-3" style={{ color: "var(--on-surf-var)" }} />
          <p style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--on-surf)" }}>
            Sin lotes registrados
          </p>
          <p style={{ fontSize: "0.8rem", color: "var(--on-surf-var)", marginTop: "0.25rem" }}>
            Registra el primer lote de baterías para comenzar.
          </p>
          <Button
            onClick={() => setIsDialogOpen(true)}
            className="mt-4"
            style={{
              background: "var(--velocity-gradient)",
              color: "#fff",
              borderRadius: "1.5rem",
              border: "none",
              fontSize: "0.8rem",
            }}
          >
            <PackagePlus className="h-4 w-4 mr-1.5" />
            Registrar Lote
          </Button>
        </div>
      ) : (
        <div
          className="rounded-2xl overflow-hidden"
          style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
          {/* Column headers */}
          <div
            className="grid items-center px-4 py-3"
            style={{
              gridTemplateColumns: "1fr 1fr 1fr 120px 96px 96px 32px",
              borderBottom: "1px solid var(--ghost-border)",
            }}
          >
            {["Referencia / Proveedor", "Tipo", "Registrado por", "Fecha", "Total", "Disponibles", ""].map((h) => (
              <span
                key={h}
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 500,
                  letterSpacing: "0.05em",
                  textTransform: "uppercase",
                  color: "var(--on-surf-var)",
                }}
              >
                {h}
              </span>
            ))}
          </div>

          {/* Rows */}
          {lots.map((lot) => {
            const stockPct = lot.totalBatteries > 0 ? (lot.inStock / lot.totalBatteries) * 100 : 0;
            const stockColor =
              stockPct > 50
                ? "var(--sec)"
                : stockPct > 20
                  ? "var(--warn)"
                  : "var(--ter)";

            return (
              <div
                key={lot.id}
                className="grid items-center px-4 py-3 transition-colors"
                style={{
                  gridTemplateColumns: "1fr 1fr 1fr 120px 96px 96px 32px",
                  borderBottom: "1px solid var(--ghost-border-soft)",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "var(--surf-high)";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLDivElement).style.background = "transparent";
                }}
              >
                {/* Referencia / proveedor */}
                <div>
                  <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--on-surf)" }}>
                    {lot.reference ?? "Sin referencia"}
                  </p>
                  <p style={{ fontSize: "0.7rem", color: "var(--on-surf-var)" }}>
                    {lot.supplier ?? "Sin proveedor"}
                  </p>
                </div>

                {/* Tipo */}
                <div>
                  <p style={{ fontSize: "0.75rem", color: "var(--on-surf)" }}>{lot.batteryTypeName}</p>
                  <p style={{ fontSize: "0.7rem", fontFamily: "monospace", color: "var(--on-surf-var)" }}>
                    {lot.productVariantSku}
                  </p>
                </div>

                {/* Registrado por */}
                <p style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>{lot.registeredBy}</p>

                {/* Fecha */}
                <p style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>{formatDate(lot.receivedAt)}</p>

                {/* Total */}
                <p style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--on-surf)" }}>
                  {lot.totalBatteries}
                </p>

                {/* Disponibles */}
                <div className="flex items-center gap-2">
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      color: stockColor,
                    }}
                  >
                    {lot.inStock}
                  </span>
                  <div
                    className="flex-1 rounded-full overflow-hidden"
                    style={{ height: 4, background: "var(--surf-highest)" }}
                  >
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${stockPct}%`, background: stockColor }}
                    />
                  </div>
                </div>

                {/* Chevron */}
                <ChevronRight className="h-4 w-4" style={{ color: "var(--on-surf-var)" }} />
              </div>
            );
          })}
        </div>
      )}

      {/* Refresh hint */}
      {lots.length > 0 && (
        <p
          className="text-center cursor-pointer hover:underline"
          style={{ fontSize: "0.7rem", color: "var(--on-surf-var)" }}
          onClick={refreshLots}
        >
          {isRefreshing ? "Actualizando…" : "↻ Actualizar lista"}
        </p>
      )}

      {/* Dialog */}
      <NewBatteryLotDialog
        open={isDialogOpen}
        onOpenChange={setIsDialogOpen}
        batteryVariants={batteryVariants}
        onSuccess={refreshLots}
      />
    </div>
  );
}
