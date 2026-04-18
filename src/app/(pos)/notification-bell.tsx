"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, BellOff } from "lucide-react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type {
    NotificationCategory,
    NotificationFeedResponse,
    NotificationGroup,
} from "@/app/api/notifications/feed/route";

const POLL_INTERVAL_MS = 30_000;

const CATEGORY_ROOT_HREF: Record<NotificationCategory, string> = {
    autorizaciones: "/autorizaciones",
    taller: "/workshop",
    recepciones: "/inventario/recepciones",
    cortes: "/cash-register",
};

function badgeLabel(total: number): string {
    if (total > 99) return "99+";
    return String(total);
}

export function NotificationBell() {
    const [data, setData] = useState<NotificationFeedResponse | null>(null);
    const [error, setError] = useState<boolean>(false);

    useEffect(() => {
        let cancelled = false;
        let intervalId: ReturnType<typeof setInterval> | null = null;

        const fetchFeed = async () => {
            try {
                const res = await fetch("/api/notifications/feed", {
                    credentials: "same-origin",
                });
                if (!res.ok) {
                    if (!cancelled) setError(true);
                    console.error(
                        `[NotificationBell] fetch failed: ${res.status} ${res.statusText}`,
                    );
                    return;
                }
                const payload = (await res.json()) as NotificationFeedResponse;
                if (!cancelled) {
                    setData(payload);
                    setError(false);
                }
            } catch (err) {
                console.error("[NotificationBell] fetch error", err);
                if (!cancelled) setError(true);
            }
        };

        const startInterval = () => {
            if (intervalId !== null) return;
            intervalId = setInterval(fetchFeed, POLL_INTERVAL_MS);
        };

        const stopInterval = () => {
            if (intervalId !== null) {
                clearInterval(intervalId);
                intervalId = null;
            }
        };

        const handleVisibilityChange = () => {
            if (document.hidden) {
                stopInterval();
            } else {
                fetchFeed();
                startInterval();
            }
        };

        fetchFeed();
        startInterval();
        document.addEventListener("visibilitychange", handleVisibilityChange);

        return () => {
            cancelled = true;
            stopInterval();
            document.removeEventListener("visibilitychange", handleVisibilityChange);
        };
    }, []);

    const total = data?.total ?? 0;
    const groups = data?.groups ?? [];
    const visibleGroups = groups.filter((g) => g.count > 0);

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label="Notificaciones"
                className="relative inline-flex h-8 w-8 items-center justify-center rounded-full text-[var(--on-surf-var)] outline-none transition-colors hover:bg-[var(--surf-high)] hover:text-[var(--on-surf)] focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
                <Bell className="h-4 w-4" aria-hidden="true" />
                {total > 0 && (
                    <span
                        aria-label={`${total} notificaciones pendientes`}
                        className="absolute -top-0.5 -right-0.5 flex h-[1.1rem] min-w-[1.1rem] items-center justify-center rounded-full bg-[var(--ter)] px-[0.3rem] text-[0.625rem] font-semibold leading-none tracking-[0.04em] text-[var(--on-ter-solid)]"
                    >
                        {badgeLabel(total)}
                    </span>
                )}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-96 border-0 p-0 shadow-[var(--shadow)]"
                style={{
                    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    color: "var(--on-surf)",
                }}
            >
                <div className="flex items-center justify-between px-4 py-3">
                    <h2
                        className="text-sm font-semibold"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        Notificaciones
                    </h2>
                    <span className="text-xs text-[var(--on-surf-var)]">
                        {total === 0 ? "Sin novedades" : `${total} pendientes`}
                    </span>
                </div>

                {error && !data && (
                    <div className="px-4 py-6 text-center text-sm text-[var(--on-surf-var)]">
                        No pudimos cargar las notificaciones.
                    </div>
                )}

                {!error && total === 0 && (
                    <div className="flex flex-col items-center gap-2 px-4 py-8 text-center">
                        <BellOff
                            className="h-6 w-6 text-[var(--on-surf-var)]"
                            aria-hidden="true"
                        />
                        <p className="text-sm text-[var(--on-surf-var)]">
                            No hay novedades
                        </p>
                    </div>
                )}

                {total > 0 && (
                    <div className="max-h-[60vh] overflow-y-auto pb-2">
                        {visibleGroups.map((group) => (
                            <NotificationGroupBlock key={group.category} group={group} />
                        ))}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function NotificationGroupBlock({ group }: { group: NotificationGroup }) {
    const remaining = group.count - group.items.length;
    return (
        <div className="border-t border-transparent pt-2">
            <div className="flex items-baseline justify-between px-4 py-1">
                <span className="text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-[var(--on-surf-var)]">
                    {group.label}
                </span>
                <span className="text-[0.6875rem] text-[var(--on-surf-var)]">
                    {group.count}
                </span>
            </div>
            {group.items.map((item) => (
                <DropdownMenuItem
                    key={item.id}
                    asChild
                    className="mx-2 cursor-pointer rounded-lg px-3 py-2 focus:bg-[var(--surf-high)]"
                >
                    <Link href={item.href}>
                        <div className="flex w-full flex-col gap-0.5">
                            <span className="text-sm font-semibold text-[var(--on-surf)]">
                                {item.title}
                            </span>
                            <span className="text-xs text-[var(--on-surf-var)]">
                                {item.description}
                            </span>
                        </div>
                    </Link>
                </DropdownMenuItem>
            ))}
            {remaining > 0 && (
                <Link
                    href={CATEGORY_ROOT_HREF[group.category]}
                    className="mx-2 block rounded-lg px-3 py-1.5 text-xs text-[var(--p)] hover:bg-[var(--surf-high)]"
                >
                    Ver los {remaining} restantes
                </Link>
            )}
        </div>
    );
}
