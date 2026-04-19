"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import ReportCard from "./report-card";
import type { ReportMeta, ReportGroup, ReportRole } from "@/lib/reportes/reports-config";

const GROUP_LABELS: Record<ReportGroup, string> = {
  VENTAS: "Ventas",
  CLIENTES: "Clientes",
  INVENTARIO: "Inventario",
  FINANCIERO: "Financiero",
  EXPORTACIONES: "Exportaciones",
};

const GROUP_ORDER: ReportGroup[] = [
  "VENTAS",
  "CLIENTES",
  "INVENTARIO",
  "FINANCIERO",
  "EXPORTACIONES",
];

type Props = {
  role: ReportRole;
  pinnedReports: ReportMeta[];
  groupedReports: Record<ReportGroup, ReportMeta[]>;
  initialPinned: string[];
};

function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

export default function HubView({
  role,
  pinnedReports,
  groupedReports,
  initialPinned,
}: Props) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [pinned, setPinned] = useState<string[]>(initialPinned);

  const q = normalize(query.trim());
  const matchesQuery = (r: ReportMeta) =>
    !q ||
    normalize(r.title).includes(q) ||
    normalize(r.description).includes(q);

  const handleToggle = async (slug: string, action: "add" | "remove") => {
    const res = await fetch("/api/user/pinned-reports", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug, action }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as {
      success: boolean;
      data?: { pinnedReports: string[] };
    };
    if (data.success && data.data) {
      setPinned(data.data.pinnedReports);
      router.refresh();
    }
  };

  const visiblePinned = pinnedReports.filter(matchesQuery);
  const hasAnyResult = GROUP_ORDER.some(
    (g) => groupedReports[g].filter(matchesQuery).length > 0,
  );

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1
          className="text-2xl font-bold tracking-[-0.01em] text-[var(--on-surf)]"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Reportes
        </h1>
        <p className="mt-1 text-sm text-[var(--on-surf-var)]">
          Analiza el desempeño de tu negocio
        </p>
      </div>

      {role === "TECHNICIAN" ? (
        <div className="rounded-[var(--r-lg)] bg-[var(--surf-low)] p-8 text-center">
          <p className="text-sm text-[var(--on-surf-var)]">
            No tienes reportes asignados en este rol.
          </p>
        </div>
      ) : (
        <>
          {/* Search */}
          <div className="relative max-w-sm">
            <svg
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--on-surf-var)]"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="11" cy="11" r="7" />
              <path d="m16 16 4.5 4.5" />
            </svg>
            <input
              type="search"
              placeholder="Buscar reporte…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full rounded-[var(--r-lg)] bg-[var(--surf-low)] py-2.5 pl-10 pr-4 text-sm text-[var(--on-surf)] placeholder:text-[var(--on-surf-var)] outline-none focus:ring-2 focus:ring-[var(--p-bright)] transition-shadow"
            />
          </div>

          {/* Pinned */}
          {pinned.length > 0 && visiblePinned.length > 0 && (
            <section>
              <h2 className="mb-4 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                Guardados
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {visiblePinned.map((r) => (
                  <ReportCard
                    key={r.slug}
                    meta={r}
                    isPinned={pinned.includes(r.slug)}
                    onToggle={handleToggle}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Groups */}
          {GROUP_ORDER.map((group) => {
            const reports = groupedReports[group].filter(matchesQuery);
            if (reports.length === 0) return null;
            return (
              <section key={group}>
                <h2
                  className="mb-4 text-base font-bold tracking-[-0.01em] text-[var(--on-surf)]"
                  style={{ fontFamily: "var(--font-display)" }}
                >
                  {GROUP_LABELS[group]}
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {reports.map((r) => (
                    <ReportCard
                      key={r.slug}
                      meta={r}
                      isPinned={pinned.includes(r.slug)}
                      onToggle={handleToggle}
                    />
                  ))}
                </div>
              </section>
            );
          })}

          {/* Sin resultados */}
          {q && !hasAnyResult && (
            <div className="py-12 text-center text-sm text-[var(--on-surf-var)]">
              No se encontraron reportes para &ldquo;{query}&rdquo;.
            </div>
          )}
        </>
      )}
    </div>
  );
}
