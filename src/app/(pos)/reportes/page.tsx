import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  getReportsByGroup,
  REPORTS_BY_SLUG,
  type ReportRole,
} from "@/lib/reportes/reports-config";
import { getEffectivePinned } from "@/lib/reportes/pinned-defaults";
import HubView from "./hub-view";

export const dynamic = "force-dynamic";

export default async function ReportesPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const role = session.user.role as ReportRole;

  const user = await prisma.user.findUniqueOrThrow({
    where: { id: session.user.id },
    select: { pinnedReports: true },
  });

  const effectivePinned = getEffectivePinned(role, user.pinnedReports);
  const pinnedReports = effectivePinned
    .map((slug) => REPORTS_BY_SLUG[slug])
    .filter((r): r is NonNullable<typeof r> => r !== undefined && r.status !== "reserved");

  const groupedReports = getReportsByGroup(role);

  return (
    <HubView
      role={role}
      pinnedReports={pinnedReports}
      groupedReports={groupedReports}
      initialPinned={effectivePinned}
    />
  );
}
