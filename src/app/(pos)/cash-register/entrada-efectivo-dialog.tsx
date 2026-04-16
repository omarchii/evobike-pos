"use client";

import { Controller, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { LogIn, MoreHorizontal, PiggyBank, Repeat, X } from "lucide-react";

// ── Enum local (workaround Prisma client-only, AGENTS.md §TypeScript) ────────

const CASH_DEPOSIT_CATEGORIES = ["DOTACION_INICIAL", "CAMBIO", "OTROS"] as const;
type CashDepositCategory = (typeof CASH_DEPOSIT_CATEGORIES)[number];

const CATEGORY_META: Record<
    CashDepositCategory,
    { label: string; description: string; icon: React.ComponentType<{ className?: string }> }
> = {
    DOTACION_INICIAL: {
        label: "Dotación inicial",
        description: "Fondo inicial del turno",
        icon: LogIn,
    },
    CAMBIO: {
        label: "Cambio",
        description: "Reposición de cambio",
        icon: Repeat,
    },
    OTROS: {
        label: "Otros",
        description: "Depósito de respaldo, ajuste, etc.",
        icon: MoreHorizontal,
    },
};

const SELLER_DEPOSIT_LIMIT = 500;

// ── Estilos (patrón canónico AGENTS.md §Reglas de UI para modales) ──────────

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
    fontSize: "1.5rem",
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

const INPUT_STYLE: React.CSSProperties = {
    background: "var(--surf-low)",
    border: "none",
    borderRadius: "var(--r-lg)",
    color: "var(--on-surf)",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "1rem",
    height: 48,
    width: "100%",
    padding: "0 0.75rem",
    outline: "none",
};

const AMOUNT_INPUT_STYLE: React.CSSProperties = {
    ...INPUT_STYLE,
    fontSize: "1.25rem",
    height: 56,
    paddingLeft: "1.75rem",
};

const TEXTAREA_STYLE: React.CSSProperties = {
    ...INPUT_STYLE,
    height: "auto",
    minHeight: 72,
    paddingTop: "0.625rem",
    paddingBottom: "0.625rem",
    resize: "vertical",
    fontSize: "0.875rem",
    fontWeight: 400,
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
    paddingInline: "2rem",
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

const ERROR_STYLE: React.CSSProperties = {
    color: "var(--ter)",
    fontSize: "0.75rem",
    marginTop: "0.25rem",
};

const PILL_BASE: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "0.75rem",
    width: "100%",
    padding: "0.75rem 0.875rem",
    borderRadius: "var(--r-lg)",
    border: "none",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "var(--font-body)",
    transition: "background 150ms ease, color 150ms ease",
};

// ── Schema ───────────────────────────────────────────────────────────────────

const depositFormSchema = z.object({
    amount: z
        .number({ message: "Ingresa un monto válido" })
        .positive("El monto debe ser mayor a cero"),
    category: z.enum(CASH_DEPOSIT_CATEGORIES),
    notes: z.string().trim().optional(),
});

type DepositFormValues = z.infer<typeof depositFormSchema>;

const DEFAULT_VALUES: DepositFormValues = {
    amount: 0,
    category: "OTROS",
    notes: "",
};

// ── Componente ───────────────────────────────────────────────────────────────

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userRole: string;
}

export function EntradaEfectivoDialog({
    open,
    onOpenChange,
    userRole,
}: Props): React.ReactElement {
    const router = useRouter();
    const form = useForm<DepositFormValues>({
        resolver: zodResolver(depositFormSchema),
        defaultValues: DEFAULT_VALUES,
    });

    const amount = useWatch({ control: form.control, name: "amount" });
    const isOverSellerLimit = userRole === "SELLER" && amount > SELLER_DEPOSIT_LIMIT;

    const handleOpenChange = (next: boolean): void => {
        if (!next) form.reset(DEFAULT_VALUES);
        onOpenChange(next);
    };

    const onSubmit = async (values: DepositFormValues): Promise<void> => {
        // Pre-check client-side: SELLER tope $500. Backend sigue siendo la autoridad.
        if (userRole === "SELLER" && values.amount > SELLER_DEPOSIT_LIMIT) {
            toast.error(
                "Monto excede tu límite. Requiere autorización de gerente (P5).",
                { id: "cash-deposit" },
            );
            return;
        }

        toast.loading("Registrando entrada...", { id: "cash-deposit" });
        const res = await fetch("/api/cash/deposit", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount: values.amount,
                category: values.category,
                notes: values.notes?.trim() || undefined,
            }),
        });
        const json = (await res.json()) as { success: boolean; error?: string };

        if (!json.success) {
            toast.error(json.error ?? "Error al registrar entrada", { id: "cash-deposit" });
            return;
        }

        // Flow post-éxito: cerrar modal → refresh → toast (en ese orden).
        handleOpenChange(false);
        router.refresh();
        toast.success("Entrada registrada", { id: "cash-deposit" });
    };

    const submitting = form.formState.isSubmitting;
    const submitDisabled = submitting || isOverSellerLimit;

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                showCloseButton={false}
                className="p-0 gap-0 overflow-hidden"
                style={MODAL_STYLE}
            >
                <form onSubmit={form.handleSubmit(onSubmit)} noValidate>
                    <DialogHeader className="px-6 pt-6 pb-4">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-4">
                                <div
                                    className="shrink-0 flex items-center justify-center"
                                    style={{
                                        width: 44,
                                        height: 44,
                                        borderRadius: "var(--r-full)",
                                        background: "var(--sec-container)",
                                        color: "var(--on-sec-container)",
                                    }}
                                >
                                    <PiggyBank className="h-5 w-5" />
                                </div>
                                <DialogTitle style={TITLE_STYLE}>
                                    Registrar entrada de efectivo
                                </DialogTitle>
                            </div>
                            <button
                                type="button"
                                onClick={() => handleOpenChange(false)}
                                style={CLOSE_BUTTON_STYLE}
                                aria-label="Cerrar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <DialogDescription style={DESCRIPTION_STYLE}>
                            Suma efectivo al cajón fuera del flujo de ventas (dotación,
                            cambio, depósito de respaldo). Queda registrada en el arqueo
                            del turno.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 pb-2 space-y-4">
                        {/* Monto */}
                        <div>
                            <label htmlFor="dep-amount" style={LABEL_STYLE}>
                                Monto
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
                                    id="dep-amount"
                                    type="number"
                                    inputMode="decimal"
                                    step="0.01"
                                    placeholder="0.00"
                                    autoFocus
                                    style={AMOUNT_INPUT_STYLE}
                                    {...form.register("amount", { valueAsNumber: true })}
                                />
                            </div>
                            {form.formState.errors.amount && (
                                <p style={ERROR_STYLE}>
                                    {form.formState.errors.amount.message}
                                </p>
                            )}
                            {isOverSellerLimit && (
                                <p style={{ ...ERROR_STYLE, color: "var(--warn)" }}>
                                    Arriba de ${SELLER_DEPOSIT_LIMIT}. Requiere autorización
                                    de gerente (pendiente en fase P5).
                                </p>
                            )}
                        </div>

                        {/* Categoría — radio pills verticales (Controller: compiler-safe) */}
                        <div>
                            <span style={LABEL_STYLE}>Categoría</span>
                            <Controller
                                control={form.control}
                                name="category"
                                render={({ field }) => (
                                    <div
                                        role="radiogroup"
                                        aria-label="Categoría de la entrada"
                                        className="flex flex-col gap-2"
                                    >
                                        {CASH_DEPOSIT_CATEGORIES.map((key) => {
                                            const meta = CATEGORY_META[key];
                                            const Icon = meta.icon;
                                            const isChecked = field.value === key;
                                            return (
                                                <button
                                                    key={key}
                                                    type="button"
                                                    role="radio"
                                                    aria-checked={isChecked}
                                                    onClick={() => field.onChange(key)}
                                                    onBlur={field.onBlur}
                                                    style={{
                                                        ...PILL_BASE,
                                                        background: isChecked
                                                            ? "var(--p-container)"
                                                            : "var(--surf-low)",
                                                        color: isChecked
                                                            ? "var(--on-p-container)"
                                                            : "var(--on-surf)",
                                                    }}
                                                >
                                                    <span
                                                        className="shrink-0 flex items-center justify-center"
                                                        style={{
                                                            width: 32,
                                                            height: 32,
                                                            borderRadius: "var(--r-full)",
                                                            background: isChecked
                                                                ? "color-mix(in srgb, var(--on-p-container) 12%, transparent)"
                                                                : "var(--surf-high)",
                                                        }}
                                                    >
                                                        <Icon className="h-4 w-4" />
                                                    </span>
                                                    <span className="flex flex-col gap-0.5">
                                                        <span
                                                            style={{
                                                                fontSize: "0.875rem",
                                                                fontWeight: 600,
                                                            }}
                                                        >
                                                            {meta.label}
                                                        </span>
                                                        <span
                                                            style={{
                                                                fontSize: "0.75rem",
                                                                color: isChecked
                                                                    ? "color-mix(in srgb, var(--on-p-container) 75%, transparent)"
                                                                    : "var(--on-surf-var)",
                                                            }}
                                                        >
                                                            {meta.description}
                                                        </span>
                                                    </span>
                                                </button>
                                            );
                                        })}
                                    </div>
                                )}
                            />
                        </div>

                        {/* Notas (opcional) */}
                        <div>
                            <label htmlFor="dep-notes" style={LABEL_STYLE}>
                                Notas{" "}
                                <span style={{ textTransform: "none", fontWeight: 400 }}>
                                    (opcional)
                                </span>
                            </label>
                            <textarea
                                id="dep-notes"
                                rows={2}
                                placeholder="Ej. Reposición de cambio del turno anterior."
                                style={TEXTAREA_STYLE}
                                {...form.register("notes")}
                            />
                        </div>
                    </div>

                    <div className="px-6 pt-4 pb-6 flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={() => handleOpenChange(false)}
                            style={SECONDARY_BUTTON_STYLE}
                            disabled={submitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitDisabled}
                            style={{
                                ...PRIMARY_BUTTON_STYLE,
                                opacity: submitDisabled ? 0.6 : 1,
                                cursor: submitDisabled ? "not-allowed" : "pointer",
                            }}
                        >
                            {submitting ? "Registrando..." : "Registrar entrada"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
