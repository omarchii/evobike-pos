import type { SessionUser } from "@/lib/auth-types";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { OutboxList, type OutboxRow } from "./outbox-list";

export const dynamic = "force-dynamic";

export default async function WhatsAppOutboxPage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as unknown as SessionUser | undefined;
  if (!user) redirect("/login");
  if (user.role !== "ADMIN" && user.role !== "MANAGER") redirect("/");

  const messages = await prisma.outboundMessage.findMany({
    where: {
      status: { in: ["PENDING", "ERROR", "OPENED_IN_WAME", "EXPIRED", "CANCELLED"] },
    },
    include: {
      customer: { select: { id: true, name: true, phone: true } },
      openedByUser: { select: { name: true } },
      template: { select: { key: true, description: true } },
    },
    orderBy: [
      { status: "asc" },
      { scheduledAt: "desc" },
    ],
    take: 200,
  });

  const rows: OutboxRow[] = messages.map((m) => ({
    id: m.id,
    templateKey: m.templateKey,
    templateDescription: m.template.description,
    customerName: m.customer?.name ?? null,
    customerId: m.customer?.id ?? null,
    currentCustomerPhone: m.customer?.phone ?? null,
    recipientPhone: m.recipientPhone,
    renderedBody: m.renderedBody,
    status: m.status,
    errorMessage: m.errorMessage,
    cancelReason: m.cancelReason,
    scheduledAt: m.scheduledAt.toISOString(),
    expiresAt: m.expiresAt?.toISOString() ?? null,
    openedAt: m.openedAt?.toISOString() ?? null,
    openedByName: m.openedByUser?.name ?? null,
  }));

  const errorCount = rows.filter((r) => r.status === "ERROR").length;
  const pendingCount = rows.filter((r) => r.status === "PENDING").length;

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1
          className="text-3xl font-semibold"
          style={{ fontFamily: "var(--font-display)" }}
        >
          WhatsApp — Bandeja de salida
        </h1>
        <p className="text-sm text-[var(--on-surf-var)] mt-1">
          Mensajes pendientes de enviar a clientes vía WhatsApp.
        </p>
      </div>

      {errorCount > 0 && (
        <div
          className="rounded-xl px-4 py-3 text-sm font-medium"
          style={{
            background: "rgba(220,38,38,0.12)",
            color: "#dc2626",
          }}
        >
          {errorCount} mensaje{errorCount > 1 ? "s" : ""} con error requiere{errorCount > 1 ? "n" : ""} atención.
        </div>
      )}

      <OutboxList rows={rows} pendingCount={pendingCount} />
    </div>
  );
}
