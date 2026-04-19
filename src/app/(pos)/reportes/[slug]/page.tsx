import { notFound } from "next/navigation";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { REPORTS_BY_SLUG } from "@/lib/reportes/reports-config";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ slug: string }> };

export default async function ReportePlaceholder({ params }: Props) {
  const { slug } = await params;
  const meta = REPORTS_BY_SLUG[slug];

  // Sin config o reservado → 404
  if (!meta || meta.status === "reserved") notFound();

  // Si llegamos con status "ready", hay un config mismatch (el page.tsx específico
  // debería haber manejado la ruta antes que este catch-all).
  if (meta.status === "ready") notFound();

  const isPlaceholder = meta.status === "placeholder";

  return (
    <div className="mx-auto max-w-3xl py-12">
      <span className="text-[var(--p-bright)] mb-4 block">
        <Icon name={meta.icon} size={40} strokeWidth={1.25} />
      </span>
      <h1
        className="text-2xl font-bold tracking-[-0.01em] text-[var(--on-surf)] mb-2"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {meta.title}
      </h1>
      <p className="text-sm text-[var(--on-surf-var)] mb-8">
        {meta.description}
      </p>
      <div className="rounded-[var(--r-lg)] bg-[var(--surf-low)] p-6">
        <Chip
          variant={isPlaceholder ? "info" : "warn"}
          label={isPlaceholder ? "Próximamente" : "En construcción"}
        />
        <p className="mt-3 text-sm text-[var(--on-surf-var)]">
          Este reporte está en desarrollo y estará disponible próximamente.
        </p>
      </div>
    </div>
  );
}
