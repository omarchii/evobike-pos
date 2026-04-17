import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { TransferenciasClient } from "./transferencias-client";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

interface SearchParams {
  tab?: string;
  direccion?: string;
  desde?: string;
  hasta?: string;
  page?: string;
  q?: string;
}

export default async function TransferenciasPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.ReactElement> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;
  const role = user.role;

  if (!["SELLER", "MANAGER", "ADMIN"].includes(role)) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page ?? "1"));
  const pageSize = 20;
  const skip = (page - 1) * pageSize;
  const tab = params.tab ?? "solicitudes";
  const direccion = params.direccion ?? "todas";
  const q = params.q?.trim() ?? "";

  const statusByTab: Record<string, Prisma.StockTransferWhereInput["status"]> = {
    solicitudes: "SOLICITADA",
    borradores: "BORRADOR",
    transito: "EN_TRANSITO",
    historial: { in: ["RECIBIDA", "CANCELADA"] },
  };

  const where: Prisma.StockTransferWhereInput = {};

  if (tab in statusByTab) {
    where.status = statusByTab[tab];
  }

  if (params.desde || params.hasta) {
    where.createdAt = {
      ...(params.desde ? { gte: new Date(params.desde) } : {}),
      ...(params.hasta ? { lte: new Date(params.hasta) } : {}),
    };
  }

  if (q) {
    where.folio = { contains: q, mode: "insensitive" };
  }

  if (role === "MANAGER") {
    const bf =
      direccion === "entrantes"
        ? { toBranchId: user.branchId! }
        : direccion === "salientes"
          ? { fromBranchId: user.branchId! }
          : { OR: [{ fromBranchId: user.branchId! }, { toBranchId: user.branchId! }] };
    Object.assign(where, bf);
  } else if (role === "SELLER") {
    const sf =
      direccion === "salientes"
        ? { creadoPor: user.id }
        : { OR: [{ creadoPor: user.id }, { toBranchId: user.branchId! }] };
    Object.assign(where, sf);
  }

  const [transfers, total, solicitadasCount, enTransitoCount, branches] = await Promise.all([
    prisma.stockTransfer.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        folio: true,
        status: true,
        fromBranchId: true,
        toBranchId: true,
        creadoPor: true,
        createdAt: true,
        fromBranch: { select: { id: true, name: true, code: true } },
        toBranch: { select: { id: true, name: true, code: true } },
        creadoPorUser: { select: { id: true, name: true } },
        _count: { select: { items: true } },
      },
    }),
    prisma.stockTransfer.count({ where }),
    role !== "SELLER"
      ? prisma.stockTransfer.count({
          where: {
            status: "SOLICITADA",
            ...(role === "MANAGER" ? { fromBranchId: user.branchId! } : {}),
          },
        })
      : Promise.resolve(0),
    role !== "SELLER"
      ? prisma.stockTransfer.count({
          where: {
            status: "EN_TRANSITO",
            ...(role === "MANAGER" ? { toBranchId: user.branchId! } : {}),
          },
        })
      : Promise.resolve(0),
    prisma.branch.findMany({
      select: { id: true, name: true, code: true },
      orderBy: { name: "asc" },
    }),
  ]);

  const rows = transfers.map((t) => ({
    id: t.id,
    folio: t.folio,
    status: t.status,
    fromBranchId: t.fromBranchId,
    toBranchId: t.toBranchId,
    fromBranch: t.fromBranch,
    toBranch: t.toBranch,
    creadoPor: t.creadoPor,
    creadoPorUser: t.creadoPorUser,
    createdAt: t.createdAt.toISOString(),
    totalItems: t._count.items,
  }));

  return (
    <TransferenciasClient
      rows={rows}
      total={total}
      page={page}
      pageSize={pageSize}
      tab={tab}
      direccion={direccion}
      desde={params.desde ?? ""}
      hasta={params.hasta ?? ""}
      q={q}
      solicitadasCount={solicitadasCount}
      enTransitoCount={enTransitoCount}
      branches={branches}
      userRole={role}
      userBranchId={user.branchId ?? ""}
    />
  );
}
