import type { BranchedSessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { z } from "zod";

interface RouteParams {
  params: Promise<{ id: string }>;
}

const itemInputSchema = z
  .object({
    productVariantId: z.string().min(1).optional(),
    description: z.string().optional(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive(),
    isFreeForm: z.boolean().default(false),
  })
  .superRefine((item, ctx) => {
    if (item.isFreeForm) {
      if (!item.description?.trim()) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Las líneas libres requieren descripción",
          path: ["description"],
        });
      }
    } else {
      if (!item.productVariantId) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Las líneas de catálogo requieren productVariantId",
          path: ["productVariantId"],
        });
      }
    }
  });

const patchQuotationSchema = z.object({
  customerId: z.string().optional(),
  anonymousCustomerName: z.string().optional(),
  anonymousCustomerPhone: z.string().regex(/^\d{10}$/, "El teléfono debe ser exactamente 10 dígitos").optional().or(z.literal("")),
  items: z.array(itemInputSchema).min(1, "La cotización debe tener al menos un artículo"),
  discountAmount: z.number().nonnegative().default(0),
  discountAuthorizedById: z.string().optional(),
  internalNote: z.string().optional(),
});

const EDITABLE_STATUSES = ["DRAFT", "EN_ESPERA_CLIENTE"] as const;

// PATCH /api/cotizaciones/[id] — editar cotización (solo DRAFT o SENT)
export async function PATCH(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { branchId, role } = session.user as unknown as BranchedSessionUser;
  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Usuario sin sucursal asignada" },
      { status: 400 }
    );
  }

  const { id } = await params;

  const body: unknown = await req.json();
  const parsed = patchQuotationSchema.safeParse(body);
  if (!parsed.success) {
    const msg = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: msg }, { status: 422 });
  }

  const input = parsed.data;

  // ── Verificar que la cotización existe y es editable ──────────────────────
  const existing = await prisma.quotation.findUnique({
    where: { id },
    select: { id: true, status: true, branchId: true },
  });

  if (!existing) {
    return NextResponse.json({ success: false, error: "Cotización no encontrada" }, { status: 404 });
  }

  if (!EDITABLE_STATUSES.includes(existing.status as (typeof EDITABLE_STATUSES)[number])) {
    return NextResponse.json(
      {
        success: false,
        error: `No se puede editar una cotización en estado ${existing.status}. Solo se permiten DRAFT y EN_ESPERA_CLIENTE.`,
      },
      { status: 422 }
    );
  }

  // Solo ADMIN puede editar cotizaciones de otras sucursales
  if (role !== "ADMIN" && existing.branchId !== branchId) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 403 });
  }

  // ── Validar autorización de descuento ──────────────────────────────────────
  if (input.discountAmount > 0) {
    if (!input.discountAuthorizedById) {
      return NextResponse.json(
        {
          success: false,
          error: "Los descuentos fijos requieren autorización de un gerente (discountAuthorizedById).",
        },
        { status: 422 }
      );
    }
    const authorizer = await prisma.user.findUnique({
      where: { id: input.discountAuthorizedById },
      select: { role: true },
    });
    if (!authorizer || !["MANAGER", "ADMIN"].includes(authorizer.role)) {
      return NextResponse.json(
        {
          success: false,
          error: "El usuario autorizador no tiene rol suficiente (requiere MANAGER o ADMIN).",
        },
        { status: 422 }
      );
    }
  }

  // ── Validar ítems de catálogo ──────────────────────────────────────────────
  const catalogIds = input.items
    .filter((i) => !i.isFreeForm && i.productVariantId)
    .map((i) => i.productVariantId as string);

  type VariantSnap = {
    id: string;
    nombre: string;
    colorNombre: string;
    voltajeLabel: string;
  };

  const variantMap = new Map<string, VariantSnap>();

  if (catalogIds.length > 0) {
    const variants = await prisma.productVariant.findMany({
      where: { id: { in: catalogIds } },
      select: {
        id: true,
        modelo: { select: { nombre: true } },
        color: { select: { nombre: true } },
        voltaje: { select: { label: true } },
      },
    });
    for (const v of variants) {
      variantMap.set(v.id, {
        id: v.id,
        nombre: v.modelo.nombre,
        colorNombre: v.color.nombre,
        voltajeLabel: v.voltaje.label,
      });
    }
    const missing = catalogIds.filter((cid) => !variantMap.has(cid));
    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Producto no encontrado en el catálogo: ${missing[0]}` },
        { status: 422 }
      );
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Borrar ítems anteriores y recrear
      await tx.quotationItem.deleteMany({ where: { quotationId: id } });

      const itemsData = input.items.map((item) => {
        const lineTotal = item.unitPrice * item.quantity;
        if (item.isFreeForm) {
          return {
            isFreeForm: true,
            productVariantId: null,
            description: item.description!,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            lineTotal,
          };
        }
        const snap = variantMap.get(item.productVariantId!);
        const description = snap
          ? `${snap.nombre} ${snap.colorNombre} ${snap.voltajeLabel}`
          : item.description ?? "";
        return {
          isFreeForm: false,
          productVariantId: item.productVariantId!,
          description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          lineTotal,
        };
      });

      const subtotal = itemsData.reduce((acc, i) => acc + i.lineTotal, 0);
      const total = subtotal - input.discountAmount;

      return tx.quotation.update({
        where: { id },
        data: {
          customerId: input.customerId ?? null,
          anonymousCustomerName: input.anonymousCustomerName ?? null,
          anonymousCustomerPhone: input.anonymousCustomerPhone ?? null,
          subtotal,
          discountAmount: input.discountAmount,
          total,
          discountAuthorizedById: input.discountAuthorizedById ?? null,
          internalNote: input.internalNote ?? null,
          items: { create: itemsData },
        },
        include: { items: true },
      });
    });

    return NextResponse.json({ success: true, data: serializeQuotation(updated) });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error al actualizar la cotización";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// ── Serialización ─────────────────────────────────────────────────────────────
type QuotationWithItems = Prisma.QuotationGetPayload<{ include: { items: true } }>;

function serializeQuotation(q: QuotationWithItems) {
  return {
    id: q.id,
    folio: q.folio,
    branchId: q.branchId,
    userId: q.userId,
    customerId: q.customerId,
    anonymousCustomerName: q.anonymousCustomerName,
    anonymousCustomerPhone: q.anonymousCustomerPhone,
    status: q.status,
    validUntil: q.validUntil.toISOString(),
    subtotal: Number(q.subtotal),
    discountAmount: Number(q.discountAmount),
    total: Number(q.total),
    discountAuthorizedById: q.discountAuthorizedById,
    internalNote: q.internalNote,
    publicShareToken: q.publicShareToken,
    convertedToSaleId: q.convertedToSaleId,
    convertedAt: q.convertedAt?.toISOString() ?? null,
    convertedByUserId: q.convertedByUserId,
    convertedInBranchId: q.convertedInBranchId,
    cancelledAt: q.cancelledAt?.toISOString() ?? null,
    cancelledByUserId: q.cancelledByUserId,
    cancelReason: q.cancelReason,
    items: q.items.map((i) => ({
      id: i.id,
      productVariantId: i.productVariantId,
      description: i.description,
      quantity: i.quantity,
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.lineTotal),
      isFreeForm: i.isFreeForm,
      createdAt: i.createdAt.toISOString(),
    })),
    createdAt: q.createdAt.toISOString(),
    updatedAt: q.updatedAt.toISOString(),
  };
}

