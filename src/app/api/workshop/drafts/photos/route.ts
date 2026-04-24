import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

interface SessionUser {
  id: string;
  role: string;
}

const MAX_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const DRAFTS_DIR = path.join(process.cwd(), "public", "workshop", "drafts");

// Files are written as {userId}-{uuid}.webp to allow per-user cleanup in Fase 6.
//
// Branch scope: este endpoint NO filtra por branch porque los drafts se
// guardan por userId (per-user namespace) — no hay recursos cross-branch
// que puedan fugarse. El move final a /workshop/orders/{orderId}/ ocurre
// dentro del POST de orders, que sí aplica `getViewBranchId`.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  const { id: userId, role } = session.user as unknown as SessionUser;
  if (role === "SELLER") {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ success: false, error: "Formato inválido" }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ success: false, error: "Archivo requerido" }, { status: 400 });
  }

  if (!ALLOWED_MIMES.has(file.type)) {
    return NextResponse.json(
      { success: false, error: "Formato no permitido. Usa PNG, JPEG o WebP." },
      { status: 415 },
    );
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { success: false, error: "La imagen excede 10MB" },
      { status: 413 },
    );
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  let webp: Buffer;
  try {
    webp = await sharp(buffer)
      .resize({ width: 1920, withoutEnlargement: true })
      .webp({ quality: 85 })
      .toBuffer();
  } catch {
    return NextResponse.json(
      { success: false, error: "No se pudo procesar la imagen" },
      { status: 400 },
    );
  }

  await fs.mkdir(DRAFTS_DIR, { recursive: true });
  const uuid = crypto.randomUUID();
  const filename = `${userId}-${uuid}.webp`;
  await fs.writeFile(path.join(DRAFTS_DIR, filename), webp);

  const url = `/workshop/drafts/${filename}`;
  return NextResponse.json({ success: true, data: { url } });
}
