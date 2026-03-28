import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { ServiceOrderDetailsView } from "./service-order-details";
import type { FullSerializedOrder, SerializedProduct, SerializedOrderItem } from "./service-order-details";
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
            customerBike: {
                select: {
                    serialNumber: true,
                    voltaje: true,
                    brand: true,
                    model: true,
                    color: true
                }
            },
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
    const serializedOrder: FullSerializedOrder = {
        id: order.id,
        folio: order.folio,
        status: order.status,
        customerId: order.customerId,
        bikeInfo: order.bikeInfo,
        diagnosis: order.diagnosis,
        subtotal: Number(order.subtotal),
        total: Number(order.total),
        createdAt: order.createdAt,
        customer: order.customer,
        user: order.user,
        customerBike: order.customerBike ?? null,
        items: order.items.map((i): SerializedOrderItem => ({
            id: i.id,
            serviceOrderId: i.serviceOrderId,
            productVariantId: i.productVariantId,
            description: i.description,
            quantity: i.quantity,
            price: Number(i.price),
            productVariant: i.productVariant ? {
                id: i.productVariant.id,
                sku: i.productVariant.sku,
                name: `${i.productVariant.modelo.nombre} ${i.productVariant.color.nombre} ${i.productVariant.voltaje.label}`,
                price: Number(i.productVariant.precioPublico),
                cost: Number(i.productVariant.costo)
            } : null
        }))
    };

    const serializedProducts: SerializedProduct[] = products.map((p) => ({
        id: p.id,
        sku: p.sku,
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

            <ServiceOrderDetailsView order={serializedOrder} catalogProducts={serializedProducts} />
        </div>
    );
}
