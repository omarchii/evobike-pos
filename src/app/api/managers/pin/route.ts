import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import bcrypt from "bcryptjs";

// POST /api/managers/pin  { pin: string, branchId: string }
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return new NextResponse("Unauthorized", { status: 401 });

  try {
    const body: unknown = await request.json();
    if (
      typeof body !== "object" ||
      body === null ||
      typeof (body as Record<string, unknown>).pin !== "string" ||
      typeof (body as Record<string, unknown>).branchId !== "string"
    ) {
      return NextResponse.json({ success: false, error: "pin y branchId son requeridos" }, { status: 400 });
    }

    const { pin, branchId } = body as { pin: string; branchId: string };

    const managers = await prisma.user.findMany({
      where: {
        branchId,
        role: { in: ["MANAGER", "ADMIN"] },
      },
      select: { id: true, name: true, password: true },
    });

    for (const manager of managers) {
      const valid = await bcrypt.compare(pin, manager.password);
      if (valid) {
        return NextResponse.json({ success: true, managerId: manager.id, managerName: manager.name });
      }
    }

    return NextResponse.json({ success: false, error: "PIN incorrecto" });
  } catch (error) {
    console.error("Error validando PIN:", error);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
