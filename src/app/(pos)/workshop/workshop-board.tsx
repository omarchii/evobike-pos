"use client";

import React, { useState } from "react";
import { ServiceOrder, Customer, ServiceOrderItem, User, ServiceOrderStatus } from "@prisma/client";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Wrench, Clock, CheckCircle2, Bike, User as UserIcon, ArrowRight } from "lucide-react";
import { updateServiceOrderStatus } from "@/actions/workshop";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";

type FullServiceOrder = Omit<ServiceOrder, "subtotal" | "total"> & {
    subtotal: number;
    total: number;
    customer: Omit<Customer, "creditLimit" | "balance"> & {
        creditLimit: number;
        balance: number;
    };
    items: (Omit<ServiceOrderItem, "price"> & { price: number })[];
    user: User;
};

const COLUMNS: { id: ServiceOrderStatus; title: string; icon: React.ElementType; color: string; bg: string; borderColor: string }[] = [
    { id: "PENDING", title: "En Espera", icon: Clock, color: "text-amber-500", bg: "bg-amber-50 dark:bg-amber-950/30", borderColor: "border-amber-200" },
    { id: "IN_PROGRESS", title: "En Reparación", icon: Wrench, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-200" },
    { id: "COMPLETED", title: "Listo p/ Entrega", icon: CheckCircle2, color: "text-emerald-500", bg: "bg-emerald-50 dark:bg-emerald-950/30", borderColor: "border-emerald-200" },
];

export default function WorkshopBoard({ initialOrders }: { initialOrders: FullServiceOrder[] }) {
    const router = useRouter();
    const [orders, setOrders] = useState<FullServiceOrder[]>(initialOrders);
    const [movingId, setMovingId] = useState<string | null>(null);

    const moveOrder = async (orderId: string, currentStatus: ServiceOrderStatus) => {
        setMovingId(orderId);
        toast.loading("Avanzando orden...", { id: `move-${orderId}` });

        const result = await updateServiceOrderStatus(orderId, currentStatus);

        if (result.success) {
            toast.success("Bicicleta avanzada", { id: `move-${orderId}` });
            // Optimistic update
            setOrders(orders.map(o => o.id === orderId ? { ...o, status: result.newStatus! } : o));
            router.refresh();
        } else {
            toast.error(result.error || "No se pudo avanzar", { id: `move-${orderId}` });
        }
        setMovingId(null);
    };

    return (
        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden">
            {COLUMNS.map((column) => {
                const columnOrders = orders.filter((o) => o.status === column.id);

                return (
                    <div key={column.id} className={`flex flex-col rounded-xl border bg-white dark:bg-slate-950 shadow-sm overflow-hidden`}>
                        {/* Column Header */}
                        <div className={`p-4 border-b ${column.bg} flex items-center justify-between`}>
                            <div className="flex items-center gap-2 font-semibold">
                                <column.icon className={`h-5 w-5 ${column.color}`} />
                                {column.title}
                            </div>
                            <Badge variant="secondary" className="bg-white/50">{columnOrders.length}</Badge>
                        </div>

                        {/* Column Body / Droppable Area */}
                        <ScrollArea className="flex-1 p-3">
                            <div className="space-y-3">
                                {columnOrders.map((order) => (
                                    <Card key={order.id} className={`shadow-sm border-l-4 ${column.borderColor}`}>
                                        <CardHeader className="p-4 pb-2">
                                            <div className="flex justify-between items-start">
                                                <Badge variant="outline" className="text-xs bg-slate-50">{order.folio}</Badge>
                                                <span className="text-xs text-slate-400 font-medium">
                                                    {new Date(order.createdAt).toLocaleDateString()}
                                                </span>
                                            </div>
                                            <CardTitle className="text-base mt-2 flex items-start gap-2">
                                                <Bike className="h-4 w-4 mt-0.5 text-slate-400 shrink-0" />
                                                <span className="line-clamp-2 leading-tight">{order.bikeInfo || "Bicicleta sin detalles"}</span>
                                            </CardTitle>
                                        </CardHeader>
                                        <CardContent className="p-4 py-2 text-sm text-slate-600 dark:text-slate-400 space-y-2">
                                            <div className="flex items-center gap-2">
                                                <UserIcon className="h-3.5 w-3.5 shrink-0" />
                                                <span className="truncate">{order.customer.name}</span>
                                            </div>
                                            {order.diagnosis && (
                                                <div className="bg-slate-50 dark:bg-slate-900 p-2 rounded text-xs line-clamp-2 italic">
                                                    &quot;{order.diagnosis}&quot;
                                                </div>
                                            )}
                                        </CardContent>
                                        <CardFooter className="p-3 pt-0 flex justify-end gap-2">
                                            <Button variant="ghost" size="sm" className="text-xs h-8" asChild>
                                                <Link href={`/workshop/${order.id}`}>Ver Detalles</Link>
                                            </Button>

                                            {column.id !== "COMPLETED" && (
                                                <Button
                                                    size="sm"
                                                    disabled={movingId === order.id}
                                                    className="h-8 text-xs bg-slate-100 hover:bg-slate-200 text-slate-900"
                                                    onClick={() => moveOrder(order.id, column.id)}
                                                >
                                                    {movingId === order.id ? "Cargando..." : "Avanzar"} <ArrowRight className="h-3 w-3 ml-1" />
                                                </Button>
                                            )}
                                            {column.id === "COMPLETED" && (
                                                <Button
                                                    size="sm"
                                                    className="h-8 text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
                                                >
                                                    Entregar
                                                </Button>
                                            )}
                                        </CardFooter>
                                    </Card>
                                ))}

                                {columnOrders.length === 0 && (
                                    <div className="h-32 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed rounded-lg">
                                        <p className="text-sm">Sin pendientes</p>
                                    </div>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                );
            })}
        </div>
    );
}
