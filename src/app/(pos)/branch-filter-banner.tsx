"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { X, Eye } from "lucide-react";
import { switchAdminBranch } from "@/lib/actions/branch";

interface Props {
    branchName: string;
}

export function BranchFilterBanner({ branchName }: Props) {
    const [isPending, startTransition] = useTransition();
    const router = useRouter();

    function clear() {
        startTransition(async () => {
            await switchAdminBranch(null, null);
            router.refresh();
        });
    }

    return (
        <div
            role="status"
            className="flex items-center justify-between gap-3 px-6 py-1.5 text-xs font-medium bg-[var(--sec-container)] text-[var(--on-sec-container)] border-b border-[var(--outline-var)]"
        >
            <div className="flex items-center gap-2">
                <Eye className="h-3.5 w-3.5 opacity-80" />
                <span>
                    Viendo solo <strong className="font-semibold">{branchName}</strong>. Los datos y KPIs están filtrados.
                </span>
            </div>
            <button
                onClick={clear}
                disabled={isPending}
                aria-label="Volver a vista Global"
                className="flex items-center gap-1 px-2 py-0.5 rounded-md hover:bg-[var(--surf-high)] transition-colors disabled:opacity-60"
            >
                <span className="uppercase tracking-wider">Global</span>
                <X className="h-3 w-3" />
            </button>
        </div>
    );
}
