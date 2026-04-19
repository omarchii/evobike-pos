"use client";

import { createContext, useContext } from "react";
import type { DensityLevel } from "@/lib/user/ui-preferences";

const DensityContext = createContext<DensityLevel>("normal");

export function DensityProvider({
  value,
  children,
}: {
  value: DensityLevel;
  children: React.ReactNode;
}) {
  return (
    <DensityContext.Provider value={value}>{children}</DensityContext.Provider>
  );
}

export function useDensity() {
  return useContext(DensityContext);
}
