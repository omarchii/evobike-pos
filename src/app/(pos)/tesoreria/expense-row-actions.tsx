"use client";

import { useState } from "react";
import { Pencil, Ban } from "lucide-react";
import { EditarGastoDialog } from "./editar-gasto-dialog";
import { AnularGastoDialog } from "./anular-gasto-dialog";
import type { ExpenseCategoryTuple } from "./shared-tokens";

interface Props {
    expenseId: string;
    categoria: ExpenseCategoryTuple;
    descripcion: string;
    comprobanteUrl: string | null;
    canEdit: boolean;
    canAnular: boolean;
    isAnulado: boolean;
}

const iconBtn: React.CSSProperties = {
    background: "transparent",
    border: "none",
    padding: 6,
    borderRadius: "var(--r-md)",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    color: "var(--on-surf-var)",
};

export function ExpenseRowActions({
    expenseId,
    categoria,
    descripcion,
    comprobanteUrl,
    canEdit,
    canAnular,
    isAnulado,
}: Props): React.ReactElement {
    const [editOpen, setEditOpen] = useState(false);
    const [anularOpen, setAnularOpen] = useState(false);

    const disabledBtn: React.CSSProperties = {
        ...iconBtn,
        opacity: 0.35,
        cursor: "not-allowed",
    };

    return (
        <div className="inline-flex items-center gap-1">
            <button
                type="button"
                onClick={() => setEditOpen(true)}
                disabled={!canEdit || isAnulado}
                title={
                    isAnulado
                        ? "Este gasto está anulado"
                        : canEdit
                          ? "Editar gasto"
                          : "Solo el mismo día puede editarse"
                }
                style={canEdit && !isAnulado ? iconBtn : disabledBtn}
                aria-label="Editar gasto"
            >
                <Pencil className="h-4 w-4" />
            </button>
            <button
                type="button"
                onClick={() => setAnularOpen(true)}
                disabled={!canAnular || isAnulado}
                title={
                    isAnulado
                        ? "Ya está anulado"
                        : canAnular
                          ? "Anular gasto"
                          : "Solo ADMIN puede anular"
                }
                style={canAnular && !isAnulado ? iconBtn : disabledBtn}
                aria-label="Anular gasto"
            >
                <Ban className="h-4 w-4" />
            </button>

            <EditarGastoDialog
                open={editOpen}
                onOpenChange={setEditOpen}
                expenseId={expenseId}
                initialCategoria={categoria}
                initialDescripcion={descripcion}
                comprobanteUrl={comprobanteUrl}
            />
            <AnularGastoDialog
                open={anularOpen}
                onOpenChange={setAnularOpen}
                expenseId={expenseId}
                expenseDescripcion={descripcion}
            />
        </div>
    );
}
