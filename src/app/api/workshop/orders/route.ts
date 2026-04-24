import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import crypto from "crypto";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
  generatePublicToken,
  calculateHourlyPrice,
  assertPolicyActive,
} from "@/lib/workshop";
import { SERVICE_ORDER_TYPES } from "@/lib/workshop-enums";
import { CHECKLIST_KEYS } from "@/lib/workshop-checklist";
import { moveDraftToOrder, cleanupOrderPhotos } from "@/lib/workshop-photos";
import { getViewBranchId } from "@/lib/branch-filter";
import { normalizeForSearch } from "@/lib/customers/normalize";
import type { SessionUser } from "@/lib/auth-types";

// Item del payload al crear la orden. Todos son opcionales: el wizard de
// recepción crea la orden sin ítems; ésos se agregan después vía
// POST /api/workshop/orders/[id]/items.
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

const checklistEntrySchema = z.object({
  key: z.string(),
  state: z.enum(["OK", "FAIL", "NA"]),
  note: z.string().max(500).nullable().default(null),
});

// Datos para crear una CustomerBike nueva junto con la orden. Si brand es
// "Evobike" (case-insensitive) el VIN es obligatorio; para otras marcas
// es opcional y se persiste "" cuando no se captura.
const newBikeSchema = z
  .object({
    brand: z.string().min(1, "La marca es obligatoria"),
    model: z.string().optional(),
    color: z.string().optional(),
    serialNumber: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (
      val.brand.trim().toLowerCase() === "evobike" &&
      (!val.serialNumber || !val.serialNumber.trim())
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["serialNumber"],
        message: "VIN obligatorio para bicicletas Evobike",
      });
    }
  });

const newOrderSchema = z
  .object({
    customerId: z.string().optional(),
    customerBikeId: z.string().optional(),
    customerName: z.string().min(1, "El nombre del cliente es obligatorio"),
    customerPhone: z.string().optional(),
    bikeInfo: z.string().optional(),
    newBike: newBikeSchema.optional(),
    diagnosis: z.string().max(2000).optional().nullable(),
    type: z.enum(SERVICE_ORDER_TYPES).default("PAID"),
    assignedTechId: z.string().uuid().nullable().optional(),
    items: z.array(newOrderItemSchema).optional(),
    // Campos de recepción (Sub-fase C — Decisión 7)
    checklist: z.array(checklistEntrySchema).optional(),
    signatureData: z.string().nullable().optional(),
    signatureRejected: z.boolean().optional(),
    photoUrls: z
      .array(
        z.string().refine((u) => u.startsWith("/workshop/drafts/"), {
          message: "URL de foto debe ser un draft de taller",
        }),
      )
      .max(5, "Máximo 5 fotos por orden")
      .optional(),
    expectedDeliveryDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Formato de fecha inválido (esperado YYYY-MM-DD)")
      .refine(
        (val) => val >= new Date().toISOString().slice(0, 10),
        { message: "La fecha estimada de entrega no puede ser en el pasado" },
      )
      .optional(),
  })
  .superRefine((data, ctx) => {
    // Identificador de bici: exactamente uno de los tres es requerido.
    const hasBikeInfo =
      typeof data.bikeInfo === "string" && data.bikeInfo.trim().length > 0;
    if (!data.customerBikeId && !data.newBike && !hasBikeInfo) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message:
          "Debe indicar la bicicleta: selecciona una registrada, captura una nueva o describe el equipo.",
        path: ["bikeInfo"],
      });
    }
    // Checklist: si presente, exactamente 10 ítems con las 10 claves requeridas
    if (data.checklist !== undefined) {
      if (data.checklist.length !== 10) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "El checklist debe tener exactamente 10 ítems",
          path: ["checklist"],
        });
      } else {
        const providedKeys = new Set(data.checklist.map((i) => i.key));
        for (const k of CHECKLIST_KEYS) {
          if (!providedKeys.has(k)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              message: `El checklist debe incluir la clave: ${k}`,
              path: ["checklist"],
            });
          }
        }
      }
    }
    // Firma: si se envía contexto de firma, validar coherencia
    const hasSignatureContext =
      data.signatureData !== undefined || data.signatureRejected !== undefined;
    if (hasSignatureContext) {
      const rejected = data.signatureRejected ?? false;
      if (!rejected && (!data.signatureData || data.signatureData.trim() === "")) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "La firma es obligatoria si el cliente no la rechazó",
          path: ["signatureData"],
        });
      }
    }
  });

// POST /api/workshop/orders — crear nueva orden de servicio
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const user = session.user as unknown as SessionUser;
  const userId = user.id;
  const branchId = await getViewBranchId();

  if (!branchId) {
    return NextResponse.json(
      { success: false, error: "Selecciona una sucursal para operar" },
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

  // Generate orderId before the transaction so photos can be moved pre-tx
  const orderId = crypto.randomUUID();
  const finalPhotoUrls: string[] = [];

  try {
    await requireActiveUser(session);

    // ── Resolución / creación del cliente (preserva el flujo existente) ──
    let customer;
    if (input.customerId) {
      customer = await prisma.customer.findUnique({ where: { id: input.customerId } });
    } else if (input.customerPhone) {
      customer = await prisma.customer.findFirst({
        where: { phone: input.customerPhone, deletedAt: null, mergedIntoId: null },
      });
    }

    if (!customer) {
      customer = await prisma.customer.create({
        data: {
          name: input.customerName,
          nameNormalized: normalizeForSearch(input.customerName),
          phone: input.customerPhone || null,
        },
      });
    } else if (!input.customerId && customer.name !== input.customerName) {
      customer = await prisma.customer.update({
        where: { id: customer.id },
        data: {
          name: input.customerName,
          nameNormalized: normalizeForSearch(input.customerName),
        },
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
      if (tech.role !== "TECHNICIAN" && tech.role !== "MANAGER") {
        return NextResponse.json(
          { success: false, error: "Solo técnicos y encargados pueden asignarse a una orden" },
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

    // ── Move de fotos de draft a carpeta de la orden (pre-transaction) ──
    if (input.photoUrls && input.photoUrls.length > 0) {
      for (const draftUrl of input.photoUrls) {
        if (!draftUrl.startsWith(`/workshop/drafts/${userId}-`)) {
          return NextResponse.json(
            { success: false, error: "URL de foto inválida" },
            { status: 400 },
          );
        }
        const finalUrl = await moveDraftToOrder(draftUrl, orderId);
        finalPhotoUrls.push(finalUrl);
      }
    }

    // ── Transacción: orden + ítems ──
    const publicToken = generatePublicToken();
    const folio = `TS-${Date.now().toString().slice(-5)}`;

    const result = await prisma.$transaction(async (tx) => {
      if (input.type === "POLICY_MAINTENANCE") {
        // Guard formal no-op hoy — ver docstring en src/lib/workshop.ts.
        await assertPolicyActive(input.customerBikeId!, tx);

        // Decisión 7: si hay ítems, al menos uno debe ser de mantenimiento.
        const items = input.items ?? [];
        if (items.length > 0) {
          const catIds = items
            .map((it) => it.serviceCatalogId)
            .filter((id): id is string => id != null);
          if (catIds.length === 0) {
            throw new Error(
              "Mantenimiento en póliza requiere al menos un servicio de mantenimiento",
            );
          }
          const mantCount = await tx.serviceCatalog.count({
            where: { id: { in: catIds }, esMantenimiento: true },
          });
          if (mantCount === 0) {
            throw new Error(
              "Mantenimiento en póliza requiere al menos un servicio marcado como mantenimiento",
            );
          }
        }
      }

      // Crear CustomerBike si el wizard envió datos estructurados de una
      // bicicleta nueva (flujo Evobike / Otra marca). Se hace dentro de la
      // transacción para que una falla posterior deshaga también la bici.
      let resolvedBikeId: string | null = input.customerBikeId || null;
      if (!resolvedBikeId && input.newBike) {
        const createdBike = await tx.customerBike.create({
          data: {
            customerId: customer.id,
            branchId,
            brand: input.newBike.brand,
            model: input.newBike.model || null,
            color: input.newBike.color || null,
            serialNumber: input.newBike.serialNumber?.trim() || "",
          },
          select: { id: true },
        });
        resolvedBikeId = createdBike.id;
      }

      const order = await tx.serviceOrder.create({
        data: {
          id: orderId,
          folio,
          branchId,
          userId,
          customerId: customer.id,
          customerBikeId: resolvedBikeId,
          bikeInfo: input.bikeInfo || null,
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
          // Campos de recepción (Sub-fase C)
          checklist: input.checklist
            ? (input.checklist as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          signatureData: (input.signatureRejected ?? false) ? null : (input.signatureData ?? null),
          signatureRejected: input.signatureRejected ?? false,
          photoUrls: finalPhotoUrls.length > 0
            ? (finalPhotoUrls as Prisma.InputJsonValue)
            : Prisma.JsonNull,
          expectedDeliveryDate: input.expectedDeliveryDate ?? null,
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
    if (finalPhotoUrls.length > 0) {
      await cleanupOrderPhotos(orderId).catch(() => {});
    }
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
