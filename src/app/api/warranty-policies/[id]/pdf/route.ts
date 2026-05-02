import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  generateWarrantyPDF,
  generateAndUploadWarrantyPDF,
} from "@/lib/warranty-policy";
import * as blob from "@/lib/storage/blob";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function GET(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { branchId, role } = session.user as unknown as SessionUser;
  const { id } = await params;

  const policy = await prisma.warrantyPolicy.findUnique({
    where: { id },
    include: {
      customerBike: { select: { branchId: true } },
      sale: { select: { folio: true } },
    },
  });

  if (!policy) {
    return NextResponse.json({ error: "Póliza no encontrada" }, { status: 404 });
  }

  if (role !== "ADMIN" && role !== "MANAGER" && policy.customerBike.branchId !== branchId) {
    return NextResponse.json({ error: "Sin acceso" }, { status: 403 });
  }

  if (policy.docUrl) {
    try {
      const buffer = await blob.get(policy.docUrl);
      return new Response(new Uint8Array(buffer), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="Poliza-${policy.sale.folio}.pdf"`,
        },
      });
    } catch {
      // R2 unavailable or key missing — fall through to live render
    }
  }

  const { buffer } = await generateWarrantyPDF(id);
  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="Poliza-${policy.sale.folio}.pdf"`,
    },
  });
}

export async function POST(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<Response> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const { role } = session.user as unknown as SessionUser;
  if (role !== "ADMIN" && role !== "MANAGER" && role !== "SELLER") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id } = await params;

  const policy = await prisma.warrantyPolicy.findUnique({
    where: { id },
  });

  if (!policy) {
    return NextResponse.json({ error: "Póliza no encontrada" }, { status: 404 });
  }

  await generateAndUploadWarrantyPDF(id);

  return NextResponse.json({ success: true });
}
