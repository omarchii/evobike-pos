"use client";

export default function MobileError({ reset }: { error: Error; reset: () => void }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <h1 className="text-xl font-semibold text-[var(--on-surf)]">Algo salió mal</h1>
      <p className="max-w-xs text-sm text-[var(--on-surf-var)]">
        No pudimos cargar tus órdenes. Toca para reintentar.
      </p>
      <button
        onClick={reset}
        className="rounded-full bg-[var(--p-container)] px-6 py-3 text-sm font-medium text-[var(--on-p-container)] active:scale-95 transition-transform"
      >
        Reintentar
      </button>
    </div>
  );
}
