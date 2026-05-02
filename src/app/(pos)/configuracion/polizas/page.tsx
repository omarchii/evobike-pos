import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth-types";
import { WarrantyPoliciesClient } from "./warranty-policies-client";

export const dynamic = "force-dynamic";

export default async function PolizasPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/");
  }

  const policies = await prisma.warrantyPolicy.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      sale: { select: { folio: true } },
      customerBike: {
        select: {
          serialNumber: true,
          model: true,
          customer: { select: { name: true } },
          branch: { select: { name: true } },
        },
      },
      modelo: { select: { nombre: true } },
    },
  });

  const rows = policies.map((p) => ({
    id: p.id,
    folio: p.sale.folio,
    customerName: p.customerBike.customer?.name ?? "—",
    modeloNombre: p.modelo.nombre,
    serie: p.customerBike.serialNumber,
    branchName: p.customerBike.branch.name,
    status: p.status,
    startedAt: p.startedAt.toISOString(),
    expiresAt: p.expiresAt.toISOString(),
    warrantyDays: p.warrantyDaysSnapshot,
    hasPdf: !!p.docUrl,
    printCount: p.printCount,
  }));

  return <WarrantyPoliciesClient rows={rows} />;
}
