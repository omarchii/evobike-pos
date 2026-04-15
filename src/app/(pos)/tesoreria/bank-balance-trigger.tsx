"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { ActualizarSaldoBancarioDialog } from "./actualizar-saldo-bancario-dialog";

interface Props {
    isAdmin: boolean;
}

const BTN_BASE: React.CSSProperties = {
    height: 36,
    paddingInline: "0.875rem",
    borderRadius: "var(--r-full)",
    border: "none",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "0.8125rem",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
    cursor: "pointer",
    background: "var(--surf-high)",
    color: "var(--on-surf)",
};

const BTN_DISABLED: React.CSSProperties = {
    ...BTN_BASE,
    opacity: 0.45,
    cursor: "not-allowed",
};

export function BankBalanceTrigger({ isAdmin }: Props): React.ReactElement {
    const [open, setOpen] = useState(false);

    return (
        <>
            <button
                type="button"
                onClick={() => (isAdmin ? setOpen(true) : null)}
                disabled={!isAdmin}
                title={
                    isAdmin
                        ? "Registrar nuevo saldo bancario"
                        : "Solo ADMIN puede actualizar el saldo bancario"
                }
                style={isAdmin ? BTN_BASE : BTN_DISABLED}
            >
                <RefreshCw className="h-3.5 w-3.5" />
                Actualizar saldo
            </button>
            {isAdmin && (
                <ActualizarSaldoBancarioDialog open={open} onOpenChange={setOpen} />
            )}
        </>
    );
}
