import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "./sidebar";
import { CashSessionManager } from "@/components/pos/cash-session-manager";
import { ThemeToggle } from "./theme-toggle";
import { OrphanedSessionBanner } from "./orphaned-session-banner";
import { BranchSwitcher } from "@/components/pos/branch-switcher";
import { getAdminActiveBranch } from "@/lib/actions/branch";
import { NotificationBell } from "./notification-bell";
import { UserMenu } from "./user-menu";
import { CommandPalette } from "./command-palette";
import { SearchTrigger } from "./search-trigger";

interface SessionUser {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    branchId: string | null;
    branchName: string | null;
}

interface TopbarProps {
    user: SessionUser;
    isAdmin: boolean;
    canSeeNotifications: boolean;
    activeBranchId: string;
    activeBranchName: string;
}

function Topbar({ user, isAdmin, canSeeNotifications, activeBranchId, activeBranchName }: TopbarProps) {
    return (
        <header data-shell="topbar" className="sticky top-0 z-10 flex h-16 items-center justify-between px-6 bg-[var(--surf-bright)] shrink-0 transition-colors duration-200">
            {/* Left: Branch chip / switcher */}
            {isAdmin ? (
                <BranchSwitcher activeBranchId={activeBranchId} activeBranchName={activeBranchName} />
            ) : (
                <div className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest whitespace-nowrap text-white" style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}>
                    BRANCH: {user.branchName ?? "—"}
                </div>
            )}

            {/* Center: Command palette trigger */}
            <div className="flex-1 flex justify-center px-6">
                <SearchTrigger />
            </div>

            {/* Right: Notifications + Theme toggle + User menu */}
            <div className="flex items-center gap-3">
                {canSeeNotifications && <NotificationBell />}
                <ThemeToggle />
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

    // For admin: use cookie-stored active branch, falling back to their assigned branch
    let activeBranchId = user.branchId ?? "";
    let activeBranchName = user.branchName ?? "—";

    if (isAdmin) {
        const saved = await getAdminActiveBranch();
        if (saved) {
            activeBranchId = saved.id;
            activeBranchName = saved.name;
        }
    }

    return (
        <div className="flex flex-col h-screen overflow-hidden bg-[var(--surface)] transition-colors duration-200">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[var(--surf-bright)] focus:text-[var(--on-surf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)] focus:shadow-[var(--shadow)]"
            >
                Saltar al contenido
            </a>
            {/* Alert bar full-width arriba del shell (banner aparece solo si hay caja huérfana) */}
            <OrphanedSessionBanner branchId={activeBranchId} />
            <div className="flex flex-1 overflow-hidden">
                <Sidebar user={user} />
                <div className="flex flex-col flex-1 overflow-hidden">
                    <Topbar
                        user={user}
                        isAdmin={isAdmin}
                        canSeeNotifications={canSeeNotifications}
                        activeBranchId={activeBranchId}
                        activeBranchName={activeBranchName}
                    />
                    <main id="main-content" className="flex-1 overflow-y-auto relative">
                        <div className="p-8">
                            {children}
                        </div>
                    </main>
                </div>
            </div>
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
    );
}
