import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "./sidebar";
import { CashSessionManager } from "@/components/pos/cash-session-manager";
import Link from "next/link";
import { Bell, HelpCircle, Search, Settings } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

function getInitials(name?: string | null) {
    if (!name) return "U";
    return name.substring(0, 2).toUpperCase();
}

function Topbar({ user }: { user: { name?: string | null; branchName?: string | null } }) {
    return (
        <header className="sticky top-0 z-10 flex h-16 items-center justify-between px-6 backdrop-blur-md bg-white/90 dark:bg-[#131313]/80 border-b border-zinc-200 dark:border-white/5 shrink-0">
            {/* Left: Branch chip */}
            <div className="bg-[#1B4332] text-[#a5d0b9] px-3 py-1 rounded-full text-xs font-medium uppercase tracking-widest whitespace-nowrap">
                BRANCH: {user.branchName ?? "—"}
            </div>

            {/* Center: Search */}
            <div className="relative w-80 mx-6">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-500" />
                <input
                    aria-hidden="true"
                    tabIndex={-1}
                    placeholder="Buscar órdenes, VIN…"
                    className="w-full bg-zinc-100 dark:bg-[#1e1e1e] rounded-2xl pl-9 pr-4 py-2 text-sm text-zinc-600 dark:text-zinc-300 placeholder:text-zinc-400 dark:placeholder:text-zinc-600 outline-none pointer-events-none cursor-default"
                />
            </div>

            {/* Right: Icons + Avatar */}
            <div className="flex items-center gap-3">
                <button aria-label="Notificaciones" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                    <Bell className="h-5 w-5" />
                </button>
                <Link href="/settings" aria-label="Configuración" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
                    <Settings className="h-5 w-5" />
                </Link>
                <button aria-label="Ayuda" className="text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300 transition-colors">
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
        <div className="flex h-screen overflow-hidden bg-zinc-50 dark:bg-[#131313]">
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
