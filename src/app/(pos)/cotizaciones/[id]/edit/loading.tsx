export default function EditCotizacionLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-5">
        <div className="rounded" style={{ width: 160, height: 14, background: "var(--surf-low)" }} />
      </div>

      <div
        className="rounded-lg mb-6"
        style={{ width: 260, height: 36, background: "var(--surf-low)" }}
      />

      <div
        className="rounded-2xl p-6 mb-4"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="rounded mb-4" style={{ width: 140, height: 14, background: "var(--surf-low)" }} />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i}>
              <div className="rounded mb-2" style={{ width: "40%", height: 10, background: "var(--surf-low)" }} />
              <div className="rounded" style={{ width: "100%", height: 40, background: "var(--surf-low)" }} />
            </div>
          ))}
        </div>
      </div>

      <div
        className="rounded-2xl p-6 mb-4"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="rounded mb-4" style={{ width: 120, height: 14, background: "var(--surf-low)" }} />
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-3 mb-3 items-center"
            style={{ borderBottom: "1px solid var(--ghost-border-soft)", paddingBottom: 12 }}
          >
            <div className="rounded" style={{ width: "45%", height: 38, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "15%", height: 38, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "20%", height: 38, background: "var(--surf-low)" }} />
            <div className="rounded ml-auto" style={{ width: 36, height: 36, background: "var(--surf-low)" }} />
          </div>
        ))}
        <div className="rounded-full mt-3" style={{ width: 180, height: 38, background: "var(--surf-low)" }} />
      </div>

      <div className="flex justify-end gap-3 mt-6">
        <div className="rounded-full" style={{ width: 120, height: 44, background: "var(--surf-low)" }} />
        <div className="rounded-full" style={{ width: 180, height: 44, background: "var(--surf-low)" }} />
      </div>
    </div>
  );
}
