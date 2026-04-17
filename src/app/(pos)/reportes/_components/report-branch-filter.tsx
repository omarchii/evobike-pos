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

const SELECT_STYLE: CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-md)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body)",
  fontSize: "0.875rem",
  height: 36,
  padding: "0 2rem 0 0.75rem",
  outline: "none",
  cursor: "pointer",
  appearance: "none",
  WebkitAppearance: "none",
  backgroundImage:
    "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%233d5247' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E\")",
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 0.6rem center",
  minWidth: 160,
};

interface BranchOption {
  id: string;
  name: string;
}

interface ReportBranchFilterProps {
  /** Solo renderiza para ADMIN. */
  role: string;
  branches: BranchOption[];
  currentBranchId: string;
}

export function ReportBranchFilter({
  role,
  branches,
  currentBranchId,
}: ReportBranchFilterProps): React.JSX.Element | null {
  const router = useRouter();
  const searchParams = useSearchParams();

  if (role !== "ADMIN") return null;

  function handleChange(value: string): void {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("branchId", value);
    } else {
      params.delete("branchId");
    }
    router.replace(`?${params.toString()}`);
  }

  return (
    <div>
      <label style={LABEL_STYLE}>Sucursal</label>
      <select
        defaultValue={currentBranchId}
        style={SELECT_STYLE}
        onChange={(e) => handleChange(e.target.value)}
      >
        <option value="">Todas las sucursales</option>
        {branches.map((b) => (
          <option key={b.id} value={b.id}>
            {b.name}
          </option>
        ))}
      </select>
    </div>
  );
}
