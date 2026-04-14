"use client";

import { useState } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    Banknote,
    LockKeyholeOpen,
    Printer,
    Receipt,
    Vault,
    X,
} from "lucide-react";
import { ExpenseDialog } from "./expense-dialog";
import { WithdrawalDialog } from "./withdrawal-dialog";

// Tokens compartidos con cash-session-manager.tsx (patrón canónico DESIGN.md §9)

const MODAL_STYLE: React.CSSProperties = {
    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
    maxWidth: 460,
};

const TITLE_STYLE: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "1.75rem",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "var(--on-surf)",
};

const DESCRIPTION_STYLE: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.8125rem",
    color: "var(--on-surf-var)",
    lineHeight: 1.5,
};

const INPUT_STYLE: React.CSSProperties = {
    background: "var(--surf-low)",
    border: "none",
    borderRadius: "var(--r-lg)",
    color: "var(--on-surf)",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "1.25rem",
    height: 56,
    width: "100%",
    padding: "0 0.75rem 0 1.75rem",
    outline: "none",
};

const LABEL_STYLE: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.6875rem",
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--on-surf-var)",
    marginBottom: "0.5rem",
    display: "block",
};

const DANGER_BUTTON_STYLE: React.CSSProperties = {
    background: "var(--ter)",
    color: "#FFFFFF",
    borderRadius: "var(--r-full)",
    border: "none",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "0.875rem",
    height: 48,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    cursor: "pointer",
};

const SECONDARY_BUTTON_STYLE: React.CSSProperties = {
    background: "var(--surf-high)",
    color: "var(--on-surf-var)",
    borderRadius: "var(--r-full)",
    border: "none",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "0.875rem",
    height: 48,
    paddingInline: "1.5rem",
    cursor: "pointer",
};

const CLOSE_BUTTON_STYLE: React.CSSProperties = {
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--r-full)",
    background: "var(--surf-high)",
    color: "var(--on-surf-var)",
    border: "none",
    cursor: "pointer",
};

// Estilos de los botones del header

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

const HEADER_PRIMARY_DANGER: React.CSSProperties = {
    ...HEADER_BUTTON_BASE,
    background: "var(--ter)",
    color: "#FFFFFF",
    fontWeight: 600,
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

export function CashActionsBar({ canRegisterWithdrawal, sessionOpen, userRole }: Props): React.ReactElement {
    const router = useRouter();
    const [isClosing, setIsClosing] = useState(false);
    const [expenseOpen, setExpenseOpen] = useState(false);
    const [withdrawalOpen, setWithdrawalOpen] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [amount, setAmount] = useState<string>("");

    const handleCloseShift = async (): Promise<void> => {
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt < 0) {
            toast.error("Ingresa el monto de arqueo final");
            return;
        }

        setSubmitting(true);
        toast.loading("Cerrando caja...", { id: "cash-action" });
        const { success, error } = await fetch("/api/cash-register/session", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ closingAmt: amt }),
        }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);
        setSubmitting(false);

        if (success) {
            toast.success("Caja cerrada. Ya no puedes operar ventas.", { id: "cash-action" });
            setIsClosing(false);
            setAmount("");
            router.push("/dashboard");
        } else {
            toast.error(error ?? "Error al cerrar caja", { id: "cash-action" });
        }
    };

    const pdfTooltip = "Disponible en fase P6";

    return (
        <>
            <div className="flex flex-wrap items-center gap-2">
                <button
                    type="button"
                    onClick={() => setIsClosing(true)}
                    disabled={!sessionOpen}
                    style={sessionOpen ? HEADER_PRIMARY_DANGER : HEADER_DISABLED}
                    title={sessionOpen ? undefined : "No hay caja abierta"}
                >
                    <LockKeyholeOpen className="h-4 w-4" />
                    Cerrar caja
                </button>

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

            <ExpenseDialog open={expenseOpen} onOpenChange={setExpenseOpen} userRole={userRole} />
            {canRegisterWithdrawal && (
                <WithdrawalDialog open={withdrawalOpen} onOpenChange={setWithdrawalOpen} />
            )}

            <Dialog open={isClosing} onOpenChange={setIsClosing}>
                <DialogContent
                    showCloseButton={false}
                    className="p-0 gap-0 overflow-hidden"
                    style={MODAL_STYLE}
                >
                    <DialogHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-4">
                                <div
                                    className="shrink-0 flex items-center justify-center"
                                    style={{
                                        width: 48,
                                        height: 48,
                                        borderRadius: "var(--r-full)",
                                        background: "var(--ter-container)",
                                        color: "var(--on-ter-container)",
                                    }}
                                >
                                    <Banknote className="h-5 w-5" />
                                </div>
                                <DialogTitle style={TITLE_STYLE}>Corte de Caja</DialogTitle>
                            </div>
                            <button
                                type="button"
                                onClick={() => setIsClosing(false)}
                                style={CLOSE_BUTTON_STYLE}
                                aria-label="Cerrar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <DialogDescription style={DESCRIPTION_STYLE}>
                            Declara cuánto dinero en efectivo REAL hay en el cajón en este
                            momento. El sistema comparará con lo esperado y generará el arqueo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 pb-2">
                        <label htmlFor="closingAmt" style={LABEL_STYLE}>
                            Monto final físico
                        </label>
                        <div className="relative">
                            <span
                                className="absolute left-4 top-1/2 -translate-y-1/2 pointer-events-none"
                                style={{
                                    color: "var(--on-surf-var)",
                                    fontFamily: "var(--font-body)",
                                    fontSize: "1rem",
                                    fontWeight: 500,
                                }}
                            >
                                $
                            </span>
                            <input
                                id="closingAmt"
                                type="number"
                                inputMode="decimal"
                                placeholder="0.00"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                autoFocus
                                style={INPUT_STYLE}
                            />
                        </div>
                    </div>

                    <div className="px-6 pt-4 pb-6 flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={() => setIsClosing(false)}
                            style={SECONDARY_BUTTON_STYLE}
                        >
                            Cancelar
                        </button>
                        <button
                            type="button"
                            onClick={handleCloseShift}
                            disabled={submitting}
                            style={{
                                ...DANGER_BUTTON_STYLE,
                                paddingInline: "2rem",
                                opacity: submitting ? 0.6 : 1,
                                cursor: submitting ? "not-allowed" : "pointer",
                            }}
                        >
                            Cerrar caja
                        </button>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
