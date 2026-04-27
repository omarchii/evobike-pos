import type { SessionUser } from "@/lib/auth-types";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { UsersManager } from "./users-manager";

export const dynamic = "force-dynamic";

export default async function UsuariosPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");
  if (user.role !== "ADMIN") redirect("/");

  const [users, branches] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        isActive: true,
        branchId: true,
        pin: true,
        branch: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { name: "asc" }],
    }),
    prisma.branch.findMany({
      select: { id: true, code: true, name: true },
      orderBy: { code: "asc" },
    }),
  ]);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Gestión de usuarios
        </h1>
        <p className="text-sm text-[var(--on-surf-var)] mt-1">
          Crear, editar y desactivar usuarios del sistema. Los usuarios nunca se eliminan; se desactivan.
        </p>
      </div>
      <UsersManager
        initialUsers={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          role: u.role,
          isActive: u.isActive,
          branchId: u.branchId,
          branchName: u.branch?.name ?? null,
          branchCode: u.branch?.code ?? null,
          hasPin: u.pin != null,
        }))}
        branches={branches}
        currentUserId={user.id}
      />
    </div>
  );
}
