import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TrendingUp, Banknote, Wrench, ArchiveRestore } from "lucide-react";

export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
    COMPLETED: "Venta",
    LAYAWAY: "Apartado",
    CANCELLED: "Cancelado",
};

const WORKSHOP_STATUS_LABELS: Record<string, string> = {
    PENDING: "Pendiente",
    IN_PROGRESS: "En Proceso",
    COMPLETED: "Completado",
    DELIVERED: "Entregado",
    CANCELLED: "Cancelado",
};

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    const branchId = (session?.user as any)?.branchId;
    const branchName = (session?.user as any)?.branchName ?? "la Sucursal";

    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    const salesTodayAgg = await prisma.sale.aggregate({
        where: { branchId, createdAt: { gte: startOfToday, lte: endOfToday }, status: "COMPLETED" },
        _sum: { total: true },
    });
    const revenueToday = Number(salesTodayAgg._sum.total || 0);

    const activeWorkshopCount = await prisma.serviceOrder.count({
        where: { branchId, status: { in: ["PENDING", "IN_PROGRESS"] } },
    });

    const activeLayawaysCount = await prisma.sale.count({
        where: { branchId, status: "LAYAWAY" },
    });

    const salesTodayCount = await prisma.sale.count({
        where: { branchId, status: "COMPLETED", createdAt: { gte: startOfToday, lte: endOfToday } },
    });

    const recentSales = await prisma.sale.findMany({
        where: { branchId },
        orderBy: { createdAt: "desc" },
        take: 5,
        include: { customer: true, user: true },
    });

    const upcomingOrders = await prisma.serviceOrder.findMany({
        where: { branchId, status: { in: ["PENDING", "IN_PROGRESS"] } },
        orderBy: { createdAt: "asc" },
        take: 3,
        include: { customer: true },
    });

    return (
        <div className="space-y-6">
            {/* Header */}
            <div>
                <h1
                    className="text-2xl font-bold text-zinc-900"
                    style={{ fontFamily: "var(--font-space-grotesk)" }}
                >
                    Panel de Control
                </h1>
                <p className="text-sm text-zinc-500 mt-0.5">Resumen diario · {branchName}</p>
            </div>

            {/* Metric Cards */}
            <div className="grid grid-cols-4 gap-4">
                {/* Ventas Hoy */}
                <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Ventas Hoy</span>
                        <TrendingUp className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-3xl font-bold text-zinc-900" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                        {salesTodayCount}{" "}
                        <span className="text-lg font-normal text-zinc-400">unidades</span>
                    </p>
                    <p className="text-xs text-zinc-400">Ventas cobradas hoy</p>
                </div>

                {/* Ingresos del Día — DESTACADA */}
                <div className="bg-emerald-600 rounded-2xl p-5 space-y-3">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-white/60 uppercase tracking-wider">
                            Ingresos del Día
                        </span>
                        <Banknote className="h-4 w-4 text-white/60" />
                    </div>
                    <p className="text-3xl font-bold text-white" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                        ${revenueToday.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                    </p>
                    <p className="text-xs text-white/50">Total facturado hoy</p>
                </div>

                {/* Taller Activo */}
                <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Taller Activo</span>
                        <Wrench className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-3xl font-bold text-zinc-900" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                        {String(activeWorkshopCount).padStart(2, "0")}{" "}
                        <span className="text-lg font-normal text-zinc-400">órdenes</span>
                    </p>
                    <p className="text-xs text-zinc-400">Pendientes / En proceso</p>
                </div>

                {/* Apartados */}
                <div className="bg-white rounded-2xl p-5 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">Apartados</span>
                        <ArchiveRestore className="h-4 w-4 text-zinc-400" />
                    </div>
                    <p className="text-3xl font-bold text-zinc-900" style={{ fontFamily: "var(--font-space-grotesk)" }}>
                        {String(activeLayawaysCount).padStart(2, "0")}{" "}
                        <span className="text-lg font-normal text-zinc-400">tickets</span>
                    </p>
                    <p className="text-xs text-zinc-400">Por liquidar</p>
                </div>
            </div>

            {/* Main Grid */}
            <div className="grid grid-cols-7 gap-4">
                {/* Revenue Trend — col 1-4 */}
                <div className="col-span-4 bg-white rounded-2xl p-6 shadow-sm">
                    <div className="flex items-center justify-between mb-1">
                        <div>
                            <h2
                                className="text-base font-semibold text-zinc-900"
                                style={{ fontFamily: "var(--font-space-grotesk)" }}
                            >
                                Tendencia de Ingresos
                            </h2>
                            <p className="text-xs text-zinc-500 mt-0.5">
                                Análisis de rendimiento semanal
                            </p>
                        </div>
                        <div className="flex gap-1">
                            <button className="px-3 py-1 rounded-full text-xs font-medium bg-emerald-600 text-white">
                                Semana
                            </button>
                            <button className="px-3 py-1 rounded-full text-xs font-medium text-zinc-500 hover:text-zinc-700 transition-colors">
                                Mes
                            </button>
                        </div>
                    </div>
                    <div className="mt-4 h-56 flex items-center justify-center rounded-xl bg-zinc-50">
                        <p className="text-zinc-400 text-sm">El gráfico se activará en v2</p>
                    </div>
                </div>

                {/* Right column — col 5-7 */}
                <div className="col-span-3 space-y-4">
                    {/* Ventas Recientes */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm">
                        <h2
                            className="text-base font-semibold text-zinc-900 mb-4"
                            style={{ fontFamily: "var(--font-space-grotesk)" }}
                        >
                            Ventas Recientes
                        </h2>
                        {recentSales.length === 0 ? (
                            <p className="text-sm text-zinc-400 text-center py-4">
                                No hay ventas registradas aún.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {recentSales.map((sale) => {
                                    const initials = sale.customer
                                        ? sale.customer.name.substring(0, 2).toUpperCase()
                                        : "MO";
                                    return (
                                        <div key={sale.id} className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-zinc-100 flex items-center justify-center text-xs font-medium text-zinc-500 shrink-0">
                                                {initials}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-800 truncate">
                                                    {sale.customer?.name ?? "Mostrador"}
                                                </p>
                                                <p className="text-xs text-zinc-400 truncate">
                                                    {sale.folio} ·{" "}
                                                    {new Date(sale.createdAt).toLocaleTimeString([], {
                                                        hour: "2-digit",
                                                        minute: "2-digit",
                                                    })}
                                                </p>
                                            </div>
                                            <div className="text-right shrink-0">
                                                <p className="text-sm font-semibold text-emerald-700">
                                                    +${Number(sale.total).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                                                </p>
                                                <span
                                                    className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                                                        sale.status === "LAYAWAY"
                                                            ? "bg-amber-100 text-amber-600"
                                                            : "bg-emerald-50 text-emerald-700"
                                                    }`}
                                                >
                                                    {STATUS_LABELS[sale.status as string] ?? sale.status}
                                                </span>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Próximas Órdenes de Taller */}
                    <div className="bg-white rounded-2xl p-5 shadow-sm">
                        <h2
                            className="text-base font-semibold text-zinc-900 mb-4"
                            style={{ fontFamily: "var(--font-space-grotesk)" }}
                        >
                            Próximas Órdenes de Taller
                        </h2>
                        {upcomingOrders.length === 0 ? (
                            <p className="text-sm text-zinc-400 text-center py-4">
                                No hay órdenes activas.
                            </p>
                        ) : (
                            <div className="space-y-3">
                                {upcomingOrders.map((order) => {
                                    const d = new Date(order.createdAt);
                                    const day = d.getDate();
                                    const month = d.toLocaleString("es-MX", { month: "short" }).toUpperCase();
                                    return (
                                        <div key={order.id} className="flex items-center gap-3">
                                            <div className="h-10 w-10 rounded-xl bg-zinc-100 flex flex-col items-center justify-center shrink-0">
                                                <span className="text-[10px] font-medium text-zinc-400 leading-none">
                                                    {month}
                                                </span>
                                                <span className="text-sm font-bold text-zinc-700 leading-tight">
                                                    {day}
                                                </span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-medium text-zinc-800 truncate">
                                                    {order.bikeInfo ?? order.diagnosis ?? order.folio}
                                                </p>
                                                <p className="text-xs text-zinc-400 truncate">
                                                    {order.customer?.name ?? "Sin cliente"} · {order.folio}
                                                </p>
                                            </div>
                                            <span
                                                className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                                                    order.status === "IN_PROGRESS"
                                                        ? "bg-blue-50 text-blue-500"
                                                        : "bg-zinc-100 text-zinc-500"
                                                }`}
                                            >
                                                {WORKSHOP_STATUS_LABELS[order.status as string] ?? order.status}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
