"use client";

import { useEffect, useMemo, useState } from "react";
import type { AvailabilityEntry } from "@/lib/stock-availability";

const POLL_INTERVAL_MS = 60_000;

export type StockMap = Record<string, AvailabilityEntry>;

const EMPTY: StockMap = Object.freeze({}) as StockMap;

export function useStockAvailability(
  ids: string[],
  kind: "variant" | "simple" = "variant",
): StockMap {
  const [data, setData] = useState<StockMap>(EMPTY);
  const key = useMemo(() => [...ids].sort().join(","), [ids]);

  useEffect(() => {
    if (!key) return;
    const ctrl = new AbortController();
    let cancelled = false;

    const fetchOnce = async () => {
      try {
        const res = await fetch(
          `/api/workshop/stock-availability?ids=${key}&kind=${kind}`,
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
        // AbortError or network failure — next tick retries.
      }
    };

    fetchOnce();
    const id = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      ctrl.abort();
      clearInterval(id);
    };
  }, [key, kind]);

  return key ? data : EMPTY;
}
