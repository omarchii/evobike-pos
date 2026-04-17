import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  let user;
  try {
    user = await requireActiveUser(session);
  } catch (err) {
    if (err instanceof UserInactiveError)
      return NextResponse.json({ success: false, error: err.message }, { status: 401 });
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const productVariantId = searchParams.get("productVariantId") || null;
  const simpleProductId = searchParams.get("simpleProductId") || null;
  const targetBranchId = searchParams.get("targetBranchId") ?? user.branchId;

  // Exactly one product identifier must be provided
  const hasVariant = !!productVariantId;
  const hasSimple = !!simpleProductId;
  if (hasVariant === hasSimple) {
    return NextResponse.json(
      { success: false, error: "Proporciona exactamente uno: productVariantId o simpleProductId" },
      { status: 400 },
    );
  }

  // SELLER / MANAGER can only query their own branch
  if (user.role !== "ADMIN" && targetBranchId !== user.branchId) {
    return NextResponse.json(
      { success: false, error: "No autorizado para consultar otra sucursal" },
      { status: 403 },
    );
  }

  const transfer = await prisma.stockTransfer.findFirst({
    where: {
      toBranchId: targetBranchId,
      status: { in: ["SOLICITADA", "BORRADOR", "EN_TRANSITO"] },
      items: {
        some: productVariantId
          ? { productVariantId }
          : { simpleProductId: simpleProductId! },
      },
    },
    select: {
      folio: true,
      status: true,
      fromBranch: { select: { name: true } },
      items: {
        where: productVariantId
          ? { productVariantId }
          : { simpleProductId: simpleProductId! },
        select: { cantidadEnviada: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  if (!transfer) {
    return NextResponse.json({ success: true, data: null });
  }

  const cantidadPendiente = transfer.items.reduce((sum, i) => sum + i.cantidadEnviada, 0);

  return NextResponse.json({
    success: true,
    data: {
      folio: transfer.folio,
      status: transfer.status,
      cantidadPendiente,
      fromBranchName: transfer.fromBranch.name,
    },
  });
}
