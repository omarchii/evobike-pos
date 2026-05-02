"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Chip } from "@/components/primitives/chip";
import type { ChipVariant } from "@/components/primitives/chip";

type PolicyRow = {
  id: string;
  folio: string;
  customerName: string;
  modeloNombre: string;
  serie: string;
  branchName: string;
  status: string;
  startedAt: string;
  expiresAt: string;
  warrantyDays: number;
  hasPdf: boolean;
  printCount: number;
};

const STATUS_CHIP: Record<string, { label: string; variant: ChipVariant }> = {
  ACTIVE: { label: "Vigente", variant: "success" },
  EXPIRED: { label: "Vencida", variant: "warn" },
  VOID: { label: "Anulada", variant: "error" },
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function WarrantyPoliciesClient({ rows }: { rows: PolicyRow[] }) {
  const [regenerating, setRegenerating] = useState<string | null>(null);

  async function handleRegenerate(id: string) {
    setRegenerating(id);
    try {
      const res = await fetch(`/api/warranty-policies/${id}/pdf`, { method: "POST" });
      if (!res.ok) {
        const data = await res.json();
        toast.error(data.error ?? "Error al regenerar PDF");
        return;
      }
      toast.success("PDF regenerado y subido a R2");
    } catch {
      toast.error("Error de red");
    } finally {
      setRegenerating(null);
    }
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between">
        <h1
          className="text-xl font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
        >
          Pólizas de garantía
        </h1>
        <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
          {rows.length} póliza{rows.length !== 1 && "s"}
        </span>
      </header>

      {rows.length === 0 ? (
        <div
          className="rounded-xl p-8 text-center text-sm"
          style={{ background: "var(--surf-low)", color: "var(--on-surf-var)" }}
        >
          No hay pólizas registradas aún. Se crearán automáticamente al cerrar ventas con garantía.
        </div>
      ) : (
        <div className="overflow-auto rounded-xl" style={{ background: "var(--surf-bright)" }}>
          <table className="w-full text-sm" style={{ color: "var(--on-surf)" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                <Th>Folio</Th>
                <Th>Cliente</Th>
                <Th>Modelo</Th>
                <Th>Serie</Th>
                <Th>Sucursal</Th>
                <Th>Estado</Th>
                <Th>Inicio</Th>
                <Th>Vence</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const chip = STATUS_CHIP[r.status] ?? { label: r.status, variant: "neutral" as ChipVariant };
                return (
                  <tr
                    key={r.id}
                    style={{ borderBottom: "1px solid var(--ghost-border)" }}
                  >
                    <td className="px-4 py-3 font-medium">{r.folio}</td>
                    <td className="px-4 py-3">{r.customerName}</td>
                    <td className="px-4 py-3">{r.modeloNombre}</td>
                    <td className="px-4 py-3 font-mono text-xs">{r.serie}</td>
                    <td className="px-4 py-3">{r.branchName}</td>
                    <td className="px-4 py-3">
                      <Chip variant={chip.variant} label={chip.label} />
                    </td>
                    <td className="px-4 py-3 text-xs">{formatDate(r.startedAt)}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(r.expiresAt)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <a
                          href={`/api/warranty-policies/${r.id}/pdf`}
                          target="_blank"
                          rel="noopener"
                          className="rounded-md px-2 py-1 text-xs font-medium"
                          style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
                        >
                          Ver PDF
                        </a>
                        <button
                          onClick={() => handleRegenerate(r.id)}
                          disabled={regenerating === r.id}
                          className="rounded-md px-2 py-1 text-xs font-medium disabled:opacity-50"
                          style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
                        >
                          {regenerating === r.id ? "..." : "Regenerar"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-4 py-3 text-xs font-semibold uppercase tracking-wider"
      style={{ color: "var(--on-surf-var)", textAlign: align }}
    >
      {children}
    </th>
  );
}
