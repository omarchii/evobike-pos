import { prisma } from "@/lib/prisma";
import PosTerminal from "./pos-terminal";

export const dynamic = "force-dynamic";

export default async function PointOfSalePage() {
    // Fetch active products to populate the POS catalog/search
    const rawProducts = await prisma.product.findMany({
        include: {
            stocks: {
                include: {
                    branch: true,
                }
            }
        },
        orderBy: { name: 'asc' }
    });

    const products = rawProducts.map(p => ({
        ...p,
        price: Number(p.price),
        cost: Number(p.cost),
    }));

    const customers = await prisma.customer.findMany({
        orderBy: { name: 'asc' }
    });

    // Convert decimal balances 
    const serializedCustomers = customers.map(c => ({
        ...c,
        creditLimit: Number(c.creditLimit),
        balance: Number(c.balance)
    }));

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <div className="mb-4">
                <h1 className="text-3xl font-bold tracking-tight">Punto de Venta</h1>
                <p className="text-slate-500">Agrega productos al carrito y procesa la venta.</p>
            </div>

            {/* We pass the serialized products to the interactive Client Component */}
            <PosTerminal initialProducts={products} customers={serializedCustomers as any} />
        </div>
    );
}
