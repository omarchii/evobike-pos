"use client";

export function LabelActions() {
  return (
    <div
      className="no-print"
      style={{
        position: "fixed",
        top: "1.5rem",
        right: "1.5rem",
        display: "flex",
        gap: "0.75rem",
        zIndex: 50,
      }}
    >
      <button
        type="button"
        onClick={() => window.print()}
        style={{
          padding: "0.5rem 1.25rem",
          borderRadius: "9999px",
          background: "#1b4332",
          color: "#ffffff",
          fontSize: "0.875rem",
          fontWeight: 600,
          border: "none",
          cursor: "pointer",
        }}
      >
        Imprimir
      </button>
      <button
        type="button"
        onClick={() => window.close()}
        style={{
          padding: "0.5rem 1.25rem",
          borderRadius: "9999px",
          background: "#f0f7f4",
          color: "#1b4332",
          fontSize: "0.875rem",
          fontWeight: 600,
          border: "1px solid #b2ccc0",
          cursor: "pointer",
        }}
      >
        Cerrar
      </button>
    </div>
  );
}
