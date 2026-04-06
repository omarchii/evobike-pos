import { prisma } from "@/lib/prisma";
import WorkshopBoard from "./workshop-board";
import { NewOrderDialog } from "./new-order-dialog";

export const dynamic = "force-dynamic";

export default async function WorkshopPage() {
    // Fetch open service orders and their items/customer
    const serviceOrders = await prisma.serviceOrder.findMany({
        where: {
            status: {
                notIn: ["DELIVERED", "CANCELLED"], // Only active ones for the Kanban board
            }
        },
        include: {
            customer: true,
            items: true,
            user: true, // Technician/Seller
        },
        orderBy: {
            createdAt: "desc"
        }
    });

    const serializedOrders = serviceOrders.map(so => ({
        ...so,
        subtotal: Number(so.subtotal),
        total: Number(so.total),
        customer: {
            ...so.customer,
            creditLimit: Number(so.customer.creditLimit),
            balance: Number(so.customer.balance)
        },
        items: so.items.map(i => ({
            ...i,
            price: Number(i.price)
        }))
    }));

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Taller Mecánico</h1>
                    <p className="text-slate-500">Gestiona las bicicletas y reparaciones activas.</p>
                </div>
                <NewOrderDialog />
            </div>

            {/* Client Component Kanban Board */}
            <WorkshopBoard initialOrders={serializedOrders} />
        </div>
    );
}
