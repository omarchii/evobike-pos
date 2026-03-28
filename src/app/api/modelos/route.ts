import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
    try {
        const modelos = await prisma.modelo.findMany({
            include: {
                coloresDisponibles: {
                    include: { color: true }
                },
                configuraciones: true
            },
            orderBy: { nombre: 'asc' }
        });

        // Calculamos métricas útiles para la vista inicial
        const modelosProcesados = modelos.map(m => {
            const minPrice = m.configuraciones.length > 0 
                ? Math.min(...m.configuraciones.map(c => Number(c.precio))) 
                : 0;
            
            return {
                id: m.id,
                nombre: m.nombre,
                descripcion: m.descripcion,
                requiere_vin: m.requiere_vin,
                imagenPrincipal: m.imageUrl || null,
                variantesCount: m.configuraciones.length,
                precioDesde: minPrice
            };
        });

        return NextResponse.json(modelosProcesados);
    } catch (error) {
        console.error("Error obteniendo modelos:", error);
        return NextResponse.json({ error: "No se pudieron obtener los modelos" }, { status: 500 });
    }
}
