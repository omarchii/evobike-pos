import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface SessionUser {
  role: string;
}

export async function GET(): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;

  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  const branches = await prisma.branch.findMany({
    select: { id: true, code: true, name: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ success: true, data: branches });
}
