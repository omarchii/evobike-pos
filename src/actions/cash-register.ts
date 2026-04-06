"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { CashRegisterSession } from "@prisma/client";

interface SessionUser {
    id: string;
    branchId: string;
    role: string;
}

type SerializedCashSession = Omit<CashRegisterSession, "openingAmt" | "closingAmt"> & {
    openingAmt: number;
    closingAmt: number | null;
};

// Get currently open session for the logged-in user at their branch
export async function getActiveCashSession(): Promise<{ success: boolean; session?: SerializedCashSession | null; error?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        const { id: userId, branchId } = session.user as SessionUser;

        const activeSession = await prisma.cashRegisterSession.findFirst({
            where: {
                userId,
                branchId,
                status: "OPEN",
            },
        });

        const serializedSession: SerializedCashSession | null = activeSession ? {
            ...activeSession,
            openingAmt: Number(activeSession.openingAmt),
            closingAmt: activeSession.closingAmt ? Number(activeSession.closingAmt) : null
        } : null;

        return { success: true, session: serializedSession };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// Open a new cash register shift
export async function openCashSession(openingAmt: number) {
    try {
        const authSession = await getServerSession(authOptions);
        if (!authSession?.user) return { success: false, error: "No autorizado" };

        const { id: userId, branchId } = authSession.user as SessionUser;

        // Check if one is already open
        const existing = await prisma.cashRegisterSession.findFirst({
            where: { userId, branchId, status: "OPEN" },
        });

        if (existing) {
            return { success: false, error: "Ya existe una sesión abierta para este usuario." };
        }

        const newSession = await prisma.cashRegisterSession.create({
            data: {
                userId,
                branchId,
                openingAmt,
                status: "OPEN",
            },
        });

        const serializedSession: SerializedCashSession = {
            ...newSession,
            openingAmt: Number(newSession.openingAmt),
            closingAmt: newSession.closingAmt ? Number(newSession.closingAmt) : null
        };

        revalidatePath("/point-of-sale");
        return { success: true, session: serializedSession };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}

// Close current cash register shift
export async function closeCashSession(closingAmt: number) {
    try {
        const authSession = await getServerSession(authOptions);
        if (!authSession?.user) return { success: false, error: "No autorizado" };

        const { id: userId, branchId } = authSession.user as SessionUser;

        const activeSession = await prisma.cashRegisterSession.findFirst({
            where: { userId, branchId, status: "OPEN" },
        });

        if (!activeSession) {
            return { success: false, error: "No hay ninguna sesión abierta." };
        }

        const closedSession = await prisma.cashRegisterSession.update({
            where: { id: activeSession.id },
            data: {
                closedAt: new Date(),
                closingAmt,
                status: "CLOSED",
            },
        });

        const serializedSession: SerializedCashSession = {
            ...closedSession,
            openingAmt: Number(closedSession.openingAmt),
            closingAmt: closedSession.closingAmt ? Number(closedSession.closingAmt) : null
        };

        revalidatePath("/point-of-sale");
        return { success: true, session: serializedSession };
    } catch (error: unknown) {
        return { success: false, error: error instanceof Error ? error.message : String(error) };
    }
}
