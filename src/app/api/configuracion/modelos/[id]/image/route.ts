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

const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const IMG_DIR = path.join(process.cwd(), "public", "productos");

function requireAdmin(user: SessionUser | undefined): NextResponse | null {
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json(
      { success: false, error: "No autorizado" },
      { status: 403 },
    );
  }
  return null;
}

async function tryDelete(url: string | null): Promise<void> {
  if (!url || !url.startsWith("/productos/")) return;
  const filename = url.slice("/productos/".length);
  if (!filename) return;
  try {
    await fs.unlink(path.join(IMG_DIR, filename));
  } catch {
    // ignore
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

  const modelo = await prisma.modelo.findUnique({ where: { id } });
  if (!modelo) {
    return NextResponse.json(
      { success: false, error: "Modelo no encontrado" },
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
  let webp: Buffer;
  try {
    webp = await sharp(buffer)
      .resize({ width: 1200, height: 1200, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { success: false, error: "No se pudo procesar la imagen" },
      { status: 400 },
    );
  }

  await fs.mkdir(IMG_DIR, { recursive: true });
  const filename = `modelo-${id}-${Date.now()}.webp`;
  await fs.writeFile(path.join(IMG_DIR, filename), webp);

  const previousUrl = modelo.imageUrl;
  const imageUrl = `/productos/${filename}`;
  const updated = await prisma.modelo.update({ where: { id }, data: { imageUrl } });
  await tryDelete(previousUrl);

  return NextResponse.json({ success: true, data: { imageUrl: updated.imageUrl } });
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

  const modelo = await prisma.modelo.findUnique({ where: { id } });
  if (!modelo) {
    return NextResponse.json(
      { success: false, error: "Modelo no encontrado" },
      { status: 404 },
    );
  }

  const previousUrl = modelo.imageUrl;
  await prisma.modelo.update({ where: { id }, data: { imageUrl: null } });
  await tryDelete(previousUrl);

  return NextResponse.json({ success: true, data: { imageUrl: null } });
}
