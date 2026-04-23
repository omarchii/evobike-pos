// Route handler auxiliar del breadcrumb client. Recibe un path y, si
// incluye un segmento dinámico (ID), devuelve su label resuelto vía
// resolveDynamicLabel (misma lógica que tenía el server component).
// Se llama como fallback cuando la página aún no ha registrado su label
// en el store client-side.

import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import {
  resolveDynamicLabel,
  fallbackIdLabel,
} from "@/lib/breadcrumbs/resolve-dynamic";

const ID_PATTERN = /^[a-z0-9-]{12,}$/i;

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const path = req.nextUrl.searchParams.get("path") ?? "";
  const segments = path.split("/").filter(Boolean);

  const ctx = {
    role: session.user.role,
    branchId: session.user.branchId ?? "",
  };

  const out: Record<string, string> = {};
  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];
    if (!ID_PATTERN.test(seg)) continue;
    const accumulated = "/" + segments.slice(0, i + 1).join("/");
    const label = await resolveDynamicLabel(segments, i, ctx);
    out[accumulated] = label ?? fallbackIdLabel(seg);
  }

  return NextResponse.json({ success: true, labels: out });
}
