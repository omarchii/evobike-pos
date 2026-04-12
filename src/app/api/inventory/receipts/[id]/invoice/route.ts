import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

interface SessionUser {
  id: string;
  branchId: string | null;
  role: string;
}

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const PDF_MIME = "application/pdf";
const FACTURAS_DIR = path.join(process.cwd(), "public", "facturas");

function requireManagerOrAdmin(user: SessionUser | undefined): NextResponse | null {
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    return NextResponse.json(
      { success: false, error: "Solo MANAGER o ADMIN pueden gestionar facturas de compra" },
      { status: 403 },
    );
  }
  return null;
}

async function tryDeleteLocalFactura(url: string | null): Promise<void> {
  if (!url || !url.startsWith("/facturas/")) return;
  const filename = url.slice("/facturas/".length);
  if (!filename) return;
  try {
    await fs.unlink(path.join(FACTURAS_DIR, filename));
  } catch {
    // ignore missing file
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  const denied = requireManagerOrAdmin(user);
  if (denied) return denied;

  const { id } = await params;

  const receipt = await prisma.purchaseReceipt.findUnique({
    where: { id },
    select: { id: true, branchId: true, facturaUrl: true },
  });
  if (!receipt) {
    return NextResponse.json(
      { success: false, error: "Recepción no encontrada" },
      { status: 404 },
    );
  }
  if (user!.role !== "ADMIN" && receipt.branchId !== user!.branchId) {
    return NextResponse.json(
      { success: false, error: "Recepción de otra sucursal" },
      { status: 403 },
    );
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json(
      { success: false, error: "Formato inválido" },
      { status: 400 },
    );
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json(
      { success: false, error: "Archivo requerido" },
      { status: 400 },
    );
  }

  const isPdf = file.type === PDF_MIME;
  const isImage = IMAGE_MIMES.has(file.type);

  if (!isPdf && !isImage) {
    return NextResponse.json(
      { success: false, error: "Formato no permitido. Usa PDF, PNG, JPEG o WebP." },
      { status: 400 },
    );
  }

  const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
  if (file.size > maxBytes) {
    return NextResponse.json(
      {
        success: false,
        error: isPdf ? "El PDF excede 10MB" : "La imagen excede 5MB",
      },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  await fs.mkdir(FACTURAS_DIR, { recursive: true });

  let outputBuffer: Buffer;
  let extension: string;

  if (isPdf) {
    outputBuffer = buffer;
    extension = "pdf";
  } else {
    try {
      outputBuffer = await sharp(buffer)
        .resize({
          width: 2000,
          height: 2000,
          fit: "inside",
          withoutEnlargement: true,
        })
        .webp({ quality: 85 })
        .toBuffer();
    } catch {
      return NextResponse.json(
        { success: false, error: "No se pudo procesar la imagen" },
        { status: 400 },
      );
    }
    extension = "webp";
  }

  const filename = `${receipt.branchId}-${receipt.id}-${Date.now()}.${extension}`;
  await fs.writeFile(path.join(FACTURAS_DIR, filename), outputBuffer);

  const previousUrl = receipt.facturaUrl;
  const facturaUrl = `/facturas/${filename}`;

  const updated = await prisma.purchaseReceipt.update({
    where: { id },
    data: { facturaUrl },
    select: { facturaUrl: true },
  });

  await tryDeleteLocalFactura(previousUrl);

  return NextResponse.json({
    success: true,
    data: { facturaUrl: updated.facturaUrl },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  const denied = requireManagerOrAdmin(user);
  if (denied) return denied;

  const { id } = await params;

  const receipt = await prisma.purchaseReceipt.findUnique({
    where: { id },
    select: { id: true, branchId: true, facturaUrl: true },
  });
  if (!receipt) {
    return NextResponse.json(
      { success: false, error: "Recepción no encontrada" },
      { status: 404 },
    );
  }
  if (user!.role !== "ADMIN" && receipt.branchId !== user!.branchId) {
    return NextResponse.json(
      { success: false, error: "Recepción de otra sucursal" },
      { status: 403 },
    );
  }

  const previousUrl = receipt.facturaUrl;

  await prisma.purchaseReceipt.update({
    where: { id },
    data: { facturaUrl: null },
  });

  await tryDeleteLocalFactura(previousUrl);

  return NextResponse.json({ success: true, data: { facturaUrl: null } });
}
