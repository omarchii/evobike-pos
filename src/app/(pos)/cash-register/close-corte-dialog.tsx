"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { openPDFInNewTab } from "@/lib/pdf-client";
import {
    AlertCircle,
    AlertTriangle,
    ArrowLeft,
    Banknote,
    CheckCircle2,
    LockKeyholeOpen,
    Printer,
    X,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { DiscountAuthorizationPanel } from "@/components/pos/authorization/discount-authorization-panel";
import type { SessionSummary } from "@/lib/cash-register";

// ── Constantes del dominio ──────────────────────────────────────────────────

type Denomination = 1000 | 500 | 200 | 100 | 50;

const DENOMINACIONES: ReadonlyArray<{
    valor: Denomination;
    label: string;
}> = [
    { valor: 1000, label: "Billete" },
    { valor: 500, label: "Billete" },
    { valor: 200, label: "Billete" },
    { valor: 100, label: "Billete" },
    { valor: 50, label: "Moneda / Billete" },
];

const DEFAULT_DENOM: Record<Denomination, number> = {
    1000: 0,
    500: 0,
    200: 0,
    100: 0,
    50: 0,
};

// NO es tolerancia contable (regla de negocio = cero estricto). Solo absorbe
// ruido de redondeo Decimal↔Number al sumar transacciones. Un sub-centavo jamás
// existe físicamente, por lo que < 1e-2 es por definición ruido. Debe coincidir
// con FLOATING_POINT_EPSILON en /api/cash-register/session/route.ts.
const FLOATING_POINT_EPSILON = 0.01;

type Step = "contar" | "autorizar" | "confirmar";
type DiffState = "ok" | "sobrante" | "faltante";

interface ClosingResult {
    sessionId: string;
    diferencia: number;
    expectedAmt: number;
    contadoAmt: number;
    closedAt: string;
    openedByName: string;
    branchName: string;
    authorizedBy: { id: string; name: string } | null;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

const mxn = new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
});

function formatCurrency(value: number): string {
    return mxn.format(value);
}

function formatSigned(value: number): string {
    if (Math.abs(value) < FLOATING_POINT_EPSILON) return formatCurrency(0);
    const sign = value > 0 ? "+" : "−";
    return `${sign}${formatCurrency(Math.abs(value))}`;
}

function classifyDiff(value: number): DiffState {
    if (Math.abs(value) < FLOATING_POINT_EPSILON) return "ok";
    return value > 0 ? "sobrante" : "faltante";
}

function diffStateMeta(state: DiffState): {
    color: string;
    bg: string;
    icon: React.ReactNode;
    label: string;
} {
    if (state === "ok") {
        return {
            color: "var(--p)",
            bg: "color-mix(in srgb, var(--p) 12%, transparent)",
            icon: <CheckCircle2 className="h-5 w-5" />,
            label: "Cuadra al centavo",
        };
    }
    if (state === "sobrante") {
        return {
            color: "var(--warn)",
            bg: "color-mix(in srgb, var(--warn) 12%, transparent)",
            icon: <AlertTriangle className="h-5 w-5" />,
            label: "Sobrante",
        };
    }
    return {
        color: "var(--ter)",
        bg: "color-mix(in srgb, var(--ter) 14%, transparent)",
        icon: <AlertCircle className="h-5 w-5" />,
        label: "Faltante",
    };
}

function formatDateLong(iso: string): string {
    return new Intl.DateTimeFormat("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(iso));
}

// ── Estilos compartidos (tokens) ────────────────────────────────────────────

const MODAL_STYLE: React.CSSProperties = {
    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
};

const MODAL_CONFIRM_STYLE: React.CSSProperties = {
    ...MODAL_STYLE,
    maxWidth: 640,
};

const MODAL_SPLIT_STYLE: React.CSSProperties = {
    ...MODAL_STYLE,
    maxWidth: 1080,
};

const MODAL_AUTH_STYLE: React.CSSProperties = {
    ...MODAL_STYLE,
    maxWidth: 560,
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

const HEADLINE_STYLE: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "var(--on-surf)",
};

const LABEL_STYLE: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.6875rem",
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--on-surf-var)",
};

const DENOM_INPUT_STYLE: React.CSSProperties = {
    width: 80,
    background: "var(--surf-low)",
    border: "none",
    borderBottom: "2px solid transparent",
    borderRadius: "var(--r-md)",
    color: "var(--on-surf)",
    fontFamily: "var(--font-display)",
    fontWeight: 500,
    fontSize: "1rem",
    height: 40,
    textAlign: "center",
    outline: "none",
    transition: "border-color 160ms ease",
};

const PRIMARY_BUTTON_STYLE: React.CSSProperties = {
    background: "linear-gradient(135deg, var(--p) 0%, var(--p-container) 100%)",
    color: "var(--on-p)",
    borderRadius: "var(--r-full)",
    border: "none",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "0.875rem",
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    paddingInline: "2rem",
    height: 52,
    cursor: "pointer",
    width: "100%",
};

const SECONDARY_LINK_STYLE: React.CSSProperties = {
    background: "transparent",
    border: "none",
    color: "var(--on-surf-var)",
    fontFamily: "var(--font-body)",
    fontSize: "0.8125rem",
    cursor: "pointer",
    paddingBlock: "0.75rem",
};

// ── Trigger button styles (variant-based) ───────────────────────────────────

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

// ── Public API ──────────────────────────────────────────────────────────────

export type CloseCorteVariant = "danger" | "inline-cta";

export interface CloseCorteTriggerProps {
    variant: CloseCorteVariant;
    session: SessionSummary | null;
    userRole: string;
    /**
     * Solo aplica a variant="danger". Cuando false, el botón renderiza disabled.
     * inline-cta siempre asume sesión abierta (lo monta el banner huérfano).
     */
    sessionOpen?: boolean;
}

export function CloseCorteTrigger({
    variant,
    session,
    userRole,
    sessionOpen = true,
}: CloseCorteTriggerProps): React.ReactElement {
    const [open, setOpen] = useState(false);

    const isDanger = variant === "danger";
    const disabled = isDanger && (!sessionOpen || !session);
    const triggerStyle = isDanger
        ? !disabled
            ? TRIGGER_DANGER
            : TRIGGER_DANGER_DISABLED
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

            {session && (
                <CloseCorteDialog
                    open={open}
                    onOpenChange={setOpen}
                    variant={variant}
                    session={session}
                    userRole={userRole}
                />
            )}
        </>
    );
}

// ── Dialog interno (3 steps) ────────────────────────────────────────────────

interface DialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    variant: CloseCorteVariant;
    session: SessionSummary;
    userRole: string;
}

function CloseCorteDialog({
    open,
    onOpenChange,
    variant,
    session,
    userRole,
}: DialogProps): React.ReactElement {
    const router = useRouter();
    const [step, setStep] = useState<Step>("contar");
    const [denom, setDenom] = useState<Record<Denomination, number>>(DEFAULT_DENOM);
    const [submitting, setSubmitting] = useState(false);
    const [closingResult, setClosingResult] = useState<ClosingResult | null>(null);

    const contadoAmt = useMemo(
        () =>
            DENOMINACIONES.reduce(
                (acc, { valor }) => acc + valor * (denom[valor] ?? 0),
                0,
            ),
        [denom],
    );

    const expectedAmt = session.expectedCash;
    const diferencia = contadoAmt - expectedAmt;
    const diffState = classifyDiff(diferencia);
    const needsAuthorization = diffState !== "ok" && userRole === "SELLER";

    const handleOpenChange = (next: boolean): void => {
        if (!next) {
            setStep("contar");
            setDenom(DEFAULT_DENOM);
            setClosingResult(null);
            setSubmitting(false);
        }
        onOpenChange(next);
    };

    const handleDenomChange = (valor: Denomination, raw: string): void => {
        const clean = raw.replace(/[^0-9]/g, "");
        const qty = clean === "" ? 0 : Math.max(0, Math.min(9999, parseInt(clean, 10)));
        setDenom((prev) => ({ ...prev, [valor]: qty }));
    };

    const submitCierre = async (authorizationId: string | null): Promise<void> => {
        setSubmitting(true);
        toast.loading("Cerrando corte...", { id: "close-corte" });
        try {
            const res = await fetch("/api/cash-register/session", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    closingAmt: contadoAmt,
                    expectedAmt,
                    diferencia,
                    denominaciones: Object.fromEntries(
                        Object.entries(denom).filter(([, qty]) => qty > 0),
                    ),
                    authorizationId: authorizationId ?? undefined,
                }),
            });
            const json = (await res.json()) as {
                success: boolean;
                error?: string;
                data?: {
                    id: string;
                    diferencia: number | null;
                    closedAt: string;
                    authorizedBy: { id: string; name: string } | null;
                };
            };
            if (!res.ok || !json.success || !json.data) {
                toast.error(json.error ?? "No se pudo cerrar el corte.", {
                    id: "close-corte",
                });
                return;
            }
            toast.success("Corte cerrado correctamente.", { id: "close-corte" });
            setClosingResult({
                sessionId: json.data.id,
                diferencia: json.data.diferencia ?? 0,
                expectedAmt,
                contadoAmt,
                closedAt: json.data.closedAt,
                openedByName: session.openedByName,
                branchName: session.branchName,
                authorizedBy: json.data.authorizedBy,
            });
            setStep("confirmar");
        } catch {
            toast.error("Error de red al cerrar el corte.", { id: "close-corte" });
        } finally {
            setSubmitting(false);
        }
    };

    const onConfirmCorte = (): void => {
        if (needsAuthorization) {
            setStep("autorizar");
            return;
        }
        void submitCierre(null);
    };

    const onFinalize = (): void => {
        handleOpenChange(false);
        if (variant === "danger") {
            router.push("/dashboard");
        } else {
            router.refresh();
        }
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="p-0 gap-0 overflow-hidden"
                style={
                    step === "contar"
                        ? MODAL_SPLIT_STYLE
                        : step === "autorizar"
                          ? MODAL_AUTH_STYLE
                          : MODAL_CONFIRM_STYLE
                }
            >
                {step === "contar" && (
                    <StepContar
                        session={session}
                        denom={denom}
                        onDenomChange={handleDenomChange}
                        contadoAmt={contadoAmt}
                        expectedAmt={expectedAmt}
                        diferencia={diferencia}
                        diffState={diffState}
                        submitting={submitting}
                        onConfirm={onConfirmCorte}
                        onCancel={() => handleOpenChange(false)}
                    />
                )}

                {step === "autorizar" && (
                    <StepAutorizar
                        branchId={session.branchId}
                        diferencia={diferencia}
                        diffState={diffState}
                        onApproved={(authId) => void submitCierre(authId)}
                        onRejected={(reason) => {
                            toast.error(
                                reason
                                    ? `Autorización rechazada: ${reason}`
                                    : "El gerente rechazó la autorización.",
                                { id: "close-corte" },
                            );
                            setStep("contar");
                        }}
                        onExpired={() => {
                            toast.error(
                                "La autorización expiró. Solicítala de nuevo.",
                                { id: "close-corte" },
                            );
                            setStep("contar");
                        }}
                        onCancel={() => setStep("contar")}
                        onBack={() => setStep("contar")}
                    />
                )}

                {step === "confirmar" && closingResult && (
                    <StepConfirmar
                        result={closingResult}
                        onFinalize={onFinalize}
                    />
                )}
            </DialogContent>
        </Dialog>
    );
}

// ── STEP 1 — Contar denominaciones + resumen contable ───────────────────────

interface StepContarProps {
    session: SessionSummary;
    denom: Record<Denomination, number>;
    onDenomChange: (valor: Denomination, raw: string) => void;
    contadoAmt: number;
    expectedAmt: number;
    diferencia: number;
    diffState: DiffState;
    submitting: boolean;
    onConfirm: () => void;
    onCancel: () => void;
}

function StepContar({
    session,
    denom,
    onDenomChange,
    contadoAmt,
    expectedAmt,
    diferencia,
    diffState,
    submitting,
    onConfirm,
    onCancel,
}: StepContarProps): React.ReactElement {
    const diffMeta = diffStateMeta(diffState);

    return (
        <div className="flex flex-col md:flex-row max-h-[88vh]">
            {/* Header mobile — cierre */}
            <button
                type="button"
                onClick={onCancel}
                className="md:hidden absolute top-4 right-4 z-10"
                style={CLOSE_BUTTON_STYLE}
                aria-label="Cerrar"
            >
                <X className="w-4 h-4" />
            </button>

            {/* Izquierda — denominaciones */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto min-w-0">
                <header className="mb-6">
                    <DialogTitle
                        style={{ ...HEADLINE_STYLE, fontSize: "1.5rem", color: "var(--p)" }}
                    >
                        Declaración de Efectivo
                    </DialogTitle>
                    <DialogDescription
                        className="mt-1"
                        style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "0.8125rem",
                            color: "var(--on-surf-var)",
                        }}
                    >
                        Contabilización manual de billetes y monedas
                    </DialogDescription>
                </header>
                <div className="space-y-3">
                    {DENOMINACIONES.map(({ valor, label }) => {
                        const qty = denom[valor];
                        const subtotal = valor * qty;
                        return (
                            <div
                                key={valor}
                                className="flex items-center justify-between gap-3 p-4 rounded-[var(--r-lg)] transition-colors"
                                style={{ background: "var(--surf-lowest)" }}
                            >
                                <div className="flex items-center gap-4 min-w-0">
                                    <span
                                        className="shrink-0 flex items-center justify-center"
                                        style={{
                                            width: 48,
                                            height: 48,
                                            borderRadius: "var(--r-full)",
                                            background:
                                                "color-mix(in srgb, var(--p) 12%, transparent)",
                                            color: "var(--p)",
                                            fontFamily: "var(--font-display)",
                                            fontWeight: 700,
                                            fontSize: "0.875rem",
                                        }}
                                    >
                                        ${valor}
                                    </span>
                                    <div className="min-w-0">
                                        <p
                                            className="truncate"
                                            style={{
                                                ...LABEL_STYLE,
                                                marginBottom: "0.125rem",
                                            }}
                                        >
                                            {label}
                                        </p>
                                        <p
                                            style={{
                                                ...HEADLINE_STYLE,
                                                fontSize: "1.125rem",
                                            }}
                                        >
                                            {formatCurrency(subtotal)}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <span
                                        style={{
                                            ...LABEL_STYLE,
                                            fontSize: "0.75rem",
                                            textTransform: "none",
                                            letterSpacing: "normal",
                                        }}
                                    >
                                        x
                                    </span>
                                    <input
                                        type="number"
                                        inputMode="numeric"
                                        min={0}
                                        max={9999}
                                        value={qty === 0 ? "" : qty}
                                        onChange={(e) => onDenomChange(valor, e.target.value)}
                                        onFocus={(e) => {
                                            e.currentTarget.style.borderBottomColor =
                                                "var(--p)";
                                        }}
                                        onBlur={(e) => {
                                            e.currentTarget.style.borderBottomColor =
                                                "transparent";
                                        }}
                                        placeholder="0"
                                        style={DENOM_INPUT_STYLE}
                                    />
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Derecha — resumen contable */}
            <div
                className="md:w-[380px] p-6 md:p-8 flex flex-col shrink-0"
                style={{ background: "var(--surf-lowest)" }}
            >
                <header className="mb-6">
                    <h2 style={{ ...HEADLINE_STYLE, fontSize: "1.5rem" }}>
                        Resumen Contable
                    </h2>
                    <p
                        className="mt-1"
                        style={{
                            fontFamily: "var(--font-body)",
                            fontSize: "0.8125rem",
                            color: "var(--on-surf-var)",
                        }}
                    >
                        Balance del turno actual
                    </p>
                </header>

                <div className="space-y-4 flex-1">
                    <SummaryRow label="Saldo inicial" value={session.openingAmt} tone="neutral" />
                    {session.salesCash > 0 && (
                        <SummaryRow
                            label="Ventas en efectivo"
                            value={session.salesCash}
                            tone="positive"
                        />
                    )}
                    {session.depositsCash > 0 && (
                        <SummaryRow
                            label="Entradas"
                            value={session.depositsCash}
                            tone="positive"
                        />
                    )}
                    {session.expensesCash > 0 && (
                        <SummaryRow
                            label="Gastos declarados"
                            value={-session.expensesCash}
                            tone="negative"
                        />
                    )}
                    {session.withdrawalsCash > 0 && (
                        <SummaryRow
                            label="Retiros"
                            value={-session.withdrawalsCash}
                            tone="negative"
                        />
                    )}
                    {session.refundsCash > 0 && (
                        <SummaryRow
                            label="Reembolsos"
                            value={-session.refundsCash}
                            tone="negative"
                        />
                    )}

                    <div
                        className="mt-6 p-5 rounded-[var(--r-xl)]"
                        style={{ background: "var(--surf-high)" }}
                    >
                        <p
                            style={{
                                ...LABEL_STYLE,
                                marginBottom: "0.375rem",
                            }}
                        >
                            Efectivo esperado
                        </p>
                        <p
                            style={{
                                ...HEADLINE_STYLE,
                                fontSize: "2.25rem",
                                letterSpacing: "-0.02em",
                            }}
                        >
                            {formatCurrency(expectedAmt)}
                        </p>
                    </div>

                    <div>
                        <p style={{ ...LABEL_STYLE, color: "var(--p)", marginBottom: "0.5rem" }}>
                            Efectivo físico contado
                        </p>
                        <div
                            className="relative"
                            style={{
                                background: "var(--surf-low)",
                                borderRadius: "var(--r-lg) var(--r-lg) 0 0",
                                borderBottom: "2px solid var(--p)",
                                paddingBlock: "0.875rem",
                                paddingLeft: "1rem",
                            }}
                        >
                            <p
                                style={{
                                    ...HEADLINE_STYLE,
                                    fontSize: "1.75rem",
                                    letterSpacing: "-0.02em",
                                    color: "var(--on-surf)",
                                }}
                            >
                                {formatCurrency(contadoAmt)}
                            </p>
                        </div>
                    </div>

                    <div
                        className="flex items-center gap-3 p-4 rounded-[var(--r-lg)]"
                        style={{ background: diffMeta.bg, color: diffMeta.color }}
                    >
                        <span className="shrink-0">{diffMeta.icon}</span>
                        <div className="min-w-0 flex-1">
                            <p
                                style={{
                                    ...LABEL_STYLE,
                                    color: diffMeta.color,
                                    marginBottom: "0.125rem",
                                }}
                            >
                                Diferencia · {diffMeta.label}
                            </p>
                            <p
                                style={{
                                    ...HEADLINE_STYLE,
                                    fontSize: "1.25rem",
                                    color: diffMeta.color,
                                }}
                            >
                                {formatSigned(diferencia)}
                            </p>
                        </div>
                    </div>
                </div>

                <div className="mt-6 space-y-1">
                    <button
                        type="button"
                        onClick={onConfirm}
                        disabled={submitting}
                        style={{
                            ...PRIMARY_BUTTON_STYLE,
                            opacity: submitting ? 0.6 : 1,
                            cursor: submitting ? "not-allowed" : "pointer",
                        }}
                    >
                        {submitting ? "Procesando..." : "Confirmar cierre y corte"}
                    </button>
                    <button
                        type="button"
                        onClick={onCancel}
                        disabled={submitting}
                        style={{ ...SECONDARY_LINK_STYLE, width: "100%" }}
                    >
                        Cancelar y volver
                    </button>
                </div>
            </div>
        </div>
    );
}

function SummaryRow({
    label,
    value,
    tone,
}: {
    label: string;
    value: number;
    tone: "neutral" | "positive" | "negative";
}): React.ReactElement {
    const color =
        tone === "positive"
            ? "var(--p)"
            : tone === "negative"
              ? "var(--ter)"
              : "var(--on-surf)";
    const display =
        tone === "positive"
            ? `+${formatCurrency(Math.abs(value))}`
            : tone === "negative"
              ? `−${formatCurrency(Math.abs(value))}`
              : formatCurrency(value);
    return (
        <div className="flex justify-between items-baseline gap-3 py-2">
            <span style={{ ...LABEL_STYLE, fontSize: "0.75rem" }}>{label}</span>
            <span
                style={{
                    fontFamily: "var(--font-display)",
                    fontWeight: 500,
                    fontSize: "1.0625rem",
                    color,
                }}
            >
                {display}
            </span>
        </div>
    );
}

// ── STEP 2 — Autorizar diferencia (solo SELLER con diff ≠ 0) ────────────────

interface StepAutorizarProps {
    branchId: string;
    diferencia: number;
    diffState: DiffState;
    onApproved: (authorizationId: string) => void;
    onRejected: (reason: string | null) => void;
    onExpired: () => void;
    onCancel: () => void;
    onBack: () => void;
}

function StepAutorizar({
    branchId,
    diferencia,
    diffState,
    onApproved,
    onRejected,
    onExpired,
    onCancel,
    onBack,
}: StepAutorizarProps): React.ReactElement {
    const absDiff = Math.abs(diferencia);
    const diffLabel = diffState === "sobrante" ? "sobrante" : "faltante";
    return (
        <div className="p-6 md:p-8">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div
                        className="shrink-0 flex items-center justify-center"
                        style={{
                            width: 44,
                            height: 44,
                            borderRadius: "var(--r-full)",
                            background: "var(--ter-container)",
                            color: "var(--on-ter-container)",
                        }}
                    >
                        <AlertTriangle className="h-5 w-5" />
                    </div>
                    <DialogTitle
                        style={{ ...HEADLINE_STYLE, fontSize: "1.375rem" }}
                    >
                        Autorización de cierre
                    </DialogTitle>
                </div>
                <button
                    type="button"
                    onClick={onBack}
                    style={CLOSE_BUTTON_STYLE}
                    aria-label="Volver"
                >
                    <ArrowLeft className="w-4 h-4" />
                </button>
            </div>
            <DialogDescription
                style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.875rem",
                    color: "var(--on-surf-var)",
                    lineHeight: 1.5,
                    marginBottom: "1.25rem",
                }}
            >
                La caja presenta una diferencia de{" "}
                <strong style={{ color: "var(--on-surf)" }}>
                    {formatCurrency(absDiff)}
                </strong>{" "}
                ({diffLabel}). Solicita autorización de un gerente para registrar
                el cierre.
            </DialogDescription>

            <div
                className="rounded-[var(--r-lg)] p-4 mb-4"
                style={{ background: "var(--surf-lowest)" }}
            >
                <DiscountAuthorizationPanel
                    branchId={branchId}
                    amount={absDiff}
                    reason={`Cierre de caja con ${diffLabel} de ${formatCurrency(absDiff)}`}
                    tipo="CIERRE_DIFERENCIA"
                    onAuthorized={(res) => onApproved(res.authorizationId)}
                    onRejected={onRejected}
                    onExpired={onExpired}
                    onCancel={onCancel}
                />
            </div>

            <button
                type="button"
                onClick={onBack}
                style={{ ...SECONDARY_LINK_STYLE, width: "100%" }}
            >
                Volver a contar
            </button>
        </div>
    );
}

// ── STEP 3 — Confirmación full-width ────────────────────────────────────────

interface StepConfirmarProps {
    result: ClosingResult;
    onFinalize: () => void;
}

function StepConfirmar({
    result,
    onFinalize,
}: StepConfirmarProps): React.ReactElement {
    const diffState = classifyDiff(result.diferencia);
    const isClean = diffState === "ok";
    const hasAuthorization = result.authorizedBy !== null;

    const headline = isClean
        ? "Corte cerrado correctamente"
        : hasAuthorization
          ? "Corte cerrado con diferencia autorizada"
          : "Corte cerrado con diferencia";

    const iconColor = isClean
        ? "var(--p)"
        : diffState === "sobrante"
          ? "var(--warn)"
          : "var(--ter)";
    const iconBg = isClean
        ? "color-mix(in srgb, var(--p) 14%, transparent)"
        : diffState === "sobrante"
          ? "color-mix(in srgb, var(--warn) 14%, transparent)"
          : "color-mix(in srgb, var(--ter) 14%, transparent)";
    const Icon = isClean ? CheckCircle2 : AlertCircle;

    return (
        <div className="p-8 md:p-12 flex flex-col items-center text-center">
            <div
                className="shrink-0 flex items-center justify-center mb-6"
                style={{
                    width: 96,
                    height: 96,
                    borderRadius: "var(--r-full)",
                    background: iconBg,
                    color: iconColor,
                }}
            >
                <Icon className="h-12 w-12" />
            </div>
            <DialogTitle
                style={{
                    ...HEADLINE_STYLE,
                    fontSize: "2rem",
                    letterSpacing: "-0.02em",
                }}
            >
                {headline}
            </DialogTitle>
            <DialogDescription
                className="mt-2"
                style={{
                    fontFamily: "var(--font-body)",
                    fontSize: "0.9375rem",
                    color: "var(--on-surf-var)",
                }}
            >
                {result.branchName} · {formatDateLong(result.closedAt)}
            </DialogDescription>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 w-full mt-8">
                <ResultCard
                    label="Efectivo contado"
                    value={formatCurrency(result.contadoAmt)}
                    accentColor="var(--p)"
                />
                <ResultCard
                    label="Diferencia"
                    value={formatSigned(result.diferencia)}
                    accentColor={iconColor}
                />
            </div>

            <div
                className="w-full mt-3 px-5 py-3 rounded-[var(--r-lg)] flex flex-wrap items-center justify-between gap-2"
                style={{
                    background: "color-mix(in srgb, var(--surf-high) 60%, transparent)",
                    fontFamily: "var(--font-body)",
                    fontSize: "0.75rem",
                    color: "var(--on-surf-var)",
                }}
            >
                <span>
                    Operador:{" "}
                    <strong style={{ color: "var(--on-surf)" }}>
                        {result.openedByName}
                    </strong>
                </span>
                <span>
                    Esperado:{" "}
                    <strong style={{ color: "var(--on-surf)" }}>
                        {formatCurrency(result.expectedAmt)}
                    </strong>
                </span>
                {result.authorizedBy && (
                    <span>
                        Autorizó:{" "}
                        <strong style={{ color: "var(--on-surf)" }}>
                            {result.authorizedBy.name}
                        </strong>
                    </span>
                )}
            </div>

            <div className="w-full flex flex-col sm:flex-row gap-3 mt-8">
                <button
                    type="button"
                    onClick={onFinalize}
                    style={{
                        ...PRIMARY_BUTTON_STYLE,
                        width: "auto",
                        flex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                    }}
                >
                    <Banknote className="w-4 h-4" />
                    Volver al control
                </button>
                <button
                    type="button"
                    onClick={() =>
                        openPDFInNewTab(
                            `/api/cash-register/session/${result.sessionId}/pdf`,
                        )
                    }
                    style={{
                        background: "var(--surf-high)",
                        color: "var(--on-surf-var)",
                        borderRadius: "var(--r-full)",
                        border: "none",
                        height: 52,
                        paddingInline: "2rem",
                        fontFamily: "var(--font-body)",
                        fontWeight: 600,
                        fontSize: "0.875rem",
                        letterSpacing: "0.05em",
                        textTransform: "uppercase",
                        flex: 1,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.5rem",
                        cursor: "pointer",
                    }}
                >
                    <Printer className="w-4 h-4" />
                    Imprimir comprobante
                </button>
            </div>
        </div>
    );
}

function ResultCard({
    label,
    value,
    accentColor,
}: {
    label: string;
    value: string;
    accentColor: string;
}): React.ReactElement {
    return (
        <div
            className="rounded-[var(--r-lg)] p-5 text-left"
            style={{
                background: "var(--surf-lowest)",
                borderLeft: `3px solid ${accentColor}`,
            }}
        >
            <p style={{ ...LABEL_STYLE, marginBottom: "0.25rem" }}>{label}</p>
            <p
                style={{
                    ...HEADLINE_STYLE,
                    fontSize: "1.75rem",
                    letterSpacing: "-0.02em",
                    color: accentColor,
                }}
            >
                {value}
            </p>
        </div>
    );
}
