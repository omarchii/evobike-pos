import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { ExpenseCategory, type OperationalExpense } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";

const ALLOWED_PATCH_KEYS = new Set(["descripcion", "categoria", "comprobanteUrl"]);
const BLOCKED_PATCH_KEYS = new Set(["monto", "fecha", "metodoPago"]);

const patchSchema = z.object({
    descripcion: z.string().trim().min(1).optional(),
    categoria: z.nativeEnum(ExpenseCategory).optional(),
    comprobanteUrl: z.string().url().optional().nullable(),
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

function isPlainObject(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

export async function PATCH(
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

    if (!isPlainObject(body)) {
        return NextResponse.json(
            { success: false, error: "Datos inválidos" },
            { status: 400 },
        );
    }

    const keys = Object.keys(body);
    for (const k of keys) {
        if (BLOCKED_PATCH_KEYS.has(k)) {
            return NextResponse.json(
                {
                    success: false,
                    error:
                        "Para corregir estos campos, anula el gasto y crea uno nuevo.",
                },
                { status: 422 },
            );
        }
        if (!ALLOWED_PATCH_KEYS.has(k)) {
            return NextResponse.json(
                { success: false, error: `Campo no permitido: ${k}` },
                { status: 400 },
            );
        }
    }

    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) {
        const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
        return NextResponse.json({ success: false, error: first }, { status: 400 });
    }

    try {
        const user = await requireActiveUser(session);

        if (user.role !== "MANAGER" && user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Solo MANAGER o ADMIN pueden editar gastos operativos.",
                },
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
                { success: false, error: "No puedes editar un gasto anulado." },
                { status: 409 },
            );
        }

        if (user.role === "MANAGER") {
            if (expense.branchId !== user.branchId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "No puedes editar gastos de otra sucursal.",
                    },
                    { status: 403 },
                );
            }
            const createdAt = expense.createdAt;
            const today = new Date();
            if (createdAt.toDateString() !== today.toDateString()) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "Solo puedes editar gastos del día de hoy.",
                    },
                    { status: 403 },
                );
            }
        }

        const data: {
            descripcion?: string;
            categoria?: ExpenseCategory;
            comprobanteUrl?: string | null;
        } = {};
        if (parsed.data.descripcion !== undefined)
            data.descripcion = parsed.data.descripcion.trim();
        if (parsed.data.categoria !== undefined)
            data.categoria = parsed.data.categoria;
        if ("comprobanteUrl" in parsed.data)
            data.comprobanteUrl = parsed.data.comprobanteUrl ?? null;

        const updated = await prisma.operationalExpense.update({
            where: { id },
            data,
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
        console.error("[api/tesoreria/expenses/[id] PATCH]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
