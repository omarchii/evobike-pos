// Ruta consolidada con el perfil canónico /customers/[id]?tab=finanzas
// (BRIEF §7.1 — Sub-fase H). Se conserva solo como redirect 308.

import { permanentRedirect } from "next/navigation";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ from?: string; to?: string }>;
}

export default async function ClienteDetalleRedirect({
  params,
  searchParams,
}: PageProps): Promise<never> {
  const { id } = await params;
  const sp = await searchParams;
  const qs = new URLSearchParams({ tab: "finanzas" });
  if (sp.from) qs.set("from", sp.from);
  if (sp.to) qs.set("to", sp.to);
  permanentRedirect(`/customers/${id}?${qs.toString()}`);
}
