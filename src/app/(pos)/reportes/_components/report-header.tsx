import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  icon?: LucideIcon;
  /** Slot para filtros (debajo del título). */
  filters?: ReactNode;
  /** Slot para acciones (CSV, etc.) alineadas a la derecha del header. */
  actions?: ReactNode;
}

export function ReportHeader({
  title,
  subtitle,
  icon: Icon,
  filters,
  actions,
}: ReportHeaderProps): React.JSX.Element {
  return (
    <div className="space-y-4">
      <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div className="min-w-0">
          <h1
            className="flex items-center gap-3 leading-none"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "2.25rem",
              fontWeight: 700,
              letterSpacing: "-0.01em",
              color: "var(--on-surf)",
            }}
          >
            {Icon && (
              <Icon
                className="h-8 w-8 shrink-0"
                style={{ color: "var(--on-surf-var)" }}
              />
            )}
            {title}
          </h1>
          {subtitle && (
            <p
              className="mt-2"
              style={{
                fontFamily: "var(--font-body)",
                fontSize: "0.8125rem",
                color: "var(--on-surf-var)",
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex items-center gap-2 shrink-0">{actions}</div>
        )}
      </div>
      {filters && <div>{filters}</div>}
    </div>
  );
}
