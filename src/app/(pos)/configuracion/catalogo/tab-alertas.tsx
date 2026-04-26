"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { SELECT_STYLE, type BranchRow } from "./shared";

interface Alert {
  kind: "variant" | "simple";
  stockId: string;
  branchId: string;
  branchCode: string;
  branchName: string;
  quantity: number;
  stockMinimo: number;
  delta: number;
  variant: {
    id: string;
    sku: string;
    imageUrl: string | null;
    modelo: string;
    color: string;
    voltaje: string;
  } | null;
  simple: {
    id: string;
    codigo: string;
    nombre: string;
    categoria: string;
    imageUrl: string | null;
  } | null;
}

export function TabAlertas({
  isAdmin,
  userBranchId,
  branches,
}: {
  isAdmin: boolean;
  userBranchId: string | null;
  branches: BranchRow[];
}) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [branchFilter, setBranchFilter] = useState<string>(
    isAdmin ? "" : userBranchId ?? "",
  );
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load(): Promise<void> {
      setLoading(true);
      try {
        const qs = isAdmin && branchFilter ? `?branchId=${branchFilter}` : "";
        const res = await fetch(`/api/configuracion/alertas-stock${qs}`);
        const json = await res.json();
        if (!active) return;
        if (!res.ok || !json.success) {
          toast.error(json.error ?? "No se pudo cargar");
          return;
        }
        setAlerts(json.data);
      } catch {
        if (active) toast.error("Error de red");
      } finally {
        if (active) setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, [branchFilter, isAdmin]);

  function severity(a: Alert): "critical" | "warning" {
    return a.quantity <= a.stockMinimo / 2 ? "critical" : "warning";
  }

  return (
    <div className="space-y-4 mt-4">
      {isAdmin && (
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-widest text-[var(--on-surf-var)]">
            Sucursal
          </label>
          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            style={{ ...SELECT_STYLE, width: 280 }}
          >
            <option value="">Todas</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.code} — {b.name}
              </option>
            ))}
          </select>
        </div>
      )}

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                <Th>Severidad</Th>
                <Th>Producto</Th>
                <Th>Sucursal</Th>
                <Th align="right">Stock</Th>
                <Th align="right">Mínimo</Th>
                <Th align="right">Acción</Th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-sm text-[var(--on-surf-var)]">
                    Cargando…
                  </td>
                </tr>
              )}
              {!loading && alerts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-5 py-6 text-center text-sm text-[var(--on-surf-var)]">
                    Sin alertas de stock.
                  </td>
                </tr>
              )}
              {alerts.map((a) => {
                const sev = severity(a);
                const recepcionHref = a.variant?.id
                  ? `/inventario/recepciones/nuevo?variantId=${a.variant.id}`
                  : `/inventario/recepciones/nuevo?simpleProductId=${a.simple!.id}`;
                const label = a.variant
                  ? `${a.variant.modelo} · ${a.variant.color} · ${a.variant.voltaje}`
                  : a.simple?.nombre ?? "—";
                const sub = a.variant?.sku ?? a.simple?.codigo ?? "";
                return (
                  <tr
                    key={a.stockId}
                    style={{ borderBottom: "1px solid var(--ghost-border-soft)" }}
                  >
                    <td className="px-5 py-3">
                      <span
                        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{
                          background:
                            sev === "critical" ? "var(--e-container)" : "var(--t-container)",
                          color:
                            sev === "critical"
                              ? "var(--on-e-container)"
                              : "var(--on-t-container)",
                        }}
                      >
                        <AlertTriangle className="h-3 w-3" />
                        {sev === "critical" ? "Crítico" : "Bajo"}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-[var(--on-surf)]">
                      <div>{label}</div>
                      <div className="text-xs text-[var(--on-surf-var)] font-mono">{sub}</div>
                    </td>
                    <td className="px-5 py-3 text-[var(--on-surf-var)]">
                      {a.branchCode} — {a.branchName}
                    </td>
                    <td className="px-5 py-3 text-right font-semibold text-[var(--on-surf)]">
                      {a.quantity}
                    </td>
                    <td className="px-5 py-3 text-right text-[var(--on-surf-var)]">
                      {a.stockMinimo}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <Link
                        href={recepcionHref}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
                        style={{ background: "var(--p)", color: "#ffffff" }}
                      >
                        Crear recepción
                      </Link>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="px-5 py-3 text-xs font-medium uppercase tracking-widest"
      style={{ color: "var(--on-surf-var)", textAlign: align }}
    >
      {children}
    </th>
  );
}
