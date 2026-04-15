import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { Prisma, type BankBalanceSnapshot } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { getActiveBankBalance } from "@/lib/tesoreria";

type SnapshotWithUser = BankBalanceSnapshot & {
    registradoBy: { id: string; name: string | null };
};

type SerializedSnapshot = Omit<BankBalanceSnapshot, "monto"> & {
    monto: number;
    registradoBy?: { id: string; name: string | null };
};

function serialize(
    snapshot: BankBalanceSnapshot | SnapshotWithUser,
): SerializedSnapshot {
    return {
        ...snapshot,
        monto: Number(snapshot.monto),
    };
}

const postSchema = z.object({
    monto: z.coerce.number().positive("El monto debe ser mayor a cero"),
    notas: z.string().trim().optional(),
});

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 20;

export async function GET(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json(
            { success: false, error: "No autorizado" },
            { status: 401 },
        );
    }

    try {
        const user = await requireActiveUser(session);

        if (user.role !== "MANAGER" && user.role !== "ADMIN") {
            return NextResponse.json(
                { success: false, error: "Requiere rol MANAGER o ADMIN" },
                { status: 403 },
            );
        }

        const { searchParams } = new URL(req.url);
        const historial = searchParams.get("historial") === "true";

        if (!historial) {
            const latest = await prisma.bankBalanceSnapshot.findFirst({
                orderBy: { createdAt: "desc" },
                include: { registradoBy: { select: { id: true, name: true } } },
            });

            // `getActiveBankBalance` se importa para cumplir la instrucción del
            // endpoint (fuente única de verdad del saldo activo). Se usa como
            // fallback si el include falla por cualquier razón.
            if (!latest) {
                const plain = await getActiveBankBalance();
                return NextResponse.json({
                    success: true,
                    data: plain ? serialize(plain) : null,
                });
            }

            return NextResponse.json({
                success: true,
                data: serialize(latest),
            });
        }

        const pageRaw = Number(searchParams.get("page"));
        const pageSizeRaw = Number(searchParams.get("pageSize"));

        const page = Number.isFinite(pageRaw) && pageRaw > 0 ? Math.floor(pageRaw) : 1;
        let pageSize =
            Number.isFinite(pageSizeRaw) && pageSizeRaw > 0
                ? Math.floor(pageSizeRaw)
                : DEFAULT_PAGE_SIZE;
        if (pageSize > MAX_PAGE_SIZE) pageSize = MAX_PAGE_SIZE;

        const [items, total] = await Promise.all([
            prisma.bankBalanceSnapshot.findMany({
                orderBy: { createdAt: "desc" },
                skip: (page - 1) * pageSize,
                take: pageSize,
                include: { registradoBy: { select: { id: true, name: true } } },
            }),
            prisma.bankBalanceSnapshot.count(),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                items: items.map(serialize),
                total,
                page,
                pageSize,
            },
        });
    } catch (error: unknown) {
        if (error instanceof UserInactiveError) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 401 },
            );
        }
        console.error("[api/tesoreria/bank-balance GET]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 },
        );
    }
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json(
            { success: false, error: "No autorizado" },
            { status: 401 },
        );
    }

    const body: unknown = await req.json();
    const parsed = postSchema.safeParse(body);
    if (!parsed.success) {
        const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
        return NextResponse.json(
            { success: false, error: first },
            { status: 400 },
        );
    }

    try {
        const user = await requireActiveUser(session);

        if (user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Solo ADMIN puede actualizar el saldo bancario",
                },
                { status: 403 },
            );
        }

        const { monto, notas } = parsed.data;

        const snapshot = await prisma.bankBalanceSnapshot.create({
            data: {
                monto: new Prisma.Decimal(monto.toFixed(2)),
                notas: notas?.trim() || null,
                registradoPor: user.id,
            },
            include: { registradoBy: { select: { id: true, name: true } } },
        });

        return NextResponse.json({
            success: true,
            data: serialize(snapshot),
        });
    } catch (error: unknown) {
        if (error instanceof UserInactiveError) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 401 },
            );
        }
        console.error("[api/tesoreria/bank-balance POST]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json(
            { success: false, error: message },
            { status: 500 },
        );
    }
}
