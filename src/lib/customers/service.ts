// Helpers compartidos por los endpoints de Customer.
// BRIEF.md §4, §6, §10.

import type { Prisma, PrismaClient } from "@prisma/client";
import { CUSTOMER_SENSITIVE_FIELDS, type CustomerSensitiveField } from "./validation";

// Alias compacto para `tx` en transactions.
type Tx = Prisma.TransactionClient | PrismaClient;

export type Role = "ADMIN" | "MANAGER" | "SELLER" | "TECHNICIAN";

export function isManagerPlus(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER";
}

export function isSellerPlus(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "SELLER";
}

export function isTechnicianPlus(role: string | null | undefined): boolean {
  return role === "ADMIN" || role === "MANAGER" || role === "TECHNICIAN";
}

// Filtro base del directorio (§6.2: soft-delete y soft-merge se excluyen
// SOLO en queries top-level, nunca en relaciones).
export function listableCustomerWhere(opts?: {
  includeDeleted?: boolean;
}): Prisma.CustomerWhereInput {
  return {
    mergedIntoId: null,
    ...(opts?.includeDeleted ? {} : { deletedAt: null }),
  };
}

// Serializa un cambio para escribir en CustomerEditLog.
interface AuditEntry {
  field: string;
  oldValue: string | null;
  newValue: string | null;
  reason?: string | null;
  customerBikeId?: string | null;
}

function stringify(v: unknown): string | null {
  if (v == null) return null;
  if (v instanceof Date) return v.toISOString();
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

export function diffForAudit(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): AuditEntry[] {
  const entries: AuditEntry[] = [];
  for (const field of fields) {
    if (!(field in after)) continue;
    const oldV = stringify(before[field]);
    const newV = stringify(after[field]);
    if (oldV !== newV) {
      entries.push({ field, oldValue: oldV, newValue: newV });
    }
  }
  return entries;
}

export async function writeCustomerEditLog(
  tx: Tx,
  args: {
    customerId: string;
    userId: string;
    entries: AuditEntry[];
    reason?: string | null;
  },
): Promise<void> {
  if (!args.entries.length) return;
  await tx.customerEditLog.createMany({
    data: args.entries.map((e) => ({
      customerId: args.customerId,
      customerBikeId: e.customerBikeId ?? null,
      userId: args.userId,
      field: e.field,
      oldValue: e.oldValue,
      newValue: e.newValue,
      reason: e.reason ?? args.reason ?? null,
    })),
  });
}

// Exponer para callers que quieren saber qué campos requieren motivo.
export { CUSTOMER_SENSITIVE_FIELDS, type CustomerSensitiveField };
