import type { SessionUser } from "@/lib/auth-types";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TemplateManager, type TemplateRow } from "./template-manager";

export const dynamic = "force-dynamic";

export default async function WhatsAppTemplatesPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/");

  const templates = await prisma.whatsAppTemplate.findMany({
    include: { updatedByUser: { select: { name: true } } },
    orderBy: { key: "asc" },
  });

  const rows: TemplateRow[] = templates.map((t) => ({
    key: t.key,
    description: t.description,
    bodyTemplate: t.bodyTemplate,
    requiredVariables: t.requiredVariables as string[],
    isActive: t.isActive,
    updatedAt: t.updatedAt.toISOString(),
    updatedByName: t.updatedByUser?.name ?? null,
  }));

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          Plantillas WhatsApp
        </h1>
        <p className="text-sm text-[var(--on-surf-var)] mt-1">
          Edita las plantillas de mensajes. Los cambios no afectan mensajes ya generados.
        </p>
      </div>

      <TemplateManager rows={rows} />
    </div>
  );
}
