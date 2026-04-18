"use client";

import { useSyncExternalStore } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

const EMPTY_SUBSCRIBE = (): (() => void) => (): void => {};

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    // Evita hydration-mismatch: en SSR devuelve false, tras hidratar devuelve true
    // sin necesidad de setState en useEffect (compiler-safe).
    const mounted = useSyncExternalStore(
        EMPTY_SUBSCRIBE,
        () => true,
        () => false,
    );

    const isDark = resolvedTheme === "dark";

    return (
        <button
            aria-label="Cambiar modo"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="text-[var(--on-surf-var)] hover:text-[var(--on-surf)] transition-colors"
        >
            {mounted ? (
                isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
            ) : (
                <span className="block h-5 w-5" aria-hidden />
            )}
        </button>
    );
}
