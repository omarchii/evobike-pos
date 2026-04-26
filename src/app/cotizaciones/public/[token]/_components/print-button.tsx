"use client";

import { Printer } from "lucide-react";

export default function PrintButton() {
  return (
    <button
      className="no-print"
      onClick={() => window.print()}
      style={{
        position: "fixed",
        bottom: "1.5rem",
        right: "1.5rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        padding: "0.75rem 1.25rem",
        borderRadius: "9999px",
        background: "var(--velocity-gradient)",
        color: "#ffffff",
        fontFamily: "'Inter', sans-serif",
        fontSize: "0.875rem",
        fontWeight: 600,
        border: "none",
        cursor: "pointer",
        boxShadow: "0 4px 24px rgba(27,67,50,0.3)",
        zIndex: 50,
        transition: "opacity 0.15s",
      }}
      onMouseEnter={(e) => (e.currentTarget.style.opacity = "0.88")}
      onMouseLeave={(e) => (e.currentTarget.style.opacity = "1")}
    >
      <Printer size={16} />
      Imprimir / Guardar como PDF
    </button>
  );
}
