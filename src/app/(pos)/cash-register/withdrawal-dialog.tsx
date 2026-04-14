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
import { Vault, X } from "lucide-react";

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

const withdrawalFormSchema = z.object({
    amount: z
        .number({ message: "Ingresa un monto válido" })
        .positive("El monto debe ser mayor a cero"),
    reference: z
        .string()
        .trim()
        .min(3, "El motivo debe tener al menos 3 caracteres."),
});

type WithdrawalFormValues = z.infer<typeof withdrawalFormSchema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function WithdrawalDialog({ open, onOpenChange }: Props): React.ReactElement {
    const router = useRouter();
    const form = useForm<WithdrawalFormValues>({
        resolver: zodResolver(withdrawalFormSchema),
        defaultValues: { amount: 0, reference: "" },
    });

    useEffect(() => {
        if (!open) {
            form.reset({ amount: 0, reference: "" });
        }
    }, [open, form]);

    const onSubmit = async (values: WithdrawalFormValues): Promise<void> => {
        toast.loading("Registrando retiro...", { id: "cash-withdrawal" });
        const res = await fetch("/api/cash/withdrawal", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                amount: values.amount,
                reference: values.reference,
            }),
        });
        const json = (await res.json()) as { success: boolean; error?: string };

        if (!json.success) {
            toast.error(json.error ?? "Error al registrar retiro", { id: "cash-withdrawal" });
            return;
        }

        toast.success("Retiro registrado", { id: "cash-withdrawal" });
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
                                    <Vault className="h-5 w-5" />
                                </div>
                                <DialogTitle style={TITLE_STYLE}>Retiro a bóveda</DialogTitle>
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
                            Registra un retiro de efectivo del cajón. Queda asentado en el arqueo
                            con el motivo que especifiques.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 pb-2 space-y-4">
                        <div>
                            <label htmlFor="wd-amount" style={LABEL_STYLE}>
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
                                    id="wd-amount"
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
                        </div>

                        <div>
                            <label htmlFor="wd-reference" style={LABEL_STYLE}>
                                Motivo
                            </label>
                            <input
                                id="wd-reference"
                                type="text"
                                placeholder="Ej. Depósito bancario, fondo de cambio"
                                style={INPUT_STYLE}
                                {...form.register("reference")}
                            />
                            {form.formState.errors.reference && (
                                <p style={ERROR_STYLE}>
                                    {form.formState.errors.reference.message}
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
                            {submitting ? "Registrando..." : "Registrar retiro"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
