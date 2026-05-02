import { prisma } from "@/lib/prisma";
import type { OutboundMessage, Prisma } from "@prisma/client";
import { renderTemplate, extractPlaceholders } from "./render";

// ── Errors ───────────────────────────────────────────────────────────────────

export class TemplateNotAvailableError extends Error {
  constructor(key: string) {
    super(`Template "${key}" not found or inactive`);
    this.name = "TemplateNotAvailableError";
  }
}

export class VariableValidationError extends Error {
  constructor(
    public missing: string[],
    public extra: string[],
  ) {
    const parts: string[] = [];
    if (missing.length) parts.push(`missing: ${missing.join(", ")}`);
    if (extra.length) parts.push(`extra: ${extra.join(", ")}`);
    super(`Variable validation failed — ${parts.join("; ")}`);
    this.name = "VariableValidationError";
  }
}

export class InvalidTransitionError extends Error {
  constructor(currentStatus: string) {
    super(`Cannot transition from "${currentStatus}"`);
    this.name = "InvalidTransitionError";
  }
}

// ── send() ───────────────────────────────────────────────────────────────────

interface SendOptions {
  templateKey: string;
  customerId?: string | null;
  recipientPhone: string;
  variables: Record<string, string>;
  expiresAt?: Date | null;
  context?: {
    triggeredByUserId?: string | null;
    source: "cron" | "manual";
  };
  tx?: Prisma.TransactionClient;
}

export async function send(opts: SendOptions): Promise<OutboundMessage> {
  const db = opts.tx ?? prisma;

  const template = await db.whatsAppTemplate.findUnique({
    where: { key: opts.templateKey },
  });

  if (!template || !template.isActive) {
    throw new TemplateNotAvailableError(opts.templateKey);
  }

  const required = template.requiredVariables as string[];
  const provided = Object.keys(opts.variables);
  const missing = required.filter((k) => !provided.includes(k));
  const extra = provided.filter((k) => !required.includes(k));

  if (missing.length || extra.length) {
    throw new VariableValidationError(missing, extra);
  }

  const renderedBody = renderTemplate(template.bodyTemplate, opts.variables);

  return db.outboundMessage.create({
    data: {
      templateKey: opts.templateKey,
      customerId: opts.customerId ?? null,
      recipientPhone: opts.recipientPhone,
      variables: opts.variables,
      renderedBody,
      status: "PENDING",
      expiresAt: opts.expiresAt ?? null,
      scheduledAt: new Date(),
    },
  });
}

// ── markOpened() ─────────────────────────────────────────────────────────────

export async function markOpened(
  outboundMessageId: string,
  userId: string,
): Promise<OutboundMessage> {
  const msg = await prisma.outboundMessage.findUniqueOrThrow({
    where: { id: outboundMessageId },
  });

  if (msg.status === "OPENED_IN_WAME") return msg;

  if (msg.status !== "PENDING") {
    throw new InvalidTransitionError(msg.status);
  }

  return prisma.outboundMessage.update({
    where: { id: outboundMessageId },
    data: {
      status: "OPENED_IN_WAME",
      openedAt: new Date(),
      openedByUserId: userId,
    },
  });
}

// ── cancel() ─────────────────────────────────────────────────────────────────

export async function cancel(
  outboundMessageId: string,
  reason: string,
): Promise<OutboundMessage> {
  const msg = await prisma.outboundMessage.findUniqueOrThrow({
    where: { id: outboundMessageId },
  });

  if (msg.status === "CANCELLED") return msg;

  if (msg.status !== "PENDING") {
    throw new InvalidTransitionError(msg.status);
  }

  return prisma.outboundMessage.update({
    where: { id: outboundMessageId },
    data: {
      status: "CANCELLED",
      cancelReason: reason,
    },
  });
}
