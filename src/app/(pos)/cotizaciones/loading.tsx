export default function CotizacionesLoading() {
  return (
    <div className="flex flex-col min-h-0 animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div className="rounded-lg" style={{ width: 240, height: 36, background: "var(--surf-low)" }} />
        <div className="rounded-full" style={{ width: 200, height: 44, background: "var(--surf-low)" }} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-2xl p-4"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
          >
            <div className="rounded" style={{ width: "60%", height: 12, background: "var(--surf-low)" }} />
            <div className="rounded mt-3" style={{ width: "45%", height: 28, background: "var(--surf-low)" }} />
          </div>
        ))}
      </div>

      <div className="flex gap-2 mb-4 flex-wrap">
        {Array.from({ length: 5 }).map((_, i) => (
          <div
            key={i}
            className="rounded-full"
            style={{ width: 110, height: 34, background: "var(--surf-low)" }}
          />
        ))}
      </div>

      <div
        className="rounded-xl mb-4"
        style={{ width: 320, height: 36, background: "var(--surf-low)" }}
      />

      <div
        className="flex-1 rounded-2xl"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-4"
            style={{
              height: 52,
              borderBottom: "1px solid var(--ghost-border-soft)",
              alignItems: "center",
            }}
          >
            <div className="rounded" style={{ width: "10%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "20%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "16%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "12%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded ml-auto" style={{ width: "10%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "8%", height: 22, borderRadius: 9999, background: "var(--surf-low)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
