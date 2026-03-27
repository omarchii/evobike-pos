import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    
    try {
        const modelo = await prisma.modelo.findUnique({
            where: { id },
            include: {
                coloresDisponibles: {
                    include: {
                        color: true
                    }
                }
            }
        });

        if (!modelo) {
            return NextResponse.json({ error: "Modelo no encontrado" }, { status: 404 });
        }

        const coloresFormat = modelo.coloresDisponibles.map(mc => ({
            id: mc.color.id,
            nombre: mc.color.nombre
        }));

        return NextResponse.json(coloresFormat);
    } catch (error) {
        console.error(`Error obteniendo colores para modelo ${id}:`, error);
        return NextResponse.json({ error: "No se pudieron obtener los colores" }, { status: 500 });
    }
}
