import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { type OperationalExpense } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";

const anularSchema = z.object({
    motivoAnulacion: z
        .string()
        .trim()
        .min(5, "El motivo debe tener al menos 5 caracteres."),
});

type ExpenseWithRelations = OperationalExpense & {
    registradoBy?: { id: string; name: string | null } | null;
    anuladoBy?: { id: string; name: string | null } | null;
};

type SerializedExpense = Omit<OperationalExpense, "monto"> & {
    monto: number;
    registradoBy?: { id: string; name: string | null } | null;
    anuladoBy?: { id: string; name: string | null } | null;
};

function serialize(e: ExpenseWithRelations): SerializedExpense {
    return { ...e, monto: Number(e.monto) };
}

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json(
            { success: false, error: "No autorizado" },
            { status: 401 },
        );
    }

    const { id } = await params;

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { success: false, error: "Formato inválido" },
            { status: 400 },
        );
    }

    const parsed = anularSchema.safeParse(body);
    if (!parsed.success) {
        const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
        return NextResponse.json({ success: false, error: first }, { status: 400 });
    }

    try {
        const user = await requireActiveUser(session);

        if (user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, error: "Solo ADMIN puede anular gastos" },
                { status: 403 },
            );
        }

        const expense = await prisma.operationalExpense.findUnique({
            where: { id },
        });
        if (!expense) {
            return NextResponse.json(
                { success: false, error: "Gasto no encontrado" },
                { status: 404 },
            );
        }

        if (expense.isAnulado) {
            return NextResponse.json(
                { success: false, error: "El gasto ya está anulado." },
                { status: 409 },
            );
        }

        const updated = await prisma.operationalExpense.update({
            where: { id },
            data: {
                isAnulado: true,
                anuladoPor: user.id,
                anuladoAt: new Date(),
                motivoAnulacion: parsed.data.motivoAnulacion.trim(),
            },
            include: {
                registradoBy: { select: { id: true, name: true } },
                anuladoBy: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ success: true, data: serialize(updated) });
    } catch (error: unknown) {
        if (error instanceof UserInactiveError) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 401 },
            );
        }
        console.error("[api/tesoreria/expenses/[id]/anular POST]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
