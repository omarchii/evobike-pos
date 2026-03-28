import { prisma } from "@/lib/prisma";
import LayawayList from "./layaway-list";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function LayawaysPage() {
    const session = await getServerSession(authOptions);
    const branchId = (session?.user as any)?.branchId;

    if (!branchId) return <div>No tienes sucursal asignada</div>;

    const layaways = await prisma.sale.findMany({
        where: {
            branchId: branchId,
            status: "LAYAWAY"
        },
        include: {
            customer: true,
            payments: true,
            items: {
                include: {
                    productVariant: {
                        include: {
                            modelo: true,
                            color: true,
                            voltaje: true
                        }
                    }
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    // Serialize decimal fields
    const serializedLayaways = layaways.map((l: any) => {
        const totalPayments = l.payments.reduce((acc: number, p: any) => acc + Number(p.amount), 0);
        return {
            ...l,
            subtotal: Number(l.subtotal),
            total: Number(l.total),
            totalPaid: totalPayments,
            customer: l.customer ? {
                ...l.customer,
                creditLimit: Number(l.customer.creditLimit),
                balance: Number(l.customer.balance)
            } : null,
            payments: l.payments.map((p: any) => ({
                ...p,
                amount: Number(p.amount)
            })),
            items: l.items.map((i: any) => ({
                ...i,
                price: Number(i.price),
                discount: Number(i.discount),
                productVariant: i.productVariant ? {
                    ...i.productVariant,
                    precioPublico: Number(i.productVariant.precioPublico),
                    costo: Number(i.productVariant.costo)
                } : null,
                product: i.productVariant ? {
                    name: `${i.productVariant.modelo.nombre} ${i.productVariant.color.nombre} ${i.productVariant.voltaje.label}`
                } : { name: i.description || "Producto" }
            }))
        };
    });

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Cuentas de Apartados</h1>
                    <p className="text-slate-500">Gestiona los pagos parciales y abonos de clientes.</p>
                </div>
            </div>

            <LayawayList initialLayaways={serializedLayaways as any} />
        </div>
    );
}
