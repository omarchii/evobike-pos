"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { Plus } from "lucide-react";
import {
    EXPENSE_CATEGORIES,
    EXPENSE_CATEGORY_LABELS,
    INPUT_STYLE,
    LABEL_STYLE,
    SELECT_STYLE,
    type ExpenseCategoryTuple,
} from "./shared-tokens";

interface BranchOption {
    id: string;
    name: string;
}

interface Props {
    isAdmin: boolean;
    branches: BranchOption[];
    currentFrom: string;
    currentTo: string;
    currentCategoria: string;
    currentBranchId: string;
    currentSoloSinComprobante: boolean;
    onNewExpense: () => void;
}

const TRIGGER_BUTTON: React.CSSProperties = {
    background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
    color: "#FFFFFF",
    borderRadius: "var(--r-full)",
    border: "none",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "0.8125rem",
    height: 40,
    paddingInline: "1.25rem",
    cursor: "pointer",
    display: "inline-flex",
    alignItems: "center",
    gap: "0.5rem",
};

const COMPACT_SELECT: React.CSSProperties = {
    ...SELECT_STYLE,
    height: 40,
    fontSize: "0.875rem",
};
const COMPACT_INPUT: React.CSSProperties = {
    ...INPUT_STYLE,
    height: 40,
    fontSize: "0.875rem",
};

export function FiltersBar({
    isAdmin,
    branches,
    currentFrom,
    currentTo,
    currentCategoria,
    currentBranchId,
    currentSoloSinComprobante,
    onNewExpense,
}: Props): React.ReactElement {
    const router = useRouter();
    const params = useSearchParams();
    const [pending, startTransition] = useTransition();

    const update = (patch: Record<string, string | null>): void => {
        const next = new URLSearchParams(params.toString());
        for (const [k, v] of Object.entries(patch)) {
            if (v === null || v === "") next.delete(k);
            else next.set(k, v);
        }
        startTransition(() => {
            router.replace(`/tesoreria?${next.toString()}`, { scroll: false });
        });
    };

    return (
        <div
            className="rounded-[var(--r-xl)] p-4"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
            <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[140px]">
                    <label style={LABEL_STYLE} htmlFor="f-from">
                        Desde
                    </label>
                    <input
                        id="f-from"
                        type="date"
                        style={COMPACT_INPUT}
                        value={currentFrom}
                        onChange={(e) => update({ from: e.target.value })}
                    />
                </div>
                <div className="flex-1 min-w-[140px]">
                    <label style={LABEL_STYLE} htmlFor="f-to">
                        Hasta
                    </label>
                    <input
                        id="f-to"
                        type="date"
                        style={COMPACT_INPUT}
                        value={currentTo}
                        onChange={(e) => update({ to: e.target.value })}
                    />
                </div>
                <div className="flex-1 min-w-[180px]">
                    <label style={LABEL_STYLE} htmlFor="f-cat">
                        Categoría
                    </label>
                    <select
                        id="f-cat"
                        style={COMPACT_SELECT}
                        value={currentCategoria}
                        onChange={(e) => update({ categoria: e.target.value || null })}
                    >
                        <option value="">Todas</option>
                        {EXPENSE_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                                {EXPENSE_CATEGORY_LABELS[c as ExpenseCategoryTuple]}
                            </option>
                        ))}
                    </select>
                </div>
                {isAdmin && (
                    <div className="flex-1 min-w-[180px]">
                        <label style={LABEL_STYLE} htmlFor="f-branch">
                            Sucursal
                        </label>
                        <select
                            id="f-branch"
                            style={COMPACT_SELECT}
                            value={currentBranchId}
                            onChange={(e) =>
                                update({ branchId: e.target.value || null })
                            }
                        >
                            <option value="">Todas</option>
                            {branches.map((b) => (
                                <option key={b.id} value={b.id}>
                                    {b.name}
                                </option>
                            ))}
                        </select>
                    </div>
                )}
                <label
                    className="flex items-center gap-2 cursor-pointer h-10 px-3 rounded-[var(--r-lg)]"
                    style={{ background: "var(--surf-low)" }}
                >
                    <input
                        type="checkbox"
                        checked={currentSoloSinComprobante}
                        onChange={(e) =>
                            update({
                                soloSinComprobante: e.target.checked ? "true" : null,
                            })
                        }
                    />
                    <span className="text-[0.8125rem]" style={{ color: "var(--on-surf)" }}>
                        Solo sin comprobante
                    </span>
                </label>
                <button
                    type="button"
                    onClick={onNewExpense}
                    style={TRIGGER_BUTTON}
                >
                    <Plus className="h-4 w-4" />
                    Nuevo gasto
                </button>
            </div>
            {pending && (
                <p
                    className="mt-2 text-[0.75rem]"
                    style={{ color: "var(--on-surf-var)" }}
                >
                    Actualizando…
                </p>
            )}
        </div>
    );
}
