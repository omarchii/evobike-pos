"use client";

import { useEffect, useState } from "react";
import { Plus, Receipt, Vault, PiggyBank } from "lucide-react";

interface Props {
    sessionOpen: boolean;
}

interface FabAction {
    key: string;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

export function CashFab({ sessionOpen }: Props): React.ReactElement | null {
    const [expanded, setExpanded] = useState(false);

    useEffect(() => {
        if (!expanded) return;
        const onKey = (e: KeyboardEvent): void => {
            if (e.key === "Escape") setExpanded(false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [expanded]);

    if (!sessionOpen) return null;

    const actions: FabAction[] = [
        {
            key: "deposit",
            label: "Registrar depósito",
            icon: <PiggyBank className="h-4 w-4" />,
            onClick: () => {
                /* TODO: abrir modal en Fase 4 */
            },
        },
        {
            key: "expense",
            label: "Registrar gasto",
            icon: <Receipt className="h-4 w-4" />,
            onClick: () => {
                /* TODO: abrir modal en Fase 4 */
            },
        },
        {
            key: "withdrawal",
            label: "Registrar retiro",
            icon: <Vault className="h-4 w-4" />,
            onClick: () => {
                /* TODO: abrir modal en Fase 4 */
            },
        },
    ];

    return (
        <div
            className="fixed bottom-6 right-6 z-40 flex flex-col items-end gap-3"
            style={{ pointerEvents: "none" }}
        >
            {actions.map((action, i) => (
                <MiniFab
                    key={action.key}
                    index={i}
                    expanded={expanded}
                    label={action.label}
                    icon={action.icon}
                    onClick={() => {
                        action.onClick();
                        setExpanded(false);
                    }}
                />
            ))}

            <button
                type="button"
                aria-expanded={expanded}
                aria-label={expanded ? "Cerrar menú de acciones" : "Abrir menú de acciones"}
                onClick={() => setExpanded((v) => !v)}
                style={{
                    pointerEvents: "auto",
                    width: 56,
                    height: 56,
                    borderRadius: "var(--r-full)",
                    border: "none",
                    background:
                        "linear-gradient(135deg, var(--p) 0%, var(--p-container) 100%)",
                    color: "var(--on-p)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "var(--shadow)",
                    cursor: "pointer",
                    transition: "transform 180ms ease, box-shadow 180ms ease",
                    transform: expanded ? "scale(1.03)" : "scale(1)",
                }}
            >
                <Plus
                    className="h-5 w-5"
                    style={{
                        transition: "transform 220ms ease",
                        transform: expanded ? "rotate(45deg)" : "rotate(0deg)",
                    }}
                />
            </button>
        </div>
    );
}

interface MiniFabProps {
    index: number;
    expanded: boolean;
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
}

function MiniFab({
    index,
    expanded,
    label,
    icon,
    onClick,
}: MiniFabProps): React.ReactElement {
    // Stagger top-down al abrir (delays 0/100/200ms); bottom-up al cerrar (120/60/0ms).
    const delayMs = expanded ? index * 100 : (2 - index) * 60;

    return (
        <button
            type="button"
            title={label}
            aria-label={label}
            onClick={onClick}
            tabIndex={expanded ? 0 : -1}
            style={{
                pointerEvents: expanded ? "auto" : "none",
                width: 44,
                height: 44,
                borderRadius: "var(--r-full)",
                border: "none",
                background: "var(--surf-lowest)",
                color: "var(--on-surf)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "var(--shadow)",
                cursor: expanded ? "pointer" : "default",
                opacity: expanded ? 1 : 0,
                transform: expanded
                    ? "translateY(0) scale(1)"
                    : "translateY(12px) scale(0.85)",
                transition:
                    "opacity 200ms ease, transform 220ms cubic-bezier(0.2, 0.8, 0.2, 1)",
                transitionDelay: `${delayMs}ms`,
            }}
        >
            {icon}
        </button>
    );
}
