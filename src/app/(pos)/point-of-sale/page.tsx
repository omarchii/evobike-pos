import { prisma } from "@/lib/prisma";
import PosTerminal from "./pos-terminal";

export const dynamic = "force-dynamic";

export default async function PointOfSalePage() {
    const rawProducts = await prisma.modeloConfiguracion.findMany({
        include: {
            modelo: true,
            color: true,
            voltaje: true,
            stocks: {
                include: {
                    branch: true,
                }
            }
        },
        orderBy: { sku: 'asc' }
    });

    const products = rawProducts.map((p: any) => ({
        ...p,
        name: `${p.modelo.nombre} ${p.color.nombre} ${p.voltaje.label}`,
        price: Number(p.precio),
        cost: Number(p.costo),
        precioDistribuidor: p.precioDistribuidor ? Number(p.precioDistribuidor) : null,
        precioDistribuidorConfirmado: p.precioDistribuidorConfirmado,
        color: p.color.nombre,
        voltage: p.voltaje.label,
        imageUrl: p.modelo.imageUrl || null,
        baseProductId: p.modelo.id,
        baseProduct: p.modelo,
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
