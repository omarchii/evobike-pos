"use client";

// Store client-side para labels dinámicos del breadcrumb (nombre de cliente,
// folio de venta, etc.). Las páginas con segmentos dinámicos registran su
// label al montar vía `useRegisterBreadcrumbLabel(path, label)`. El
// componente <Breadcrumbs /> lee del store con useSyncExternalStore para
// re-renderizar cuando se publica.
//
// Complementa ROUTE_LABELS (estáticos) — ver route-labels.ts.

import { useEffect } from "react";
import { useSyncExternalStore } from "react";

type Listener = () => void;

const labels = new Map<string, string>();
const listeners = new Set<Listener>();
// Version counter — useSyncExternalStore compara referencias de getSnapshot,
// y mutar el Map no cambia su referencia, así que usamos un contador para
// que React detecte cambios.
let version = 0;

function emit(): void {
  version++;
  for (const l of listeners) l();
}

export function setBreadcrumbLabel(path: string, label: string): void {
  const prev = labels.get(path);
  if (prev === label) return;
  labels.set(path, label);
  emit();
}

function subscribe(l: Listener): () => void {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

function getVersion(): number {
  return version;
}

export function useBreadcrumbLabels(): Map<string, string> {
  useSyncExternalStore(subscribe, getVersion, getVersion);
  return labels;
}

/**
 * Hook para páginas con segmentos dinámicos: registra el label al montar
 * (y si cambia). No limpia al desmontar — el valor queda en cache para la
 * siguiente navegación a esa ruta.
 */
export function useRegisterBreadcrumbLabel(path: string, label: string | null | undefined): void {
  useEffect(() => {
    if (!label) return;
    setBreadcrumbLabel(path, label);
  }, [path, label]);
}
