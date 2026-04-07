import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SessionUser {
  role: string;
  branchId: string;
}

// GET /api/assembly/config — datos para el modal de creación de montaje
// Retorna solo modelos que tienen BatteryConfiguration y sus voltajes/colores disponibles.
export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { role, branchId } = session.user as unknown as SessionUser;

  try {
    // 1. Todas las BatteryConfigurations con sus relaciones
    const batteryConfigs = await prisma.batteryConfiguration.findMany({
      select: {
        modeloId: true,
        voltajeId: true,
        quantity: true,
        modelo: {
          select: {
            id: true,
            nombre: true,
            coloresDisponibles: {
              select: {
                color_id: true,
                color: { select: { id: true, nombre: true } },
              },
            },
          },
        },
        voltaje: {
          select: { id: true, valor: true, label: true },
        },
      },
    });

    // 2. Agrupar por modelo — solo los modelos que tienen configuración de baterías
    const modeloMap = new Map<
      string,
      {
        id: string;
        nombre: string;
        voltajes: { id: string; valor: number; label: string }[];
        colores: { id: string; nombre: string }[];
      }
    >();

    for (const cfg of batteryConfigs) {
      if (!modeloMap.has(cfg.modeloId)) {
        const colores = cfg.modelo.coloresDisponibles.map((mc) => ({
          id: mc.color.id,
          nombre: mc.color.nombre,
        }));
        modeloMap.set(cfg.modeloId, {
          id: cfg.modelo.id,
          nombre: cfg.modelo.nombre,
          voltajes: [],
          colores,
        });
      }
      const entry = modeloMap.get(cfg.modeloId)!;
      // Añadir voltaje si no está ya
      if (!entry.voltajes.find((v) => v.id === cfg.voltajeId)) {
        entry.voltajes.push({
          id: cfg.voltaje.id,
          valor: cfg.voltaje.valor,
          label: cfg.voltaje.label,
        });
      }
    }

    const modelos = Array.from(modeloMap.values()).sort((a, b) =>
      a.nombre.localeCompare(b.nombre)
    );

    const configurations = batteryConfigs.map((cfg) => ({
      modeloId: cfg.modeloId,
      voltajeId: cfg.voltajeId,
      quantity: cfg.quantity,
    }));

    // 3. Pasar branchId al cliente para validaciones de /api/batteries/check
    const userBranchId = role === "ADMIN" ? null : branchId;

    return NextResponse.json({
      success: true,
      data: { modelos, configurations, branchId: userBranchId },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Error al cargar configuración";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
