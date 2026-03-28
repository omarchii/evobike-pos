import { prisma } from "@/lib/prisma";
import ReceiptsTerminal from "./receipts-terminal";

export const dynamic = "force-dynamic";

export default async function ReceiptsPage() {
    const rawProducts = await prisma.modeloConfiguracion.findMany({
        include: {
            stocks: {
                include: { branch: true }
            },
            modelo: true,
            color: true,
            voltaje: true
        },
        orderBy: { sku: 'asc' }
    });

    // Serialize Decimals for Client Component
    const products = rawProducts.map(p => ({
        ...p,
        name: `${p.modelo.nombre} ${p.color.nombre} ${p.voltaje.label}`,
        price: Number(p.precio),
        cost: Number(p.costo)
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
