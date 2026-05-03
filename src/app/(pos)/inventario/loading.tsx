export default function InventarioLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-pulse">
      {/* Header skeleton */}
      <div className="flex items-end justify-between mb-6">
        <div>
          <div
            className="rounded-lg"
            style={{ width: 180, height: 36, background: "var(--surf-low)" }}
          />
          <div
            className="rounded-lg mt-2"
            style={{ width: 280, height: 16, background: "var(--surf-low)" }}
          />
        </div>
        <div className="flex gap-3">
          <div
            className="rounded-full"
            style={{ width: 130, height: 44, background: "var(--surf-low)" }}
          />
          <div
            className="rounded-full"
            style={{ width: 170, height: 44, background: "var(--surf-low)" }}
          />
        </div>
      </div>

      {/* Tabs skeleton */}
      <div
        className="rounded-xl mb-4"
        style={{ width: 360, height: 38, background: "var(--surf-low)" }}
      />

      {/* Search skeleton */}
      <div
        className="rounded-xl mb-4"
        style={{ width: 320, height: 36, background: "var(--surf-low)" }}
      />

      {/* Table skeleton */}
      <div
        className="flex-1 rounded-2xl"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        {Array.from({ length: 8 }).map((_, i) => (
          <div
            key={i}
            className="flex gap-4 px-4"
            style={{
              height: 48,
              borderBottom: "1px solid var(--ghost-border-soft)",
              alignItems: "center",
            }}
          >
            <div className="rounded" style={{ width: "30%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "15%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded ml-auto" style={{ width: "10%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "10%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "8%", height: 20, borderRadius: 9999, background: "var(--surf-low)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
