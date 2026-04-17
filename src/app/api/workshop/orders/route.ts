import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
  generatePublicToken,
  calculateHourlyPrice,
  assertPolicyActive,
} from "@/lib/workshop";
import { SERVICE_ORDER_TYPES } from "@/lib/workshop-enums";

interface SessionUser {
  id: string;
  branchId: string;
}

// Item del payload al crear la orden. Todos son opcionales: la UI actual
// (NewOrderDialog) crea la orden sin ítems; ésos se agregan después vía
// POST /api/workshop/orders/[id]/items. El bloque está aquí para soportar
// el wizard de recepción de Sub-fase C, que capturará ítems al crear.
const newOrderItemSchema = z
  .object({
    serviceCatalogId: z.string().uuid().optional(),
    productVariantId: z.string().uuid().optional(),
    simpleProductId: z.string().optional(),
    description: z.string().min(1).optional(),
    quantity: z.number().int().positive().default(1),
    price: z.number().nonnegative().optional(),
    laborMinutes: z.number().int().positive().optional(),
  })
  .superRefine((data, ctx) => {
    const refs = [
      data.serviceCatalogId,
      data.productVariantId,
      data.simpleProductId,
    ].filter((v) => v != null).length;
    if (refs > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Un ítem solo puede referenciar un catálogo, una variante o un producto simple",
      });
    }
    if (refs === 0 && !data.description) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "El ítem requiere descripción si no referencia catálogo/variante/producto simple",
      });
    }
  });

const newOrderSchema = z.object({
  customerId: z.string().optional(),
  customerBikeId: z.string().optional(),
  customerName: z.string().min(1, "El nombre del cliente es obligatorio"),
  customerPhone: z.string().optional(),
  bikeInfo: z.string().min(1, "Los detalles de la bicicleta son obligatorios"),
  diagnosis: z.string().min(1, "El diagnóstico es obligatorio"),
  type: z.enum(SERVICE_ORDER_TYPES).default("PAID"),
  assignedTechId: z.string().uuid().nullable().optional(),
  items: z.array(newOrderItemSchema).optional(),
});

// POST /api/workshop/orders — crear nueva orden de servicio
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId } = session.user as unknown as SessionUser;

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Empleado sin sucursal asignada." },
      { status: 400 },
    );
  }

  const body: unknown = await req.json();
  const parsed = newOrderSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const input = parsed.data;

  // POLICY_MAINTENANCE exige customerBikeId como guard mínimo de Sub-fase A.
  // La validación de vigencia real (assertPolicyActive) es hoy no-op.
  if (input.type === "POLICY_MAINTENANCE" && !input.customerBikeId) {
    return NextResponse.json(
      {
        success: false,
        error:
          "Mantenimiento en póliza requiere seleccionar la bicicleta del cliente",
      },
      { status: 422 },
    );
  }

  try {
    await requireActiveUser(session);

    // ── Resolución / creación del cliente (preserva el flujo existente) ──
    let customer;
    if (input.customerId) {
      customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    } else if (input.customerPhone) {
      customer = await prisma.customer.findUnique({
        where: { phone: input.customerPhone },
      });
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: input.customerName,
          phone: input.customerPhone || null,
        },
      });
    } else if (!input.customerId && customer.name !== input.customerName) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: { name: input.customerName },
      });
    }

    // ── Validaciones server-side previas a la transacción ──
    if (input.assignedTechId) {
      const tech = await prisma.user.findUnique({
        where: { id: input.assignedTechId },
        select: { id: true, role: true, branchId: true, isActive: true },
      });
      if (!tech || !tech.isActive) {
        return NextResponse.json(
          { success: false, error: "El técnico asignado no existe o está inactivo" },
          { status: 422 },
        );
      }
      if (tech.role !== "TECHNICIAN") {
        return NextResponse.json(
          { success: false, error: "El usuario asignado no es técnico" },
          { status: 422 },
        );
      }
      if (tech.branchId !== branchId) {
        return NextResponse.json(
          { success: false, error: "El técnico asignado es de otra sucursal" },
          { status: 422 },
        );
      }
    }

    // Si vienen ítems con serviceCatalogId HOURLY, cargar catálogos para
    // calcular precios server-side. Hacerlo fuera de la transacción para
    // poder retornar 422 con mensaje claro si falta hourlyRate.
    const catalogIds = (input.items ?? [])
      .map((it) => it.serviceCatalogId)
      .filter((id): id is string => typeof id === "string");
    const catalogs = catalogIds.length
      ? await prisma.serviceCatalog.findMany({
          where: { id: { in: catalogIds }, branchId, isActive: true },
        })
      : [];
    const catalogById = new Map(catalogs.map((c) => [c.id, c]));

    const branch = await prisma.branch.findUnique({
      where: { id: branchId },
      select: { hourlyRate: true, code: true },
    });
    if (!branch) {
      return NextResponse.json(
        { success: false, error: "Sucursal no encontrada" },
        { status: 404 },
      );
    }

    // Pre-compute price/description por ítem validando reglas HOURLY/FIXED.
    interface ComputedItem {
      serviceOrderItemInput: Prisma.ServiceOrderItemUncheckedCreateWithoutServiceOrderInput;
    }
    const computedItems: ComputedItem[] = [];
    for (const raw of input.items ?? []) {
      const catalog = raw.serviceCatalogId
        ? catalogById.get(raw.serviceCatalogId)
        : null;
      if (raw.serviceCatalogId && !catalog) {
        return NextResponse.json(
          {
            success: false,
            error: "Servicio del catálogo no encontrado o inactivo",
          },
          { status: 422 },
        );
      }

      let priceDecimal: Prisma.Decimal;
      let quantity = raw.quantity ?? 1;
      let laborMinutes: number | null = null;
      let description: string;

      if (catalog && catalog.chargeModel === "HOURLY") {
        if (!raw.laborMinutes) {
          return NextResponse.json(
            {
              success: false,
              error: `"${catalog.name}" requiere minutos de mano de obra`,
            },
            { status: 422 },
          );
        }
        try {
          priceDecimal = calculateHourlyPrice(branch.hourlyRate, raw.laborMinutes);
        } catch (err) {
          const message =
            err instanceof Error
              ? err.message
              : "No se pudo calcular el precio por hora";
          return NextResponse.json(
            { success: false, error: message },
            { status: 422 },
          );
        }
        laborMinutes = raw.laborMinutes;
        quantity = 1; // HOURLY vive en una sola línea; laborMinutes carga el tiempo
        description = raw.description ?? catalog.name;
      } else if (catalog && catalog.chargeModel === "FIXED") {
        priceDecimal = catalog.basePrice;
        description = raw.description ?? catalog.name;
      } else {
        // Variante, producto simple o ítem libre: el caller provee precio.
        if (raw.price == null) {
          return NextResponse.json(
            {
              success: false,
              error: "El ítem requiere precio si no viene de catálogo",
            },
            { status: 422 },
          );
        }
        priceDecimal = new Prisma.Decimal(raw.price);
        description = raw.description ?? "";
        if (!description) {
          return NextResponse.json(
            { success: false, error: "El ítem requiere descripción" },
            { status: 422 },
          );
        }
      }

      computedItems.push({
        serviceOrderItemInput: {
          serviceCatalogId: raw.serviceCatalogId ?? null,
          productVariantId: raw.productVariantId ?? null,
          simpleProductId: raw.simpleProductId ?? null,
          description,
          quantity,
          price: priceDecimal,
          laborMinutes,
          isExtra: false, // ítems del diagnóstico inicial nunca son extra
        },
      });
    }

    const subtotal = computedItems.reduce(
      (acc, { serviceOrderItemInput: it }) =>
        acc + Number(it.price) * (it.quantity ?? 1),
      0,
    );

    // ── Transacción: orden + ítems ──
    const publicToken = generatePublicToken();
    const folio = `TS-${Date.now().toString().slice(-5)}`;

    const result = await prisma.$transaction(async (tx) => {
      if (input.type === "POLICY_MAINTENANCE") {
        // Guard formal no-op hoy — ver docstring en src/lib/workshop.ts.
        await assertPolicyActive(input.customerBikeId!, tx);
      }

      const order = await tx.serviceOrder.create({
        data: {
          folio,
          branchId,
          userId,
          customerId: customer.id,
          customerBikeId: input.customerBikeId || null,
          bikeInfo: input.bikeInfo,
          diagnosis: input.diagnosis,
          status: "PENDING",
          type: input.type,
          assignedTechId: input.assignedTechId ?? null,
          publicToken,
          subtotal,
          total: subtotal,
          items: {
            create: computedItems.map((c) => c.serviceOrderItemInput),
          },
        },
        select: { id: true, folio: true, publicToken: true },
      });

      return order;
    });

    if (input.type === "POLICY_MAINTENANCE") {
      console.warn(
        `[workshop/orders POST] POLICY_MAINTENANCE creada ${result.id}: validación de vigencia es no-op (pendiente modelar póliza).`,
      );
    }

    return NextResponse.json({
      success: true,
      data: {
        orderId: result.id,
        folio: result.folio,
        publicToken: result.publicToken,
      },
    });
  } catch (error: unknown) {
    if (error instanceof UserInactiveError) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 401 },
      );
    }
    console.error("[api/workshop/orders POST]", error);
    const message =
      error instanceof Error ? error.message : "Error al crear la orden";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
