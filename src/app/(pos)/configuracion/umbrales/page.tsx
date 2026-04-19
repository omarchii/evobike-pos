import { notFound, redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UmbralesView } from "./view";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

export default async function UmbralesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");

  const { role, branchId } = user;
  if (role === "SELLER" || role === "TECHNICIAN") notFound();

  const isAdmin = role === "ADMIN";

  const [branches, thresholds] = await Promise.all([
    prisma.branch.findMany({
      where: isAdmin ? {} : { id: branchId ?? undefined },
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
    prisma.alertThreshold.findMany({
      where: isAdmin ? {} : { branchId: branchId ?? undefined },
      orderBy: [{ metricKey: "asc" }, { branchId: "asc" }],
    }),
  ]);

  const serializedThresholds = thresholds.map((t) => ({
    id: t.id,
    metricKey: t.metricKey,
    branchId: t.branchId,
    thresholdValue: Number(t.thresholdValue),
    comparator: t.comparator as "LT" | "LTE" | "GT" | "GTE" | "EQ",
    isActive: t.isActive,
  }));

  return (
    <UmbralesView
      branches={branches}
      thresholds={serializedThresholds}
      role={role as "ADMIN" | "MANAGER"}
    />
  );
}
