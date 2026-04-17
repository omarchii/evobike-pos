import { FileSearch } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface ReportEmptyStateProps {
  message?: string;
  icon?: LucideIcon;
}

export function ReportEmptyState({
  message = "No hay datos para el período seleccionado.",
  icon: Icon = FileSearch,
}: ReportEmptyStateProps): React.JSX.Element {
  return (
    <div
      className="flex flex-col items-center justify-center py-16 gap-4"
      style={{ color: "var(--on-surf-var)" }}
    >
      <Icon className="h-12 w-12 opacity-40" />
      <p
        style={{
          fontFamily: "var(--font-body)",
          fontSize: "0.875rem",
          color: "var(--on-surf-var)",
        }}
      >
        {message}
      </p>
    </div>
  );
}
