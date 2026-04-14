"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Sun, Moon } from "lucide-react";

export function ThemeToggle() {
    const { resolvedTheme, setTheme } = useTheme();
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const isDark = resolvedTheme === "dark";

    return (
        <button
            aria-label="Cambiar modo"
            onClick={() => setTheme(isDark ? "light" : "dark")}
            className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors"
        >
            {mounted ? (
                isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />
            ) : (
                <span className="block h-5 w-5" aria-hidden />
            )}
        </button>
    );
}
