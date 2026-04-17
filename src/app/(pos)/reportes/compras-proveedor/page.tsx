import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { branchWhere } from "@/lib/reportes/branch-scope";
import { parseDateRange, toDateString } from "@/lib/reportes/date-range";
import { serializeDecimal } from "@/lib/reportes/money";
import { ComprasProveedorClient } from "./compras-proveedor-client";

export const dynamic = "force-dynamic";

interface SessionUser {
  id: string;
  role: string;
  branchId: string | null;
}

const VALID_ESTADO_PAGO = ["all", "pagada", "pendiente"] as const;
type FilterEstadoPago = (typeof VALID_ESTADO_PAGO)[number];

interface SearchParams {
  from?: string;
  to?: string;
  branchId?: string;
  estadoPago?: string;
  q?: string;
}

// ── Serialized types for Client Component ─────────────────────────────────────

export interface KpiData {
  totalComprado: number;
  totalPagado: number;
  cuentasPorPagar: number;
  cuentasVencidas: number;
  cuentasVencidasMonto: number;
  proveedoresDistintos: number;
}

export interface ProveedorRow {
  key: string;
  nombre: string;
  recepciones: number;
  totalComprado: number;
  pagado: number;
  pendiente: number;
  proximoVencimiento: string | null; // ISO — earliest fechaVencimiento among PENDIENTE/CREDITO
  tieneVencida: boolean;
  branchId: string;
}

export interface MesRow {
  mesKey: string; // "YYYY-MM"
  mesLabel: string; // "abr. 2026"
  totalComprado: number;
  recepciones: number;
  proveedores: number;
}

export interface BranchOption {
  id: string;
  name: string;
}

export interface CurrentFilters {
  from: string;
  to: string;
  branchId: string;
  efectiveBranchId: string;
  estadoPago: FilterEstadoPago;
  q: string;
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function ComprasProveedorPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}): Promise<React.JSX.Element> {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/login");

  const user = session.user as unknown as SessionUser;
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    redirect("/dashboard");
  }

  const isAdmin = user.role === "ADMIN";
  const params = await searchParams;

  // ── Parse filters ──────────────────────────────────────────────────────
  const { from: fromDate, to: toDate } = parseDateRange({
    from: params.from,
    to: params.to,
  });

  const filterBranchId = isAdmin ? (params.branchId ?? "") : "";
  const filterEstadoPago: FilterEstadoPago =
    (VALID_ESTADO_PAGO as readonly string[]).includes(params.estadoPago ?? "")
      ? (params.estadoPago as FilterEstadoPago)
      : "all";
  const filterQ = params.q?.trim() ?? "";

  // ── Branch scope ───────────────────────────────────────────────────────
  const scope = branchWhere(
    { role: user.role, branchId: user.branchId },
    filterBranchId || undefined,
  );

  // ── Queries ────────────────────────────────────────────────────────────
  const [receiptsRaw, branches] = await Promise.all([
    prisma.purchaseReceipt.findMany({
      where: {
        createdAt: { gte: fromDate, lte: toDate },
        ...(scope.branchId !== undefined ? { branchId: scope.branchId } : {}),
      },
      select: {
        id: true,
        proveedor: true,
        totalPagado: true,
        estadoPago: true,
        fechaVencimiento: true,
        createdAt: true,
        branchId: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    isAdmin
      ? prisma.branch.findMany({
          select: { id: true, name: true },
          orderBy: { name: "asc" },
        })
      : Promise.resolve<BranchOption[]>([]),
  ]);

  const receipts = receiptsRaw.map((r) => ({
    ...r,
    totalPagado: serializeDecimal(r.totalPagado),
  }));

  // ── estadoPago filter (applied to tables and KPIs) ─────────────────────
  const filteredReceipts = receipts.filter((r) => {
    if (filterEstadoPago === "pagada") return r.estadoPago === "PAGADA";
    if (filterEstadoPago === "pendiente")
      return r.estadoPago === "PENDIENTE" || r.estadoPago === "CREDITO";
    return true;
  });

  // ── q filter (applied only to tables, not KPIs) ────────────────────────
  const qLower = filterQ.toLowerCase();
  const displayReceipts = filterQ
    ? filteredReceipts.filter((r) =>
        r.proveedor.toLowerCase().includes(qLower),
      )
    : filteredReceipts;

  // ── KPIs ───────────────────────────────────────────────────────────────
  const now = new Date();
  let totalComprado = 0;
  let totalPagado = 0;
  let cuentasPorPagar = 0;
  let cuentasVencidas = 0;
  let cuentasVencidasMonto = 0;

  for (const r of filteredReceipts) {
    totalComprado += r.totalPagado;
    if (r.estadoPago === "PAGADA") {
      totalPagado += r.totalPagado;
    } else {
      cuentasPorPagar += r.totalPagado;
      if (r.fechaVencimiento && r.fechaVencimiento < now) {
        cuentasVencidas += 1;
        cuentasVencidasMonto += r.totalPagado;
      }
    }
  }

  const proveedoresDistintos = new Set(
    filteredReceipts.map((r) => r.proveedor.trim().toLowerCase()),
  ).size;

  const kpis: KpiData = {
    totalComprado,
    totalPagado,
    cuentasPorPagar,
    cuentasVencidas,
    cuentasVencidasMonto,
    proveedoresDistintos,
  };

  // ── Aggregate by proveedor ─────────────────────────────────────────────
  interface ProveedorAgg {
    nameFreq: Map<string, number>;
    recepciones: number;
    totalComprado: number;
    pagado: number;
    pendiente: number;
    proximoVencimiento: Date | null;
    tieneVencida: boolean;
    branchId: string;
  }

  const proveedorMap = new Map<string, ProveedorAgg>();

  for (const r of displayReceipts) {
    const key = r.proveedor.trim().toLowerCase();
    const isPendiente =
      r.estadoPago === "PENDIENTE" || r.estadoPago === "CREDITO";

    const existing = proveedorMap.get(key);
    if (existing) {
      const freq = existing.nameFreq.get(r.proveedor) ?? 0;
      existing.nameFreq.set(r.proveedor, freq + 1);
      existing.recepciones += 1;
      existing.totalComprado += r.totalPagado;
      if (r.estadoPago === "PAGADA") existing.pagado += r.totalPagado;
      if (isPendiente) {
        existing.pendiente += r.totalPagado;
        if (r.fechaVencimiento) {
          if (r.fechaVencimiento < now) {
            existing.tieneVencida = true;
          }
          if (
            !existing.proximoVencimiento ||
            r.fechaVencimiento < existing.proximoVencimiento
          ) {
            existing.proximoVencimiento = r.fechaVencimiento;
          }
        }
      }
    } else {
      const nameFreq = new Map<string, number>();
      nameFreq.set(r.proveedor, 1);
      proveedorMap.set(key, {
        nameFreq,
        recepciones: 1,
        totalComprado: r.totalPagado,
        pagado: r.estadoPago === "PAGADA" ? r.totalPagado : 0,
        pendiente: isPendiente ? r.totalPagado : 0,
        proximoVencimiento:
          isPendiente && r.fechaVencimiento ? r.fechaVencimiento : null,
        tieneVencida: isPendiente
          ? !!(r.fechaVencimiento && r.fechaVencimiento < now)
          : false,
        branchId: r.branchId,
      });
    }
  }

  const proveedorRows: ProveedorRow[] = Array.from(proveedorMap.entries())
    .map(([key, agg]) => {
      let canonicalName = "";
      let maxFreq = 0;
      for (const [name, freq] of agg.nameFreq.entries()) {
        if (freq > maxFreq || (freq === maxFreq && name < canonicalName)) {
          canonicalName = name;
          maxFreq = freq;
        }
      }
      return {
        key,
        nombre: canonicalName,
        recepciones: agg.recepciones,
        totalComprado: agg.totalComprado,
        pagado: agg.pagado,
        pendiente: agg.pendiente,
        proximoVencimiento: agg.proximoVencimiento
          ? agg.proximoVencimiento.toISOString()
          : null,
        tieneVencida: agg.tieneVencida,
        branchId: agg.branchId,
      };
    })
    .sort((a, b) => b.totalComprado - a.totalComprado);

  // ── Monthly series ─────────────────────────────────────────────────────
  const mesMap = new Map<
    string,
    { totalComprado: number; recepciones: number; proveedores: Set<string> }
  >();

  for (const r of displayReceipts) {
    const d = r.createdAt;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const key = `${y}-${m}`;

    const existing = mesMap.get(key);
    if (existing) {
      existing.totalComprado += r.totalPagado;
      existing.recepciones += 1;
      existing.proveedores.add(r.proveedor.trim().toLowerCase());
    } else {
      mesMap.set(key, {
        totalComprado: r.totalPagado,
        recepciones: 1,
        proveedores: new Set([r.proveedor.trim().toLowerCase()]),
      });
    }
  }

  const mesRows: MesRow[] = Array.from(mesMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, agg]) => {
      const [y, mo] = key.split("-");
      const d = new Date(Number(y), Number(mo) - 1, 1);
      const mesLabel = new Intl.DateTimeFormat("es-MX", {
        month: "short",
        year: "numeric",
      }).format(d);
      return {
        mesKey: key,
        mesLabel,
        totalComprado: agg.totalComprado,
        recepciones: agg.recepciones,
        proveedores: agg.proveedores.size,
      };
    });

  const currentFilters: CurrentFilters = {
    from: toDateString(fromDate),
    to: toDateString(new Date(toDate.getTime() - 1)),
    branchId: filterBranchId,
    efectiveBranchId: scope.branchId ?? "",
    estadoPago: filterEstadoPago,
    q: filterQ,
  };

  return (
    <ComprasProveedorClient
      kpis={kpis}
      proveedorRows={proveedorRows}
      mesRows={mesRows}
      branches={branches}
      currentFilters={currentFilters}
      isAdmin={isAdmin}
      userRole={user.role}
    />
  );
}
