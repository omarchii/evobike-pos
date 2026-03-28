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
                include: {
                    productVariant: {
                        include: {
                            modelo: true,
                            color: true,
                            voltaje: true
                        }
                    }
                }
            },
            user: true, // Technician
        }
    });

    if (!order) {
        notFound();
    }

    // Fetch active products to allow mechanic to add parts from inventory
    const products = await prisma.productVariant.findMany({
        include: {
            modelo: true,
            color: true,
            voltaje: true
        },
        orderBy: { sku: "asc" }
    });

    // Convert Decimals
    const serializedOrder = {
        ...order,
        subtotal: Number(order.subtotal),
        total: Number(order.total),
        items: order.items.map((i: any) => ({
            ...i,
            price: Number(i.price),
            productVariant: i.productVariant ? {
                ...i.productVariant,
                precioPublico: Number(i.productVariant.precioPublico),
                costo: Number(i.productVariant.costo)
            } : null
        }))
    };

    const serializedProducts = products.map((p: any) => ({
        ...p,
        name: `${p.modelo.nombre} ${p.color.nombre} ${p.voltaje.label}`,
        price: Number(p.precioPublico),
        cost: Number(p.costo)
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
