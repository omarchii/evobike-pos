import type { SessionUser } from "@/lib/auth-types";
import { redirect, notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { REPORTS_BY_SLUG } from "@/lib/reportes/reports-config";
import type { ReportRole } from "@/lib/reportes/reports-config";
import { ExportacionContableView } from "./view";

export const dynamic = "force-dynamic";

export default async function ExportacionContablePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;

  const reportMeta = REPORTS_BY_SLUG["exportacion-contable"];
  if (!reportMeta || !reportMeta.allowedRoles.includes(user.role as ReportRole)) {
    notFound();
  }

  return <ExportacionContableView />;
}
