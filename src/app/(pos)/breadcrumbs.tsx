import Link from "next/link";
import { headers } from "next/headers";
import { getServerSession } from "next-auth";
import { ChevronRight, Home } from "lucide-react";
import { authOptions } from "@/lib/auth";
import {
    ROUTE_LABELS,
    HIDDEN_ROUTES,
    resolveStaticLabel,
} from "@/lib/breadcrumbs/route-labels";
import {
    resolveDynamicLabel,
    fallbackIdLabel,
} from "@/lib/breadcrumbs/resolve-dynamic";

const ID_PATTERN = /^[a-z0-9-]{12,}$/i;

type Crumb = {
    label: string;
    href: string | null;
};

export async function Breadcrumbs() {
    const pathname = (await headers()).get("x-pathname") ?? "/";
    if (HIDDEN_ROUTES.has(pathname)) return null;

    const session = await getServerSession(authOptions);
    if (!session?.user) return null;

    const segments = pathname.split("/").filter(Boolean);
    const crumbs: Crumb[] = [{ label: "Inicio", href: "/" }];

    const ctx = {
        role: session.user.role,
        branchId: session.user.branchId ?? "",
    };

    for (let i = 0; i < segments.length; i++) {
        const seg = segments[i];
        const accumulated = "/" + segments.slice(0, i + 1).join("/");
        const isLast = i === segments.length - 1;

        let label: string;
        if (ROUTE_LABELS[accumulated]) {
            label = ROUTE_LABELS[accumulated];
        } else if (ID_PATTERN.test(seg)) {
            const resolved = await resolveDynamicLabel(segments, i, ctx);
            label = resolved ?? fallbackIdLabel(seg);
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
                                    {isFirst && (
                                        <Home size={14} aria-hidden="true" />
                                    )}
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
