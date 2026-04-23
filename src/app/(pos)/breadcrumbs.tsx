"use client";

// Breadcrumbs (client component) — lee usePathname() para re-renderizar en
// cada navegación soft-side. El server component original quedaba cacheado
// al layout y no se refrescaba al cambiar de página (por ej. al volver de
// /customers/[id] a /customers).
//
// Labels:
//  - Estáticos: ROUTE_LABELS / resolveStaticLabel (síncrono, sin flash).
//  - Dinámicos (ID_PATTERN): primero busca en el store client
//    (useBreadcrumbLabels), luego cae a un fetch a /api/breadcrumb-label
//    que corre resolveDynamicLabel server-side. Las páginas pueden poblar
//    el store proactivamente vía useRegisterBreadcrumbLabel() para evitar
//    flash (ver profile-shell.tsx).

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { ChevronRight, Home } from "lucide-react";
import {
  HIDDEN_ROUTES,
  resolveStaticLabel,
  ROUTE_LABELS,
} from "@/lib/breadcrumbs/route-labels";
import { fallbackIdLabel } from "@/lib/breadcrumbs/resolve-dynamic";
import {
  setBreadcrumbLabel,
  useBreadcrumbLabels,
} from "@/lib/breadcrumbs/client-store";

const ID_PATTERN = /^[a-z0-9-]{12,}$/i;

type Crumb = {
  label: string;
  href: string | null;
};

export function Breadcrumbs(): React.JSX.Element | null {
  const pathname = usePathname();
  const dynamicLabels = useBreadcrumbLabels();

  // Lanza un fetch por cualquier segmento ID sin label registrado todavía.
  // El handler devuelve labels y setBreadcrumbLabel los publica al store,
  // causando re-render vía useSyncExternalStore.
  useEffect(() => {
    const segments = pathname.split("/").filter(Boolean);
    const missing: string[] = [];
    for (let i = 0; i < segments.length; i++) {
      const seg = segments[i];
      if (!ID_PATTERN.test(seg)) continue;
      const accumulated = "/" + segments.slice(0, i + 1).join("/");
      if (!dynamicLabels.has(accumulated)) missing.push(accumulated);
    }
    if (missing.length === 0) return;

    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `/api/breadcrumb-label?path=${encodeURIComponent(pathname)}`,
        );
        if (!res.ok || cancelled) return;
        const body = (await res.json()) as {
          success: boolean;
          labels?: Record<string, string>;
        };
        if (!body.success || !body.labels) return;
        for (const [p, l] of Object.entries(body.labels)) {
          setBreadcrumbLabel(p, l);
        }
      } catch {
        // Silencioso — el fallback (fallbackIdLabel) ya está visible.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [pathname, dynamicLabels]);

  if (HIDDEN_ROUTES.has(pathname)) return null;

  const segments = pathname.split("/").filter(Boolean);
  const crumbs: Crumb[] = [{ label: "Inicio", href: "/" }];

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    const accumulated = "/" + segments.slice(0, i + 1).join("/");
    const isLast = i === segments.length - 1;

    let label: string;
    if (ROUTE_LABELS[accumulated]) {
      label = ROUTE_LABELS[accumulated];
    } else if (ID_PATTERN.test(seg)) {
      label = dynamicLabels.get(accumulated) ?? fallbackIdLabel(seg);
    } else {
      label = resolveStaticLabel(seg, accumulated);
    }

    crumbs.push({ label, href: isLast ? null : accumulated });
  }

  return (
    <nav
      aria-label="Breadcrumb"
      className="w-full bg-[var(--surf-bright)] px-6 py-2 shrink-0 transition-colors duration-200"
    >
      <ol
        role="list"
        className="flex items-center gap-1.5 overflow-x-auto text-sm"
      >
        {crumbs.map((c, idx) => {
          const isFirst = idx === 0;
          return (
            <li
              key={`${idx}-${c.label}`}
              className="flex items-center gap-1.5 shrink-0"
            >
              {!isFirst && (
                <ChevronRight
                  size={14}
                  className="text-[var(--on-surf-var)] shrink-0"
                  aria-hidden="true"
                />
              )}
              {c.href ? (
                <Link
                  href={c.href}
                  className="text-[var(--on-surf-var)] hover:text-[var(--on-surf)] underline-offset-4 hover:underline flex items-center gap-1.5"
                >
                  {isFirst && <Home size={14} aria-hidden="true" />}
                  <span>{c.label}</span>
                </Link>
              ) : (
                <span
                  aria-current="page"
                  className="text-[var(--on-surf)] font-medium"
                >
                  {c.label}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
