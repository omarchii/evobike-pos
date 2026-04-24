import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getViewBranchId } from "@/lib/branch-filter";
import type { SessionUser } from "@/lib/auth-types";

const MAX_IDS = 50;

// GET /api/workshop/stock-availability?ids=a,b,c
//
// Devuelve el stock disponible por id (productVariantId o simpleProductId)
// en la sucursal operativa del usuario (cookie admin_branch_id para ADMIN,
// JWT para el resto). Polimorfismo: el mismo id puede corresponder a una
// variante o a un producto simple — `Stock` los almacena en filas separadas
// con uno de los dos FK seteado.
//
// Consumido por el chip semáforo del taller (ficha técnica) con polling
// cliente cada 30s. NO reserva stock — es una lectura pura para mostrar
// señal al técnico que el inventario disponible cambió en otro flujo.
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autenticado" },
      { status: 401 },
    );
  }

  const user = session.user as unknown as SessionUser;
  const branchId = await getViewBranchId();
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Selecciona una sucursal para operar" },
      { status: 400 },
    );
  }

  const idsParam = req.nextUrl.searchParams.get("ids");
  if (!idsParam) {
    return NextResponse.json(
      { success: false, error: "Falta parámetro ids" },
      { status: 400 },
    );
  }
  const ids = idsParam
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length === 0) {
    return NextResponse.json(
      { success: false, error: "Lista de ids vacía" },
      { status: 400 },
    );
  }
  if (ids.length > MAX_IDS) {
    return NextResponse.json(
      { success: false, error: `Máximo ${MAX_IDS} ids por request` },
      { status: 400 },
    );
  }

  // Busca por ambos polimorfismos en una query. El id que matchee uno solo
  // de los dos campos quedará en el response; el otro tipo no devolverá fila.
  const rows = await prisma.stock.findMany({
    where: {
      branchId,
      OR: [
        { productVariantId: { in: ids } },
        { simpleProductId: { in: ids } },
      ],
    },
    select: {
      productVariantId: true,
      simpleProductId: true,
      quantity: true,
    },
  });

  const data: Record<string, { available: number }> = {};
  for (const r of rows) {
    const id = r.productVariantId ?? r.simpleProductId;
    if (!id) continue;
    data[id] = { available: r.quantity };
  }
  // Defaultea a 0 los ids sin fila (sin stock registrado en la sucursal).
  for (const id of ids) {
    if (!(id in data)) data[id] = { available: 0 };
  }

  return NextResponse.json({ success: true, data });
}
