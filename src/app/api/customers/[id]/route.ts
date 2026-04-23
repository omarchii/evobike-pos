import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { customerUpdateSchema } from "@/lib/customers/validation";
import {
  CUSTOMER_SENSITIVE_FIELDS,
  diffForAudit,
  isManagerPlus,
  writeCustomerEditLog,
} from "@/lib/customers/service";
import { normalizeForSearch } from "@/lib/customers/normalize";

// Campos que SELLER puede editar.
const SELLER_WRITABLE: readonly string[] = [
  "name",
  "phone",
  "phone2",
  "email",
  "birthday",
  "isBusiness",
  "communicationConsent",
  "shippingStreet",
  "shippingExtNum",
  "shippingIntNum",
  "shippingColonia",
  "shippingCity",
  "shippingState",
  "shippingZip",
  "shippingRefs",
  "rfc",
  "razonSocial",
  "regimenFiscal",
  "usoCFDI",
  "emailFiscal",
  "fiscalStreet",
  "fiscalExtNum",
  "fiscalIntNum",
  "fiscalColonia",
  "fiscalCity",
  "fiscalState",
  "fiscalZip",
];

// Campos que requieren MANAGER+.
const MANAGER_ONLY_FIELDS: readonly string[] = ["creditLimit", "tags"];

// Campos que disparan diálogo de confirmación y motivo obligatorio.
const FIELDS_REQUIRING_REASON = CUSTOMER_SENSITIVE_FIELDS;

const updateBodySchema = customerUpdateSchema.extend({
  creditLimit: z.number().nonnegative().optional(),
  reason: z.string().trim().min(1).optional(),
});

// GET /api/customers/[id] — ficha completa.
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const customer = await prisma.customer.findUnique({
    where: { id },
    include: {
      bikes: true,
      _count: { select: { sales: true, serviceOrders: true, quotations: true } },
    },
  });

  if (!customer) {
    return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
  }

  // Si está mergeado, devolver 308 lógico con el target para que el caller redirija.
  if (customer.mergedIntoId) {
    return NextResponse.json(
      { success: false, error: "MERGED", redirectTo: customer.mergedIntoId },
      { status: 308 },
    );
  }

  return NextResponse.json({
    success: true,
    data: {
      ...customer,
      balance: Number(customer.balance),
      creditLimit: Number(customer.creditLimit),
    },
  });
}

// PUT /api/customers/[id] — editar con rol-gated y audit log.
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id } = await params;
  const body: unknown = await req.json();
  const parsed = updateBodySchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const { reason, ...rawPatch } = parsed.data;

  // Filtra campos por rol.
  const managerPlus = isManagerPlus(user.role);
  const allowedFields = new Set<string>(SELLER_WRITABLE);
  if (managerPlus) {
    MANAGER_ONLY_FIELDS.forEach((f) => allowedFields.add(f));
  }

  const patch: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(rawPatch)) {
    if (!allowedFields.has(key)) continue;
    patch[key] = value;
  }

  // Detección de campos sensibles sin motivo.
  const touchingSensitive = FIELDS_REQUIRING_REASON.some((f) => f in patch);
  if (touchingSensitive && !reason) {
    return NextResponse.json(
      { success: false, error: "Se requiere motivo para editar campos fiscales o límite de crédito" },
      { status: 400 },
    );
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      const before = await tx.customer.findUnique({ where: { id } });
      if (!before) return null;
      if (before.mergedIntoId) return "MERGED" as const;
      if (before.deletedAt) return "DELETED" as const;

      // Guardrail: phone anterior se conserva en phonePrevious.
      const updateData: Prisma.CustomerUpdateInput = { ...(patch as Prisma.CustomerUpdateInput) };
      if ("phone" in patch && patch.phone !== before.phone) {
        updateData.phonePrevious = before.phone;
      }
      if ("name" in patch && typeof patch.name === "string") {
        updateData.nameNormalized = normalizeForSearch(patch.name);
      }

      const after = await tx.customer.update({ where: { id }, data: updateData });

      // Audit: solo camposDonde antes != después.
      const beforeAsRecord = before as unknown as Record<string, unknown>;
      const afterAsRecord = after as unknown as Record<string, unknown>;
      const entries = diffForAudit(beforeAsRecord, afterAsRecord, Object.keys(patch));
      await writeCustomerEditLog(tx, {
        customerId: id,
        userId: user.id,
        entries,
        reason: reason ?? null,
      });

      return after;
    });

    if (result === null) {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }
    if (result === "MERGED") {
      return NextResponse.json(
        { success: false, error: "Cliente fusionado; no editable" },
        { status: 409 },
      );
    }
    if (result === "DELETED") {
      return NextResponse.json(
        { success: false, error: "Cliente eliminado; restaurar antes de editar" },
        { status: 409 },
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        ...result,
        balance: Number(result.balance),
        creditLimit: Number(result.creditLimit),
      },
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "valor único";
      return NextResponse.json(
        { success: false, error: `Ya existe un cliente con ese ${target}` },
        { status: 409 },
      );
    }
    console.error("[api/customers/[id] PUT]", err);
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}

const deleteBodySchema = z.object({
  reason: z.enum(["DUPLICATE", "REQUEST", "ERROR"]),
});

// DELETE /api/customers/[id] — soft-delete (MANAGER+).
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }
  if (!isManagerPlus(user.role)) {
    return NextResponse.json({ success: false, error: "Requiere rol MANAGER+" }, { status: 403 });
  }

  const body: unknown = await req.json().catch(() => ({}));
  const parsed = deleteBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: "Se requiere motivo: DUPLICATE | REQUEST | ERROR" },
      { status: 400 },
    );
  }

  const { id } = await params;
  try {
    const updated = await prisma.customer.update({
      where: { id },
      data: { deletedAt: new Date(), deletedReason: parsed.data.reason },
    });
    return NextResponse.json({ success: true, data: { id: updated.id } });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2025") {
      return NextResponse.json({ success: false, error: "Cliente no encontrado" }, { status: 404 });
    }
    console.error("[api/customers/[id] DELETE]", err);
    return NextResponse.json({ success: false, error: "Error interno" }, { status: 500 });
  }
}
