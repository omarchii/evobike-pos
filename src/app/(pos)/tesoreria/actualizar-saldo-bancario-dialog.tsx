"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Landmark, X } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    CLOSE_BUTTON_STYLE,
    DESCRIPTION_STYLE,
    ERROR_STYLE,
    INPUT_STYLE,
    LABEL_STYLE,
    MODAL_STYLE,
    PRIMARY_BUTTON_STYLE,
    SECONDARY_BUTTON_STYLE,
    TITLE_STYLE,
} from "./shared-tokens";

const schema = z.object({
    monto: z
        .number({ message: "Ingresa un monto válido" })
        .positive("El monto debe ser mayor a cero"),
    notas: z.string().trim().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ActualizarSaldoBancarioDialog({
    open,
    onOpenChange,
}: Props): React.ReactElement {
    const router = useRouter();

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: { monto: 0, notas: "" },
    });

    useEffect(() => {
        if (!open) form.reset({ monto: 0, notas: "" });
    }, [open, form]);

    const onSubmit = async (values: FormValues): Promise<void> => {
        toast.loading("Registrando saldo...", { id: "tes-bank" });
        const res = await fetch("/api/tesoreria/bank-balance", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                monto: values.monto,
                notas: values.notas || undefined,
            }),
        });
        const json = (await res.json()) as { success: boolean; error?: string };
        if (!json.success) {
            toast.error(json.error ?? "Error al registrar saldo", { id: "tes-bank" });
            return;
        }
        toast.success("Saldo bancario actualizado", { id: "tes-bank" });
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
                                    <Landmark className="h-5 w-5" />
                                </div>
                                <DialogTitle style={TITLE_STYLE}>Actualizar saldo bancario</DialogTitle>
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
                            Cada actualización crea un snapshot nuevo. El historial es
                            inmutable.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 pb-2 space-y-4">
                        <div>
                            <label htmlFor="tes-bank-monto" style={LABEL_STYLE}>
                                Saldo actual
                            </label>
                            <input
                                id="tes-bank-monto"
                                type="number"
                                step="0.01"
                                inputMode="decimal"
                                placeholder="0.00"
                                autoFocus
                                style={INPUT_STYLE}
                                {...form.register("monto", { valueAsNumber: true })}
                            />
                            {form.formState.errors.monto && (
                                <p style={ERROR_STYLE}>
                                    {form.formState.errors.monto.message}
                                </p>
                            )}
                        </div>
                        <div>
                            <label htmlFor="tes-bank-notas" style={LABEL_STYLE}>
                                Notas{" "}
                                <span style={{ textTransform: "none", fontWeight: 400 }}>
                                    (opcional)
                                </span>
                            </label>
                            <input
                                id="tes-bank-notas"
                                type="text"
                                placeholder="Ej. Cierre de mes, conciliación"
                                style={INPUT_STYLE}
                                {...form.register("notas")}
                            />
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
                            {submitting ? "Registrando..." : "Registrar saldo"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
