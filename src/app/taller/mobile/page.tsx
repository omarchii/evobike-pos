import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { resolveOperationalBranchId } from "@/lib/branch-scope";
import type { SessionUser } from "@/lib/auth-types";
import {
  MOBILE_ORDER_SELECT,
  serializeMobileOrder,
} from "@/lib/workshop-mobile";
import Dashboard from "./_components/dashboard";

export default async function MobileDashboardPage() {
  const session = await getServerSession(authOptions);
  // El guard vive en layout.tsx; aquí el non-null de session.user ya está
  // asegurado por el redirect previo. Tipamos para consumo.
  const user = session!.user as unknown as SessionUser;
  const branchId = await resolveOperationalBranchId({ user });

  // Una sola query + filtrado client-side por tab: 12–20 órdenes típicas por
  // técnico, serializar todo es barato y evita 3 round-trips que no aportan.
  const rows = await prisma.serviceOrder.findMany({
    where: {
      assignedTechId: user.id,
      branchId,
      status: { in: ["PENDING", "IN_PROGRESS", "COMPLETED"] },
    },
    select: MOBILE_ORDER_SELECT,
    orderBy: { updatedAt: "desc" },
  });

  const branch = await prisma.branch.findUnique({
    where: { id: branchId },
    select: { name: true },
  });

  const orders = rows.map(serializeMobileOrder);

  return (
    <Dashboard
      userName={user.name ?? "Técnico"}
      branchName={branch?.name ?? "—"}
      orders={orders}
    />
  );
}
