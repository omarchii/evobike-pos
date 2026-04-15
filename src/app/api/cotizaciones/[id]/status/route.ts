import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getEffectiveStatus } from "@/lib/quotations";
import { QuotationStatus } from "@prisma/client";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

type Action = "ENVIAR_A_FABRICA" | "NOTIFICAR_CLIENTE" | "REGISTRAR_PAGO";

const VALID_FROM: Record<Action, QuotationStatus[]> = {
  ENVIAR_A_FABRICA: ["EN_ESPERA_CLIENTE"],
  NOTIFICAR_CLIENTE: ["EN_ESPERA_FABRICA"],
  REGISTRAR_PAGO: ["EN_ESPERA_CLIENTE", "EN_ESPERA_FABRICA"],
};

const TARGET_STATUS: Record<Action, QuotationStatus> = {
  ENVIAR_A_FABRICA: "EN_ESPERA_FABRICA",
  NOTIFICAR_CLIENTE: "EN_ESPERA_CLIENTE",
  REGISTRAR_PAGO: "PAGADA",
};

// POST /api/cotizaciones/[id]/status
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { branchId, role } = session.user as unknown as SessionUser;

  if (!["SELLER", "MANAGER", "ADMIN"].includes(role)) {
    return NextResponse.json({ success: false, error: "Sin permisos" }, { status: 403 });
  }

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 }
    );
  }

  const { id } = await params;

  let action: Action;
  try {
    const body = (await req.json()) as { action?: unknown };
    if (
      body.action !== "ENVIAR_A_FABRICA" &&
      body.action !== "NOTIFICAR_CLIENTE" &&
      body.action !== "REGISTRAR_PAGO"
    ) {
      return NextResponse.json(
        { success: false, error: "Acción inválida" },
        { status: 400 }
      );
    }
    action = body.action;
  } catch {
    return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 });
  }

  const quotation = await prisma.quotation.findUnique({
    where: { id },
    select: { id: true, status: true, branchId: true, validUntil: true },
  });

  if (!quotation) {
    return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 });
  }

  if (role !== "ADMIN" && quotation.branchId !== branchId) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  // Check expiration before transitioning
  const effectiveStatus = getEffectiveStatus({
    status: quotation.status,
    validUntil: quotation.validUntil,
  });

  if (effectiveStatus === "EXPIRED") {
    return NextResponse.json(
      { success: false, error: "La cotización ha expirado" },
      { status: 409 }
    );
  }

  // Validate transition
  const validFrom = VALID_FROM[action];
  if (!validFrom.includes(quotation.status)) {
    return NextResponse.json(
      {
        success: false,
        error: `Transición inválida: la acción '${action}' no es permitida desde el estado '${quotation.status}'.`,
      },
      { status: 422 }
    );
  }

  const newStatus = TARGET_STATUS[action];

  const updated = await prisma.quotation.update({
    where: { id },
    data: { status: newStatus },
    select: { id: true, folio: true, status: true, updatedAt: true },
  });

  return NextResponse.json({
    success: true,
    data: {
      id: updated.id,
      folio: updated.folio,
      status: updated.status,
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}
