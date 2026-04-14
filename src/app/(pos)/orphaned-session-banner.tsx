import { getOrphanedSession } from "@/lib/cash-register";
import { OrphanedSessionBannerContent } from "./orphaned-session-banner-content";

interface Props {
    branchId: string | null;
}

function formatOpenedDate(date: Date): string {
    return new Intl.DateTimeFormat("es-MX", {
        weekday: "long",
        day: "numeric",
        month: "long",
    }).format(date);
}

export async function OrphanedSessionBanner({ branchId }: Props): Promise<React.ReactElement | null> {
    if (!branchId) return null;

    const session = await getOrphanedSession(branchId);
    if (!session) return null;

    return <OrphanedSessionBannerContent openedLabel={formatOpenedDate(session.openedAt)} />;
}
