"use client";

import { useSyncExternalStore } from "react";
import { Search } from "lucide-react";

import { COMMAND_PALETTE_OPEN_EVENT } from "./command-palette";

const SUBSCRIBE_NOOP = (): (() => void) => () => {};
const GET_IS_MAC = (): boolean =>
    typeof navigator !== "undefined" && navigator.platform.includes("Mac");
const GET_IS_MAC_SERVER = (): boolean => false;

export function SearchTrigger(): React.JSX.Element {
    const isMac = useSyncExternalStore(SUBSCRIBE_NOOP, GET_IS_MAC, GET_IS_MAC_SERVER);

    const handleClick = (): void => {
        window.dispatchEvent(new CustomEvent(COMMAND_PALETTE_OPEN_EVENT));
    };

    return (
        <button
            type="button"
            onClick={handleClick}
            aria-label="Abrir búsqueda"
            aria-keyshortcuts={isMac ? "Meta+K" : "Control+K"}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surf-high)] hover:bg-[var(--surf-highest)] text-[var(--on-surf-var)] hover:text-[var(--on-surf)] transition-colors"
        >
            <Search className="h-4 w-4 shrink-0" />
            <span className="hidden md:inline text-sm">Buscar…</span>
            <span
                aria-hidden="true"
                className="hidden md:inline-flex items-center h-5 px-1.5 rounded-md bg-[var(--surf-bright)] text-[0.6875rem] font-semibold tracking-wider text-[var(--on-surf-var)] border border-[var(--ghost-border)]"
            >
                {isMac ? "⌘K" : "Ctrl K"}
            </span>
        </button>
    );
}
