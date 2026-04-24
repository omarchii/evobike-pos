import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewBranchId } from "@/lib/branch-filter";
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
  const branchId = await getViewBranchId();

  // Técnico sin sucursal asignada (o admin en Global, caso edge) — el
  // dashboard mobile requiere branch específico; devuelve a raíz.
  if (!branchId) {
    redirect("/");
  }

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

  // Timestamp estable compartido para los "hace X min" de todas las
  // cards. SSR y el primer render cliente verán el mismo valor, evitando
  // hydration mismatch. El polling de G.3 refrescará el árbol y con él
  // este `nowMs`.
  // eslint-disable-next-line react-hooks/purity -- corre por request, no en render
  const nowMs = Date.now();

  return (
    <Dashboard
      userId={user.id}
      userName={user.name ?? "Técnico"}
      branchName={branch?.name ?? "—"}
      orders={orders}
      nowMs={nowMs}
    />
  );
}
