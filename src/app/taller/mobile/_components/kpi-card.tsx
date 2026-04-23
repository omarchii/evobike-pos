import { Plus } from "lucide-react";

interface KpiCardProps {
  activeCount: number;
  pendingCount: number;
  // G.3 cablea el FAB al bottom-sheet de "Sin asignar". En G.2 queda
  // como placeholder visual — el botón existe en el DOM pero la
  // prop `onFabClick` es opcional.
  onFabClick?: () => void;
}

export default function KpiCard({ activeCount, pendingCount, onFabClick }: KpiCardProps) {
  return (
    <section className="relative mb-4 overflow-hidden rounded-2xl bg-[var(--surf-low)] p-5">
      <div
        className="pointer-events-none absolute -top-10 -right-10 size-32 rounded-full blur-2xl"
        style={{ background: "color-mix(in oklab, var(--p) 12%, transparent)" }}
        aria-hidden
      />
      <div className="flex items-end justify-between">
        <div className="min-w-0">
          <p className="text-sm text-[var(--on-surf-var)]">Activas</p>
          <p className="mt-1 font-[var(--font-display)] text-5xl font-bold leading-none tracking-tight text-[var(--on-surf)]">
            {activeCount}
          </p>
          {pendingCount > 0 && (
            <p className="mt-2 text-xs text-[var(--on-surf-var)]">
              +{pendingCount} por iniciar
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={onFabClick}
          disabled={!onFabClick}
          aria-label="Ver órdenes sin asignar"
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-[var(--on-p-container)] shadow-lg transition-opacity active:scale-95 disabled:opacity-60"
          style={{ background: "var(--p-container)" }}
        >
          <Plus className="size-5" />
        </button>
      </div>
    </section>
  );
}
