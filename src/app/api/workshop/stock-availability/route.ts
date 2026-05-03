import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getViewBranchId } from "@/lib/branch-filter";
import { getAvailability, type AvailabilityEntry } from "@/lib/stock-availability";

const MAX_IDS = 50;

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json(
      { success: false, error: "No autenticado" },
      { status: 401 },
    );
  }

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

  const kind =
    (req.nextUrl.searchParams.get("kind") as "variant" | "simple") || "variant";

  const avail = await getAvailability(ids, branchId, kind);

  const data: Record<string, AvailabilityEntry> = {};
  for (const id of ids) {
    data[id] = avail.get(id) ?? {
      stock: 0,
      workshopPending: 0,
      assemblyPending: 0,
      enCamino: 0,
      disponible: 0,
    };
  }

  return NextResponse.json({ success: true, data });
}
