"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
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
import { Receipt, X } from "lucide-react";

const CASH_EXPENSE_CATEGORIES = [
    "MENSAJERIA",
    "PAPELERIA",
    "CONSUMO",
    "MANTENIMIENTO",
    "PAGO_PROVEEDOR",
    "LIMPIEZA",
    "AJUSTE_CAJA",
    "OTRO",
] as const;

type CashExpenseCategory = (typeof CASH_EXPENSE_CATEGORIES)[number];

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

const SELECT_STYLE: React.CSSProperties = {
    ...INPUT_STYLE,
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233d5247' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.9rem center",
    paddingRight: "2.5rem",
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

const CATEGORY_LABELS: Record<CashExpenseCategory, string> = {
    MENSAJERIA: "Mensajería",
    PAPELERIA: "Papelería",
    CONSUMO: "Consumo",
    MANTENIMIENTO: "Mantenimiento",
    PAGO_PROVEEDOR: "Pago a proveedor",
    LIMPIEZA: "Limpieza",
    AJUSTE_CAJA: "Ajuste de caja",
    OTRO: "Otro",
};

const SELLER_EXPENSE_LIMIT = 500;

const expenseFormSchema = z.object({
    amount: z
        .number({ message: "Ingresa un monto válido" })
        .positive("El monto debe ser mayor a cero"),
    method: z.literal("CASH"),
    category: z.enum(CASH_EXPENSE_CATEGORIES),
    beneficiary: z.string().trim().optional(),
    notes: z
        .string()
        .trim()
        .min(3, "El motivo debe tener al menos 3 caracteres."),
});

type ExpenseFormValues = z.infer<typeof expenseFormSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    userRole: string;
}

export function ExpenseDialog({ open, onOpenChange, userRole }: Props): React.ReactElement {
    const router = useRouter();
    const form = useForm<ExpenseFormValues>({
        resolver: zodResolver(expenseFormSchema),
        defaultValues: {
            amount: 0,
            method: "CASH",
            category: "OTRO",
            beneficiary: "",
            notes: "",
        },
    });

    useEffect(() => {
        if (!open) {
            form.reset({
                amount: 0,
                method: "CASH",
                category: "OTRO",
                beneficiary: "",
                notes: "",
            });
        }
    }, [open, form]);

    const amount = form.watch("amount");
    const isOverSellerLimit = userRole === "SELLER" && amount > SELLER_EXPENSE_LIMIT;

    const onSubmit = async (values: ExpenseFormValues): Promise<void> => {
        toast.loading("Registrando gasto...", { id: "cash-expense" });
        const res = await fetch("/api/cash/expense", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount: values.amount,
                method: "CASH",
                category: values.category,
                beneficiary: values.beneficiary?.trim() || undefined,
                notes: values.notes,
            }),
        });
        const json = (await res.json()) as { success: boolean; error?: string };

        if (!json.success) {
            toast.error(json.error ?? "Error al registrar gasto", { id: "cash-expense" });
            return;
        }

        toast.success("Gasto registrado", { id: "cash-expense" });
        onOpenChange(false);
        router.refresh();
    };

    const submitting = form.formState.isSubmitting;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
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
                                        background: "var(--surf-high)",
                                        color: "var(--on-surf)",
                                    }}
                                >
                                    <Receipt className="h-5 w-5" />
                                </div>
                                <DialogTitle style={TITLE_STYLE}>Registrar gasto</DialogTitle>
                            </div>
                            <button
                                type="button"
                                onClick={() => onOpenChange(false)}
                                style={CLOSE_BUTTON_STYLE}
                                aria-label="Cerrar"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <DialogDescription style={DESCRIPTION_STYLE}>
                            Registra un gasto en efectivo del turno. Queda documentado en el arqueo
                            de caja con categoría y descripción.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 pb-2 space-y-4">
                        <div>
                            <label htmlFor="exp-amount" style={LABEL_STYLE}>
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
                                    id="exp-amount"
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
                                <p style={ERROR_STYLE}>{form.formState.errors.amount.message}</p>
                            )}
                            {isOverSellerLimit && (
                                <p style={{ ...ERROR_STYLE, color: "var(--warn)" }}>
                                    Arriba de ${SELLER_EXPENSE_LIMIT}. Requiere autorización de gerente
                                    (pendiente en fase P5).
                                </p>
                            )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="exp-method" style={LABEL_STYLE}>
                                    Método
                                </label>
                                <select
                                    id="exp-method"
                                    style={SELECT_STYLE}
                                    {...form.register("method")}
                                >
                                    <option value="CASH">Efectivo</option>
                                </select>
                            </div>
                            <div>
                                <label htmlFor="exp-category" style={LABEL_STYLE}>
                                    Categoría
                                </label>
                                <select
                                    id="exp-category"
                                    style={SELECT_STYLE}
                                    {...form.register("category")}
                                >
                                    {(Object.keys(CATEGORY_LABELS) as CashExpenseCategory[]).map(
                                        (key) => (
                                            <option key={key} value={key}>
                                                {CATEGORY_LABELS[key]}
                                            </option>
                                        ),
                                    )}
                                </select>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="exp-beneficiary" style={LABEL_STYLE}>
                                Beneficiario{" "}
                                <span style={{ textTransform: "none", fontWeight: 400 }}>
                                    (opcional)
                                </span>
                            </label>
                            <input
                                id="exp-beneficiary"
                                type="text"
                                placeholder="Nombre o razón social del proveedor"
                                style={INPUT_STYLE}
                                {...form.register("beneficiary")}
                            />
                        </div>

                        <div>
                            <label htmlFor="exp-notes" style={LABEL_STYLE}>
                                Motivo
                            </label>
                            <input
                                id="exp-notes"
                                type="text"
                                placeholder="Ej. Café para clientes, toner de impresora"
                                style={INPUT_STYLE}
                                {...form.register("notes")}
                            />
                            {form.formState.errors.notes && (
                                <p style={ERROR_STYLE}>
                                    {form.formState.errors.notes.message}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="px-6 pt-4 pb-6 flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            style={SECONDARY_BUTTON_STYLE}
                            disabled={submitting}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            style={{
                                ...PRIMARY_BUTTON_STYLE,
                                opacity: submitting ? 0.6 : 1,
                                cursor: submitting ? "not-allowed" : "pointer",
                            }}
                        >
                            {submitting ? "Registrando..." : "Registrar gasto"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
