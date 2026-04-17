"use client";

import { useRouter, useSearchParams } from "next/navigation";
import type { CSSProperties } from "react";

const LABEL_STYLE: CSSProperties = {
  fontFamily: "var(--font-body)",
  fontSize: "0.6875rem",
  fontWeight: 500,
  letterSpacing: "0.05em",
  textTransform: "uppercase",
  color: "var(--on-surf-var)",
  display: "block",
  marginBottom: "0.25rem",
};

const INPUT_STYLE: CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-md)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  height: 36,
  padding: "0 0.75rem",
  outline: "none",
  width: "100%",
};

interface ReportDateFilterProps {
  currentFrom: string;
  currentTo: string;
}

export function ReportDateFilter({
  currentFrom,
  currentTo,
}: ReportDateFilterProps): React.JSX.Element {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleChange(key: "from" | "to", value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    router.replace(`?${params.toString()}`);
  }

  return (
    <div className="flex items-end gap-3">
      <div>
        <label style={LABEL_STYLE}>Desde</label>
        <input
          type="date"
          defaultValue={currentFrom}
          style={INPUT_STYLE}
          onChange={(e) => handleChange("from", e.target.value)}
        />
      </div>
      <div>
        <label style={LABEL_STYLE}>Hasta</label>
        <input
          type="date"
          defaultValue={currentTo}
          style={INPUT_STYLE}
          onChange={(e) => handleChange("to", e.target.value)}
        />
      </div>
    </div>
  );
}
