import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "./sidebar";
import { CashSessionManager } from "@/components/pos/cash-session-manager";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "./theme-toggle";
import { OrphanedSessionBanner } from "./orphaned-session-banner";
import { BranchSwitcher } from "@/components/pos/branch-switcher";
import { getAdminActiveBranch } from "@/lib/actions/branch";
import { NotificationBell } from "./notification-bell";

interface SessionUser {
    id: string;
    name?: string | null;
    email?: string | null;
    role: string;
    branchId: string | null;
    branchName: string | null;
}

function getInitials(name?: string | null) {
    if (!name) return "U";
    return name.substring(0, 2).toUpperCase();
}

interface TopbarProps {
    user: { name?: string | null; branchName?: string | null };
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

            {/* Right: Notifications + Theme toggle + Avatar */}
            <div className="flex items-center gap-3">
                {canSeeNotifications && <NotificationBell />}
                <ThemeToggle />
                <Avatar className="h-8 w-8" aria-label={`Usuario ${user.name ?? ""}`.trim()}>
                    <AvatarFallback className="text-white text-xs font-medium" style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}>
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
        <div className="flex h-screen overflow-hidden bg-[var(--surface)] transition-colors duration-200">
            <a
                href="#main-content"
                className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-xl focus:bg-[var(--surf-bright)] focus:text-[var(--on-surf)] focus:outline-none focus:ring-2 focus:ring-[var(--p)] focus:shadow-[var(--shadow)]"
            >
                Saltar al contenido
            </a>
            <Sidebar user={user} />
            <div className="flex flex-col flex-1 overflow-hidden">
                <Topbar user={user} isAdmin={isAdmin} canSeeNotifications={canSeeNotifications} activeBranchId={activeBranchId} activeBranchName={activeBranchName} />
                <main id="main-content" className="flex-1 overflow-y-auto relative">
                    <OrphanedSessionBanner branchId={activeBranchId} />
                    <div className="p-8">
                        {children}
                    </div>
                    <CashSessionManager />
                </main>
            </div>
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
