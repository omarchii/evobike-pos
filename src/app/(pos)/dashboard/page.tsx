import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Banknote, Users, Wrench, ArchiveRestore, Activity } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
    const session = await getServerSession(authOptions);
    const branchId = (session?.user as any)?.branchId;

    // Dates for filtering "Today"
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const endOfToday = new Date();
    endOfToday.setHours(23, 59, 59, 999);

    // 1. Sales Today (Sum)
    const salesTodayAgg = await prisma.sale.aggregate({
        where: {
            branchId: branchId,
            createdAt: {
                gte: startOfToday,
                lte: endOfToday,
            },
            status: "COMPLETED"
        },
        _sum: {
            total: true
        }
    });
    const revenueToday = Number(salesTodayAgg._sum.total || 0);

    // 2. Active Service Orders
    const activeWorkshopCount = await prisma.serviceOrder.count({
        where: {
            branchId: branchId,
            status: { in: ["PENDING", "IN_PROGRESS"] }
        }
    });

    // 3. Active Layaways
    const activeLayawaysCount = await prisma.sale.count({
        where: {
            branchId: branchId,
            status: "LAYAWAY"
        }
    });

    // 4. Total Costumers
    const totalCustomersCount = await prisma.customer.count();

    // 5. Recent Activity (Last 5 Sales)
    const recentSales = await prisma.sale.findMany({
        where: { branchId: branchId },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: { customer: true, user: true }
    });

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Panel de Control</h1>
                    <p className="text-slate-500">Resumen operativo para {(session?.user as any)?.branchName || 'la Sucursal Actual'}</p>
                </div>
            </div>

            {/* TOP METRICS */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                <Card className="border-t-4 border-t-emerald-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">
                            Ingresos del Día
                        </CardTitle>
                        <Banknote className="h-4 w-4 text-emerald-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">${revenueToday.toFixed(2)}</div>
                        <p className="text-xs text-slate-400 mt-1">
                            Ventas cobradas hoy
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-violet-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">
                            Taller Activo
                        </CardTitle>
                        <Wrench className="h-4 w-4 text-violet-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{activeWorkshopCount}</div>
                        <p className="text-xs text-slate-400 mt-1">
                            Órdenes Pendientes/Proceso
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-amber-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">
                            Apartados Activos
                        </CardTitle>
                        <ArchiveRestore className="h-4 w-4 text-amber-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{activeLayawaysCount}</div>
                        <p className="text-xs text-slate-400 mt-1">
                            Tickets por liquidar
                        </p>
                    </CardContent>
                </Card>

                <Card className="border-t-4 border-t-sky-500 shadow-sm">
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-slate-500">
                            Clientes (CRM)
                        </CardTitle>
                        <Users className="h-4 w-4 text-sky-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-slate-700 dark:text-slate-200">{totalCustomersCount}</div>
                        <p className="text-xs text-slate-400 mt-1">
                            Contactos registrados
                        </p>
                    </CardContent>
                </Card>
            </div>

            {/* RECENT ACTIVITY & CHARTS */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
                <Card className="col-span-4 shadow-sm">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-lg">
                            <Activity className="h-5 w-5 text-emerald-500" />
                            Rendimiento Semanal
                        </CardTitle>
                        <CardDescription>
                            Visualización de ventas de los últimos 7 días.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="pl-2">
                        <div className="h-[250px] w-full flex items-center justify-center border-2 border-dashed border-slate-100 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/50">
                            {/* Placeholder for future Recharts/Tremor Integration */}
                            <p className="text-slate-400 text-sm">El gráfico de barras se activará en la v2.</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="col-span-3 shadow-sm">
                    <CardHeader>
                        <CardTitle className="text-lg">Ventas Recientes</CardTitle>
                        <CardDescription>
                            Últimas {recentSales.length} transacciones generadas.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-6">
                            {recentSales.map(sale => (
                                <div key={sale.id} className="flex items-center">
                                    <div className="ml-4 space-y-1 overflow-hidden">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-medium leading-none truncate w-[150px]">
                                                {sale.customer ? sale.customer.name : "Mostrador"}
                                            </p>
                                            <Badge variant={sale.status === "LAYAWAY" ? "secondary" : "default"} className="text-[10px] h-4">
                                                {sale.status === "LAYAWAY" ? "APARTADO" : "VENTA"}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {sale.folio} • {new Date(sale.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </p>
                                    </div>
                                    <div className="ml-auto font-bold text-emerald-600">
                                        +${Number(sale.total).toFixed(2)}
                                    </div>
                                </div>
                            ))}
                            {recentSales.length === 0 && (
                                <p className="text-sm text-slate-500 text-center py-4">No hay ventas registradas aún.</p>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
