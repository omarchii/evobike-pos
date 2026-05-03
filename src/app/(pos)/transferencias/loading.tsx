export default function TransferenciasLoading() {
  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] animate-pulse">
      <div className="flex items-end justify-between mb-6">
        <div>
          <div
            className="rounded-lg"
            style={{ width: 200, height: 36, background: "var(--surf-low)" }}
          />
          <div
            className="rounded-lg mt-2"
            style={{ width: 300, height: 16, background: "var(--surf-low)" }}
          />
        </div>
        <div
          className="rounded-full"
          style={{ width: 180, height: 44, background: "var(--surf-low)" }}
        />
      </div>

      <div className="flex gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
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
            <div className="rounded" style={{ width: "12%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "18%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "18%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded ml-auto" style={{ width: "10%", height: 14, background: "var(--surf-low)" }} />
            <div className="rounded" style={{ width: "8%", height: 22, borderRadius: 9999, background: "var(--surf-low)" }} />
          </div>
        ))}
      </div>
    </div>
  );
}
