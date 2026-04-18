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
    Settings,
    BookmarkCheck,
    Vault,
    Bike,
    FileText,
    BarChart2,
    ShieldCheck,
    Landmark,
    ArrowLeftRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

interface UserProp {
    name?: string | null;
    role?: string | null;
    branchName?: string | null;
}

interface NavItem {
    label: string;
    icon: React.ElementType;
    href: string;
    roles?: string[]; // undefined = all roles
}

interface NavSection {
    label: string;
    items: NavItem[];
}

const SECTIONS: NavSection[] = [
    {
        label: "OPERACIÓN",
        items: [
            { label: "Inicio", icon: LayoutDashboard, href: "/" },
            { label: "Punto de Venta", icon: ShoppingCart, href: "/point-of-sale" },
            { label: "Pedidos", icon: BookmarkCheck, href: "/pedidos" },
            { label: "Taller Mecánico", icon: Wrench, href: "/workshop" },
            { label: "Montaje", icon: Bike, href: "/assembly" },
        ],
    },
    {
        label: "GESTIÓN",
        items: [
            { label: "Clientes", icon: Users, href: "/customers" },
            { label: "Inventario", icon: Package, href: "/inventario" },
            { label: "Cotizaciones", icon: FileText, href: "/cotizaciones" },
            {
                label: "Transferencias",
                icon: ArrowLeftRight,
                href: "/transferencias",
                roles: ["SELLER", "MANAGER", "ADMIN"],
            },
            { label: "Reportes", icon: BarChart2, href: "/reportes" },
        ],
    },
    {
        label: "ADMIN",
        items: [
            { label: "Caja", icon: Vault, href: "/cash-register" },
            {
                label: "Tesorería",
                icon: Landmark,
                href: "/tesoreria",
                roles: ["MANAGER", "ADMIN"],
            },
            {
                label: "Autorizaciones",
                icon: ShieldCheck,
                href: "/autorizaciones",
                roles: ["MANAGER", "ADMIN"],
            },
            {
                label: "Configuración",
                icon: Settings,
                href: "/configuracion",
                roles: ["ADMIN", "MANAGER"],
            },
        ],
    },
];

function getInitials(name?: string | null): string {
    if (!name) return "U";
    return name.substring(0, 2).toUpperCase();
}

export default function Sidebar({ user }: { user: UserProp }) {
    const pathname = usePathname();
    const role = user.role ?? "";

    return (
        <div
            data-shell="sidebar"
            className="flex flex-col h-full bg-[var(--surf-low)] transition-colors duration-200 w-64 shrink-0"
        >
            {/* Logo */}
            <div className="px-5 pt-6 pb-4">
                <Link href="/" className="flex items-center">
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
                {SECTIONS.map((section, sectionIdx) => {
                    const visibleItems = section.items.filter(
                        (item) => !item.roles || item.roles.includes(role),
                    );
                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={section.label} className={sectionIdx === 0 ? "" : "mt-4"}>
                            <div
                                className="px-3 pb-1.5 text-[0.6875rem] font-semibold uppercase tracking-[0.05em] text-[var(--on-surf-var)]"
                                aria-hidden="true"
                            >
                                {section.label}
                            </div>
                            {visibleItems.map((item) => {
                                const isActive =
                                    pathname === item.href ||
                                    pathname.startsWith(item.href + "/");
                                return (
                                    <Link
                                        key={item.href}
                                        href={item.href}
                                        aria-current={isActive ? "page" : undefined}
                                        className={cn(
                                            "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-[var(--surf-high)] text-[var(--p)] font-semibold"
                                                : "text-[var(--on-surf-var)] hover:text-[var(--on-surf)] hover:bg-[var(--surf-high)]",
                                        )}
                                    >
                                        <item.icon
                                            className={cn(
                                                "h-5 w-5 shrink-0",
                                                isActive
                                                    ? "text-[var(--p)]"
                                                    : "text-[var(--on-surf-var)]",
                                            )}
                                        />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-3 pb-4 pt-3">
                <div className="flex items-center gap-3 px-2">
                    <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-[var(--surf-high)] text-[var(--on-surf)] text-xs font-medium">
                            {getInitials(user?.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium text-[var(--on-surf)] truncate">
                            {user?.name}
                        </span>
                        <span className="text-xs text-[var(--on-surf-var)] truncate">
                            {user?.role} · {user?.branchName}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    );
}
