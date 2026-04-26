import type { CSSProperties } from "react";

export const EXPENSE_CATEGORIES = [
    "RENTA",
    "SERVICIOS",
    "NOMINA",
    "PUBLICIDAD",
    "TRANSPORTE",
    "MANTENIMIENTO_INMUEBLE",
    "IMPUESTOS",
    "COMISIONES_BANCARIAS",
    "OTRO",
] as const;

export type ExpenseCategoryTuple = (typeof EXPENSE_CATEGORIES)[number];

export const EXPENSE_CATEGORY_LABELS: Record<ExpenseCategoryTuple, string> = {
    RENTA: "Renta",
    SERVICIOS: "Servicios",
    NOMINA: "Nómina",
    PUBLICIDAD: "Publicidad",
    TRANSPORTE: "Transporte",
    MANTENIMIENTO_INMUEBLE: "Mantenimiento inmueble",
    IMPUESTOS: "Impuestos",
    COMISIONES_BANCARIAS: "Comisiones bancarias",
    OTRO: "Otro",
};

export const OPERATIONAL_METHODS = [
    "CARD",
    "TRANSFER",
    "CREDIT_BALANCE",
    "ATRATO",
] as const;

export type OperationalMethod = (typeof OPERATIONAL_METHODS)[number];

export const METHOD_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    CREDIT_BALANCE: "Saldo a favor",
    ATRATO: "Atrato",
};

export const MODAL_STYLE: CSSProperties = {
    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
    maxWidth: 520,
};

export const TITLE_STYLE: CSSProperties = {
    fontFamily: "var(--font-display)",
    fontSize: "1.5rem",
    fontWeight: 700,
    letterSpacing: "-0.01em",
    color: "var(--on-surf)",
};

export const DESCRIPTION_STYLE: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.8125rem",
    color: "var(--on-surf-var)",
    lineHeight: 1.5,
};

export const LABEL_STYLE: CSSProperties = {
    fontFamily: "var(--font-body)",
    fontSize: "0.6875rem",
    fontWeight: 500,
    letterSpacing: "0.05em",
    textTransform: "uppercase",
    color: "var(--on-surf-var)",
    marginBottom: "0.5rem",
    display: "block",
};

export const INPUT_STYLE: CSSProperties = {
    background: "var(--surf-low)",
    border: "none",
    borderRadius: "var(--r-lg)",
    color: "var(--on-surf)",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "1rem",
    height: 48,
    width: "100%",
    padding: "0 0.75rem",
    outline: "none",
};

export const SELECT_STYLE: CSSProperties = {
    ...INPUT_STYLE,
    cursor: "pointer",
    appearance: "none",
    WebkitAppearance: "none",
    backgroundImage:
        "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233d5247' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
    backgroundRepeat: "no-repeat",
    backgroundPosition: "right 0.9rem center",
    paddingRight: "2.5rem",
};

export const PRIMARY_BUTTON_STYLE: CSSProperties = {
    background: "var(--velocity-gradient)",
    color: "#FFFFFF",
    borderRadius: "var(--r-full)",
    border: "none",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "0.875rem",
    height: 48,
    paddingInline: "2rem",
    cursor: "pointer",
};

export const SECONDARY_BUTTON_STYLE: CSSProperties = {
    background: "var(--surf-high)",
    color: "var(--on-surf-var)",
    borderRadius: "var(--r-full)",
    border: "none",
    fontFamily: "var(--font-body)",
    fontWeight: 500,
    fontSize: "0.875rem",
    height: 48,
    paddingInline: "1.5rem",
    cursor: "pointer",
};

export const DANGER_BUTTON_STYLE: CSSProperties = {
    background: "var(--ter)",
    color: "#FFFFFF",
    borderRadius: "var(--r-full)",
    border: "none",
    fontFamily: "var(--font-body)",
    fontWeight: 600,
    fontSize: "0.875rem",
    height: 48,
    paddingInline: "2rem",
    cursor: "pointer",
};

export const CLOSE_BUTTON_STYLE: CSSProperties = {
    width: 36,
    height: 36,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: "var(--r-full)",
    background: "var(--surf-high)",
    color: "var(--on-surf-var)",
    border: "none",
    cursor: "pointer",
};

export const ERROR_STYLE: CSSProperties = {
    color: "var(--ter)",
    fontSize: "0.75rem",
    marginTop: "0.25rem",
};

export function formatCurrency(val: number): string {
    return new Intl.NumberFormat("es-MX", {
        style: "currency",
        currency: "MXN",
    }).format(val);
}

export function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString("es-MX", {
        day: "2-digit",
        month: "short",
        year: "numeric",
    });
}

