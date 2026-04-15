"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Ban, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    CLOSE_BUTTON_STYLE,
    DANGER_BUTTON_STYLE,
    DESCRIPTION_STYLE,
    ERROR_STYLE,
    INPUT_STYLE,
    LABEL_STYLE,
    MODAL_STYLE,
    SECONDARY_BUTTON_STYLE,
    TITLE_STYLE,
} from "./shared-tokens";

const schema = z.object({
    motivoAnulacion: z
        .string()
        .trim()
        .min(5, "El motivo debe tener al menos 5 caracteres."),
});

type FormValues = z.infer<typeof schema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    expenseId: string;
    expenseDescripcion: string;
}

export function AnularGastoDialog({
    open,
    onOpenChange,
    expenseId,
    expenseDescripcion,
}: Props): React.ReactElement {
    const router = useRouter();

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { motivoAnulacion: "" },
    });

    useEffect(() => {
        if (!open) form.reset({ motivoAnulacion: "" });
    }, [open, form]);

    const onSubmit = async (values: FormValues): Promise<void> => {
        toast.loading("Anulando gasto...", { id: "tes-anular" });
        const res = await fetch(
            `/api/tesoreria/expenses/${expenseId}/anular`,
            {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ motivoAnulacion: values.motivoAnulacion }),
            },
        );
        const json = (await res.json()) as { success: boolean; error?: string };
        if (!json.success) {
            toast.error(json.error ?? "Error al anular", { id: "tes-anular" });
            return;
        }
        toast.success("Gasto anulado", { id: "tes-anular" });
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
                                        background: "var(--ter-container)",
                                        color: "var(--on-ter-container)",
                                    }}
                                >
                                    <Ban className="h-5 w-5" />
                                </div>
                                <DialogTitle style={TITLE_STYLE}>Anular gasto</DialogTitle>
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
                            Estás a punto de anular el gasto &ldquo;{expenseDescripcion}
                            &rdquo;. La anulación es inmutable y queda registrada para
                            auditoría.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 pb-2 space-y-4">
                        <div>
                            <label htmlFor="tes-motivo" style={LABEL_STYLE}>
                                Motivo de la anulación
                            </label>
                            <input
                                id="tes-motivo"
                                type="text"
                                placeholder="Ej. Duplicado, monto incorrecto, fecha errónea"
                                style={INPUT_STYLE}
                                {...form.register("motivoAnulacion")}
                            />
                            {form.formState.errors.motivoAnulacion && (
                                <p style={ERROR_STYLE}>
                                    {form.formState.errors.motivoAnulacion.message}
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
                                ...DANGER_BUTTON_STYLE,
                                opacity: submitting ? 0.6 : 1,
                                cursor: submitting ? "not-allowed" : "pointer",
                            }}
                        >
                            {submitting ? "Anulando..." : "Anular gasto"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
