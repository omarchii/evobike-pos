"use client";

import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/utils";

interface ShellContextValue {
    sidebarOpen: boolean;
    toggleSidebar: () => void;
}

const ShellContext = createContext<ShellContextValue | null>(null);

export function useShell(): ShellContextValue {
    const ctx = useContext(ShellContext);
    if (!ctx) throw new Error("useShell must be used within ShellClient");
    return ctx;
}

interface ShellClientProps {
    initialOpen: boolean;
    sidebar: React.ReactNode;
    children: React.ReactNode;
}

export function ShellClient({ initialOpen, sidebar, children }: ShellClientProps) {
    const [sidebarOpen, setSidebarOpen] = useState(initialOpen);

    function toggleSidebar(): void {
        const next = !sidebarOpen;
        setSidebarOpen(next);
        document.cookie = `sidebar-open=${next ? "1" : "0"}; path=/; max-age=31536000; SameSite=Lax`;
    }

    return (
        <ShellContext.Provider value={{ sidebarOpen, toggleSidebar }}>
            <div className="flex flex-1 overflow-hidden">
                <div className={cn(
                    "shrink-0 overflow-hidden transition-[width] duration-200",
                    sidebarOpen ? "w-64" : "w-0",
                )}>
                    {sidebar}
                </div>
                <div className="flex flex-col flex-1 overflow-hidden min-w-0">
                    {children}
                </div>
            </div>
        </ShellContext.Provider>
    );
}
