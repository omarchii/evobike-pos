"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Pencil, Upload, Trash2, X } from "lucide-react";
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
    EXPENSE_CATEGORIES,
    EXPENSE_CATEGORY_LABELS,
    INPUT_STYLE,
    LABEL_STYLE,
    MODAL_STYLE,
    PRIMARY_BUTTON_STYLE,
    SECONDARY_BUTTON_STYLE,
    SELECT_STYLE,
    TITLE_STYLE,
    type ExpenseCategoryTuple,
} from "./shared-tokens";

const schema = z.object({
    categoria: z.enum(EXPENSE_CATEGORIES),
    descripcion: z.string().trim().min(1, "La descripción es obligatoria."),
});

type FormValues = z.infer<typeof schema>;

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    expenseId: string;
    initialCategoria: ExpenseCategoryTuple;
    initialDescripcion: string;
    comprobanteUrl: string | null;
}

export function EditarGastoDialog({
    open,
    onOpenChange,
    expenseId,
    initialCategoria,
    initialDescripcion,
    comprobanteUrl,
}: Props): React.ReactElement {
    const router = useRouter();
    const [newFile, setNewFile] = useState<File | null>(null);
    const [busy, setBusy] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            categoria: initialCategoria,
            descripcion: initialDescripcion,
        },
    });

    useEffect(() => {
        if (open) {
            form.reset({
                categoria: initialCategoria,
                descripcion: initialDescripcion,
            });
        }
    }, [open, form, initialCategoria, initialDescripcion]);

    const handleOpenChange = (next: boolean): void => {
        if (!next) setNewFile(null);
        onOpenChange(next);
    };

    const onSubmit = async (values: FormValues): Promise<void> => {
        toast.loading("Guardando cambios...", { id: "tes-edit" });
        setBusy(true);

        const patchRes = await fetch(`/api/tesoreria/expenses/${expenseId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                categoria: values.categoria,
                descripcion: values.descripcion,
            }),
        });
        const patchJson = (await patchRes.json()) as { success: boolean; error?: string };
        if (!patchJson.success) {
            setBusy(false);
            toast.error(patchJson.error ?? "Error al actualizar", { id: "tes-edit" });
            return;
        }

        if (newFile) {
            const fd = new FormData();
            fd.append("file", newFile);
            const upRes = await fetch(
                `/api/tesoreria/expenses/${expenseId}/comprobante`,
                { method: "POST", body: fd },
            );
            const upJson = (await upRes.json()) as { success: boolean; error?: string };
            if (!upJson.success) {
                setBusy(false);
                toast.error(upJson.error ?? "Error al subir comprobante", { id: "tes-edit" });
                return;
            }
        }

        setBusy(false);
        toast.success("Gasto actualizado", { id: "tes-edit" });
        handleOpenChange(false);
        router.refresh();
    };

    const onDeleteComprobante = async (): Promise<void> => {
        if (!comprobanteUrl) return;
        toast.loading("Eliminando comprobante...", { id: "tes-edit" });
        setBusy(true);
        const res = await fetch(
            `/api/tesoreria/expenses/${expenseId}/comprobante`,
            { method: "DELETE" },
        );
        const json = (await res.json()) as { success: boolean; error?: string };
        setBusy(false);
        if (!json.success) {
            toast.error(json.error ?? "Error al eliminar", { id: "tes-edit" });
            return;
        }
        toast.success("Comprobante eliminado", { id: "tes-edit" });
        router.refresh();
    };

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
                                        background: "var(--surf-high)",
                                        color: "var(--on-surf)",
                                    }}
                                >
                                    <Pencil className="h-5 w-5" />
                                </div>
                                <DialogTitle style={TITLE_STYLE}>Editar gasto</DialogTitle>
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
                            Solo se pueden editar descripción, categoría y comprobante. Para
                            corregir monto, fecha o método, anula el gasto y crea uno nuevo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 pb-2 space-y-4">
                        <div>
                            <label htmlFor="tes-edit-categoria" style={LABEL_STYLE}>
                                Categoría
                            </label>
                            <select
                                id="tes-edit-categoria"
                                style={SELECT_STYLE}
                                {...form.register("categoria")}
                            >
                                {EXPENSE_CATEGORIES.map((c) => (
                                    <option key={c} value={c}>
                                        {EXPENSE_CATEGORY_LABELS[c as ExpenseCategoryTuple]}
                                    </option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label htmlFor="tes-edit-desc" style={LABEL_STYLE}>
                                Descripción
                            </label>
                            <input
                                id="tes-edit-desc"
                                type="text"
                                style={INPUT_STYLE}
                                {...form.register("descripcion")}
                            />
                            {form.formState.errors.descripcion && (
                                <p style={ERROR_STYLE}>
                                    {form.formState.errors.descripcion.message}
                                </p>
                            )}
                        </div>

                        <div>
                            <label style={LABEL_STYLE}>Comprobante</label>
                            {comprobanteUrl && !newFile ? (
                                <div className="flex items-center justify-between gap-3" style={{ ...INPUT_STYLE, paddingInline: "0.75rem" }}>
                                    <a
                                        href={comprobanteUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="truncate underline"
                                        style={{ color: "var(--on-surf)" }}
                                    >
                                        Ver comprobante actual
                                    </a>
                                    <button
                                        type="button"
                                        onClick={onDeleteComprobante}
                                        disabled={busy}
                                        className="shrink-0 inline-flex items-center gap-1 text-[0.75rem]"
                                        style={{
                                            color: "var(--ter)",
                                            background: "transparent",
                                            border: "none",
                                            cursor: "pointer",
                                        }}
                                    >
                                        <Trash2 className="h-3.5 w-3.5" />
                                        Eliminar
                                    </button>
                                </div>
                            ) : (
                                <label
                                    htmlFor="tes-edit-file"
                                    className="flex items-center gap-3 cursor-pointer"
                                    style={{
                                        ...INPUT_STYLE,
                                        display: "flex",
                                        alignItems: "center",
                                        color: newFile ? "var(--on-surf)" : "var(--on-surf-var)",
                                    }}
                                >
                                    <Upload className="h-4 w-4" />
                                    <span className="truncate">
                                        {newFile ? newFile.name : "Adjuntar PDF o imagen (máx 10MB)"}
                                    </span>
                                    <input
                                        id="tes-edit-file"
                                        type="file"
                                        accept="application/pdf,image/png,image/jpeg,image/webp"
                                        className="hidden"
                                        onChange={(e) => setNewFile(e.target.files?.[0] ?? null)}
                                    />
                                </label>
                            )}
                        </div>
                    </div>

                    <div className="px-6 pt-4 pb-6 flex gap-3 justify-end">
                        <button
                            type="button"
                            onClick={() => handleOpenChange(false)}
                            style={SECONDARY_BUTTON_STYLE}
                            disabled={busy}
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={busy}
                            style={{
                                ...PRIMARY_BUTTON_STYLE,
                                opacity: busy ? 0.6 : 1,
                                cursor: busy ? "not-allowed" : "pointer",
                            }}
                        >
                            {busy ? "Guardando..." : "Guardar cambios"}
                        </button>
                    </div>
                </form>
            </DialogContent>
        </Dialog>
    );
}
