export default function CotizacionDetalleLoading() {
  return (
    <div className="pb-32 animate-pulse">
      <div className="mb-5">
        <div className="rounded" style={{ width: 130, height: 14, background: "var(--surf-low)" }} />
      </div>

      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-lg" style={{ width: 220, height: 44, background: "var(--surf-low)" }} />
          <div className="rounded-full" style={{ width: 100, height: 26, background: "var(--surf-low)" }} />
        </div>
        <div className="rounded" style={{ width: 280, height: 12, background: "var(--surf-low)" }} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="rounded-xl p-4"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
          >
            <div className="rounded" style={{ width: "55%", height: 10, background: "var(--surf-low)" }} />
            <div className="rounded mt-3" style={{ width: "75%", height: 18, background: "var(--surf-low)" }} />
          </div>
        ))}
      </div>

      <div
        className="rounded-2xl overflow-hidden mb-6"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div
          className="grid gap-4 px-5 py-3"
          style={{
            gridTemplateColumns: "2fr 1fr 1fr 1fr",
            borderBottom: "1px solid var(--ghost-border)",
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="rounded" style={{ width: "60%", height: 10, background: "var(--surf-low)" }} />
          ))}
        </div>
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="grid gap-4 px-5 py-4 items-center"
            style={{
              gridTemplateColumns: "2fr 1fr 1fr 1fr",
              background: i % 2 ? "var(--surf-low)" : "var(--surf-lowest)",
            }}
          >
            <div className="rounded" style={{ width: "85%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "30%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "60%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "55%", height: 18, background: "var(--surf-low)" }} />
          </div>
        ))}
        <div
          className="px-5 py-4 flex flex-col items-end gap-2"
          style={{ borderTop: "1px solid var(--ghost-border)" }}
        >
          <div className="rounded" style={{ width: 120, height: 14, background: "var(--surf-low)" }} />
          <div className="rounded" style={{ width: 180, height: 28, background: "var(--surf-low)" }} />
        </div>
      </div>

      <div
        className="rounded-2xl flex items-center justify-end gap-3 p-4"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={i}
            className="rounded-full"
            style={{ width: 140, height: 40, background: "var(--surf-low)" }}
          />
        ))}
      </div>
    </div>
  );
}
