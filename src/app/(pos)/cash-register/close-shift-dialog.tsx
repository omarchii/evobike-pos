"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { AlertTriangle, Banknote, LockKeyholeOpen, X } from "lucide-react";

// ── Estilos del modal (movidos desde cash-actions-bar.tsx) ───────────────────

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
    color: "var(--on-ter-solid)",
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

// ── Estilos del trigger (por variant) ────────────────────────────────────────

const TRIGGER_BASE: React.CSSProperties = {
    border: "none",
    fontFamily: "var(--font-body)",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    transition: "opacity 150ms ease",
};

const TRIGGER_DANGER: React.CSSProperties = {
    ...TRIGGER_BASE,
    height: 40,
    paddingInline: "1rem",
    borderRadius: "var(--r-full)",
    fontWeight: 600,
    fontSize: "0.8125rem",
    background: "var(--ter)",
    color: "var(--on-ter-solid)",
};

const TRIGGER_DANGER_DISABLED: React.CSSProperties = {
    ...TRIGGER_BASE,
    height: 40,
    paddingInline: "1rem",
    borderRadius: "var(--r-full)",
    fontWeight: 500,
    fontSize: "0.8125rem",
    background: "var(--surf-high)",
    color: "var(--on-surf)",
    opacity: 0.45,
    cursor: "not-allowed",
};

const TRIGGER_INLINE_CTA: React.CSSProperties = {
    ...TRIGGER_BASE,
    height: 36,
    paddingInline: "1.25rem",
    borderRadius: "var(--r-full)",
    fontWeight: 600,
    fontSize: "0.75rem",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    background: "var(--ter)",
    color: "var(--on-ter-solid)",
};

// ── Componente ───────────────────────────────────────────────────────────────

type Variant = "danger" | "inline-cta";

interface Props {
    variant: Variant;
    /**
     * Solo aplica a variant="danger" (botón del header). Cuando false, el
     * botón se renderiza disabled. variant="inline-cta" siempre asume sesión
     * abierta (lo monta el banner huérfano, que solo aparece si hay sesión).
     */
    sessionOpen?: boolean;
}

export function CloseShiftTrigger({
    variant,
    sessionOpen = true,
}: Props): React.ReactElement {
    const router = useRouter();
    const [open, setOpen] = useState(false);
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
            setOpen(false);
            setAmount("");
            // Variant danger = fin de turno → manda al dashboard.
            // Variant inline-cta = regularización de huérfana → se queda en
            // /cash-register para que CashSessionManager invite a abrir caja nueva.
            if (variant === "danger") {
                router.push("/dashboard");
            } else {
                router.refresh();
            }
        } else {
            toast.error(error ?? "Error al cerrar caja", { id: "cash-action" });
        }
    };

    const isDanger = variant === "danger";
    const disabled = isDanger && !sessionOpen;

    const triggerStyle = isDanger
        ? sessionOpen ? TRIGGER_DANGER : TRIGGER_DANGER_DISABLED
        : TRIGGER_INLINE_CTA;
    const TriggerIcon = isDanger ? LockKeyholeOpen : AlertTriangle;
    const triggerLabel = isDanger ? "Cerrar caja" : "Atender ahora";
    const triggerTitle = disabled ? "No hay caja abierta" : undefined;

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                disabled={disabled}
                style={triggerStyle}
                title={triggerTitle}
            >
                <TriggerIcon className="h-4 w-4" />
                {triggerLabel}
            </button>

            <Dialog open={open} onOpenChange={setOpen}>
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
                                onClick={() => setOpen(false)}
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
                            onClick={() => setOpen(false)}
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
