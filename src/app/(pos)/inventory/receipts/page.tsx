import { prisma } from "@/lib/prisma";
import ReceiptsTerminal from "./receipts-terminal";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
    const rawProducts = await prisma.product.findMany({
        include: {
            stocks: {
                include: { branch: true }
            }
        },
        orderBy: { name: 'asc' }
    });

    // Serialize Decimals for Client Component
    const products = rawProducts.map(p => ({
        ...p,
        price: Number(p.price),
        cost: Number(p.cost)
    }));

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <div className="mb-4">
                <h1 className="text-2xl font-bold tracking-tight">Recepción de Mercancía</h1>
                <p className="text-slate-500 text-sm mt-1">Ingresa nuevos productos al inventario de tu sucursal.</p>
            </div>

            <ReceiptsTerminal initialProducts={products as any} />
        </div>
    );
}
