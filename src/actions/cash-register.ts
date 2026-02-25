"use server";

import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import { CashRegisterSession } from "@prisma/client";

// Get currently open session for the logged-in user at their branch
export async function getActiveCashSession(): Promise<{ success: boolean; session?: CashRegisterSession | null; error?: string }> {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) return { success: false, error: "No autorizado" };

        const userId = (session.user as any).id;
        const branchId = (session.user as any).branchId;

        const activeSession = await prisma.cashRegisterSession.findFirst({
            where: {
                userId,
                branchId,
                status: "OPEN",
            },
        });

        const serializedSession = activeSession ? {
            ...activeSession,
            openingAmt: Number(activeSession.openingAmt),
            closingAmt: activeSession.closingAmt ? Number(activeSession.closingAmt) : null
        } as any : null;

        return { success: true, session: serializedSession };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Open a new cash register shift
export async function openCashSession(openingAmt: number) {
    try {
        const authSession = await getServerSession(authOptions);
        if (!authSession?.user) return { success: false, error: "No autorizado" };

        const userId = (authSession.user as any).id;
        const branchId = (authSession.user as any).branchId;

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

        const serializedSession = {
            ...newSession,
            openingAmt: Number(newSession.openingAmt),
            closingAmt: newSession.closingAmt ? Number(newSession.closingAmt) : null
        } as any;

        revalidatePath("/point-of-sale");
        return { success: true, session: serializedSession };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}

// Close current cash register shift
export async function closeCashSession(closingAmt: number) {
    try {
        const authSession = await getServerSession(authOptions);
        if (!authSession?.user) return { success: false, error: "No autorizado" };

        const userId = (authSession.user as any).id;
        const branchId = (authSession.user as any).branchId;

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

        const serializedSession = {
            ...closedSession,
            openingAmt: Number(closedSession.openingAmt),
            closingAmt: closedSession.closingAmt ? Number(closedSession.closingAmt) : null
        } as any;

        revalidatePath("/point-of-sale");
        return { success: true, session: serializedSession };
    } catch (error: any) {
        return { success: false, error: error.message };
    }
}
