"use client";

import { useSearchParams, useRouter, usePathname } from "next/navigation";

export function useReportFilters() {
  const sp = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  function setFilter(key: string, value: string | null) {
    const next = new URLSearchParams(sp.toString());
    if (value === null || value === "") next.delete(key);
    else next.set(key, value);
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  function setFilters(entries: Record<string, string | null>) {
    const next = new URLSearchParams(sp.toString());
    for (const [key, value] of Object.entries(entries)) {
      if (value === null || value === "") next.delete(key);
      else next.set(key, value);
    }
    const qs = next.toString();
    router.push(qs ? `${pathname}?${qs}` : pathname);
  }

  return { sp, setFilter, setFilters };
}
