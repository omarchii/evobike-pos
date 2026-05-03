export default function TransferenciaDetalleLoading() {
  return (
    <div className="animate-pulse" style={{ maxWidth: 800, margin: "0 auto", padding: "2rem 1rem" }}>
      <div className="flex items-center gap-3 mb-6">
        <div
          className="rounded-full"
          style={{ width: 36, height: 36, background: "var(--surf-low)" }}
        />
        <div>
          <div className="rounded-lg" style={{ width: 220, height: 28, background: "var(--surf-low)" }} />
          <div className="rounded-lg mt-2" style={{ width: 140, height: 14, background: "var(--surf-low)" }} />
        </div>
      </div>

      <div
        className="rounded-2xl mb-6"
        style={{ height: 120, background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      />

      <div
        className="rounded-lg mb-2"
        style={{ width: 120, height: 16, background: "var(--surf-low)" }}
      />
      <div
        className="rounded-2xl"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-4"
            style={{
              height: 52,
              borderBottom: "1px solid var(--ghost-border-soft)",
              alignItems: "center",
            }}
          >
            <div className="rounded" style={{ width: "40%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "15%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded ml-auto" style={{ width: "10%", height: 14, background: "var(--surf-low)" }} />
          </div>
        ))}
      </div>

      <div className="flex gap-3 mt-6 justify-end">
        <div className="rounded-full" style={{ width: 140, height: 44, background: "var(--surf-low)" }} />
        <div className="rounded-full" style={{ width: 140, height: 44, background: "var(--surf-low)" }} />
      </div>
    </div>
  );
}
