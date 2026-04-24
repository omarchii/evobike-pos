"use server";

import { cookies } from "next/headers";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

const COOKIE_NAME = "admin_branch_id";

export async function switchAdminBranch(
  branchId: string | null,
  branchName: string | null,
) {
  const session = await getServerSession(authOptions);
  const user = session?.user as { role?: string } | undefined;

  if (!user || user.role !== "ADMIN") return;

  const jar = await cookies();

  if (branchId === null) {
    jar.delete(COOKIE_NAME);
    return;
  }

  jar.set(COOKIE_NAME, JSON.stringify({ id: branchId, name: branchName ?? "" }), {
    httpOnly: false,
    sameSite: "lax",
    path: "/",
    maxAge: 8 * 60 * 60,
  });
}

export async function getAdminActiveBranch(): Promise<{ id: string; name: string } | null> {
  const jar = await cookies();
  const raw = jar.get(COOKIE_NAME)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as { id: string; name: string };
  } catch {
    return null;
  }
}
