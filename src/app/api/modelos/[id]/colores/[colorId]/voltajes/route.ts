import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
    request: Request, 
    { params }: { params: Promise<{ id: string, colorId: string }> }
) {
    const { id, colorId } = await params;
    
    try {
        const configuraciones = await prisma.modeloConfiguracion.findMany({
            where: {
                modelo_id: id,
                color_id: colorId
            },
            include: {
                voltaje: true,
                stocks: true
            }
        });

        if (configuraciones.length === 0) {
            return NextResponse.json({ error: "No se encontraron voltajes para esta combinación" }, { status: 404 });
        }

        const voltajesFormat = configuraciones.map(conf => {
            const stockTotal = conf.stocks.reduce((acc, stock) => acc + stock.quantity, 0);
            return {
                id: conf.voltaje.id,
                valor: conf.voltaje.valor,
                label: conf.voltaje.label,
                precio: Number(conf.precio),
                costo: Number(conf.costo),
                sku: conf.sku,
                configuracionId: conf.id,
                stockTotal
            };
        });

        // Ordenamos por voltaje de menor a mayor
        voltajesFormat.sort((a, b) => a.valor - b.valor);

        return NextResponse.json(voltajesFormat);
    } catch (error) {
        console.error(`Error obteniendo voltajes para modelo ${id} color ${colorId}:`, error);
        return NextResponse.json({ error: "No se pudieron obtener los voltajes y precios" }, { status: 500 });
    }
}
