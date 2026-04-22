"use client";

import { PanelLeft } from "lucide-react";
import { useShell } from "./shell-context";

export function SidebarToggleButton(): React.ReactElement {
    const { toggleSidebar } = useShell();
    return (
        <button
            onClick={toggleSidebar}
            aria-label="Alternar menú lateral"
            className="p-2 rounded-xl text-[var(--on-surf-var)] hover:text-[var(--on-surf)] hover:bg-[var(--surf-high)] transition-colors"
        >
            <PanelLeft className="h-5 w-5" />
        </button>
    );
}
