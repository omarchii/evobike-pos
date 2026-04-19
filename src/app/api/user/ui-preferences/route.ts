import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({
    preferences: z
        .record(z.string(), z.unknown())
        .refine((v) => !Array.isArray(v) && v !== null, {
            message: "Las preferencias deben ser un objeto plano",
        }),
});

export async function GET(): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { uiPreferences: true },
    });

    return NextResponse.json({ success: true, data: { uiPreferences: user?.uiPreferences ?? null } });
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

    const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { uiPreferences: true },
    });

    const current =
        user?.uiPreferences !== null &&
        typeof user?.uiPreferences === "object" &&
        !Array.isArray(user?.uiPreferences)
            ? (user.uiPreferences as Record<string, unknown>)
            : {};

    const merged = { ...current, ...parsed.data.preferences };

    const result = await prisma.user.update({
        where: { id: session.user.id },
        data: { uiPreferences: merged as Prisma.InputJsonValue },
        select: { uiPreferences: true },
    });

    return NextResponse.json({ success: true, data: { uiPreferences: result.uiPreferences } });
}
