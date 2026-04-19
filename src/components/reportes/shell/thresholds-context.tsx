"use client";

import { createContext, useContext } from "react";

export type ThresholdRow = {
  id: string;
  metricKey: string;
  branchId: string;
  thresholdValue: number;
  comparator: "LT" | "LTE" | "GT" | "GTE" | "EQ";
  isActive: boolean;
};

const ThresholdsContext = createContext<ThresholdRow[]>([]);

export function ThresholdsProvider({
  value,
  children,
}: {
  value: ThresholdRow[];
  children: React.ReactNode;
}) {
  return (
    <ThresholdsContext.Provider value={value}>
      {children}
    </ThresholdsContext.Provider>
  );
}

export function useThresholds(): ThresholdRow[] {
  return useContext(ThresholdsContext);
}

export function useThresholdForMetric(
  metricKey: string,
  branchId: string | null,
): ThresholdRow | null {
  const all = useThresholds();
  if (!branchId) return null;
  return all.find((t) => t.metricKey === metricKey && t.branchId === branchId) ?? null;
}
