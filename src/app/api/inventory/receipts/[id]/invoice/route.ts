import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireBranchedUser } from "@/lib/auth-guards";
import { prisma } from "@/lib/prisma";
import sharp from "sharp";
import { put, del } from "@/lib/storage/blob";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const PDF_MIME = "application/pdf";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const guard = requireBranchedUser(session);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json(
      { success: false, error: "Solo MANAGER o ADMIN pueden gestionar facturas de compra" },
      { status: 403 },
    );
  }

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
  if (user.role !== "ADMIN" && receipt.branchId !== user.branchId) {
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

  let outputBuffer: Buffer;
  let extension: string;
  let contentType: string;

  if (isPdf) {
    outputBuffer = buffer;
    extension = "pdf";
    contentType = PDF_MIME;
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
    contentType = "image/webp";
  }

  const key = `invoices/${receipt.branchId}/${receipt.id}-${Date.now()}.${extension}`;
  await put(key, outputBuffer, contentType);

  const previousKey = receipt.facturaUrl;

  await prisma.purchaseReceipt.update({
    where: { id },
    data: { facturaUrl: key },
  });

  if (previousKey) {
    try { await del(previousKey); } catch { /* best-effort */ }
  }

  return NextResponse.json({
    success: true,
    data: { facturaUrl: key },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const guard = requireBranchedUser(session);
  if (!guard.ok) return guard.response;
  const user = guard.user;

  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json(
      { success: false, error: "Solo MANAGER o ADMIN pueden gestionar facturas de compra" },
      { status: 403 },
    );
  }

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
  if (user.role !== "ADMIN" && receipt.branchId !== user.branchId) {
    return NextResponse.json(
      { success: false, error: "Recepción de otra sucursal" },
      { status: 403 },
    );
  }

  const previousKey = receipt.facturaUrl;

  await prisma.purchaseReceipt.update({
    where: { id },
    data: { facturaUrl: null },
  });

  if (previousKey) {
    try { await del(previousKey); } catch { /* best-effort */ }
  }

  return NextResponse.json({ success: true, data: { facturaUrl: null } });
}
