import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import Sidebar from "./sidebar";
import { CashSessionManager } from "@/components/pos/cash-session-manager";
import { ThemeToggle } from "./theme-toggle";
import { OrphanedSessionBanner } from "./orphaned-session-banner";
import { BranchSwitcher } from "@/components/pos/branch-switcher";
import { BranchFilterBanner } from "./branch-filter-banner";
import { getAdminActiveBranch } from "@/lib/actions/branch";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { CommandPalette } from "./command-palette";
import { SearchTrigger } from "./search-trigger";
import { Breadcrumbs } from "./breadcrumbs";
import type { SessionUser } from "@/lib/auth-types";
import { prisma } from "@/lib/prisma";
import { getEffectivePinned } from "@/lib/reportes/pinned-defaults";
import type { ReportRole } from "@/lib/reportes/reports-config";
import { resolveDensity, densityClassName } from "@/lib/user/ui-preferences";
import { DensityProvider } from "@/components/shell/density-context";
import { TweaksButton } from "./tweaks-button";
import { ShellClient } from "./shell-context";
import { SidebarToggleButton } from "./sidebar-toggle-button";

interface TopbarProps {
    user: SessionUser;
    isAdmin: boolean;
    canSeeNotifications: boolean;
    activeBranchId: string | null;
    activeBranchName: string;
}

function Topbar({ user, isAdmin, canSeeNotifications, activeBranchId, activeBranchName }: TopbarProps) {
    return (
        <header data-shell="topbar" className="sticky top-0 z-10 flex h-16 items-center justify-between px-6 bg-[var(--surf-bright)] shrink-0 transition-colors duration-200">
            {/* Left: Sidebar toggle + Branch chip / switcher */}
            <div className="flex items-center gap-2">
                <SidebarToggleButton />
                {isAdmin ? (
                    <BranchSwitcher activeBranchId={activeBranchId} activeBranchName={activeBranchName} />
                ) : (
                    <div className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest whitespace-nowrap text-white" style={{ background: "var(--velocity-gradient)" }}>
                        BRANCH: {user.branchName ?? "—"}
                    </div>
                )}
            </div>

            {/* Center: Command palette trigger */}
            <div className="flex-1 flex justify-center px-6">
                <SearchTrigger />
            </div>

            {/* Right: Notifications + Theme toggle + Tweaks + User menu */}
            <div className="flex items-center gap-3">
                {canSeeNotifications && <NotificationBell />}
                <ThemeToggle />
                <TweaksButton />
                <UserMenu
                    name={user.name ?? "Usuario"}
                    email={user.email ?? ""}
                    role={user.role}
                    branchName={user.branchName}
                />
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

    const user = session.user as unknown as SessionUser;
    const isAdmin = user.role === "ADMIN";
    const canSeeNotifications = user.role === "MANAGER" || user.role === "ADMIN";

    // Admin: cookie define el filtro persistente; sin cookie = Global (null).
    // Non-admin: siempre su sucursal asignada.
    let activeBranchId: string | null;
    let activeBranchName: string;
    if (isAdmin) {
        const saved = await getAdminActiveBranch();
        if (saved) {
            activeBranchId = saved.id;
            activeBranchName = saved.name;
        } else {
            activeBranchId = null;
            activeBranchName = "Global";
        }
    } else {
        activeBranchId = user.branchId ?? "";
        activeBranchName = user.branchName ?? "—";
    }

    // Compute effective pinned reports for sidebar cluster + read density preference
    const dbUser = await prisma.user.findUnique({
        where: { id: user.id },
        select: { pinnedReports: true, uiPreferences: true },
    });
    const effectivePinnedReports = getEffectivePinned(
        user.role as ReportRole,
        dbUser?.pinnedReports ?? [],
    );
    const density = resolveDensity(dbUser?.uiPreferences);
    const cookieStore = await cookies();
    const sidebarInitialOpen = cookieStore.get("sidebar-open")?.value !== "0";

    return (
        <DensityProvider value={density}>
        <div className={`flex flex-col h-screen overflow-hidden bg-[var(--surface)] transition-colors duration-200 ${densityClassName(density)}`}>
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[var(--surf-bright)] focus:text-[var(--on-surf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)] focus:shadow-[var(--shadow)]"
            >
                Saltar al contenido
            </a>
            {/* Alert bar full-width arriba del shell (banner aparece solo si hay caja huérfana) */}
            <OrphanedSessionBanner branchId={activeBranchId} />
            <ShellClient
                initialOpen={sidebarInitialOpen}
                sidebar={<Sidebar user={user} effectivePinnedReports={effectivePinnedReports} />}
            >
                <Topbar
                    user={user}
                    isAdmin={isAdmin}
                    canSeeNotifications={canSeeNotifications}
                    activeBranchId={activeBranchId}
                    activeBranchName={activeBranchName}
                />
                {isAdmin && activeBranchId !== null && (
                    <BranchFilterBanner branchName={activeBranchName} />
                )}
                <Breadcrumbs />
                <main id="main-content" className="flex-1 overflow-y-auto relative">
                    <div className="p-8">
                        {children}
                    </div>
                </main>
            </ShellClient>
            {/* Chrome de aplicación — fuera de <main>. Renderiza en portal. */}
            <CashSessionManager />
            <CommandPalette role={user.role as "SELLER" | "TECHNICIAN" | "MANAGER" | "ADMIN"} />
            <style>{`
                @media print {
                    [data-shell="topbar"], [data-shell="sidebar"] { display: none !important; }
                    main { padding: 0 !important; }
                }
                @media (prefers-reduced-motion: reduce) {
                    [data-shell="sidebar"] * { transition: none !important; animation: none !important; }
                }
            `}</style>
        </div>
        </DensityProvider>
    );
}
