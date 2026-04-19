"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
const DISMISSED_KEY = "evobike:notifications:dismissed";

function loadDismissed(): Set<string> {
    if (typeof window === "undefined") return new Set();
    try {
        const raw = window.localStorage.getItem(DISMISSED_KEY);
        if (!raw) return new Set();
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) return new Set();
        return new Set(parsed.filter((x): x is string => typeof x === "string"));
    } catch {
        return new Set();
    }
}

function saveDismissed(ids: Set<string>): void {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify([...ids]));
}

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
    const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed());

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
                    setDismissed((prev) => {
                        const visibleIds = new Set(
                            payload.groups.flatMap((g) => g.items.map((i) => i.id)),
                        );
                        const next = new Set([...prev].filter((id) => visibleIds.has(id)));
                        if (next.size !== prev.size) saveDismissed(next);
                        return next;
                    });
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

    const dismissItem = useCallback((id: string) => {
        setDismissed((prev) => {
            if (prev.has(id)) return prev;
            const next = new Set(prev);
            next.add(id);
            saveDismissed(next);
            return next;
        });
    }, []);

    const dismissAll = useCallback(() => {
        if (!data) return;
        const ids = data.groups.flatMap((g) => g.items.map((i) => i.id));
        if (ids.length === 0) return;
        setDismissed((prev) => {
            const next = new Set(prev);
            for (const id of ids) next.add(id);
            saveDismissed(next);
            return next;
        });
    }, [data]);

    const { total, visibleGroups, hasDismissibleVisible } = useMemo(() => {
        const groups = data?.groups ?? [];
        let total = 0;
        let dismissibleCount = 0;
        const visibleGroups: NotificationGroup[] = [];
        for (const g of groups) {
            const items = g.items.filter((i) => !dismissed.has(i.id));
            const dismissedInVisible = g.items.length - items.length;
            const adjustedCount = Math.max(0, g.count - dismissedInVisible);
            total += adjustedCount;
            dismissibleCount += items.length;
            if (adjustedCount > 0 && items.length > 0) {
                visibleGroups.push({ ...g, items, count: adjustedCount });
            }
        }
        return { total, visibleGroups, hasDismissibleVisible: dismissibleCount > 0 };
    }, [data, dismissed]);

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
                    {hasDismissibleVisible ? (
                        <button
                            type="button"
                            onClick={dismissAll}
                            className="text-xs font-medium text-[var(--p)] hover:underline"
                        >
                            Limpiar todo
                        </button>
                    ) : (
                        <span className="text-xs text-[var(--on-surf-var)]">
                            {total === 0 ? "Sin novedades" : `${total} pendientes`}
                        </span>
                    )}
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
                            <NotificationGroupBlock
                                key={group.category}
                                group={group}
                                onDismiss={dismissItem}
                            />
                        ))}
                    </div>
                )}
            </DropdownMenuContent>
        </DropdownMenu>
    );
}

function NotificationGroupBlock({
    group,
    onDismiss,
}: {
    group: NotificationGroup;
    onDismiss: (id: string) => void;
}) {
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
                <div
                    key={item.id}
                    className="group/item relative mx-2 rounded-lg focus-within:bg-[var(--surf-high)] hover:bg-[var(--surf-high)]"
                >
                    <DropdownMenuItem
                        asChild
                        className="cursor-pointer rounded-lg px-3 py-2 pr-9 focus:bg-transparent data-[highlighted]:bg-transparent"
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
                    <button
                        type="button"
                        aria-label="Marcar como leída"
                        onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            onDismiss(item.id);
                        }}
                        className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--on-surf-var)] opacity-0 transition-opacity hover:bg-[var(--surf-bright)] hover:text-[var(--on-surf)] group-hover/item:opacity-100 focus:opacity-100"
                    >
                        <span aria-hidden="true" className="text-base leading-none">×</span>
                    </button>
                </div>
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
