import Link from "next/link";
import { Paperclip, ExternalLink } from "lucide-react";
import {
    EXPENSE_CATEGORY_LABELS,
    METHOD_LABELS,
    formatCurrency,
    formatDate,
    type ExpenseCategoryTuple,
} from "./shared-tokens";
import { ExpenseRowActions } from "./expense-row-actions";

export interface TableRow {
    kind: "operational" | "cash";
    id: string;
    fechaISO: string;
    categoria: ExpenseCategoryTuple;
    descripcion: string;
    metodo: string;
    monto: number;
    comprobanteUrl: string | null;
    isAnulado: boolean;
    motivoAnulacion: string | null;
    branchId: string | null;
    createdAtISO: string;
    registradoByName: string | null;
}

interface Props {
    rows: TableRow[];
    isAdmin: boolean;
    userBranchId: string;
    todayStr: string;
}

const THEAD_STYLE: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.6875rem",
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--on-surf-var)",
};

const BADGE_BASE: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: "0.25rem",
    paddingInline: "0.5rem",
    height: 22,
    borderRadius: "var(--r-full)",
    fontFamily: "var(--font-body)",
    fontSize: "0.6875rem",
    fontWeight: 500,
    letterSpacing: "0.03em",
};

export function GastosTabla({
    rows,
    isAdmin,
    userBranchId,
    todayStr,
}: Props): React.ReactElement {
    if (rows.length === 0) {
        return (
            <div
                className="p-10 text-center rounded-[var(--r-xl)]"
                style={{
                    background: "var(--surf-lowest)",
                    boxShadow: "var(--shadow)",
                    color: "var(--on-surf-var)",
                }}
            >
                Sin gastos en el período seleccionado.
            </div>
        );
    }

    return (
        <div
            className="rounded-[var(--r-xl)] overflow-hidden"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
        >
            <div className="overflow-x-auto">
                <table className="w-full" style={{ borderCollapse: "collapse" }}>
                    <thead>
                        <tr
                            style={{
                                borderBottom: "1px solid var(--ghost-border)",
                            }}
                        >
                            <th className="text-left px-4 py-3" style={THEAD_STYLE}>
                                Fecha
                            </th>
                            <th className="text-left px-4 py-3" style={THEAD_STYLE}>
                                Categoría
                            </th>
                            <th className="text-left px-4 py-3" style={THEAD_STYLE}>
                                Descripción
                            </th>
                            <th className="text-left px-4 py-3" style={THEAD_STYLE}>
                                Método
                            </th>
                            <th className="text-right px-4 py-3" style={THEAD_STYLE}>
                                Monto
                            </th>
                            <th className="text-left px-4 py-3" style={THEAD_STYLE}>
                                Comprobante
                            </th>
                            <th className="text-left px-4 py-3" style={THEAD_STYLE}>
                                Estado
                            </th>
                            <th className="text-right px-4 py-3" style={THEAD_STYLE}>
                                Acciones
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((row) => {
                            const rowStyle: React.CSSProperties = row.isAnulado
                                ? {
                                      textDecoration: "line-through",
                                      color: "var(--on-surf-var)",
                                      opacity: 0.75,
                                  }
                                : { color: "var(--on-surf)" };

                            const createdAtDate = new Date(row.createdAtISO)
                                .toISOString()
                                .slice(0, 10);
                            const isToday = createdAtDate === todayStr;

                            const canEdit =
                                row.kind === "operational" &&
                                !row.isAnulado &&
                                (isAdmin ||
                                    (isToday && row.branchId === userBranchId));
                            const canAnular =
                                row.kind === "operational" &&
                                !row.isAnulado &&
                                isAdmin;

                            return (
                                <tr
                                    key={`${row.kind}-${row.id}`}
                                    style={{
                                        borderBottom: "1px solid var(--ghost-border)",
                                        ...rowStyle,
                                    }}
                                >
                                    <td
                                        className="px-4 py-3 text-[0.8125rem]"
                                        style={{ fontFamily: "var(--font-body)" }}
                                    >
                                        {formatDate(row.fechaISO)}
                                    </td>
                                    <td
                                        className="px-4 py-3 text-[0.8125rem]"
                                        style={{ fontFamily: "var(--font-body)" }}
                                    >
                                        {EXPENSE_CATEGORY_LABELS[row.categoria]}
                                    </td>
                                    <td
                                        className="px-4 py-3 text-[0.8125rem] max-w-[320px]"
                                        style={{ fontFamily: "var(--font-body)" }}
                                    >
                                        <div className="truncate">{row.descripcion}</div>
                                        {row.registradoByName && (
                                            <div
                                                className="truncate text-[0.6875rem] mt-0.5"
                                                style={{ color: "var(--on-surf-var)" }}
                                            >
                                                por {row.registradoByName}
                                            </div>
                                        )}
                                    </td>
                                    <td
                                        className="px-4 py-3 text-[0.8125rem]"
                                        style={{ fontFamily: "var(--font-body)" }}
                                    >
                                        {row.kind === "cash" ? (
                                            <span
                                                style={{
                                                    ...BADGE_BASE,
                                                    background: "var(--surf-high)",
                                                    color: "var(--on-surf-var)",
                                                }}
                                            >
                                                Efectivo
                                            </span>
                                        ) : (
                                            METHOD_LABELS[row.metodo] ?? row.metodo
                                        )}
                                    </td>
                                    <td
                                        className="px-4 py-3 text-right text-[0.8125rem] tabular-nums"
                                        style={{
                                            fontFamily: "var(--font-display)",
                                            fontWeight: 600,
                                        }}
                                    >
                                        {formatCurrency(row.monto)}
                                    </td>
                                    <td className="px-4 py-3">
                                        {row.comprobanteUrl ? (
                                            <a
                                                href={row.comprobanteUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-1 text-[0.75rem] underline"
                                                style={{ color: "var(--on-surf)" }}
                                            >
                                                <Paperclip className="h-3 w-3" />
                                                Ver
                                            </a>
                                        ) : (
                                            <span
                                                style={{
                                                    ...BADGE_BASE,
                                                    background: "var(--ter-container)",
                                                    color: "var(--on-ter-container)",
                                                }}
                                            >
                                                Sin comprobante
                                            </span>
                                        )}
                                    </td>
                                    <td
                                        className="px-4 py-3 text-[0.75rem]"
                                        style={{ fontFamily: "var(--font-body)" }}
                                    >
                                        {row.isAnulado ? (
                                            <span
                                                title={row.motivoAnulacion ?? undefined}
                                                style={{
                                                    ...BADGE_BASE,
                                                    background: "var(--ter-container)",
                                                    color: "var(--on-ter-container)",
                                                }}
                                            >
                                                Anulado
                                            </span>
                                        ) : (
                                            <span
                                                style={{
                                                    ...BADGE_BASE,
                                                    background: "var(--surf-high)",
                                                    color: "var(--on-surf)",
                                                }}
                                            >
                                                Activo
                                            </span>
                                        )}
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                        {row.kind === "cash" ? (
                                            <Link
                                                href="/cash-register"
                                                className="inline-flex items-center gap-1 text-[0.75rem]"
                                                style={{ color: "var(--on-surf-var)" }}
                                                title="Ver en Caja"
                                            >
                                                <ExternalLink className="h-3 w-3" />
                                                Caja
                                            </Link>
                                        ) : (
                                            <ExpenseRowActions
                                                expenseId={row.id}
                                                categoria={row.categoria}
                                                descripcion={row.descripcion}
                                                comprobanteUrl={row.comprobanteUrl}
                                                canEdit={canEdit}
                                                canAnular={canAnular}
                                                isAnulado={row.isAnulado}
                                            />
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
