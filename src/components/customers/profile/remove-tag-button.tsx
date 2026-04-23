"use client";

// Remove tag inline (BRIEF §7.4 tab Datos — Sub-fase I). MANAGER+.

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Icon } from "@/components/primitives/icon";

interface Props {
  customerId: string;
  tag: string;
}

export function RemoveTagButton({
  customerId,
  tag,
}: Props): React.JSX.Element {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const submit = async (): Promise<void> => {
    if (loading) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/customers/${customerId}/tags`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ remove: [tag] }),
      });
      const json = (await res.json()) as { success: boolean; error?: string };
      if (json.success) {
        toast.success("Tag eliminado");
        router.refresh();
      } else {
        toast.error(json.error ?? "No se pudo eliminar");
      }
    } catch {
      toast.error("Error de red");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={() => void submit()}
      disabled={loading}
      className="ml-1 inline-flex items-center justify-center h-3.5 w-3.5 rounded-full disabled:opacity-40"
      style={{
        background: "color-mix(in srgb, var(--data-3) 30%, transparent)",
        color: "var(--on-surf)",
      }}
      title="Quitar tag"
      aria-label={`Quitar tag ${tag}`}
    >
      <Icon name="close" size={8} />
    </button>
  );
}
