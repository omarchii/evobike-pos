import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const { role, branchId } = session.user;

    if (role === "SELLER" || role === "TECHNICIAN") {
        return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }

    const { id } = await params;

    const threshold = await prisma.alertThreshold.findUnique({ where: { id } });
    if (!threshold) {
        return NextResponse.json({ success: false, error: "Umbral no encontrado" }, { status: 404 });
    }

    if (role === "MANAGER" && threshold.branchId !== branchId) {
        return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }

    await prisma.alertThreshold.delete({ where: { id } });

    return NextResponse.json({ success: true });
}
