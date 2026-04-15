import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import {
    ExpenseCategory,
    Prisma,
    type OperationalExpense,
} from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { getDefaultMonthRange } from "@/lib/tesoreria";

const OPERATIONAL_METHODS = ["CARD", "TRANSFER", "CREDIT_BALANCE", "ATRATO"] as const;
type OperationalMethod = (typeof OPERATIONAL_METHODS)[number];

const createSchema = z
    .object({
        categoria: z.nativeEnum(ExpenseCategory),
        descripcion: z.string().trim().min(1, "La descripción es obligatoria."),
        monto: z.coerce.number().positive(),
        fecha: z.coerce.date(),
        metodoPago: z.enum(OPERATIONAL_METHODS),
        comprobanteUrl: z.string().url().optional().nullable(),
        branchId: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        if (data.metodoPago === "TRANSFER" && !data.comprobanteUrl) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["comprobanteUrl"],
                message: "El comprobante es obligatorio para transferencias",
            });
        }
    });

type SerializedExpense = Omit<
    OperationalExpense,
    "monto"
> & {
    monto: number;
    registradoBy?: { id: string; name: string | null } | null;
    anuladoBy?: { id: string; name: string | null } | null;
};

type ExpenseWithRelations = OperationalExpense & {
    registradoBy?: { id: string; name: string | null } | null;
    anuladoBy?: { id: string; name: string | null } | null;
};

function serialize(e: ExpenseWithRelations): SerializedExpense {
    return { ...e, monto: Number(e.monto) };
}

export async function POST(req: NextRequest): Promise<NextResponse> {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
        return NextResponse.json(
            { success: false, error: "No autorizado" },
            { status: 401 },
        );
    }

    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json(
            { success: false, error: "Formato inválido" },
            { status: 400 },
        );
    }

    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
        const first = parsed.error.issues[0]?.message ?? "Datos inválidos";
        return NextResponse.json({ success: false, error: first }, { status: 400 });
    }

    const data = parsed.data;

    if (data.fecha.getTime() > Date.now()) {
        return NextResponse.json(
            { success: false, error: "La fecha no puede ser futura" },
            { status: 400 },
        );
    }

    try {
        const user = await requireActiveUser(session);

        if (user.role !== "MANAGER" && user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Solo MANAGER o ADMIN pueden registrar gastos operativos.",
                },
                { status: 403 },
            );
        }

        let branchId: string;
        if (user.role === "ADMIN") {
            branchId = data.branchId ?? user.branchId;
        } else {
            if (data.branchId && data.branchId !== user.branchId) {
                return NextResponse.json(
                    {
                        success: false,
                        error: "No puedes registrar gastos de otra sucursal.",
                    },
                    { status: 403 },
                );
            }
            branchId = user.branchId;
        }

        const method: OperationalMethod = data.metodoPago;

        const created = await prisma.operationalExpense.create({
            data: {
                branchId,
                categoria: data.categoria,
                descripcion: data.descripcion.trim(),
                monto: new Prisma.Decimal(data.monto.toFixed(2)),
                fecha: data.fecha,
                metodoPago: method,
                comprobanteUrl: data.comprobanteUrl ?? null,
                registradoPor: user.id,
            },
            include: {
                registradoBy: { select: { id: true, name: true } },
                anuladoBy: { select: { id: true, name: true } },
            },
        });

        return NextResponse.json({ success: true, data: serialize(created) });
    } catch (error: unknown) {
        if (error instanceof UserInactiveError) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 401 },
            );
        }
        console.error("[api/tesoreria/expenses POST]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

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
                {
                    success: false,
                    error: "Solo MANAGER o ADMIN pueden consultar gastos operativos.",
                },
                { status: 403 },
            );
        }

        const { searchParams } = new URL(req.url);
        const fromParam = searchParams.get("from");
        const toParam = searchParams.get("to");
        const categoriaParam = searchParams.get("categoria");
        const branchParam = searchParams.get("branchId");
        const incluirAnulados = searchParams.get("incluirAnulados") === "true";
        const soloSinComprobante =
            searchParams.get("soloSinComprobante") === "true";

        let from: Date;
        let to: Date;
        if (fromParam || toParam) {
            const fromDate = fromParam ? new Date(fromParam) : null;
            const toDate = toParam ? new Date(toParam) : null;
            if ((fromParam && fromDate && isNaN(fromDate.getTime())) ||
                (toParam && toDate && isNaN(toDate.getTime()))) {
                return NextResponse.json(
                    { success: false, error: "Fechas inválidas" },
                    { status: 400 },
                );
            }
            const defaultRange = getDefaultMonthRange();
            from = fromDate ?? defaultRange.from;
            to = toDate ?? defaultRange.to;
        } else {
            const range = getDefaultMonthRange();
            from = range.from;
            to = range.to;
        }

        let resolvedBranchId: string | null = null;
        if (user.role === "ADMIN") {
            resolvedBranchId = branchParam && branchParam.length > 0 ? branchParam : null;
        } else {
            resolvedBranchId = user.branchId;
        }

        let categoriaFilter: ExpenseCategory | undefined;
        if (categoriaParam) {
            const values = Object.values(ExpenseCategory) as string[];
            if (!values.includes(categoriaParam)) {
                return NextResponse.json(
                    { success: false, error: "Categoría inválida" },
                    { status: 400 },
                );
            }
            categoriaFilter = categoriaParam as ExpenseCategory;
        }

        const where: Prisma.OperationalExpenseWhereInput = {
            fecha: { gte: from, lte: to },
        };
        if (resolvedBranchId) where.branchId = resolvedBranchId;
        if (categoriaFilter) where.categoria = categoriaFilter;
        if (!incluirAnulados) where.isAnulado = false;
        if (soloSinComprobante) where.comprobanteUrl = null;

        const expenses = await prisma.operationalExpense.findMany({
            where,
            include: {
                registradoBy: { select: { id: true, name: true } },
                anuladoBy: { select: { id: true, name: true } },
            },
            orderBy: { fecha: "desc" },
        });

        return NextResponse.json({
            success: true,
            data: expenses.map(serialize),
        });
    } catch (error: unknown) {
        if (error instanceof UserInactiveError) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 401 },
            );
        }
        console.error("[api/tesoreria/expenses GET]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
