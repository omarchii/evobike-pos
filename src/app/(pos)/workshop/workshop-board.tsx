"use client";

import React, { useState } from "react";
import { ServiceOrder, Customer, ServiceOrderItem, User, ServiceOrderStatus } from "@prisma/client";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Wrench, Clock, CheckCircle2, Bike, ArrowRight, Filter } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { formatMXN } from "@/lib/quotations";

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

interface WorkshopBoardProps {
    initialOrders: FullServiceOrder[];
    currentUserId: string;
    currentUserRole: string;
}

const COLUMNS: { id: ServiceOrderStatus; title: string; icon: React.ElementType; color: string; bg: string }[] = [
    { id: "PENDING", title: "En Espera", icon: Clock, color: "text-amber-500", bg: "bg-[var(--warn-container)]" },
    { id: "IN_PROGRESS", title: "En Reparación", icon: Wrench, color: "text-blue-500", bg: "bg-blue-50 dark:bg-blue-950/30" },
    { id: "COMPLETED", title: "Listo p/ Entrega", icon: CheckCircle2, color: "text-[var(--sec)]", bg: "bg-[var(--sec-container)]" },
];

const AGE_OPTIONS = [
    { label: "Todas", minDays: 0 },
    { label: "> 1 día", minDays: 1 },
    { label: "> 3 días", minDays: 3 },
    { label: "> 7 días", minDays: 7 },
] as const;

function getDaysInColumn(order: FullServiceOrder): number {
    const ref = order.status === "PENDING" ? order.createdAt : order.updatedAt;
    const ms = Date.now() - new Date(ref).getTime();
    return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function getInitials(name: string): string {
    return name
        .split(" ")
        .slice(0, 2)
        .map(w => w[0])
        .join("")
        .toUpperCase();
}

const SELECT_STYLE: React.CSSProperties = {
    background: "var(--surf-low)",
    border: "none",
    borderRadius: "var(--r-full)",
    color: "var(--on-surf)",
    fontFamily: "var(--font-body)",
    fontSize: "0.75rem",
    fontWeight: 500,
    height: 32,
    paddingLeft: "0.75rem",
    paddingRight: "1.75rem",
    appearance: "none",
    WebkitAppearance: "none",
    cursor: "pointer",
};

export default function WorkshopBoard({ initialOrders, currentUserId, currentUserRole }: WorkshopBoardProps) {
    const router = useRouter();
    const [orders, setOrders] = useState<FullServiceOrder[]>(initialOrders);
    const [movingId, setMovingId] = useState<string | null>(null);

    // Filters
    const [technicianFilter, setTechnicianFilter] = useState<string>("ALL");
    const [ageFilter, setAgeFilter] = useState<number>(0);
    const [onlyMine, setOnlyMine] = useState(false);

    // Unique technicians from orders
    const technicians = Array.from(
        new Map(orders.map(o => [o.user.id, o.user.name])).entries()
    );

    // Apply filters
    const filteredOrders = orders.filter((o) => {
        if (technicianFilter !== "ALL" && o.userId !== technicianFilter) return false;
        if (ageFilter > 0 && getDaysInColumn(o) < ageFilter) return false;
        if (onlyMine && o.userId !== currentUserId) return false;
        return true;
    });

    const hasActiveFilters = technicianFilter !== "ALL" || ageFilter > 0 || onlyMine;

    const moveOrder = async (orderId: string, currentStatus: ServiceOrderStatus) => {
        setMovingId(orderId);
        toast.loading("Avanzando orden...", { id: `move-${orderId}` });

        const result = await fetch(`/api/workshop/orders/${orderId}/status`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ currentStatus }),
        }).then((r) => r.json() as Promise<{ success: boolean; data?: { newStatus: ServiceOrderStatus }; error?: string }>);

        if (result.success) {
            toast.success("Bicicleta avanzada", { id: `move-${orderId}` });
            setOrders(orders.map(o => o.id === orderId ? { ...o, status: result.data!.newStatus } : o));
            router.refresh();
        } else {
            toast.error(result.error || "No se pudo avanzar", { id: `move-${orderId}` });
        }
        setMovingId(null);
    };

    return (
        <div className="flex-1 flex flex-col gap-3 overflow-hidden">
            {/* Filter bar */}
            <div className="flex items-center gap-3 flex-wrap">
                <Filter className="h-3.5 w-3.5 text-[var(--on-surf-var)]" />

                {/* Technician filter */}
                <div className="relative">
                    <select
                        value={technicianFilter}
                        onChange={(e) => setTechnicianFilter(e.target.value)}
                        style={SELECT_STYLE}
                    >
                        <option value="ALL">Todos los técnicos</option>
                        {technicians.map(([id, name]) => (
                            <option key={id} value={id}>{name}</option>
                        ))}
                    </select>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surf-var)]">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                </div>

                {/* Age filter */}
                <div className="relative">
                    <select
                        value={ageFilter}
                        onChange={(e) => setAgeFilter(Number(e.target.value))}
                        style={SELECT_STYLE}
                    >
                        {AGE_OPTIONS.map((opt) => (
                            <option key={opt.minDays} value={opt.minDays}>{opt.label}</option>
                        ))}
                    </select>
                    <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-[var(--on-surf-var)]">
                        <svg width="10" height="6" viewBox="0 0 10 6" fill="none"><path d="M1 1L5 5L9 1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </span>
                </div>

                {/* "Solo mis órdenes" toggle — only for TECHNICIAN */}
                {currentUserRole === "TECHNICIAN" && (
                    <button
                        type="button"
                        onClick={() => setOnlyMine(!onlyMine)}
                        className={`text-xs font-medium px-3 h-8 rounded-full transition-colors ${
                            onlyMine
                                ? "bg-[var(--p)] text-[var(--on-p)]"
                                : "bg-[var(--surf-low)] text-[var(--on-surf-var)] hover:bg-[var(--surf-high)]"
                        }`}
                    >
                        Solo mis órdenes
                    </button>
                )}

                {/* Clear filters */}
                {hasActiveFilters && (
                    <button
                        type="button"
                        onClick={() => { setTechnicianFilter("ALL"); setAgeFilter(0); setOnlyMine(false); }}
                        className="text-[11px] font-medium text-[var(--p)] hover:text-[var(--p-mid)] transition-colors ml-auto"
                    >
                        Limpiar filtros
                    </button>
                )}
            </div>

            {/* Kanban columns — or editorial empty state */}
            {filteredOrders.length === 0 ? (
                <div
                    className="flex-1 flex flex-col items-center justify-center text-center px-6 rounded-[var(--r-lg)]"
                    style={{ background: "var(--surf-low)" }}
                >
                    {/* Icon — accent wrench, no overlay */}
                    <div
                        className="h-16 w-16 rounded-full flex items-center justify-center mb-5"
                        style={{ background: "rgba(46, 204, 113, 0.12)" }}
                    >
                        {hasActiveFilters
                            ? <Filter className="h-7 w-7" style={{ color: "#2ECC71" }} />
                            : <Wrench className="h-7 w-7" style={{ color: "#2ECC71" }} />
                        }
                    </div>

                    {/* Title — Space Grotesk */}
                    <p
                        className="text-xl font-bold text-[var(--on-surf)] tracking-[-0.02em]"
                        style={{ fontFamily: "var(--font-display)" }}
                    >
                        {hasActiveFilters ? "Sin resultados" : "Taller al día"}
                    </p>

                    {/* Subtitle — Inter */}
                    <p className="text-sm text-[var(--on-surf-var)] mt-2 max-w-sm leading-relaxed">
                        {hasActiveFilters
                            ? "Ninguna orden coincide con los filtros seleccionados. Prueba ajustar los criterios."
                            : "No hay bicicletas en reparación. Las nuevas órdenes aparecerán aquí automáticamente."
                        }
                    </p>
                </div>
            ) : (
            <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 overflow-hidden">
                {COLUMNS.map((column) => {
                    const columnOrders = filteredOrders.filter((o) => o.status === column.id);

                    return (
                        <div
                            key={column.id}
                            className="flex flex-col rounded-[var(--r-lg)] overflow-hidden bg-[var(--surf-lowest)]"
                            style={{ boxShadow: "var(--shadow)" }}
                        >
                            {/* Column Header */}
                            <div className={`px-4 py-3 ${column.bg} flex items-center justify-between`}>
                                <div className="flex items-center gap-2 font-semibold text-sm text-[var(--on-surf)]">
                                    <column.icon className={`h-4 w-4 ${column.color}`} />
                                    {column.title}
                                </div>
                                <span
                                    className="text-xs font-bold text-[var(--on-surf-var)] bg-white/50 dark:bg-white/10 rounded-full px-2 py-0.5"
                                >
                                    {columnOrders.length}
                                </span>
                            </div>

                            {/* Column Body */}
                            <ScrollArea className="flex-1 p-3">
                                <div className="space-y-3">
                                    {columnOrders.map((order) => {
                                        const days = getDaysInColumn(order);
                                        const isStale = days > 3;

                                        return (
                                            <div
                                                key={order.id}
                                                className="rounded-[var(--r-md)] bg-[var(--surf-low)] p-4 space-y-3"
                                            >
                                                {/* Row 1: Folio + days chip */}
                                                <div className="flex items-center justify-between">
                                                    <Link
                                                        href={`/workshop/${order.id}`}
                                                        className="text-xs font-semibold text-[var(--p)] hover:text-[var(--p-mid)] transition-colors tracking-wide"
                                                    >
                                                        {order.folio}
                                                    </Link>
                                                    {days >= 1 && (
                                                        <span
                                                            className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                                                isStale
                                                                    ? "bg-[var(--ter-container)] text-[var(--on-ter-container)]"
                                                                    : "bg-[var(--surf-high)] text-[var(--on-surf-var)]"
                                                            }`}
                                                        >
                                                            {days}d
                                                        </span>
                                                    )}
                                                </div>

                                                {/* Row 2: Bike info */}
                                                <div className="flex items-start gap-2">
                                                    <Bike className="h-3.5 w-3.5 mt-0.5 text-[var(--on-surf-var)] shrink-0" />
                                                    <span className="text-sm font-medium text-[var(--on-surf)] line-clamp-2 leading-tight">
                                                        {order.bikeInfo || "Bicicleta sin detalles"}
                                                    </span>
                                                </div>

                                                {/* Row 3: Customer + technician avatar */}
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs text-[var(--on-surf-var)] truncate max-w-[70%]">
                                                        {order.customer.name}
                                                    </span>
                                                    <div
                                                        className="h-6 w-6 rounded-full flex items-center justify-center text-[9px] font-semibold bg-[var(--p-container)] text-[var(--on-p-container)]"
                                                        title={order.user.name}
                                                    >
                                                        {getInitials(order.user.name)}
                                                    </div>
                                                </div>

                                                {/* Row 4: Diagnosis (if present) */}
                                                {order.diagnosis && (
                                                    <p className="text-[11px] text-[var(--on-surf-var)] italic line-clamp-2 leading-relaxed">
                                                        &ldquo;{order.diagnosis}&rdquo;
                                                    </p>
                                                )}

                                                {/* Row 5: Chips + action */}
                                                <div className="flex items-center justify-between pt-1">
                                                    <div className="flex items-center gap-1.5 flex-wrap">
                                                        {order.prepaid ? (
                                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 uppercase tracking-wider">
                                                                Pre-pagado
                                                            </span>
                                                        ) : order.total > 0 ? (
                                                            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-[var(--warn-container)] text-[var(--warn)] uppercase tracking-wider">
                                                                {formatMXN(order.total)}
                                                            </span>
                                                        ) : null}
                                                    </div>

                                                    <div className="flex items-center gap-1.5">
                                                        {column.id !== "COMPLETED" && (
                                                            <Button
                                                                size="sm"
                                                                disabled={movingId === order.id}
                                                                className="h-7 text-[11px] px-3 rounded-full bg-[var(--surf-high)] hover:bg-[var(--surf-highest)] text-[var(--on-surf)]"
                                                                onClick={() => moveOrder(order.id, column.id)}
                                                            >
                                                                {movingId === order.id ? "..." : "Avanzar"}
                                                                <ArrowRight className="h-3 w-3 ml-1" />
                                                            </Button>
                                                        )}
                                                        {column.id === "COMPLETED" && (
                                                            <Button
                                                                size="sm"
                                                                className="h-7 text-[11px] px-3 rounded-full text-white"
                                                                style={{ background: "linear-gradient(135deg, #1b4332, #2ecc71)" }}
                                                                asChild
                                                            >
                                                                <Link href={`/workshop/${order.id}`}>
                                                                    Entregar
                                                                </Link>
                                                            </Button>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}

                                    {columnOrders.length === 0 && (
                                        <div className="h-32 flex flex-col items-center justify-center text-[var(--on-surf-var)] opacity-50">
                                            <column.icon className="h-6 w-6 mb-2" />
                                            <p className="text-xs">Sin pendientes</p>
                                        </div>
                                    )}
                                </div>
                            </ScrollArea>
                        </div>
                    );
                })}
            </div>
            )}
        </div>
    );
}
