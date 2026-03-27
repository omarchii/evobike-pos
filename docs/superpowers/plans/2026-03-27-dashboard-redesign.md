# Dashboard Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replicar el diseño del screenshot de referencia (Kinetic ERP) en el dashboard de Evobike POS aplicando el colorway de DESIGN.md, sin romper la lógica de datos existente.

**Architecture:** Se modifican exactamente 3 archivos existentes. El layout POS se reestructura para incluir un topbar horizontal sticky. El sidebar recibe un rediseño visual completo. El dashboard recibe nuevas cards y paneles con 2 queries adicionales de solo lectura.

**Tech Stack:** Next.js 15 App Router, React 19, Tailwind CSS 4, Prisma, next/font/google (Space Grotesk), Lucide React, next-auth.

**Design tokens aplicados en todo el plan:**
- Background: `#131313`
- Sidebar bg: `#0d0d0d`
- Primary: `#a5d0b9`
- Primary Container: `#1B4332`
- Secondary: `#E63946`
- Tertiary: `#94ccff`
- Surface: `#1e1e1e`
- Surface High: `#2a2a2a`
- Text primary: `#f5f5f5`
- Text muted: `zinc-500` (`#71717a`)

> **Nota:** Este proyecto no tiene suite de tests. Los pasos de verificación son visuales — abrir `http://localhost:3000/dashboard` con `npm run dev` corriendo.

---

## File Map

| File | Action | Responsabilidad |
|------|--------|-----------------|
| `src/app/(pos)/layout.tsx` | Modify | Reestructurar shell, añadir `Topbar` inline, añadir Space Grotesk |
| `src/app/(pos)/sidebar.tsx` | Modify | Rediseño visual completo con nuevo colorway |
| `src/app/(pos)/dashboard/page.tsx` | Modify | Nuevas queries + rediseño completo de UI |

---

## Task 1: Reestructurar layout shell + agregar Space Grotesk

**Files:**
- Modify: `src/app/(pos)/layout.tsx`

- [ ] **Step 1: Agregar Space Grotesk y reestructurar el layout**

Reemplazar el contenido completo de `src/app/(pos)/layout.tsx` con:

```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Space_Grotesk } from "next/font/google";
import Sidebar from "./sidebar";
import { CashSessionManager } from "@/components/pos/cash-session-manager";
import Link from "next/link";
import { Bell, HelpCircle, Search, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const spaceGrotesk = Space_Grotesk({
    subsets: ["latin"],
    variable: "--font-space-grotesk",
});

function getInitials(name?: string | null) {
    if (!name) return "U";
    return name.substring(0, 2).toUpperCase();
}

function Topbar({ user }: { user: { name?: string | null; branchName?: string | null } }) {
    return (
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between px-6 backdrop-blur-md bg-[#131313]/80 border-b border-white/5 shrink-0">
            {/* Left: Branch chip */}
            <div className="bg-[#1B4332] text-[#a5d0b9] px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest whitespace-nowrap">
                BRANCH: {user.branchName ?? "—"}
            </div>

            {/* Center: Search */}
            <div className="relative w-80 mx-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                    placeholder="Buscar órdenes, VIN…"
                    className="w-full bg-[#1e1e1e] rounded-2xl pl-9 pr-4 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 outline-none focus:ring-1 focus:ring-[#a5d0b9]/30"
                />
            </div>

            {/* Right: Icons + Avatar */}
            <div className="flex items-center gap-3">
                <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    <Bell className="h-5 w-5" />
                </button>
                <Link href="/settings" className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    <Settings className="h-5 w-5" />
                </Link>
                <button className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    <HelpCircle className="h-5 w-5" />
                </button>
                <Avatar className="h-8 w-8 border border-[#1B4332]">
                    <AvatarFallback className="bg-[#1B4332] text-[#a5d0b9] text-xs font-medium">
                        {getInitials(user.name)}
                    </AvatarFallback>
                </Avatar>
            </div>
        </header>
    );
}

export default async function PosLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const session = await getServerSession(authOptions);

    if (!session?.user) {
        redirect("/login");
    }

    return (
        <div className={`${spaceGrotesk.variable} flex h-screen overflow-hidden bg-[#131313]`}>
            <Sidebar user={session.user as any} />
            <div className="flex flex-col flex-1 overflow-hidden">
                <Topbar user={session.user as any} />
                <main className="flex-1 overflow-y-auto relative">
                    <div className="p-8">
                        {children}
                    </div>
                    <CashSessionManager />
                </main>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verificar en browser**

Abrir `http://localhost:3000/dashboard`. Verificar:
- Topbar visible arriba con chip verde de branch, search input centrado, íconos a la derecha
- El contenido del dashboard sigue scrolleando debajo del topbar
- No hay errores en consola
- El `CashSessionManager` overlay sigue funcionando

- [ ] **Step 3: Commit**

```bash
git add src/app/\(pos\)/layout.tsx
git commit -m "feat: add topbar and restructure POS layout shell"
```

---

## Task 2: Rediseño del Sidebar

**Files:**
- Modify: `src/app/(pos)/sidebar.tsx`

- [ ] **Step 1: Reemplazar sidebar completo**

Reemplazar el contenido completo de `src/app/(pos)/sidebar.tsx` con:

```tsx
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
    { label: "Inventario", icon: Package, href: "/inventory" },
    { label: "Apartados", icon: ArchiveRestore, href: "/layaways" },
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
        <div className="flex flex-col h-full bg-[#0d0d0d] text-white w-64 shrink-0">
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
                                    ? "bg-[#1B4332] text-[#a5d0b9]"
                                    : "text-zinc-500 hover:text-zinc-200 hover:bg-white/5"
                            )}
                        >
                            <route.icon className={cn("h-5 w-5 shrink-0", isActive ? "text-[#a5d0b9]" : "text-zinc-500")} />
                            {route.label}
                        </Link>
                    );
                })}
            </nav>

            {/* Footer */}
            <div className="px-3 pb-4 pt-3 space-y-3">
                <div className="flex items-center gap-3 px-2">
                    <Avatar className="h-9 w-9 shrink-0">
                        <AvatarFallback className="bg-[#1B4332] text-[#a5d0b9] text-xs font-medium">
                            {getInitials(user?.name)}
                        </AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col flex-1 min-w-0">
                        <span className="text-sm font-medium text-zinc-200 truncate">{user?.name}</span>
                        <span className="text-xs text-zinc-500 truncate">
                            {user?.role} · {user?.branchName}
                        </span>
                    </div>
                </div>
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start text-zinc-500 hover:text-zinc-200 hover:bg-white/5 px-2"
                    onClick={() => signOut({ callbackUrl: "/login" })}
                >
                    <LogOut className="h-4 w-4 mr-2 shrink-0" />
                    Cerrar Sesión
                </Button>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verificar en browser**

Abrir `http://localhost:3000/dashboard`. Verificar:
- Sidebar con fondo `#0d0d0d`, más oscuro que el content
- Logo Evobike visible, sin texto subtítulo
- Item activo "Dashboard" con fondo verde `#1B4332` e ícono/texto en `#a5d0b9`
- Items inactivos en zinc-500
- Avatar del footer con fondo verde, iniciales en verde claro
- Sin divisores ni bordes entre items

- [ ] **Step 3: Commit**

```bash
git add src/app/\(pos\)/sidebar.tsx
git commit -m "feat: redesign sidebar with Kinetic Precision colorway"
```

---

## Task 3: Dashboard — nuevas queries y metric cards

**Files:**
- Modify: `src/app/(pos)/dashboard/page.tsx`

- [ ] **Step 1: Agregar query de conteo de ventas hoy y reescribir las metric cards**

Reemplazar el contenido completo de `src/app/(pos)/dashboard/page.tsx` con la primera parte (queries + cards). El archivo completo se termina en el Task 4, pero hacer el reemplazo completo ahora para no tener código en estado intermedio:

```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, Banknote, Wrench, ArchiveRestore } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    const branchId = (session?.user as any)?.branchId;
    const branchName = (session?.user as any)?.branchName ?? "la Sucursal";

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // Existing queries
    const salesTodayAgg = await prisma.sale.aggregate({
        where: { branchId, createdAt: { gte: startOfToday, lte: endOfToday }, status: "COMPLETED" },
        _sum: { total: true },
    });
    const revenueToday = Number(salesTodayAgg._sum.total || 0);

    const activeWorkshopCount = await prisma.serviceOrder.count({
        where: { branchId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    });

    const activeLayawaysCount = await prisma.sale.count({
        where: { branchId, status: "LAYAWAY" },
    });

    // New: count of completed sales today
    const salesTodayCount = await prisma.sale.count({
        where: { branchId, status: "COMPLETED", createdAt: { gte: startOfToday, lte: endOfToday } },
    });

    // Existing: recent sales
    const recentSales = await prisma.sale.findMany({
        where: { branchId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { customer: true, user: true },
    });

    // New: upcoming workshop orders
    const upcomingOrders = await prisma.serviceOrder.findMany({
        where: { branchId, status: { in: ["PENDING", "IN_PROGRESS"] } },
        orderBy: { createdAt: "asc" },
        take: 3,
        include: { customer: true },
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-[#f5f5f5]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                    Panel de Control
                </h1>
                <p className="text-sm text-zinc-500 mt-0.5">Resumen diario · {branchName}</p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-4 gap-4">
                {/* Card 1: Ventas Hoy */}
                <div className="bg-[#1e1e1e] rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Ventas Hoy</span>
                        <TrendingUp className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[#f5f5f5]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                            {salesTodayCount} <span className="text-lg font-normal text-zinc-500">unidades</span>
                        </p>
                    </div>
                    <p className="text-xs text-zinc-600">Ventas cobradas hoy</p>
                </div>

                {/* Card 2: Ingresos del Día — DESTACADA */}
                <div className="bg-[#1B4332] rounded-2xl p-5 space-y-3 col-span-1">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#a5d0b9]/60 uppercase tracking-wider">Ingresos del Día</span>
                        <Banknote className="h-4 w-4 text-[#a5d0b9]/60" />
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[#a5d0b9]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                            ${revenueToday.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                        </p>
                    </div>
                    <p className="text-xs text-[#a5d0b9]/50">Total facturado hoy</p>
                </div>

                {/* Card 3: Taller Activo */}
                <div className="bg-[#1e1e1e] rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Taller Activo</span>
                        <Wrench className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[#f5f5f5]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                            {String(activeWorkshopCount).padStart(2, "0")} <span className="text-lg font-normal text-zinc-500">órdenes</span>
                        </p>
                    </div>
                    <p className="text-xs text-zinc-600">Pendientes / En proceso</p>
                </div>

                {/* Card 4: Apartados Activos */}
                <div className="bg-[#1e1e1e] rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Apartados</span>
                        <ArchiveRestore className="h-4 w-4 text-zinc-500" />
                    </div>
                    <div>
                        <p className="text-3xl font-bold text-[#f5f5f5]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                            {String(activeLayawaysCount).padStart(2, "0")} <span className="text-lg font-normal text-zinc-500">tickets</span>
                        </p>
                    </div>
                    <p className="text-xs text-zinc-600">Por liquidar</p>
                </div>
            </div>

            {/* Main content — placeholder, completed in Task 4 */}
            <div className="grid gap-4 grid-cols-7">
                <div className="col-span-4 bg-[#1e1e1e] rounded-2xl p-6">
                    <p className="text-zinc-500 text-sm">Cargando tendencia…</p>
                </div>
                <div className="col-span-3 space-y-4">
                    <div className="bg-[#1e1e1e] rounded-2xl p-6">
                        <p className="text-zinc-500 text-sm">Cargando ventas…</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verificar en browser**

Abrir `http://localhost:3000/dashboard`. Verificar:
- 4 cards en fila sobre fondo `#131313`
- Card "Ingresos del Día" con fondo verde `#1B4332` y valor en `#a5d0b9`
- Las otras 3 cards en `#1e1e1e`
- Heading "Panel de Control" en Space Grotesk
- Sin errores de TypeScript en consola

- [ ] **Step 3: Commit**

```bash
git add src/app/\(pos\)/dashboard/page.tsx
git commit -m "feat: add new dashboard metric cards with Kinetic Precision design"
```

---

## Task 4: Dashboard — Revenue Trend + Ventas Recientes + Órdenes de Taller

**Files:**
- Modify: `src/app/(pos)/dashboard/page.tsx`

- [ ] **Step 1: Reemplazar la sección de main content del dashboard**

Reemplazar el contenido completo de `src/app/(pos)/dashboard/page.tsx` (el archivo entero, incluyendo las queries del Task 3 que ya están bien):

```tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TrendingUp, Banknote, Wrench, ArchiveRestore } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
    COMPLETED: "Venta",
    LAYAWAY: "Apartado",
    CANCELLED: "Cancelado",
};

const WORKSHOP_STATUS_LABELS: Record<string, string> = {
    PENDING: "Pendiente",
    IN_PROGRESS: "En Proceso",
    COMPLETED: "Completado",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
};

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    const branchId = (session?.user as any)?.branchId;
    const branchName = (session?.user as any)?.branchName ?? "la Sucursal";

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const salesTodayAgg = await prisma.sale.aggregate({
        where: { branchId, createdAt: { gte: startOfToday, lte: endOfToday }, status: "COMPLETED" },
        _sum: { total: true },
    });
    const revenueToday = Number(salesTodayAgg._sum.total || 0);

    const activeWorkshopCount = await prisma.serviceOrder.count({
        where: { branchId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    });

    const activeLayawaysCount = await prisma.sale.count({
        where: { branchId, status: "LAYAWAY" },
    });

    const salesTodayCount = await prisma.sale.count({
        where: { branchId, status: "COMPLETED", createdAt: { gte: startOfToday, lte: endOfToday } },
    });

    const recentSales = await prisma.sale.findMany({
        where: { branchId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { customer: true, user: true },
    });

    const upcomingOrders = await prisma.serviceOrder.findMany({
        where: { branchId, status: { in: ["PENDING", "IN_PROGRESS"] } },
        orderBy: { createdAt: "asc" },
        take: 3,
        include: { customer: true },
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1
                    className="text-2xl font-bold text-[#f5f5f5]"
                    style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                    Panel de Control
                </h1>
                <p className="text-sm text-zinc-500 mt-0.5">Resumen diario · {branchName}</p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-4 gap-4">
                {/* Ventas Hoy */}
                <div className="bg-[#1e1e1e] rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Ventas Hoy</span>
                        <TrendingUp className="h-4 w-4 text-zinc-500" />
                    </div>
                    <p className="text-3xl font-bold text-[#f5f5f5]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                        {salesTodayCount}{" "}
                        <span className="text-lg font-normal text-zinc-500">unidades</span>
                    </p>
                    <p className="text-xs text-zinc-600">Ventas cobradas hoy</p>
                </div>

                {/* Ingresos del Día — DESTACADA */}
                <div className="bg-[#1B4332] rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-[#a5d0b9]/60 uppercase tracking-wider">
                            Ingresos del Día
                        </span>
                        <Banknote className="h-4 w-4 text-[#a5d0b9]/60" />
                    </div>
                    <p className="text-3xl font-bold text-[#a5d0b9]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                        ${revenueToday.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-[#a5d0b9]/50">Total facturado hoy</p>
                </div>

                {/* Taller Activo */}
                <div className="bg-[#1e1e1e] rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Taller Activo</span>
                        <Wrench className="h-4 w-4 text-zinc-500" />
                    </div>
                    <p className="text-3xl font-bold text-[#f5f5f5]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                        {String(activeWorkshopCount).padStart(2, "0")}{" "}
                        <span className="text-lg font-normal text-zinc-500">órdenes</span>
                    </p>
                    <p className="text-xs text-zinc-600">Pendientes / En proceso</p>
                </div>

                {/* Apartados */}
                <div className="bg-[#1e1e1e] rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Apartados</span>
                        <ArchiveRestore className="h-4 w-4 text-zinc-500" />
                    </div>
                    <p className="text-3xl font-bold text-[#f5f5f5]" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                        {String(activeLayawaysCount).padStart(2, "0")}{" "}
                        <span className="text-lg font-normal text-zinc-500">tickets</span>
                    </p>
                    <p className="text-xs text-zinc-600">Por liquidar</p>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-7 gap-4">
                {/* Revenue Trend — col 1-4 */}
                <div className="col-span-4 bg-[#1e1e1e] rounded-2xl p-6">
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <h2
                                className="text-base font-semibold text-[#f5f5f5]"
                                style={{ fontFamily: "var(--font-space-grotesk)" }}
                            >
                                Tendencia de Ingresos
                            </h2>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                Análisis de rendimiento semanal
                            </p>
                        </div>
                        <div className="flex gap-1">
                            <button className="px-3 py-1 rounded-full text-xs font-medium bg-[#1B4332] text-[#a5d0b9]">
                                Semana
                            </button>
                            <button className="px-3 py-1 rounded-full text-xs font-medium text-zinc-500 hover:text-zinc-300 transition-colors">
                                Mes
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 h-56 flex items-center justify-center rounded-xl bg-[#131313]">
                        <p className="text-zinc-600 text-sm">El gráfico se activará en v2</p>
                    </div>
                </div>

                {/* Right column — col 5-7 */}
                <div className="col-span-3 space-y-4">
                    {/* Ventas Recientes */}
                    <div className="bg-[#1e1e1e] rounded-2xl p-5">
                        <h2
                            className="text-base font-semibold text-[#f5f5f5] mb-4"
                            style={{ fontFamily: "var(--font-space-grotesk)" }}
                        >
                            Ventas Recientes
                        </h2>
                        {recentSales.length === 0 ? (
                            <p className="text-sm text-zinc-600 text-center py-4">
                                No hay ventas registradas aún.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {recentSales.map((sale) => {
                                    const initials = sale.customer
                                        ? sale.customer.name.substring(0, 2).toUpperCase()
                                        : "MO";
                                    return (
                                        <div key={sale.id} className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-[#2a2a2a] flex items-center justify-center text-xs font-medium text-zinc-400 shrink-0">
                                                {initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-200 truncate">
                                                    {sale.customer?.name ?? "Mostrador"}
                                                </p>
                                                <p className="text-xs text-zinc-600 truncate">
                                                    {sale.folio} ·{" "}
                                                    {new Date(sale.createdAt).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-semibold text-[#a5d0b9]">
                                                    +${Number(sale.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                                </p>
                                                <span
                                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                                        sale.status === "LAYAWAY"
                                                            ? "bg-amber-500/10 text-amber-400"
                                                            : "bg-[#1B4332] text-[#a5d0b9]"
                                                    }`}
                                                >
                                                    {STATUS_LABELS[sale.status] ?? sale.status}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Próximas Órdenes de Taller */}
                    <div className="bg-[#1e1e1e] rounded-2xl p-5">
                        <h2
                            className="text-base font-semibold text-[#f5f5f5] mb-4"
                            style={{ fontFamily: "var(--font-space-grotesk)" }}
                        >
                            Próximas Órdenes de Taller
                        </h2>
                        {upcomingOrders.length === 0 ? (
                            <p className="text-sm text-zinc-600 text-center py-4">
                                No hay órdenes activas.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {upcomingOrders.map((order) => {
                                    const d = new Date(order.createdAt);
                                    const day = d.getDate();
                                    const month = d.toLocaleString("es-MX", { month: "short" }).toUpperCase();
                                    return (
                                        <div key={order.id} className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-[#131313] flex flex-col items-center justify-center shrink-0">
                                                <span className="text-[10px] font-medium text-zinc-500 leading-none">
                                                    {month}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-300 leading-tight">
                                                    {day}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-200 truncate">
                                                    {order.description}
                                                </p>
                                                <p className="text-xs text-zinc-600 truncate">
                                                    {order.customer?.name ?? "Sin cliente"} · {order.folio}
                                                </p>
                                            </div>
                                            <span
                                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                                                    order.status === "IN_PROGRESS"
                                                        ? "bg-[#94ccff]/10 text-[#94ccff]"
                                                        : "bg-zinc-800 text-zinc-400"
                                                }`}
                                            >
                                                {WORKSHOP_STATUS_LABELS[order.status] ?? order.status}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
```

- [ ] **Step 2: Verificar en browser**

Abrir `http://localhost:3000/dashboard`. Verificar:
- Panel izquierdo "Tendencia de Ingresos" con toggle Semana/Mes y placeholder
- Panel derecho "Ventas Recientes" con avatares de iniciales, folio, monto en verde, badge de status
- Panel derecho "Próximas Órdenes de Taller" con chip de fecha, descripción, badge azul para IN_PROGRESS
- Layout general coincide con el screenshot de referencia
- Sin errores en consola del navegador ni en la terminal de Next.js

- [ ] **Step 3: Commit final**

```bash
git add src/app/\(pos\)/dashboard/page.tsx
git commit -m "feat: complete dashboard redesign with Kinetic Precision design system"
```

---

## Self-Review Checklist

- [x] **Spec §4 Layout Shell** → Task 1 cubre reestructura flex + Topbar
- [x] **Spec §5 Sidebar** → Task 2 cubre rediseño visual completo
- [x] **Spec §6 Topbar** → Task 1 incluye BranchChip, SearchInput, íconos, glassmorphism
- [x] **Spec §7 Dashboard queries** → Tasks 3 y 4 incluyen `salesTodayCount` y `upcomingOrders`
- [x] **Spec §7 Metric Cards** → Task 3 y 4 (reemplazado en Task 4)
- [x] **Spec §7 Revenue Trend** → Task 4 incluye card con placeholder y toggle visual
- [x] **Spec §7 Ventas Recientes** → Task 4 incluye el panel completo
- [x] **Spec §7 Upcoming Orders** → Task 4 incluye panel con `upcomingOrders`
- [x] **Spec §8 Typography** → Task 1 carga Space Grotesk y pasa variable CSS; Tasks 3/4 la usan con `var(--font-space-grotesk)`
- [x] **Spec §9 What doesn't change** → Server actions, rutas, auth, CashSessionManager, shadcn components — ninguno tocado
- [x] Sin placeholders TBD en el plan
- [x] Tipos consistentes: `upcomingOrders` incluye `customer` en ambos Task 3 y 4
