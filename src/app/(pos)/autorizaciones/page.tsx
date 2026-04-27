import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { AuthorizationsHistory, type AuthorizationRow, type BranchOption } from "./authorizations-history";
import { parseLocalDate } from "@/lib/reportes/date-range";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

interface SearchParamsShape {
  tipo?: string;
  status?: string;
  branchId?: string;
  fromDate?: string;
  toDate?: string;
}

export default async function AutorizacionesPage({
  searchParams,
}: {
  searchParams: Promise<SearchParamsShape>;
}) {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/");

  const params = await searchParams;

  const where: Prisma.AuthorizationRequestWhereInput = {};
  if (user.role === "ADMIN") {
    if (params.branchId) where.branchId = params.branchId;
  } else {
    where.branchId = user.branchId ?? "__none__";
  }
  if (
    params.tipo === "CANCELACION" ||
    params.tipo === "DESCUENTO" ||
    params.tipo === "CIERRE_DIFERENCIA"
  ) {
    where.tipo = params.tipo;
  }
  if (
    params.status === "PENDING" ||
    params.status === "APPROVED" ||
    params.status === "REJECTED" ||
    params.status === "EXPIRED"
  ) {
    where.status = params.status;
  }
  if (params.fromDate || params.toDate) {
    where.createdAt = {};
    if (params.fromDate) {
      const from = parseLocalDate(params.fromDate, false);
      if (from) where.createdAt.gte = from;
    }
    if (params.toDate) {
      const to = parseLocalDate(params.toDate, true);
      if (to) where.createdAt.lte = to;
    }
  }

  const [records, branches] = await Promise.all([
    prisma.authorizationRequest.findMany({
      where,
      select: {
        id: true,
        branchId: true,
        tipo: true,
        status: true,
        mode: true,
        saleId: true,
        monto: true,
        motivo: true,
        rejectReason: true,
        createdAt: true,
        resolvedAt: true,
        expiresAt: true,
        requester: { select: { name: true } },
        approver: { select: { name: true } },
        sale: { select: { folio: true } },
        branch: { select: { code: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    user.role === "ADMIN"
      ? prisma.branch.findMany({
          select: { id: true, code: true, name: true },
          orderBy: { code: "asc" },
        })
      : Promise.resolve<BranchOption[]>([]),
  ]);

  const rows: AuthorizationRow[] = records.map((r) => ({
    id: r.id,
    branchId: r.branchId,
    branchCode: r.branch?.code ?? null,
    branchName: r.branch?.name ?? null,
    tipo: r.tipo,
    status: r.status,
    mode: r.mode,
    saleId: r.saleId,
    saleFolio: r.sale?.folio ?? null,
    monto: r.monto ? Number(r.monto) : null,
    motivo: r.motivo,
    rejectReason: r.rejectReason,
    createdAt: r.createdAt.toISOString(),
    resolvedAt: r.resolvedAt?.toISOString() ?? null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
    requesterName: r.requester?.name ?? null,
    approverName: r.approver?.name ?? null,
  }));

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Autorizaciones
        </h1>
        <p className="text-sm text-[var(--on-surf-var)] mt-1">
          Historial de cancelaciones y descuentos que requirieron autorización.
        </p>
      </div>
      <AuthorizationsHistory
        rows={rows}
        branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
        canFilterBranch={user.role === "ADMIN"}
        initialFilters={{
          tipo: params.tipo ?? "",
          status: params.status ?? "",
          branchId: params.branchId ?? "",
          fromDate: params.fromDate ?? "",
          toDate: params.toDate ?? "",
        }}
      />
    </div>
  );
}
