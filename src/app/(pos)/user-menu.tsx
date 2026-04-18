"use client";

import { LogOut } from "lucide-react";
import { signOut } from "next-auth/react";

import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface UserMenuProps {
    name: string;
    email: string;
    role: string;
    branchName: string | null;
}

function roleLabel(role: string): string {
    switch (role) {
        case "SELLER":
            return "Vendedor";
        case "TECHNICIAN":
            return "Técnico";
        case "MANAGER":
            return "Gerente";
        case "ADMIN":
            return "Administrador";
        default:
            return role;
    }
}

function getInitials(name: string): string {
    const trimmed = name.trim();
    if (!trimmed) return "U";
    return trimmed.substring(0, 2).toUpperCase();
}

export function UserMenu({ name, email, role, branchName }: UserMenuProps) {
    const branchText = branchName ?? "Sin sucursal";

    return (
        <DropdownMenu>
            <DropdownMenuTrigger
                aria-label="Menú de usuario"
                aria-haspopup="menu"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[var(--surf-high)] text-[var(--on-surf)] text-xs font-medium outline-none transition-colors hover:bg-[var(--surf-highest)] focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
                {getInitials(name)}
            </DropdownMenuTrigger>
            <DropdownMenuContent
                align="end"
                sideOffset={8}
                className="w-64 border-0 p-0 shadow-[var(--shadow)]"
                style={{
                    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    color: "var(--on-surf)",
                }}
            >
                <div className="flex flex-col gap-0.5 px-4 py-3">
                    <span className="text-sm font-semibold text-[var(--on-surf)] truncate">
                        {name}
                    </span>
                    <span className="text-xs text-[var(--on-surf-var)] truncate">
                        {email}
                    </span>
                    <span className="mt-1 text-[0.6875rem] uppercase tracking-[0.05em] text-[var(--on-surf-var)] truncate">
                        {roleLabel(role)} · {branchText}
                    </span>
                </div>
                <DropdownMenuSeparator className="mx-0 my-0 h-px bg-[var(--on-surf-var)]/15" />
                <DropdownMenuItem
                    onClick={() => signOut({ callbackUrl: "/login" })}
                    className="mx-2 my-1 cursor-pointer rounded-lg px-3 py-2 text-sm text-[var(--on-surf)] focus:bg-[var(--surf-high)]"
                >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Cerrar sesión
                </DropdownMenuItem>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
