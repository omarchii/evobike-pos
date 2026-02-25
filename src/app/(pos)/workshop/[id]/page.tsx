import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ServiceOrderDetailsView } from "./service-order-details";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default async function WorkshopOrderPage(props: {
    params: Promise<{ id: string }>
}) {
    const params = await props.params;

    const order = await prisma.serviceOrder.findUnique({
        where: { id: params.id },
        include: {
            customer: true,
            items: {
                include: { product: true }
            },
            user: true, // Technician
        }
    });

    if (!order) {
        notFound();
    }

    // Fetch active products to allow mechanic to add parts from inventory
    const products = await prisma.product.findMany({
        orderBy: { name: "asc" }
    });

    // Convert Decimals
    const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        total: Number(order.total),
        items: order.items.map(i => ({
            ...i,
            price: Number(i.price),
            product: i.product ? {
                ...i.product,
                price: Number(i.product.price),
                cost: Number(i.product.cost)
            } : null
        }))
    };

    const serializedProducts = products.map(p => ({
        ...p,
        price: Number(p.price),
        cost: Number(p.cost)
    }));

    return (
        <div className="flex flex-col gap-6">
            <div>
                <Button variant="ghost" asChild className="mb-4 text-slate-500 hover:text-slate-900">
                    <Link href="/workshop"><ArrowLeft className="mr-2 h-4 w-4" /> Volver al Tablero</Link>
                </Button>
                <h1 className="text-3xl font-bold tracking-tight">Orden de Servicio {order.folio}</h1>
            </div>

            <ServiceOrderDetailsView order={serializedOrder as any} catalogProducts={serializedProducts} />
        </div>
    );
}
