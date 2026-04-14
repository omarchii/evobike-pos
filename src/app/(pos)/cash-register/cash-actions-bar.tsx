"use client";

import { useState } from "react";
import { Printer, Receipt, Vault } from "lucide-react";
import { ExpenseDialog } from "./expense-dialog";
import { WithdrawalDialog } from "./withdrawal-dialog";
import { CloseShiftTrigger } from "./close-shift-dialog";

// Tokens compartidos con cash-session-manager.tsx (patrón canónico DESIGN.md §9)

const HEADER_BUTTON_BASE: React.CSSProperties = {
    height: 40,
    paddingInline: "1rem",
    borderRadius: "var(--r-full)",
    border: "none",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "0.8125rem",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    transition: "opacity 150ms ease",
};

const HEADER_SECONDARY: React.CSSProperties = {
    ...HEADER_BUTTON_BASE,
    background: "var(--surf-high)",
    color: "var(--on-surf)",
};

const HEADER_DISABLED: React.CSSProperties = {
    ...HEADER_SECONDARY,
    opacity: 0.45,
    cursor: "not-allowed",
};

interface Props {
    canRegisterWithdrawal: boolean;
    sessionOpen: boolean;
    userRole: string;
}

export function CashActionsBar({
    canRegisterWithdrawal,
    sessionOpen,
    userRole,
}: Props): React.ReactElement {
    const [expenseOpen, setExpenseOpen] = useState(false);
    const [withdrawalOpen, setWithdrawalOpen] = useState(false);

    const pdfTooltip = "Disponible en fase P6";

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <CloseShiftTrigger variant="danger" sessionOpen={sessionOpen} />

                <button
                    type="button"
                    onClick={() => setExpenseOpen(true)}
                    disabled={!sessionOpen}
                    style={sessionOpen ? HEADER_SECONDARY : HEADER_DISABLED}
                    title={sessionOpen ? undefined : "No hay caja abierta"}
                >
                    <Receipt className="h-4 w-4" />
                    Registrar gasto
                </button>

                {canRegisterWithdrawal && (
                    <button
                        type="button"
                        onClick={() => setWithdrawalOpen(true)}
                        disabled={!sessionOpen}
                        style={sessionOpen ? HEADER_SECONDARY : HEADER_DISABLED}
                        title={sessionOpen ? undefined : "No hay caja abierta"}
                    >
                        <Vault className="h-4 w-4" />
                        Registrar retiro
                    </button>
                )}

                <button
                    type="button"
                    disabled
                    style={HEADER_DISABLED}
                    title={pdfTooltip}
                >
                    <Printer className="h-4 w-4" />
                    Imprimir corte
                </button>
            </div>

            <ExpenseDialog
                open={expenseOpen}
                onOpenChange={setExpenseOpen}
                userRole={userRole}
            />
            {canRegisterWithdrawal && (
                <WithdrawalDialog open={withdrawalOpen} onOpenChange={setWithdrawalOpen} />
            )}
        </>
    );
}
