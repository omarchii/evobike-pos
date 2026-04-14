import { AlertTriangle } from "lucide-react";
import { CloseShiftTrigger } from "./close-shift-dialog";

interface Props {
    openedAt: string;
}

function formatLongDate(iso: string): string {
    return new Intl.DateTimeFormat("es-MX", {
        day: "numeric",
        month: "long",
        year: "numeric",
    }).format(new Date(iso));
}

export function OrphanedInlineBanner({ openedAt }: Props): React.ReactElement {
    return (
        <div
            className="rounded-[var(--r-xl)] p-5 flex flex-col sm:flex-row sm:items-center gap-4"
            style={{ background: "var(--ter-container)" }}
        >
            <div
                className="shrink-0 flex items-center justify-center"
                style={{
                    width: 44,
                    height: 44,
                    borderRadius: "var(--r-full)",
                    background: "color-mix(in srgb, var(--ter) 18%, transparent)",
                    color: "var(--ter)",
                }}
            >
                <AlertTriangle className="h-5 w-5" />
            </div>
            <div className="flex-1 min-w-0">
                <h2
                    className="text-[1.125rem] font-bold tracking-[-0.01em]"
                    style={{
                        fontFamily: "var(--font-display)",
                        color: "var(--on-ter-container)",
                    }}
                >
                    Caja Huérfana Detectada
                </h2>
                <p
                    className="mt-1 text-[0.8125rem]"
                    style={{ color: "var(--on-ter-container)" }}
                >
                    La sesión del {formatLongDate(openedAt)} no fue cerrada
                    correctamente. Por favor, regularice el saldo.
                </p>
            </div>
            <div className="shrink-0">
                <CloseShiftTrigger variant="inline-cta" />
            </div>
        </div>
    );
}
