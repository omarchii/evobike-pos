import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ALERT_METRICS } from "@/lib/reportes/alert-metrics";

const THRESHOLD_COMPARATORS = ["LT", "LTE", "GT", "GTE", "EQ"] as const;

const postSchema = z.object({
    metricKey: z.enum(ALERT_METRICS),
    branchId: z.string().min(1),
    thresholdValue: z.coerce.number().min(0),
    comparator: z.enum(THRESHOLD_COMPARATORS),
    isActive: z.boolean().optional().default(true),
});

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const { role, branchId } = session.user;

    if (role === "SELLER" || role === "TECHNICIAN") {
        return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }

    const queryBranchId = req.nextUrl.searchParams.get("branchId");

    const where =
        role === "ADMIN"
            ? queryBranchId
                ? { branchId: queryBranchId }
                : {}
            : { branchId };

    const thresholds = await prisma.alertThreshold.findMany({
        where,
        orderBy: [{ metricKey: "asc" }, { branchId: "asc" }],
        include: { branch: { select: { id: true, code: true, name: true } } },
    });

    const data = thresholds.map((t) => ({
        ...t,
        thresholdValue: Number(t.thresholdValue),
    }));

    return NextResponse.json({ success: true, data });
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const { role, branchId } = session.user;

    if (role === "SELLER" || role === "TECHNICIAN") {
        return NextResponse.json({ success: false, error: "Acceso denegado" }, { status: 403 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 });
    }

    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
            { status: 400 },
        );
    }

    const { metricKey, thresholdValue, comparator, isActive } = parsed.data;
    let targetBranchId = parsed.data.branchId;

    if (role === "MANAGER") {
        targetBranchId = branchId;
    } else {
        // ADMIN: validar que el branchId existe
        const branch = await prisma.branch.findUnique({ where: { id: targetBranchId } });
        if (!branch) {
            return NextResponse.json({ success: false, error: "Sucursal no encontrada" }, { status: 400 });
        }
    }

    try {
        const threshold = await prisma.alertThreshold.upsert({
            where: { metricKey_branchId: { metricKey, branchId: targetBranchId } },
            update: { thresholdValue, comparator, isActive },
            create: { metricKey, branchId: targetBranchId, thresholdValue, comparator, isActive },
        });

        return NextResponse.json(
            { success: true, data: { ...threshold, thresholdValue: Number(threshold.thresholdValue) } },
            { status: 201 },
        );
    } catch {
        return NextResponse.json({ success: false, error: "Error al guardar el umbral" }, { status: 500 });
    }
}
