import type { SessionUser } from "@/lib/auth-types";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CommissionRules } from "./commission-rules";

export const dynamic = "force-dynamic";

export interface RuleRow {
  id: string;
  role: string;
  commissionType: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  modeloId: string | null;
  modeloNombre: string | null;
  branchId: string;
  branchCode: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ModeloOption {
  id: string;
  nombre: string;
}

export interface BranchOption {
  id: string;
  code: string;
  name: string;
}

export default async function ReglasComisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ branchId?: string }>;
}): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    redirect("/");
  }

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
      : { branchId: user.branchId ?? undefined };

  if (user.role !== "ADMIN" && !user.branchId) redirect("/");

  const [rules, modelos] = await Promise.all([
    prisma.commissionRule.findMany({
      where: branchFilter,
      include: {
        modelo: { select: { id: true, nombre: true } },
        branch: { select: { code: true } },
      },
      orderBy: [{ isActive: "desc" }, { role: "asc" }, { createdAt: "desc" }],
    }),
    prisma.modelo.findMany({
      select: { id: true, nombre: true },
      orderBy: { nombre: "asc" },
    }),
  ]);

  const ruleRows: RuleRow[] = rules.map((r) => ({
    id: r.id,
    role: r.role,
    commissionType: r.commissionType as "PERCENTAGE" | "FIXED_AMOUNT",
    value: Number(r.value),
    modeloId: r.modeloId,
    modeloNombre: r.modelo?.nombre ?? null,
    branchId: r.branchId,
    branchCode: r.branch?.code ?? null,
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }));

  const modeloOptions: ModeloOption[] = modelos.map((m) => ({
    id: m.id,
    nombre: m.nombre,
  }));

  const branchOptions: BranchOption[] = branches.map((b) => ({
    id: b.id,
    code: b.code,
    name: b.name,
  }));

  return (
    <CommissionRules
      initialRules={ruleRows}
      modelos={modeloOptions}
      branches={branchOptions}
      role={user.role}
      selectedBranchId={
        user.role === "ADMIN"
          ? qBranchId && branches.some((b) => b.id === qBranchId)
            ? qBranchId
            : null
          : user.branchId
      }
      defaultBranchId={user.branchId ?? branches[0]?.id ?? ""}
    />
  );
}
