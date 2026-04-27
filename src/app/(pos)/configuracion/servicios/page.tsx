import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ServiciosManager } from "./servicios-manager";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

export default async function ServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/");

  const { branchId: qBranchId } = await searchParams;

  const branches = await prisma.branch.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { code: "asc" },
  });

  const branchFilter =
    user.role === "ADMIN"
      ? qBranchId && branches.some((b) => b.id === qBranchId)
        ? { branchId: qBranchId }
        : {}
      : { branchId: user.branchId! };

  const services = await prisma.serviceCatalog.findMany({
    where: branchFilter,
    include: { branch: { select: { id: true, code: true, name: true } } },
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
  });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Catálogo de servicios
        </h1>
        <p className="text-sm text-[var(--on-surf-var)] mt-1">
          Servicios de mano de obra que aparecen en las órdenes del taller. Las refacciones
          viven en el catálogo de productos.
        </p>
      </div>
      <ServiciosManager
        initialServices={services.map((s) => ({
          id: s.id,
          name: s.name,
          basePrice: Number(s.basePrice),
          isActive: s.isActive,
          esMantenimiento: s.esMantenimiento,
          branchId: s.branchId,
          branchCode: s.branch?.code ?? null,
          branchName: s.branch?.name ?? null,
        }))}
        branches={branches}
        isAdmin={user.role === "ADMIN"}
        currentBranchId={user.branchId ?? branches[0]?.id ?? ""}
        selectedBranchId={
          user.role === "ADMIN"
            ? qBranchId && branches.some((b) => b.id === qBranchId)
              ? qBranchId
              : null
            : user.branchId
        }
      />
    </div>
  );
}
