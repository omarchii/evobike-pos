"use client";

import * as React from "react";
import { Icon } from "@/components/primitives/icon";
import { formatMXN, formatDate } from "@/lib/format";
import type { SaleDetail } from "./queries";

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: "Completada",
  LAYAWAY: "Apartado",
  CANCELLED: "Cancelada",
};

type SaleDetailModalProps = {
  saleId: string | null;
  onClose: () => void;
};

export function SaleDetailModal({ saleId, onClose }: SaleDetailModalProps) {
  const [detail, setDetail] = React.useState<SaleDetail | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!saleId) {
      setDetail(null);
      return;
    }

    setLoading(true);
    fetch(`/api/reportes/ventas-e-ingresos/detail?id=${saleId}`)
      .then((r) => r.json())
      .then((data: { success: boolean; data?: SaleDetail }) => {
        if (data.success && data.data) setDetail(data.data);
      })
      .finally(() => setLoading(false));
  }, [saleId]);

  React.useEffect(() => {
    function handleEsc(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (saleId) {
      document.addEventListener("keydown", handleEsc);
    }
    return () => document.removeEventListener("keydown", handleEsc);
  }, [saleId, onClose]);

  if (!saleId) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Detalle de venta"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
        background: "rgba(0,0,0,0.4)",
      }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "42rem",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          border: "1px solid var(--ghost-border)",
          borderRadius: "var(--r-lg)",
          boxShadow: "var(--shadow)",
          padding: "1.5rem",
        }}
      >
        {/* Header */}
        <div className="mb-5 flex items-start justify-between">
          <div>
            <p
              className="text-[0.5625rem] font-medium uppercase tracking-[0.05em]"
              style={{ color: "var(--on-surf-var)" }}
            >
              Venta
            </p>
            <h2
              className="mt-0.5 text-xl font-bold tracking-[-0.01em] tabular-nums"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              {loading ? "Cargando…" : (detail?.folio ?? saleId.slice(0, 8))}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="flex items-center justify-center rounded-[var(--r-full)] p-1.5 transition-colors hover:bg-[var(--surf-high)]"
            style={{ color: "var(--on-surf-var)" }}
          >
            <Icon name="close" size={16} />
          </button>
        </div>

        {loading && (
          <div className="py-12 text-center text-sm" style={{ color: "var(--on-surf-var)" }}>
            Cargando detalle…
          </div>
        )}

        {!loading && detail && (
          <>
            {/* Metadata grid */}
            <div
              className="mb-4 grid grid-cols-2 gap-3 rounded-[var(--r-md)] p-4"
              style={{ background: "var(--surf-low)" }}
            >
              {[
                { label: "Fecha", value: formatDate(new Date(detail.fecha), "medium") },
                { label: "Cliente", value: detail.clienteNombre },
                { label: "Vendedor", value: detail.vendedorNombre },
                { label: "Método de pago", value: detail.metodoPago },
                { label: "Estado", value: STATUS_LABELS[detail.status] ?? detail.status },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p
                    className="text-[0.5625rem] font-medium uppercase tracking-[0.05em]"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    {label}
                  </p>
                  <p className="mt-0.5 text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                    {value}
                  </p>
                </div>
              ))}
            </div>

            {/* Line items */}
            <div className="mb-4">
              <h3
                className="mb-2 text-xs font-semibold uppercase tracking-[0.05em]"
                style={{ color: "var(--on-surf-var)" }}
              >
                Productos
              </h3>
              <div
                className="overflow-hidden rounded-[var(--r-md)]"
                style={{ outline: "1px solid var(--ghost-border)" }}
              >
                <table className="w-full text-xs">
                  <thead>
                    <tr style={{ background: "var(--surf-low)" }}>
                      {["Descripción", "Cant.", "Precio unit.", "Desc.", "Subtotal"].map((h) => (
                        <th
                          key={h}
                          className="px-3 py-2 text-left font-medium"
                          style={{ color: "var(--on-surf-var)" }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {detail.lineItems.map((item, i) => (
                      <tr
                        key={item.id}
                        style={{ background: i % 2 === 0 ? "transparent" : "var(--surf-low)" }}
                      >
                        <td className="px-3 py-2" style={{ color: "var(--on-surf)" }}>
                          {item.descripcion}
                        </td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: "var(--on-surf-var)" }}>
                          {item.cantidad}
                        </td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: "var(--on-surf)" }}>
                          {formatMXN(item.precioUnitario)}
                        </td>
                        <td className="px-3 py-2 tabular-nums" style={{ color: "var(--on-surf-var)" }}>
                          {item.descuento > 0 ? formatMXN(item.descuento) : "—"}
                        </td>
                        <td className="px-3 py-2 tabular-nums font-semibold" style={{ color: "var(--on-surf)" }}>
                          {formatMXN(item.subtotal)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Totals */}
            <div
              className="mb-4 flex flex-col gap-1.5 rounded-[var(--r-md)] p-4"
              style={{ background: "var(--surf-low)" }}
            >
              <div className="flex justify-between text-xs" style={{ color: "var(--on-surf-var)" }}>
                <span>Subtotal</span>
                <span className="tabular-nums">{formatMXN(detail.subtotal)}</span>
              </div>
              {detail.descuento > 0 && (
                <div className="flex justify-between text-xs" style={{ color: "var(--on-surf-var)" }}>
                  <span>Descuento</span>
                  <span className="tabular-nums">-{formatMXN(detail.descuento)}</span>
                </div>
              )}
              <div
                className="flex justify-between border-t pt-2 text-sm font-bold"
                style={{ borderColor: "var(--ghost-border)", color: "var(--on-surf)" }}
              >
                <span>Total</span>
                <span className="tabular-nums" style={{ fontFamily: "var(--font-display)" }}>
                  {formatMXN(detail.total)}
                </span>
              </div>
            </div>

            {/* Payments */}
            {detail.pagos.length > 0 && (
              <div>
                <h3
                  className="mb-2 text-xs font-semibold uppercase tracking-[0.05em]"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  Pagos aplicados
                </h3>
                <div className="flex flex-col gap-1">
                  {detail.pagos.map((pago) => (
                    <div
                      key={pago.id}
                      className="flex justify-between rounded-[var(--r-sm)] px-3 py-2 text-xs"
                      style={{ background: "var(--surf-low)", color: "var(--on-surf)" }}
                    >
                      <span>{pago.metodo}</span>
                      <span className="tabular-nums font-medium">{formatMXN(pago.monto)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
