import crypto from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import type { SessionUser } from "@/lib/auth-types";
import * as blob from "@/lib/storage/blob";

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ALLOWED_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(
  req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  if (user.role !== "ADMIN" && user.role !== "MANAGER" && user.role !== "SELLER") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id: customerId } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { id: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  if (!file) {
    return NextResponse.json({ error: "Archivo requerido" }, { status: 400 });
  }

  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json(
      { error: "Tipo de archivo no permitido. Usa JPG, PNG, WebP o PDF." },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "El archivo excede 10 MB" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");

  const ext = file.type.split("/")[1] === "jpeg" ? "jpg" : file.type.split("/")[1];
  const key = `customers/${customerId}/ine.${ext}`;

  await blob.put(key, buffer, file.type);

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      ineScanUrl: key,
      ineScanHash: sha256,
      ineCapturedAt: new Date(),
    },
  });

  return NextResponse.json({ success: true, ineScanUrl: key });
}

export async function DELETE(
  _req: NextRequest,
  { params }: RouteParams,
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Sin permiso" }, { status: 403 });
  }

  const { id: customerId } = await params;

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    select: { ineScanUrl: true },
  });
  if (!customer) {
    return NextResponse.json({ error: "Cliente no encontrado" }, { status: 404 });
  }

  if (customer.ineScanUrl) {
    try {
      await blob.del(customer.ineScanUrl);
    } catch {
      // R2 unavailable — still clear DB ref
    }
  }

  await prisma.customer.update({
    where: { id: customerId },
    data: {
      ineScanUrl: null,
      ineScanHash: null,
      ineCapturedAt: null,
    },
  });

  return NextResponse.json({ success: true });
}
