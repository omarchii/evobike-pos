import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import Sidebar from "./sidebar";
import { CashSessionManager } from "@/components/pos/cash-session-manager";

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
        <div className="flex h-screen overflow-hidden">
            <Sidebar user={session.user as any} />
            <main className="flex-1 overflow-y-auto bg-slate-50 dark:bg-slate-900 relative">
                <div className="p-8">
                    {children}
                </div>
                {/* Global Cash Register Overlay */}
                <CashSessionManager />
            </main>
        </div>
    );
}
