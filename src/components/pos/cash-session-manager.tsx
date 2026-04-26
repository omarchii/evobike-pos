"use client";

import { useState, useEffect } from "react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Banknote, Wallet, X } from "lucide-react";

// ── Design tokens (canonical modal pattern — ver DESIGN.md §9 + AGENTS.md "Reglas de UI para modales") ──

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

const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
    background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
    color: "#FFFFFF",
    borderRadius: "var(--r-full)",
    border: "none",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "0.875rem",
    height: 48,
    width: "100%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "0.5rem",
    cursor: "pointer",
};

const DANGER_BUTTON_STYLE: React.CSSProperties = {
    ...PRIMARY_BUTTON_STYLE,
    background: "var(--ter)",
    color: "#FFFFFF",
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

// ── Component ─────────────────────────────────────────────────────────────────

export function CashSessionManager() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [amount, setAmount] = useState<string>("");
    const [, setHasActiveSession] = useState(false);

    useEffect(() => {
        const checkSession = async () => {
            const res = await fetch("/api/cash-register/session").then(
                (r) => r.json() as Promise<{
                    success: boolean;
                    data?: { id: string } | null;
                    scope?: "GLOBAL" | "BRANCH";
                    requiresBranchSelection?: boolean;
                }>,
            );
            if (res.success) {
                if (res.data) {
                    setHasActiveSession(true);
                } else if (!res.requiresBranchSelection && res.scope !== "GLOBAL") {
                    setIsOpen(true);
                }
            }
            setLoading(false);
        };
        checkSession();
    }, []);

    const handleOpenShift = async () => {
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt < 0) {
            toast.error("Ingresa un monto válido");
            return;
        }

        setSubmitting(true);
        toast.loading("Abriendo caja...", { id: "cash-action" });
        const { success, error } = await fetch("/api/cash-register/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ openingAmt: amt }),
        }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);
        setSubmitting(false);

        if (success) {
            toast.success("Caja abierta. Ya puedes operar.", { id: "cash-action" });
            setHasActiveSession(true);
            setIsOpen(false);
            setAmount("");
            router.refresh();
            return;
        }

        if (error && error.includes("Ya hay una caja abierta")) {
            // Otro usuario la abrió primero — cerramos y seguimos
            toast.info("Otro usuario ya abrió la caja.", { id: "cash-action" });
            setHasActiveSession(true);
            setIsOpen(false);
            setAmount("");
            router.refresh();
            return;
        }

        toast.error(error || "Error al abrir caja", { id: "cash-action" });
    };

    const handleCloseShift = async () => {
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
            setHasActiveSession(false);
            setIsClosing(false);
            setAmount("");
            router.refresh();
        } else {
            toast.error(error || "Error al cerrar caja", { id: "cash-action" });
        }
    };

    if (loading) return null;

    return (
        <>
            {/* ── OPEN SHIFT DIALOG (no dismissable) ── */}
            <Dialog open={isOpen} onOpenChange={() => { }}>
                <DialogContent
                    showCloseButton={false}
                    className="p-0 gap-0 overflow-hidden"
                    style={MODAL_STYLE}
                >
                    <DialogHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center gap-4 mb-2">
                            <div
                                className="shrink-0 flex items-center justify-center"
                                style={{
                                    width: 48,
                                    height: 48,
                                    borderRadius: "var(--r-full)",
                                    background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
                                    color: "#FFFFFF",
                                }}
                            >
                                <Wallet className="h-5 w-5" />
                            </div>
                            <DialogTitle style={TITLE_STYLE}>Apertura de Caja</DialogTitle>
                        </div>
                        <DialogDescription style={DESCRIPTION_STYLE}>
                            Buenos diasss☀️          
                            ¿Con cuanto inicias el día?
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 pb-2">
                        <label htmlFor="openingAmt" style={LABEL_STYLE}>
                            Efectivo inicial
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
                                id="openingAmt"
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

                    <div className="px-6 pt-4 pb-6">
                        <button
                            type="button"
                            onClick={handleOpenShift}
                            disabled={submitting}
                            style={{
                                ...PRIMARY_BUTTON_STYLE,
                                opacity: submitting ? 0.6 : 1,
                                cursor: submitting ? "not-allowed" : "pointer",
                            }}
                        >
                            <Banknote className="h-5 w-5" />
                            Abrir caja
                        </button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* ── CLOSE SHIFT DIALOG (dismissable) ── */}
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
                                width: "auto",
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
