"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AlertTriangle } from "lucide-react";

interface Props {
    openedLabel: string;
}

export function OrphanedSessionBannerContent({ openedLabel }: Props): React.ReactElement | null {
    const pathname = usePathname();
    if (pathname === "/cash-register") return null;

    return (
        <div
            className="mx-6 mt-4 rounded-[var(--r-lg)] px-5 py-4 flex items-center gap-4"
            style={{
                background: "var(--warn-container)",
            }}
        >
            <div
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full"
                style={{ background: "var(--warn)", color: "#FFFFFF" }}
            >
                <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
                <p
                    className="text-[13px] font-semibold leading-tight"
                    style={{ color: "var(--warn)" }}
                >
                    La caja abierta el {openedLabel} no se cerró.
                </p>
                <p className="text-[12px] mt-1" style={{ color: "var(--on-surf-var)" }}>
                    Ciérrala antes de registrar nuevas operaciones.
                </p>
            </div>
            <Link
                href="/cash-register"
                className="text-[12px] font-medium px-4 py-2 rounded-full shrink-0"
                style={{
                    background: "var(--warn)",
                    color: "#FFFFFF",
                }}
            >
                Cerrar caja
            </Link>
        </div>
    );
}
