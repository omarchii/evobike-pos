"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
    AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { CheckCircle2 } from "lucide-react";

interface Props {
    transactionId: string;
    methodLabel: string;
    amountLabel: string;
}

export function CollectPendingButton({
    transactionId,
    methodLabel,
    amountLabel,
}: Props): React.ReactElement {
    const router = useRouter();
    const [submitting, setSubmitting] = useState(false);

    const handleConfirm = async (): Promise<void> => {
        setSubmitting(true);
        toast.loading("Marcando como cobrado...", { id: `collect-${transactionId}` });
        const res = await fetch(`/api/cash/transactions/${transactionId}/collect`, {
            method: "PATCH",
        });
        const json = (await res.json()) as { success: boolean; error?: string };
        setSubmitting(false);

        if (!json.success) {
            toast.error(json.error ?? "Error al marcar como cobrado", {
                id: `collect-${transactionId}`,
            });
            return;
        }

        toast.success("Cobro registrado", { id: `collect-${transactionId}` });
        router.refresh();
    };

    return (
        <AlertDialog>
            <AlertDialogTrigger asChild>
                <button
                    type="button"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-[var(--r-full)] text-[0.6875rem] font-medium transition-opacity"
                    style={{
                        background: "var(--sec-container)",
                        color: "var(--on-sec-container)",
                        border: "none",
                        cursor: submitting ? "not-allowed" : "pointer",
                        opacity: submitting ? 0.6 : 1,
                    }}
                >
                    <CheckCircle2 className="h-3 w-3" />
                    Cobrar
                </button>
            </AlertDialogTrigger>
            <AlertDialogContent
                style={{
                    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
                    backdropFilter: "blur(20px)",
                    WebkitBackdropFilter: "blur(20px)",
                    boxShadow: "var(--shadow)",
                    borderRadius: "var(--r-xl)",
                    border: "none",
                }}
            >
                <AlertDialogHeader>
                    <AlertDialogTitle
                        style={{
                            fontFamily: "var(--font-display)",
                            fontSize: "1.25rem",
                            fontWeight: 700,
                            letterSpacing: "-0.01em",
                            color: "var(--on-surf)",
                        }}
                    >
                        ¿Marcar como cobrado?
                    </AlertDialogTitle>
                    <AlertDialogDescription
                        style={{
                            fontSize: "0.8125rem",
                            color: "var(--on-surf-var)",
                            lineHeight: 1.5,
                        }}
                    >
                        Confirmas que el pago de {amountLabel} por {methodLabel} ya se liquidó. El
                        método de pago no cambia, solo se registra la fecha de cobro.
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel>Cancelar</AlertDialogCancel>
                    <AlertDialogAction
                        onClick={handleConfirm}
                        style={{
                            background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
                            color: "#FFFFFF",
                            border: "none",
                        }}
                    >
                        Marcar cobrado
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
}
