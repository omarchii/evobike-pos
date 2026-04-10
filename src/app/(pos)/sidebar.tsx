"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import {
    LayoutDashboard,
    ShoppingCart,
    Wrench,
    Package,
    Users,
    LogOut,
    Settings,
    ArchiveRestore,
    Vault,
    Cog,
    FileText,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserProp {
    name?: string | null;
    role?: string | null;
    branchName?: string | null;
}

const routes = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/dashboard" },
    { label: "Punto de Venta", icon: ShoppingCart, href: "/point-of-sale" },
    { label: "Arqueo de Caja", icon: Vault, href: "/cash-register" },
    { label: "Taller Mecánico", icon: Wrench, href: "/workshop" },
    { label: "Montaje", icon: Cog, href: "/assembly" },
    { label: "Inventario", icon: Package, href: "/inventory" },
    { label: "Pedidos", icon: ArchiveRestore, href: "/pedidos" },
    { label: "Cotizaciones", icon: FileText, href: "/cotizaciones" },
    { label: "Clientes", icon: Users, href: "/customers" },
    { label: "Configuración", icon: Settings, href: "/settings" },
];

export default function Sidebar({ user }: { user: UserProp }) {
    const pathname = usePathname();

    const getInitials = (name?: string | null) => {
        if (!name) return "U";
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div className="flex flex-col h-full bg-[var(--surf-low)] transition-colors duration-200 w-64 shrink-0">
            {/* Logo */}
            <div className="px-5 pt-6 pb-4">
                <Link href="/dashboard" className="flex items-center">
                    <div className="relative w-full h-[36px]">
                        <Image
                            src="/evobike-logo.webp"
                            alt="EVOBIKE Logo"
                            fill
                            className="object-contain object-left"
                        />
                    </div>
                </Link>
            </div>

            {/* Nav */}
            <nav className="flex-1 px-3 space-y-0.5 overflow-y-auto">
                {routes.map((route) => {
                    const isActive = pathname === route.href;
                    return (
                        <Link
                            key={route.href}
                            href={route.href}
                            className={cn(
                                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                                isActive
                                    ? "bg-[var(--surf-high)] text-[var(--p)] font-semibold"
                                    : "text-[var(--on-surf-var)] hover:text-[var(--on-surf)] hover:bg-[var(--surf-high)]"
                            )}
                        >
                            <route.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-[var(--p)]" : "text-[var(--on-surf-var)]")} />
                            {route.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-3 pb-4 pt-3 space-y-3">
                <div className="flex items-center gap-3 px-2">
                    <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="text-xs font-medium" style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)", color: "#ffffff" }}>
                            {getInitials(user?.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium text-[var(--on-surf)] truncate">{user?.name}</span>
                        <span className="text-xs text-[var(--on-surf-var)] truncate">
                            {user?.role} · {user?.branchName}
                        </span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-[var(--on-surf-var)] hover:text-[var(--on-surf)] hover:bg-[var(--surf-high)] px-2"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                >
                    <LogOut className="h-4 w-4 mr-2 shrink-0" />
                    Cerrar Sesión
                </Button>
            </div>
        </div>
    );
}
