import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import sharp from "sharp";
import { promises as fs } from "fs";
import path from "path";

const MAX_PDF_BYTES = 10 * 1024 * 1024;
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const IMAGE_MIMES = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
const PDF_MIME = "application/pdf";
const COMPROBANTES_DIR = path.join(process.cwd(), "public", "comprobantes");

async function tryDeleteLocalComprobante(url: string | null): Promise<void> {
    if (!url || !url.startsWith("/comprobantes/")) return;
    const filename = url.slice("/comprobantes/".length);
    if (!filename) return;
    try {
        await fs.unlink(path.join(COMPROBANTES_DIR, filename));
    } catch {
        // ignore missing file
    }
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

    try {
        const user = await requireActiveUser(session);

        if (user.role !== "MANAGER" && user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Solo MANAGER o ADMIN pueden subir comprobantes.",
                },
                { status: 403 },
            );
        }

        const expense = await prisma.operationalExpense.findUnique({
            where: { id },
            select: {
                id: true,
                branchId: true,
                comprobanteUrl: true,
                isAnulado: true,
            },
        });
        if (!expense) {
            return NextResponse.json(
                { success: false, error: "Gasto no encontrado" },
                { status: 404 },
            );
        }

        if (expense.isAnulado) {
            return NextResponse.json(
                { success: false, error: "No puedes modificar un gasto anulado." },
                { status: 409 },
            );
        }

        if (user.role !== "ADMIN" && expense.branchId !== user.branchId) {
            return NextResponse.json(
                { success: false, error: "Gasto de otra sucursal" },
                { status: 403 },
            );
        }

        let formData: FormData;
        try {
            formData = await req.formData();
        } catch {
            return NextResponse.json(
                { success: false, error: "Formato inválido" },
                { status: 400 },
            );
        }

        const file = formData.get("file");
        if (!(file instanceof File)) {
            return NextResponse.json(
                { success: false, error: "Archivo requerido" },
                { status: 400 },
            );
        }

        const isPdf = file.type === PDF_MIME;
        const isImage = IMAGE_MIMES.has(file.type);

        if (!isPdf && !isImage) {
            return NextResponse.json(
                {
                    success: false,
                    error: "Formato no permitido. Usa PDF, PNG, JPEG o WebP.",
                },
                { status: 400 },
            );
        }

        const maxBytes = isPdf ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
        if (file.size > maxBytes) {
            return NextResponse.json(
                {
                    success: false,
                    error: isPdf ? "El PDF excede 10MB" : "La imagen excede 5MB",
                },
                { status: 413 },
            );
        }

        const buffer = Buffer.from(await file.arrayBuffer());
        await fs.mkdir(COMPROBANTES_DIR, { recursive: true });

        let outputBuffer: Buffer;
        let extension: string;

        if (isPdf) {
            outputBuffer = buffer;
            extension = "pdf";
        } else {
            try {
                outputBuffer = await sharp(buffer)
                    .resize({
                        width: 2000,
                        height: 2000,
                        fit: "inside",
                        withoutEnlargement: true,
                    })
                    .webp({ quality: 85 })
                    .toBuffer();
            } catch {
                return NextResponse.json(
                    { success: false, error: "No se pudo procesar la imagen" },
                    { status: 400 },
                );
            }
            extension = "webp";
        }

        const filename = `${expense.branchId}-${expense.id}-${Date.now()}.${extension}`;
        await fs.writeFile(path.join(COMPROBANTES_DIR, filename), outputBuffer);

        const previousUrl = expense.comprobanteUrl;
        const comprobanteUrl = `/comprobantes/${filename}`;

        const updated = await prisma.operationalExpense.update({
            where: { id },
            data: { comprobanteUrl },
            select: { comprobanteUrl: true },
        });

        await tryDeleteLocalComprobante(previousUrl);

        return NextResponse.json({
            success: true,
            data: { comprobanteUrl: updated.comprobanteUrl },
        });
    } catch (error: unknown) {
        if (error instanceof UserInactiveError) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 401 },
            );
        }
        console.error("[api/tesoreria/expenses/[id]/comprobante POST]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}

export async function DELETE(
    _req: NextRequest,
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

    try {
        const user = await requireActiveUser(session);

        if (user.role !== "MANAGER" && user.role !== "ADMIN") {
            return NextResponse.json(
                {
                    success: false,
                    error: "Solo MANAGER o ADMIN pueden eliminar comprobantes.",
                },
                { status: 403 },
            );
        }

        const expense = await prisma.operationalExpense.findUnique({
            where: { id },
            select: {
                id: true,
                branchId: true,
                comprobanteUrl: true,
                isAnulado: true,
            },
        });
        if (!expense) {
            return NextResponse.json(
                { success: false, error: "Gasto no encontrado" },
                { status: 404 },
            );
        }

        if (expense.isAnulado) {
            return NextResponse.json(
                { success: false, error: "No puedes modificar un gasto anulado." },
                { status: 409 },
            );
        }

        if (user.role !== "ADMIN" && expense.branchId !== user.branchId) {
            return NextResponse.json(
                { success: false, error: "Gasto de otra sucursal" },
                { status: 403 },
            );
        }

        const previousUrl = expense.comprobanteUrl;

        await prisma.operationalExpense.update({
            where: { id },
            data: { comprobanteUrl: null },
        });

        await tryDeleteLocalComprobante(previousUrl);

        return NextResponse.json({
            success: true,
            data: { comprobanteUrl: null },
        });
    } catch (error: unknown) {
        if (error instanceof UserInactiveError) {
            return NextResponse.json(
                { success: false, error: error.message },
                { status: 401 },
            );
        }
        console.error("[api/tesoreria/expenses/[id]/comprobante DELETE]", error);
        const message = error instanceof Error ? error.message : "Error interno";
        return NextResponse.json({ success: false, error: message }, { status: 500 });
    }
}
