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
    Vault
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface UserProp {
    name?: string | null;
    role?: string | null;
    branchName?: string | null;
}

const routes = [
    {
        label: "Dashboard",
        icon: LayoutDashboard,
        href: "/dashboard",
        color: "text-sky-500",
    },
    {
        label: "Punto de Venta",
        icon: ShoppingCart,
        href: "/point-of-sale",
        color: "text-emerald-500",
    },
    {
        label: "Arqueo de Caja",
        icon: Vault,
        href: "/cash-register",
        color: "text-yellow-500",
    },
    {
        label: "Taller Mecánico",
        icon: Wrench,
        href: "/workshop",
        color: "text-violet-500",
    },
    {
        label: "Inventario",
        icon: Package,
        color: "text-orange-500",
        href: "/inventory",
    },
    {
        label: "Apartados",
        icon: ArchiveRestore,
        href: "/layaways",
        color: "text-amber-500",
    },
    {
        label: "Clientes",
        icon: Users,
        color: "text-pink-500",
        href: "/customers",
    },
    {
        label: "Configuración",
        icon: Settings,
        href: "/settings",
    }
];

export default function Sidebar({ user }: { user: UserProp }) {
    const pathname = usePathname();

    const getInitials = (name?: string | null) => {
        if (!name) return "U";
        return name.substring(0, 2).toUpperCase();
    };

    return (
        <div className="space-y-4 py-4 flex flex-col h-full bg-slate-900 dark:bg-slate-950 text-white w-72 shadow-xl border-r border-slate-800">
            <div className="px-3 py-2 flex-1">
                <Link href="/dashboard" className="flex items-center pl-3 pr-4 mb-10 mt-2">
                    <div className="relative w-full h-[40px]">
                        <Image
                            src="/evobike-logo.webp"
                            alt="EVOBIKE Logo"
                            fill
                            className="object-contain object-left dark:invert-[0.9]"
                        />
                    </div>
                </Link>
                <div className="space-y-1">
                    {routes.map((route) => (
                        <Link
                            key={route.href}
                            href={route.href}
                            className={cn(
                                "text-sm group flex p-3 w-full justify-start font-medium cursor-pointer hover:text-white hover:bg-white/10 rounded-lg transition",
                                pathname === route.href
                                    ? "text-white bg-white/10"
                                    : "text-zinc-400"
                            )}
                        >
                            <div className="flex items-center flex-1">
                                <route.icon className={cn("h-5 w-5 mr-3", route.color)} />
                                {route.label}
                            </div>
                        </Link>
                    ))}
                </div>
            </div>

            <div className="px-4 py-4 mt-auto border-t border-slate-800">
                <div className="flex items-center gap-x-3 mb-4">
                    <Avatar className="h-10 w-10 border border-slate-700">
                        <AvatarImage src="" />
                        <AvatarFallback className="bg-slate-800 text-slate-300">
                            {getInitials(user?.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 truncate">
                        <span className="text-sm font-medium">{user?.name}</span>
                        <span className="text-xs text-slate-400 truncate">
                            {user?.role} • {user?.branchName}
                        </span>
                    </div>
                </div>
                <Button
                    variant="outline"
                    className="w-full justify-start text-slate-300 border-slate-800 hover:bg-slate-800 hover:text-white"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                >
                    <LogOut className="h-4 w-4 mr-2" />
                    Cerrar Sesión
                </Button>
            </div>
        </div>
    );
}
