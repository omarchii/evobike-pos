"use client";

// Botón "Deshacer fusión" (BRIEF §6.1 / §7.4 tab Datos — Sub-fase I).
// MANAGER+ only. Llama POST /api/customers/[sourceId]/unmerge.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";

interface Props {
  sourceId: string;
  sourceName: string;
  daysUntilUndoExpires: number;
}

export function UnmergeButton({
  sourceId,
  sourceName,
  daysUntilUndoExpires,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    if (loading) return;
    if (
      !confirm(
        `¿Deshacer la fusión con "${sourceName}"? Las ventas, órdenes y movimientos reasignados volverán al cliente original.`,
      )
    ) {
      return;
    }
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${sourceId}/unmerge`, {
        method: "POST",
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Fusión revertida");
        router.refresh();
      } else {
        toast.error(json.error ?? "No se pudo revertir");
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  };

  const expired = daysUntilUndoExpires <= 0;

  return (
    <button
      onClick={() => void submit()}
      disabled={loading || expired}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      style={{
        borderRadius: "var(--r-full)",
        background: expired ? "var(--surf-high)" : "var(--warn-container)",
        color: expired ? "var(--on-surf-var)" : "var(--on-surf)",
        fontFamily: "var(--font-display)",
      }}
      title={
        expired
          ? "Ventana de 30 días para deshacer expirada"
          : `Ventana expira en ${daysUntilUndoExpires} día${daysUntilUndoExpires === 1 ? "" : "s"}`
      }
    >
      <Icon name="chevronLeft" size={11} />
      {loading
        ? "Revirtiendo…"
        : expired
          ? "Ventana expirada"
          : "Deshacer fusión"}
    </button>
  );
}
