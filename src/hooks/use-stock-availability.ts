"use client";

import { useEffect, useMemo, useState } from "react";

const POLL_INTERVAL_MS = 30_000;

export type StockMap = Record<string, { available: number }>;

const EMPTY: StockMap = Object.freeze({}) as StockMap;

/**
 * Polling cliente del stock disponible para una lista de ids
 * (productVariantId | simpleProductId). Refresca cada 30s mientras el
 * componente esté montado.
 *
 * Patrón: hook custom (no SWR) — único consumo de polling en el proyecto
 * por ahora. Si Fase 6 agrega un segundo caso (contadores caja, métricas
 * dashboard live) reabrir la decisión y migrar a `swr` o `@tanstack/react-query`.
 *
 * NO reserva stock — es lectura para señal visual al técnico.
 */
export function useStockAvailability(ids: string[]): StockMap {
  const [data, setData] = useState<StockMap>(EMPTY);
  // Key estable: misma lista de ids = mismo polling, sin reset al rerender.
  const key = useMemo(() => [...ids].sort().join(","), [ids]);

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const res = await fetch(
          `/api/workshop/stock-availability?ids=${key}`,
          { signal: ctrl.signal, cache: "no-store" },
        );
        if (!res.ok) return;
        const json = (await res.json()) as {
          success: boolean;
          data?: StockMap;
        };
        if (!cancelled && json.success && json.data) {
          setData(json.data);
        }
      } catch {
        // AbortError o fallo de red — silencio (siguiente tick reintenta).
      }
    };

    fetchOnce();
    const id = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(id);
    };
  }, [key]);

  // Sin ids: devuelve EMPTY (no leakear datos viejos al borrar el último item).
  return key ? data : EMPTY;
}
