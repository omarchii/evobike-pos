"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import type { SerializedOrderItem } from "./service-order-details";
import type { StockMap } from "@/hooks/use-stock-availability";
import { StockChip } from "./stock-chip";

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

type Props = {
  orderId: string;
  items: SerializedOrderItem[];
  subtotal: number;
  total: number;
  stockMap: StockMap;
  isClosed: boolean;
};

export function ItemsTable({
  orderId,
  items,
  subtotal,
  total,
  stockMap,
  isClosed,
}: Props) {
  const router = useRouter();
  const [removing, setRemoving] = useState(false);

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm("¿Eliminar este concepto?")) return;
    setRemoving(true);
    toast.loading("Eliminando...", { id: "remove-item" });
    const res = await fetch(`/api/workshop/orders/${orderId}/items`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemId }),
    });
    const data = (await res.json()) as { success: boolean; error?: string };
    if (data.success) {
      toast.success("Concepto eliminado", { id: "remove-item" });
      router.refresh();
    } else {
      toast.error(data.error ?? "No se pudo eliminar", { id: "remove-item" });
    }
    setRemoving(false);
  };

  return (
    <div className="px-6 pb-6">
      {/* Table header */}
      <div
        className="grid grid-cols-12 pb-2 mb-1"
        style={{
          fontSize: "0.6875rem",
          fontWeight: 500,
          letterSpacing: "0.05em",
          textTransform: "uppercase",
          color: "var(--on-surf-var)",
          borderBottom: "1px solid var(--ghost-border)",
        }}
      >
        <span className="col-span-6">Descripción</span>
        <span className="col-span-2 text-center">Cant.</span>
        <span className="col-span-2 text-right">P. Unit.</span>
        <span className="col-span-2 text-right">Importe</span>
      </div>

      {items.length === 0 ? (
        <p
          className="py-8 text-center"
          style={{ fontSize: "0.8125rem", color: "var(--on-surf-var)" }}
        >
          No hay cargos registrados aún.
        </p>
      ) : (
        items.map((item) => {
          const variantId = item.productVariantId;
          const available = variantId
            ? (stockMap[variantId]?.available ?? null)
            : null;
          return (
            <div
              key={item.id}
              className="grid grid-cols-12 items-center py-2.5 group rounded-lg transition-colors"
              style={{ fontSize: "0.8125rem", color: "var(--on-surf)" }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--surf-high)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <div className="col-span-6 flex items-center gap-2 pl-1 pr-2">
                <span className="truncate">{item.description}</span>
                {item.productVariant && (
                  <span
                    className="shrink-0"
                    style={{
                      fontSize: "0.5625rem",
                      fontWeight: 500,
                      letterSpacing: "0.04em",
                      textTransform: "uppercase",
                      color: "var(--on-surf-var)",
                      background: "var(--surf-high)",
                      borderRadius: "var(--r-sm)",
                      padding: "1px 6px",
                    }}
                  >
                    {item.productVariant.sku}
                  </span>
                )}
                {variantId && !isClosed && (
                  <StockChip qty={item.quantity} available={available} />
                )}
              </div>
              <span className="col-span-2 text-center">{item.quantity}</span>
              <span className="col-span-2 text-right">{formatMXN(item.price)}</span>
              <div className="col-span-2 flex items-center justify-end gap-1">
                <span className="font-medium">
                  {formatMXN(item.quantity * item.price)}
                </span>
                {!isClosed && (
                  <button
                    onClick={() => handleRemoveItem(item.id)}
                    disabled={removing}
                    className="opacity-0 group-hover:opacity-100 transition-opacity ml-1"
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--ter)",
                      cursor: "pointer",
                      padding: "2px",
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            </div>
          );
        })
      )}

      {items.length > 0 && (
        <div
          className="flex justify-end mt-4 pt-4"
          style={{ borderTop: "1px solid var(--ghost-border)" }}
        >
          <div className="space-y-1 text-right">
            <div style={{ fontSize: "0.75rem", color: "var(--on-surf-var)" }}>
              Subtotal:{" "}
              <span style={{ color: "var(--on-surf)" }}>
                {formatMXN(subtotal)}
              </span>
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontSize: "1.5rem",
                fontWeight: 700,
                color: "var(--on-surf)",
                letterSpacing: "-0.01em",
              }}
            >
              {formatMXN(total)}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
