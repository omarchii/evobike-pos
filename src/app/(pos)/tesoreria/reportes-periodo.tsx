import {
    EXPENSE_CATEGORY_LABELS,
    formatCurrency,
    type ExpenseCategoryTuple,
} from "./shared-tokens";

interface CategoriaRow {
    categoria: ExpenseCategoryTuple;
    monto: number;
    porcentaje: number;
}

interface Props {
    ingresos: number;
    egresos: number;
    balanceNeto: number;
    gastosPorCategoria: CategoriaRow[];
}

const cardStyle: React.CSSProperties = {
    background: "var(--surf-lowest)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
};

const cardTitleStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.6875rem",
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--on-surf-var)",
};

export function ReportesPeriodo({
    ingresos,
    egresos,
    balanceNeto,
    gastosPorCategoria,
}: Props): React.ReactElement {
    const maxEje = Math.max(ingresos, egresos, 1);
    const ingresosPct = Math.round((ingresos / maxEje) * 100);
    const egresosPct = Math.round((egresos / maxEje) * 100);

    return (
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr] gap-4">
            {/* Ingresos vs Egresos */}
            <div className="p-6 space-y-4" style={cardStyle}>
                <div style={cardTitleStyle}>Ingresos vs. egresos</div>
                <div>
                    <div className="flex items-baseline justify-between mb-1">
                        <span
                            className="text-[0.75rem]"
                            style={{ color: "var(--on-surf-var)" }}
                        >
                            Ingresos
                        </span>
                        <span
                            className="tabular-nums"
                            style={{
                                fontFamily: "var(--font-display)",
                                fontWeight: 600,
                                fontSize: "1rem",
                                color: "var(--on-surf)",
                            }}
                        >
                            {formatCurrency(ingresos)}
                        </span>
                    </div>
                    <div
                        className="h-2 rounded-[var(--r-full)]"
                        style={{ background: "var(--surf-high)" }}
                    >
                        <div
                            className="h-full rounded-[var(--r-full)]"
                            style={{
                                width: `${ingresosPct}%`,
                                background:
                                    "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
                            }}
                        />
                    </div>
                </div>
                <div>
                    <div className="flex items-baseline justify-between mb-1">
                        <span
                            className="text-[0.75rem]"
                            style={{ color: "var(--on-surf-var)" }}
                        >
                            Egresos
                        </span>
                        <span
                            className="tabular-nums"
                            style={{
                                fontFamily: "var(--font-display)",
                                fontWeight: 600,
                                fontSize: "1rem",
                                color: "var(--ter)",
                            }}
                        >
                            {formatCurrency(egresos)}
                        </span>
                    </div>
                    <div
                        className="h-2 rounded-[var(--r-full)]"
                        style={{ background: "var(--surf-high)" }}
                    >
                        <div
                            className="h-full rounded-[var(--r-full)]"
                            style={{
                                width: `${egresosPct}%`,
                                background: "var(--ter)",
                            }}
                        />
                    </div>
                </div>
            </div>

            {/* Gastos por categoría */}
            <div className="p-6 space-y-3" style={cardStyle}>
                <div style={cardTitleStyle}>Gastos por categoría</div>
                {gastosPorCategoria.length === 0 ? (
                    <p
                        className="text-[0.8125rem]"
                        style={{ color: "var(--on-surf-var)" }}
                    >
                        Sin gastos en el período.
                    </p>
                ) : (
                    <div className="space-y-2.5">
                        {gastosPorCategoria.map((row) => (
                            <div key={row.categoria}>
                                <div className="flex items-baseline justify-between mb-1">
                                    <span
                                        className="text-[0.8125rem]"
                                        style={{ color: "var(--on-surf)" }}
                                    >
                                        {EXPENSE_CATEGORY_LABELS[row.categoria]}
                                    </span>
                                    <span
                                        className="tabular-nums text-[0.75rem]"
                                        style={{ color: "var(--on-surf-var)" }}
                                    >
                                        {formatCurrency(row.monto)} ·{" "}
                                        {row.porcentaje.toFixed(1)}%
                                    </span>
                                </div>
                                <div
                                    className="h-1.5 rounded-[var(--r-full)]"
                                    style={{ background: "var(--surf-high)" }}
                                >
                                    <div
                                        className="h-full rounded-[var(--r-full)]"
                                        style={{
                                            width: `${Math.min(100, row.porcentaje)}%`,
                                            background: "var(--p)",
                                        }}
                                    />
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Balance neto */}
            <div
                className="p-6 flex flex-col justify-between"
                style={cardStyle}
            >
                <div style={cardTitleStyle}>Balance neto del período</div>
                <div
                    className="mt-6"
                    style={{
                        fontFamily: "var(--font-display)",
                        fontWeight: 700,
                        fontSize: "2.75rem",
                        letterSpacing: "-0.02em",
                        lineHeight: 1.05,
                        color:
                            balanceNeto >= 0
                                ? "var(--on-surf)"
                                : "var(--ter)",
                    }}
                >
                    {balanceNeto >= 0 ? "" : "− "}
                    {formatCurrency(Math.abs(balanceNeto))}
                </div>
                <p
                    className="mt-3 text-[0.75rem]"
                    style={{ color: "var(--on-surf-var)" }}
                >
                    Ingresos − egresos (ventas completadas, gastos en efectivo, gastos
                    operativos y compras al proveedor).
                </p>
            </div>
        </section>
    );
}
