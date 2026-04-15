"use client";

import { useEffect, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Receipt, Upload, X } from "lucide-react";
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
    METHOD_LABELS,
    MODAL_STYLE,
    OPERATIONAL_METHODS,
    PRIMARY_BUTTON_STYLE,
    SECONDARY_BUTTON_STYLE,
    SELECT_STYLE,
    TITLE_STYLE,
    type ExpenseCategoryTuple,
} from "./shared-tokens";

function todayLocalISO(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, "0");
    const d = String(now.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
}

const schema = z
    .object({
        categoria: z.enum(EXPENSE_CATEGORIES),
        descripcion: z.string().trim().min(1, "La descripción es obligatoria."),
        monto: z
            .number({ message: "Ingresa un monto válido" })
            .positive("El monto debe ser mayor a cero"),
        fecha: z.string().min(1, "La fecha es obligatoria."),
        metodoPago: z.enum(OPERATIONAL_METHODS),
        branchId: z.string().optional(),
    })
    .superRefine((data, ctx) => {
        const d = new Date(data.fecha);
        if (Number.isNaN(d.getTime())) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["fecha"],
                message: "Fecha inválida",
            });
            return;
        }
        if (d.getTime() > Date.now() + 24 * 60 * 60 * 1000) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["fecha"],
                message: "La fecha no puede ser futura",
            });
        }
    });

type FormValues = z.infer<typeof schema>;

interface BranchOption {
    id: string;
    name: string;
}

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    isAdmin: boolean;
    branches: BranchOption[];
    defaultBranchId: string;
}

export function NuevoGastoDialog({
    open,
    onOpenChange,
    isAdmin,
    branches,
    defaultBranchId,
}: Props): React.ReactElement {
    const router = useRouter();
    const [file, setFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const form = useForm<FormValues>({
        resolver: zodResolver(schema),
        defaultValues: {
            categoria: "OTRO",
            descripcion: "",
            monto: 0,
            fecha: todayLocalISO(),
            metodoPago: "TRANSFER",
            branchId: defaultBranchId,
        },
    });

    useEffect(() => {
        if (!open) {
            form.reset({
                categoria: "OTRO",
                descripcion: "",
                monto: 0,
                fecha: todayLocalISO(),
                metodoPago: "TRANSFER",
                branchId: defaultBranchId,
            });
        }
    }, [open, form, defaultBranchId]);

    const handleOpenChange = (next: boolean): void => {
        if (!next) setFile(null);
        onOpenChange(next);
    };

    const metodoPago = useWatch({
        control: form.control,
        name: "metodoPago",
    });
    const needsComprobante = metodoPago === "TRANSFER";

    const onSubmit = async (values: FormValues): Promise<void> => {
        if (needsComprobante && !file) {
            toast.error(
                "El comprobante es obligatorio para transferencias",
                { id: "tes-expense" },
            );
            return;
        }

        toast.loading("Registrando gasto...", { id: "tes-expense" });

        const fechaDate = new Date(values.fecha);

        const createRes = await fetch("/api/tesoreria/expenses", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                categoria: values.categoria,
                descripcion: values.descripcion,
                monto: values.monto,
                fecha: fechaDate.toISOString(),
                metodoPago: values.metodoPago,
                comprobanteUrl: needsComprobante ? "https://placeholder.local/tmp" : undefined,
                branchId: isAdmin ? values.branchId : undefined,
            }),
        });
        const createJson = (await createRes.json()) as {
            success: boolean;
            error?: string;
            data?: { id: string };
        };

        if (!createJson.success || !createJson.data) {
            toast.error(createJson.error ?? "Error al registrar gasto", {
                id: "tes-expense",
            });
            return;
        }

        const expenseId = createJson.data.id;

        if (file) {
            setUploading(true);
            const fd = new FormData();
            fd.append("file", file);
            const upRes = await fetch(
                `/api/tesoreria/expenses/${expenseId}/comprobante`,
                { method: "POST", body: fd },
            );
            setUploading(false);
            const upJson = (await upRes.json()) as {
                success: boolean;
                error?: string;
            };
            if (!upJson.success) {
                toast.error(
                    `Gasto creado, pero falló el comprobante: ${upJson.error ?? "Error"}`,
                    { id: "tes-expense" },
                );
                handleOpenChange(false);
                router.refresh();
                return;
            }
        }

        toast.success("Gasto registrado", { id: "tes-expense" });
        handleOpenChange(false);
        router.refresh();
    };

    const submitting = form.formState.isSubmitting || uploading;

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
                                    <Receipt className="h-5 w-5" />
                                </div>
                                <DialogTitle style={TITLE_STYLE}>Nuevo gasto operativo</DialogTitle>
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
                            Para gastos pagados en efectivo desde el cajón, usa el módulo de
                            Caja. Aquí se registran gastos con tarjeta, transferencia o
                            crédito.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="px-6 pb-2 space-y-4">
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="tes-monto" style={LABEL_STYLE}>
                                    Monto
                                </label>
                                <input
                                    id="tes-monto"
                                    type="number"
                                    step="0.01"
                                    inputMode="decimal"
                                    placeholder="0.00"
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
                                <label htmlFor="tes-fecha" style={LABEL_STYLE}>
                                    Fecha
                                </label>
                                <input
                                    id="tes-fecha"
                                    type="date"
                                    style={INPUT_STYLE}
                                    {...form.register("fecha")}
                                />
                                {form.formState.errors.fecha && (
                                    <p style={ERROR_STYLE}>
                                        {form.formState.errors.fecha.message}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label htmlFor="tes-categoria" style={LABEL_STYLE}>
                                    Categoría
                                </label>
                                <select
                                    id="tes-categoria"
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
                                <label htmlFor="tes-metodo" style={LABEL_STYLE}>
                                    Método de pago
                                </label>
                                <select
                                    id="tes-metodo"
                                    style={SELECT_STYLE}
                                    {...form.register("metodoPago")}
                                >
                                    {OPERATIONAL_METHODS.map((m) => (
                                        <option key={m} value={m}>
                                            {METHOD_LABELS[m]}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {isAdmin && branches.length > 1 && (
                            <div>
                                <label htmlFor="tes-branch" style={LABEL_STYLE}>
                                    Sucursal
                                </label>
                                <select
                                    id="tes-branch"
                                    style={SELECT_STYLE}
                                    {...form.register("branchId")}
                                >
                                    {branches.map((b) => (
                                        <option key={b.id} value={b.id}>
                                            {b.name}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        )}

                        <div>
                            <label htmlFor="tes-descripcion" style={LABEL_STYLE}>
                                Descripción
                            </label>
                            <input
                                id="tes-descripcion"
                                type="text"
                                placeholder="Ej. Renta oficina abril 2026"
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
                            <label htmlFor="tes-comprobante" style={LABEL_STYLE}>
                                Comprobante{" "}
                                <span style={{ textTransform: "none", fontWeight: 400 }}>
                                    {needsComprobante ? "(obligatorio)" : "(opcional)"}
                                </span>
                            </label>
                            <label
                                htmlFor="tes-comprobante"
                                className="flex items-center gap-3 cursor-pointer"
                                style={{
                                    ...INPUT_STYLE,
                                    display: "flex",
                                    alignItems: "center",
                                    color: file ? "var(--on-surf)" : "var(--on-surf-var)",
                                }}
                            >
                                <Upload className="h-4 w-4" />
                                <span className="truncate">
                                    {file ? file.name : "Adjuntar PDF o imagen (máx 10MB)"}
                                </span>
                                <input
                                    id="tes-comprobante"
                                    type="file"
                                    accept="application/pdf,image/png,image/jpeg,image/webp"
                                    className="hidden"
                                    onChange={(e) => {
                                        const f = e.target.files?.[0] ?? null;
                                        setFile(f);
                                    }}
                                />
                            </label>
                            {needsComprobante && !file && (
                                <p
                                    style={{
                                        ...ERROR_STYLE,
                                        color: "var(--on-surf-var)",
                                    }}
                                >
                                    Las transferencias requieren adjuntar comprobante.
                                </p>
                            )}
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
