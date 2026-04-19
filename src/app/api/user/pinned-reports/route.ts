import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
    slug: z.string().min(1, "El slug es obligatorio"),
    action: z.enum(["add", "remove"]),
});

export async function GET(): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { pinnedReports: true },
    });

    return NextResponse.json({ success: true, data: { pinnedReports: user?.pinnedReports ?? [] } });
}

export async function PATCH(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ success: false, error: "Body inválido" }, { status: 400 });
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { success: false, error: parsed.error.issues[0]?.message ?? "Datos inválidos" },
            { status: 400 },
        );
    }

    const { slug, action } = parsed.data;

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { pinnedReports: true },
    });

    const current = user?.pinnedReports ?? [];
    let updated: string[];

    if (action === "add") {
        if (current.includes(slug)) {
            updated = current;
        } else {
            const withNew = [...current, slug];
            // Descartar el más viejo si se pasa de 4
            updated = withNew.length > 4 ? withNew.slice(withNew.length - 4) : withNew;
        }
    } else {
        updated = current.filter((s) => s !== slug);
    }

    const result = await prisma.user.update({
        where: { id: session.user.id },
        data: { pinnedReports: updated },
        select: { pinnedReports: true },
    });

    return NextResponse.json({ success: true, data: { pinnedReports: result.pinnedReports } });
}
