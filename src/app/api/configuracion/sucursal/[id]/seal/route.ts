import type { SessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const SELLO_DIR = path.join(process.cwd(), "public", "sellos");

function requireAdmin(user: SessionUser | undefined): NextResponse | null {
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }
  return null;
}

async function tryDeleteLocalSello(sealUrl: string | null): Promise<void> {
  if (!sealUrl || !sealUrl.startsWith("/sellos/")) return;
  const filename = sealUrl.slice("/sellos/".length);
  if (!filename) return;
  try {
    await fs.unlink(path.join(SELLO_DIR, filename));
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
  const denied = requireAdmin(user);
  if (denied) return denied;

  const { id } = await params;

  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) {
    return NextResponse.json(
      { success: false, error: "Sucursal no encontrada" },
      { status: 404 },
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

  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json(
      { success: false, error: "Formato no permitido. Usa PNG, JPEG o WebP." },
      { status: 400 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: "La imagen excede 2MB" },
      { status: 400 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());

  let webpBuffer: Buffer;
  try {
    webpBuffer = await sharp(buffer)
      .resize({
        width: 800,
        height: 800,
        fit: "inside",
        withoutEnlargement: true,
      })
      .webp({ quality: 90 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { success: false, error: "No se pudo procesar la imagen" },
      { status: 400 },
    );
  }

  await fs.mkdir(SELLO_DIR, { recursive: true });
  const filename = `${id}-${Date.now()}.webp`;
  await fs.writeFile(path.join(SELLO_DIR, filename), webpBuffer);

  const previousUrl = branch.sealImageUrl;
  const sealImageUrl = `/sellos/${filename}`;

  const updated = await prisma.branch.update({
    where: { id },
    data: { sealImageUrl },
  });

  await tryDeleteLocalSello(previousUrl);

  return NextResponse.json({
    success: true,
    data: { sealImageUrl: updated.sealImageUrl },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  const denied = requireAdmin(user);
  if (denied) return denied;

  const { id } = await params;

  const branch = await prisma.branch.findUnique({ where: { id } });
  if (!branch) {
    return NextResponse.json(
      { success: false, error: "Sucursal no encontrada" },
      { status: 404 },
    );
  }

  const previousUrl = branch.sealImageUrl;

  await prisma.branch.update({
    where: { id },
    data: { sealImageUrl: null },
  });

  await tryDeleteLocalSello(previousUrl);

  return NextResponse.json({ success: true, data: { sealImageUrl: null } });
}
