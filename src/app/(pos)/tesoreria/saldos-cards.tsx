import { Wallet, Landmark } from "lucide-react";
import { BankBalanceTrigger } from "./bank-balance-trigger";
import { formatCurrency } from "./shared-tokens";
import { formatRelative } from "@/lib/format-relative";

interface Props {
    saldoEfectivoCajon: number;
    saldoBancario: number | null;
    saldoBancarioActualizadoEn: string | null;
    isAdmin: boolean;
}

const cardStyle: React.CSSProperties = {
    background: "var(--surf-lowest)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
};

const labelStyle: React.CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.6875rem",
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--on-surf-var)",
};

const kpiStyle: React.CSSProperties = {
    fontFamily: "var(--font-display)",
    fontWeight: 700,
    fontSize: "2.25rem",
    letterSpacing: "-0.02em",
    color: "var(--on-surf)",
    lineHeight: 1.1,
};

export function SaldosCards({
    saldoEfectivoCajon,
    saldoBancario,
    saldoBancarioActualizadoEn,
    isAdmin,
}: Props): React.ReactElement {
    return (
        <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6" style={cardStyle}>
                <div className="flex items-center gap-2 mb-3">
                    <Wallet
                        className="h-3.5 w-3.5"
                        style={{ color: "var(--on-surf-var)" }}
                    />
                    <span style={labelStyle}>Efectivo en cajón</span>
                </div>
                <div style={kpiStyle}>{formatCurrency(saldoEfectivoCajon)}</div>
                <p
                    className="mt-2 text-[0.75rem]"
                    style={{ color: "var(--on-surf-var)" }}
                >
                    Calculado desde las cajas abiertas del turno actual.
                </p>
            </div>

            <div className="p-6" style={cardStyle}>
                <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex items-center gap-2">
                        <Landmark
                            className="h-3.5 w-3.5"
                            style={{ color: "var(--on-surf-var)" }}
                        />
                        <span style={labelStyle}>Cuenta bancaria</span>
                    </div>
                    <BankBalanceTrigger isAdmin={isAdmin} />
                </div>
                <div style={kpiStyle}>
                    {saldoBancario !== null
                        ? formatCurrency(saldoBancario)
                        : "—"}
                </div>
                <p
                    className="mt-2 text-[0.75rem]"
                    style={{ color: "var(--on-surf-var)" }}
                >
                    {saldoBancarioActualizadoEn
                        ? `Actualizado ${formatRelative(saldoBancarioActualizadoEn)}`
                        : "Sin registros todavía"}
                </p>
            </div>
        </section>
    );
}
