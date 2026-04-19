"use client";

import Link from "next/link";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import type { ReportMeta } from "@/lib/reportes/reports-config";

type ReportCardProps = {
  meta: ReportMeta;
  isPinned: boolean;
  onToggle: (slug: string, action: "add" | "remove") => Promise<void>;
};

export default function ReportCard({ meta, isPinned, onToggle }: ReportCardProps) {
  async function handleBookmark(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    await onToggle(meta.slug, isPinned ? "remove" : "add");
  }

  return (
    <Link
      href={`/reportes/${meta.slug}`}
      className="group block rounded-[var(--r-lg)] bg-[var(--surf-lowest)] p-5 shadow-[var(--shadow)] transition-shadow hover:shadow-[0px_16px_40px_-4px_rgba(19,27,46,0.12)] dark:hover:shadow-[0px_16px_40px_-4px_rgba(0,0,0,0.55)] cursor-pointer"
    >
      {/* Row superior: icono + bookmark */}
      <div className="flex items-start justify-between mb-3">
        <span className="text-[var(--p-bright)]">
          <Icon name={meta.icon} size={22} strokeWidth={1.5} />
        </span>
        <button
          type="button"
          onClick={handleBookmark}
          aria-label={isPinned ? "Quitar de guardados" : "Guardar reporte"}
          className="ml-2 shrink-0 rounded-md p-0.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p-bright)]"
        >
          <Icon
            name="bookmark"
            size={18}
            strokeWidth={1.75}
            className={isPinned ? "text-[var(--p-bright)]" : "text-[var(--on-surf-var)] group-hover:text-[var(--on-surf)]"}
          />
        </button>
      </div>

      {/* Título */}
      <p
        className="text-[1.125rem] font-semibold leading-tight tracking-tight text-[var(--on-surf)] mb-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {meta.title}
      </p>

      {/* Descripción */}
      <p className="text-[0.8125rem] text-[var(--on-surf-var)] leading-snug line-clamp-2 mb-3">
        {meta.description}
      </p>

      {/* Badge de status */}
      {meta.status === "placeholder" && (
        <Chip variant="info" label="Próximamente" />
      )}
      {meta.status === "ready-pending-impl" && (
        <Chip variant="warn" label="En construcción" />
      )}
    </Link>
  );
}
