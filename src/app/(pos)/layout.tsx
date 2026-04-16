import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "./sidebar";
import { CashSessionManager } from "@/components/pos/cash-session-manager";
import Link from "next/link";
import { Bell, HelpCircle, Search, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { ThemeToggle } from "./theme-toggle";
import { OrphanedSessionBanner } from "./orphaned-session-banner";

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

function Topbar({ user }: { user: { name?: string | null; branchName?: string | null } }) {
    return (
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between px-6 bg-[var(--surf-lowest)]/90 backdrop-blur-md border-b border-[var(--ghost-border)] shrink-0 transition-colors duration-200">
            {/* Left: Branch chip */}
            <div className="px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest whitespace-nowrap text-white" style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}>
                BRANCH: {user.branchName ?? "—"}
            </div>

            {/* Center: Search */}
            <div className="relative w-80 mx-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--on-surf-var)]" />
                <input
                    aria-hidden="true"
                    tabIndex={-1}
                    placeholder="Buscar órdenes, VIN…"
                    className="w-full bg-[var(--surf-high)] rounded-2xl pl-9 pr-4 py-2 text-sm text-[var(--on-surf)] placeholder:text-[var(--on-surf-var)] outline-none pointer-events-none cursor-default"
                />
            </div>

            {/* Right: Icons + Avatar */}
            <div className="flex items-center gap-3">
                <ThemeToggle />
                <button aria-label="Notificaciones" className="text-[var(--on-surf-var)] hover:text-[var(--on-surf)] transition-colors">
                    <Bell className="h-5 w-5" />
                </button>
                <Link href="/settings" aria-label="Configuración" className="text-[var(--on-surf-var)] hover:text-[var(--on-surf)] transition-colors">
                    <Settings className="h-5 w-5" />
                </Link>
                <button aria-label="Ayuda" className="text-[var(--on-surf-var)] hover:text-[var(--on-surf)] transition-colors">
                    <HelpCircle className="h-5 w-5" />
                </button>
                <Avatar className="h-8 w-8">
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

    return (
        <div className="flex h-screen overflow-hidden bg-[var(--surface)] transition-colors duration-200">
            <Sidebar user={user} />
            <div className="flex flex-col flex-1 overflow-hidden">
                <Topbar user={user} />
                <main className="flex-1 overflow-y-auto relative">
                    <OrphanedSessionBanner branchId={user.branchId} />
                    <div className="p-8">
                        {children}
                    </div>
                    <CashSessionManager />
                </main>
            </div>
        </div>
    );
}
