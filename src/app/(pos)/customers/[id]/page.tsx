import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { notFound } from "next/navigation";

type CustomerWithRelations = Prisma.CustomerGetPayload<{
    include: {
        sales: { include: { user: true } };
        serviceOrders: { include: { user: true } };
        bikes: true;
    };
}>;
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ArrowLeft, User, Phone, Mail, Landmark, ShoppingBag, Wrench, FileText } from "lucide-react";
import Link from "next/link";
import { AddBalanceDialog } from "./add-balance-dialog";
import QuotationStatusBadge from "@/components/quotation-status-badge";
import { getEffectiveStatus, formatMXN, formatDate } from "@/lib/quotations";
import { NewOrderDialog } from "@/app/(pos)/workshop/new-order-dialog";

export const dynamic = "force-dynamic";

export default async function CustomerProfilePage(props: {
    params: Promise<{ id: string }>;
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
    const params = await props.params;
    const searchParams = await props.searchParams;
    const customerBikeId = typeof searchParams.customerBikeId === "string" ? searchParams.customerBikeId : undefined;

    const [customer, cotizaciones] = await Promise.all([
        prisma.customer.findUnique({
            where: { id: params.id },
            include: {
                sales: {
                    orderBy: { createdAt: "desc" },
                    include: { user: true }
                },
                serviceOrders: {
                    orderBy: { createdAt: "desc" },
                    include: { user: true }
                },
                bikes: {
                    orderBy: { createdAt: "desc" }
                }
            }
        }) as Promise<CustomerWithRelations | null>,
        prisma.quotation.findMany({
            where: { customerId: params.id },
            select: {
                id: true,
                folio: true,
                total: true,
                status: true,
                validUntil: true,
                createdAt: true,
            },
            orderBy: { createdAt: "desc" },
            take: 20,
        }),
    ]);

    if (!customer) {
        notFound();
    }

    const balance = Number(customer.balance);

    return (
        <div className="space-y-6">
            <div>
                <Button variant="ghost" asChild className="mb-4 text-slate-500 hover:text-slate-900">
                    <Link href="/customers"><ArrowLeft className="mr-2 h-4 w-4" /> Volver al Directorio</Link>
                </Button>
                <div className="flex justify-between items-start">
                    <div>
                        <h1 className="text-3xl font-bold tracking-tight">{customer.name}</h1>
                        <p className="text-slate-500">Perfil unificado del cliente CRM</p>
                    </div>
                    <NewOrderDialog
                        initialCustomer={{
                            id: customer.id,
                            name: customer.name,
                            phone: customer.phone,
                            bikes: customer.bikes.map((b) => ({
                                id: b.id,
                                brand: b.brand,
                                model: b.model,
                                serialNumber: b.serialNumber,
                            })),
                        }}
                        initialCustomerBikeId={customerBikeId}
                        openOnMount={!!customerBikeId}
                    />
                </div>
            </div>

            {/* Top Cards: Info & Balance */}
            <div className="grid gap-4 md:grid-cols-3">
                <Card className="md:col-span-2 shadow-sm border-t-4 border-t-sky-500">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <User className="h-5 w-5 text-sky-500" />
                            Datos Generales
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="grid grid-cols-2 gap-4 text-sm mt-4">
                        <div>
                            <p className="font-semibold text-slate-500 flex items-center gap-2">
                                <Phone className="h-4 w-4" /> Teléfono
                            </p>
                            <p className="mt-1 text-slate-900 dark:text-slate-100">{customer.phone || "No registrado"}</p>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-500 flex items-center gap-2">
                                <Mail className="h-4 w-4" /> Correo
                            </p>
                            <p className="mt-1 text-slate-900 dark:text-slate-100">{customer.email || "No registrado"}</p>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-500">Total de Compras</p>
                            <p className="mt-1 text-slate-900 dark:text-slate-100">{customer.sales.length} transacciones</p>
                        </div>
                        <div>
                            <p className="font-semibold text-slate-500">Unidades Registradas</p>
                            <p className="mt-1 text-slate-900 dark:text-slate-100">{customer.bikes.length} vehículos</p>
                        </div>
                    </CardContent>
                </Card>

                <Card className="shadow-sm border-t-4 border-t-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center justify-between">
                            Saldo a Favor
                            <Landmark className="h-5 w-5 text-emerald-600" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="mt-2 text-center flex flex-col items-center justify-center p-6">
                        <p className="text-4xl font-extrabold text-emerald-600">${balance.toFixed(2)}</p>
                        <p className="text-xs text-slate-500 mt-2">Disponible para Ventas y Apartados</p>
                        <div className="mt-6 w-full">
                            <AddBalanceDialog customerId={customer.id} customerName={customer.name} currentBalance={balance} />
                        </div>
                    </CardContent>
                </Card>
            </div>

            {/* History Tabs */}
            <Tabs defaultValue="sales" className="w-full mt-8">
                <TabsList className="grid w-full md:w-[800px] grid-cols-4 mb-6">
                    <TabsTrigger value="sales" className="flex gap-2">
                        <ShoppingBag className="h-4 w-4" /> Ventas y Apartados
                    </TabsTrigger>
                    <TabsTrigger value="workshop" className="flex gap-2">
                        <Wrench className="h-4 w-4" /> Taller Mecánico
                    </TabsTrigger>
                    <TabsTrigger value="bikes" className="flex gap-2">
                        <span className="font-bold tracking-wider">VIN</span> Unidades Serializadas
                    </TabsTrigger>
                    <TabsTrigger value="cotizaciones" className="flex gap-2">
                        <FileText className="h-4 w-4" /> Cotizaciones
                    </TabsTrigger>
                </TabsList>

                <TabsContent value="sales">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Historial Comercial</CardTitle>
                            <CardDescription>Todas las compras de mostrador y apartados (Layaways).</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Folio</TableHead>
                                        <TableHead>Tipo</TableHead>
                                        <TableHead>Atendió</TableHead>
                                        <TableHead className="text-right">Total</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customer.sales.map((sale) => (
                                        <TableRow key={sale.id}>
                                            <TableCell>{new Date(sale.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-mono text-xs">{sale.folio.slice(0, 8)}</TableCell>
                                            <TableCell>
                                                <Badge variant={sale.status === "LAYAWAY" ? "secondary" : (sale.status === "COMPLETED" ? "default" : "destructive")}>
                                                    {sale.status}
                                                </Badge>
                                            </TableCell>
                                            <TableCell>{sale.user.name}</TableCell>
                                            <TableCell className="text-right font-semibold">${Number(sale.total).toFixed(2)}</TableCell>
                                        </TableRow>
                                    ))}
                                    {customer.sales.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                                                Sin registro de ventas.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="workshop">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Historial de Taller</CardTitle>
                            <CardDescription>Bicicletas ingresadas a servicio y reparaciones documentadas.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Ingreso</TableHead>
                                        <TableHead>Folio</TableHead>
                                        <TableHead>Bicicleta</TableHead>
                                        <TableHead>Estatus</TableHead>
                                        <TableHead className="text-right">Costo Total</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customer.serviceOrders.map((so) => (
                                        <TableRow key={so.id}>
                                            <TableCell>{new Date(so.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-mono text-xs">{so.folio.slice(0, 8)}</TableCell>
                                            <TableCell className="max-w-[200px] truncate" title={so.bikeInfo || ""}>
                                                {so.bikeInfo || "N/A"}
                                            </TableCell>
                                            <TableCell>
                                                <Badge variant="outline">{so.status}</Badge>
                                            </TableCell>
                                            <TableCell className="text-right font-semibold">${Number(so.total).toFixed(2)}</TableCell>
                                            <TableCell className="text-right">
                                                <Button variant="ghost" size="sm" asChild>
                                                    <Link href={`/workshop/${so.id}`}>Ver Orden</Link>
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                    {customer.serviceOrders.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={6} className="text-center text-slate-500 py-8">
                                                Sin registro de reparaciones.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="bikes">
                    <Card className="shadow-sm border-t-4 border-t-amber-500">
                        <CardHeader>
                            <CardTitle>Unidades Serializadas (Bicicletas / Scooters)</CardTitle>
                            <CardDescription>Vehículos registrados a nombre de este cliente por venta o ingreso a taller.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Fecha de Registro</TableHead>
                                        <TableHead>Marca y Modelo</TableHead>
                                        <TableHead>Número de Serie / VIN</TableHead>
                                        <TableHead>Notas</TableHead>
                                        <TableHead className="text-right">Color</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {customer.bikes.map((bike) => (
                                        <TableRow key={bike.id} className="bg-amber-50/10">
                                            <TableCell>{new Date(bike.createdAt).toLocaleDateString()}</TableCell>
                                            <TableCell className="font-semibold">{bike.brand} {bike.model}</TableCell>
                                            <TableCell>
                                                <Badge variant="outline" className="font-mono bg-white">{bike.serialNumber}</Badge>
                                            </TableCell>
                                            <TableCell className="text-slate-500 text-sm max-w-[200px] truncate">{bike.notes || "-"}</TableCell>
                                            <TableCell className="text-right">{bike.color || "-"}</TableCell>
                                        </TableRow>
                                    ))}
                                    {customer.bikes.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                                                No hay unidades registradas para este cliente.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value="cotizaciones">
                    <Card className="shadow-sm">
                        <CardHeader>
                            <CardTitle>Cotizaciones</CardTitle>
                            <CardDescription>Últimas 20 cotizaciones emitidas para este cliente.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Folio</TableHead>
                                        <TableHead>Fecha</TableHead>
                                        <TableHead>Total</TableHead>
                                        <TableHead>Estado</TableHead>
                                        <TableHead></TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {cotizaciones.map((cot) => {
                                        const effectiveStatus = getEffectiveStatus({
                                            status: cot.status,
                                            validUntil: cot.validUntil,
                                        });
                                        return (
                                            <TableRow key={cot.id}>
                                                <TableCell className="font-mono text-xs font-semibold">{cot.folio}</TableCell>
                                                <TableCell className="text-sm">{formatDate(cot.createdAt)}</TableCell>
                                                <TableCell className="font-semibold">{formatMXN(Number(cot.total))}</TableCell>
                                                <TableCell>
                                                    <QuotationStatusBadge status={effectiveStatus} />
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button variant="ghost" size="sm" asChild>
                                                        <Link href={`/cotizaciones/${cot.id}`}>Ver cotización</Link>
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        );
                                    })}
                                    {cotizaciones.length === 0 && (
                                        <TableRow>
                                            <TableCell colSpan={5} className="text-center text-slate-500 py-8">
                                                Este cliente no tiene cotizaciones.
                                            </TableCell>
                                        </TableRow>
                                    )}
                                </TableBody>
                            </Table>
                        </CardContent>
                    </Card>
                </TabsContent>
            </Tabs>
        </div>
    );
}
