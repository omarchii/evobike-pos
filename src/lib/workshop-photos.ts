import { promises as fs } from "fs";
import path from "path";

const PUBLIC_DIR = path.join(process.cwd(), "public");

// Draft cleanup by userId is intentional: the prefix {userId}- allows future
// cleanup jobs to remove abandoned drafts per user (Fase 6).
export async function moveDraftToOrder(
  draftUrl: string,
  orderId: string,
): Promise<string> {
  const filename = path.basename(draftUrl);
  const draftPath = path.join(PUBLIC_DIR, "workshop", "drafts", filename);
  const orderDir = path.join(PUBLIC_DIR, "workshop", orderId);
  await fs.mkdir(orderDir, { recursive: true });
  const finalPath = path.join(orderDir, filename);
  try {
    await fs.rename(draftPath, finalPath);
  } catch {
    // fs.rename can fail across volumes; fall back to copy+delete
    await fs.copyFile(draftPath, finalPath);
    await fs.unlink(draftPath);
  }
  return `/workshop/${orderId}/${filename}`;
}

export async function cleanupOrderPhotos(orderId: string): Promise<void> {
  const orderDir = path.join(PUBLIC_DIR, "workshop", orderId);
  await fs.rm(orderDir, { recursive: true, force: true });
}
