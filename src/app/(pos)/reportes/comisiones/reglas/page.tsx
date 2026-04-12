import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { CommissionRules } from "./commission-rules";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  branchId: string | null;
  role: string;
}

export interface RuleRow {
  id: string;
  role: string;
  commissionType: "PERCENTAGE" | "FIXED_AMOUNT";
  value: number;
  modeloId: string | null;
  modeloNombre: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface ModeloOption {
  id: string;
  nombre: string;
}

export default async function ReglasComisionesPage(): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user || (user.role !== "MANAGER" && user.role !== "ADMIN")) {
    redirect("/dashboard");
  }

  const branchId = user.branchId;
  if (!branchId) redirect("/dashboard");

  const [rules, modelos] = await Promise.all([
    prisma.commissionRule.findMany({
      where: { branchId },
      include: { modelo: { select: { id: true, nombre: true } } },
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
    isActive: r.isActive,
    createdAt: r.createdAt.toISOString(),
  }));

  const modeloOptions: ModeloOption[] = modelos.map((m) => ({
    id: m.id,
    nombre: m.nombre,
  }));

  return (
    <CommissionRules
      initialRules={ruleRows}
      modelos={modeloOptions}
      role={user.role}
    />
  );
}
