import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { getEffectiveStatus } from "@/lib/quotations";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import { assertSessionFreshOrThrow, OrphanedCashSessionError } from "@/lib/cash-register";

interface SessionUser {
  id: string;
  branchId: string;
  role: string;
}

interface RouteParams {
  params: Promise<{ id: string }>;
}

const convertSchema = z.object({
  targetType: z.enum(["SALE", "LAYAWAY", "BACKORDER"]),
  customerId: z.string().min(1, "Se requiere un cliente para convertir"),
  paymentMethod: z.enum(["CASH", "CARD", "TRANSFER", "CREDIT_BALANCE", "ATRATO"]),
  paymentAmount: z.number().positive("El monto de pago debe ser mayor a 0"),
  secondaryPaymentMethod: z
    .enum(["CASH", "CARD", "TRANSFER", "CREDIT_BALANCE", "ATRATO"])
    .optional(),
  secondaryPaymentAmount: z.number().nonnegative().optional(),
  isSplitPayment: z.boolean().optional(),
  useOriginalPrices: z.boolean().default(false),
  priceOverrideAuthorizedById: z.string().optional(),
  branchOverride: z.string().optional(),
});

// POST /api/cotizaciones/[id]/convert
// Coordinador de conversión one-shot: valida, crea venta/pedido, marca la cotización.
export async function POST(req: NextRequest, { params }: RouteParams): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const { id: userId, branchId, role } = session.user as unknown as SessionUser;
  if (!branchId) {
    return NextResponse.json({ success: false, error: "Usuario sin sucursal asignada" }, { status: 400 });
  }

  const { id: quotationId } = await params;

  const body: unknown = await req.json();
  const parsed = convertSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const input = parsed.data;

  // branchOverride solo para ADMIN/MANAGER
  let targetBranchId = branchId;
  if (input.branchOverride) {
    if (role !== "ADMIN" && role !== "MANAGER") {
      return NextResponse.json(
        { success: false, error: "Sin permiso para convertir en otra sucursal" },
        { status: 403 }
      );
    }
    targetBranchId = input.branchOverride;
  }

  try {
    await requireActiveUser(session);

    const result = await prisma.$transaction(async (tx) => {
      // ── a) Lock + lectura de la cotización ──────────────────────────────────
      const quotation = await tx.quotation.findUnique({
        where: { id: quotationId },
        include: { items: true },
      });

      if (!quotation) throw Object.assign(new Error("Cotización no encontrada"), { status: 404 });

      // ── b) Validar status DRAFT o SENT ──────────────────────────────────────
      const effectiveStatus = getEffectiveStatus({
        status: quotation.status,
        validUntil: quotation.validUntil,
      });

      if (effectiveStatus === "FINALIZADA") {
        throw Object.assign(new Error("Esta cotización ya fue finalizada"), { status: 409 });
      }
      if (effectiveStatus === "RECHAZADA") {
        throw Object.assign(new Error("No se puede convertir una cotización rechazada"), { status: 409 });
      }

      // ── c) Validar vigencia dentro de la transacción ──────────────────────
      if (new Date() > new Date(quotation.validUntil)) {
        throw Object.assign(new Error("La cotización expiró y no puede ser convertida"), { status: 422 });
      }

      // ── d) customerId validado en Zod ──────────────────────────────────────

      // ── e) Sesión de caja abierta en targetBranchId ────────────────────────
      const activeSession = await tx.cashRegisterSession.findFirst({
        where: { branchId: targetBranchId, status: "OPEN" },
      });
      if (!activeSession) {
        throw Object.assign(
          new Error("No hay caja abierta en la sucursal destino. Abre la caja para continuar."),
          { status: 409 }
        );
      }
      assertSessionFreshOrThrow(activeSession);

      // ── f) Leer precios actuales + detectar drift ──────────────────────────
      const catalogItems = quotation.items.filter(
        (i): i is typeof i & { productVariantId: string } => !i.isFreeForm && i.productVariantId !== null
      );
      const variantIds = catalogItems.map((i) => i.productVariantId);
      const currentVariants =
        variantIds.length > 0
          ? await tx.productVariant.findMany({
              where: { id: { in: variantIds } },
              select: { id: true, precioPublico: true },
            })
          : [];
      const currentPriceMap = new Map(currentVariants.map((v) => [v.id, Number(v.precioPublico)]));

      // Detect if there are any "higher" drift items (current price > frozen price)
      const hasHigherDrift = catalogItems.some((item) => {
        const currentPrice = currentPriceMap.get(item.productVariantId);
        return currentPrice !== undefined && currentPrice > Number(item.unitPrice);
      });

      // ── g) Validar priceOverrideAuthorizedById si aplica ──────────────────
      if (input.useOriginalPrices && hasHigherDrift) {
        if (!input.priceOverrideAuthorizedById) {
          throw Object.assign(
            new Error("Se requiere autorización de gerente para mantener precios originales que están por debajo del catálogo actual"),
            { status: 422 }
          );
        }
        const authorizer = await tx.user.findUnique({
          where: { id: input.priceOverrideAuthorizedById },
          select: { id: true, name: true, role: true },
        });
        if (!authorizer || (authorizer.role !== "MANAGER" && authorizer.role !== "ADMIN")) {
          throw Object.assign(
            new Error("El autorizador de precios debe tener rol de Gerente o Administrador"),
            { status: 422 }
          );
        }
      }

      // ── h) Construir finalItems con precios resueltos ─────────────────────
      const finalItems = quotation.items.map((item) => {
        if (item.isFreeForm || !item.productVariantId) {
          // Líneas libres: siempre precio cotizado
          return {
            productVariantId: item.productVariantId,
            description: item.description,
            isFreeForm: item.isFreeForm,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          };
        }

        if (input.useOriginalPrices) {
          // Usuario eligió mantener precios originales (con auth si había drift higher)
          return {
            productVariantId: item.productVariantId,
            description: item.description,
            isFreeForm: false,
            quantity: item.quantity,
            unitPrice: Number(item.unitPrice),
          };
        }

        // Default: usar precio actual del catálogo
        const currentPrice = currentPriceMap.get(item.productVariantId);
        return {
          productVariantId: item.productVariantId,
          description: item.description,
          isFreeForm: false,
          quantity: item.quantity,
          unitPrice: currentPrice ?? Number(item.unitPrice),
        };
      });

      // Calcular totales finales
      const finalSubtotal = finalItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);
      const discountAmount = Number(quotation.discountAmount);
      const finalTotal = finalSubtotal - discountAmount;

      // ── i) Validar stock en targetBranchId (SALE y LAYAWAY solamente) ─────
      if (input.targetType === "SALE" || input.targetType === "LAYAWAY") {
        for (const item of finalItems) {
          if (item.isFreeForm || !item.productVariantId) continue;
          const stock = await tx.stock.findUnique({
            where: {
              productVariantId_branchId: {
                productVariantId: item.productVariantId,
                branchId: targetBranchId,
              },
            },
          });
          if (!stock || stock.quantity < item.quantity) {
            throw Object.assign(
              new Error(`Stock insuficiente en esta sucursal para: ${item.description}`),
              { status: 422 }
            );
          }
        }
      }

      // ── j) Crear la venta/pedido ──────────────────────────────────────────
      // Duplicated from POST /api/sales and POST /api/pedidos — sync if those endpoints change.

      // Folio
      const updatedBranch = await tx.branch.update({
        where: { id: targetBranchId },
        data: { lastSaleFolioNumber: { increment: 1 } },
        select: { lastSaleFolioNumber: true, name: true },
      });
      const branchPrefix = updatedBranch.name
        .replace(/[^a-zA-Z0-9]/g, "")
        .substring(0, 3)
        .toUpperCase();

      const folioSuffix = input.targetType === "SALE" ? "V" : input.targetType === "LAYAWAY" ? "A" : "B";
      const saleFolio = `${branchPrefix}${folioSuffix}-${String(updatedBranch.lastSaleFolioNumber).padStart(4, "0")}`;

      // Build internalNote
      let internalNote = "";
      if (input.useOriginalPrices && hasHigherDrift && input.priceOverrideAuthorizedById) {
        const authorizer = await tx.user.findUnique({
          where: { id: input.priceOverrideAuthorizedById },
          select: { name: true },
        });
        internalNote = `Precios originales de cotización ${quotation.folio} autorizados por ${authorizer?.name ?? input.priceOverrideAuthorizedById}`;
      } else {
        internalNote = `Convertida desde cotización ${quotation.folio}`;
      }

      // Sale status and orderType
      const saleStatus = input.targetType === "SALE" ? "COMPLETED" : "LAYAWAY";
      const orderType: "LAYAWAY" | "BACKORDER" | null =
        input.targetType === "LAYAWAY" ? "LAYAWAY" : input.targetType === "BACKORDER" ? "BACKORDER" : null;

      // Invariante Sale.type (ver schema.prisma): orderType != null →
      // type = orderType; orderType == null (targetType === "SALE") → type = DIRECT.
      const sale = await tx.sale.create({
        data: {
          folio: saleFolio,
          branchId: targetBranchId,
          userId,
          customerId: input.customerId,
          status: saleStatus,
          orderType,
          type: orderType ?? "DIRECT",
          subtotal: finalSubtotal,
          discount: discountAmount,
          total: finalTotal,
          internalNote,
          quotationId,
          items: {
            create: finalItems.map((item) => ({
              productVariantId: item.productVariantId ?? null,
              description: item.description,
              isFreeForm: item.isFreeForm,
              quantity: item.quantity,
              price: item.unitPrice,
              discount: 0,
            })),
          },
        },
      });

      // ── k) Stock decrement + InventoryMovement (SALE y LAYAWAY) ──────────
      if (input.targetType === "SALE" || input.targetType === "LAYAWAY") {
        for (const item of finalItems) {
          if (item.isFreeForm || !item.productVariantId) continue;
          await tx.stock.update({
            where: {
              productVariantId_branchId: {
                productVariantId: item.productVariantId,
                branchId: targetBranchId,
              },
            },
            data: { quantity: { decrement: item.quantity } },
          });
          await tx.inventoryMovement.create({
            data: {
              productVariantId: item.productVariantId,
              branchId: targetBranchId,
              userId,
              type: "SALE",
              quantity: -item.quantity,
              referenceId: sale.id,
            },
          });
        }
      }

      // ── l) CashTransaction(s) ─────────────────────────────────────────────
      await tx.cashTransaction.create({
        data: {
          sessionId: activeSession.id,
          userId,
          saleId: sale.id,
          type: "PAYMENT_IN",
          method: input.paymentMethod,
          amount: input.paymentAmount,
          collectionStatus: input.paymentMethod === "ATRATO" ? "PENDING" : "COLLECTED",
        },
      });

      if (
        input.isSplitPayment &&
        input.secondaryPaymentMethod &&
        input.secondaryPaymentAmount &&
        input.secondaryPaymentAmount > 0
      ) {
        await tx.cashTransaction.create({
          data: {
            sessionId: activeSession.id,
            userId,
            saleId: sale.id,
            type: "PAYMENT_IN",
            method: input.secondaryPaymentMethod,
            amount: input.secondaryPaymentAmount,
            collectionStatus: input.secondaryPaymentMethod === "ATRATO" ? "PENDING" : "COLLECTED",
          },
        });
      }

      // ── m) Marcar cotización como FINALIZADA ──────────────────────────────
      await tx.quotation.update({
        where: { id: quotationId },
        data: {
          status: "FINALIZADA",
          convertedToSaleId: sale.id,
          convertedAt: new Date(),
          convertedByUserId: userId,
          convertedInBranchId: targetBranchId,
        },
      });

      return { saleId: sale.id, saleFolio: sale.folio, targetType: input.targetType };
    });

    return NextResponse.json({ success: true, data: result });
  } catch (error: unknown) {
    if (error instanceof UserInactiveError) {
      return NextResponse.json({ success: false, error: error.message }, { status: 401 });
    }
    if (error instanceof OrphanedCashSessionError) {
      return NextResponse.json(
        {
          success: false,
          error: "La caja del día anterior debe cerrarse antes de registrar nuevas operaciones.",
        },
        { status: 409 },
      );
    }
    const err = error as Error & { status?: number };
    const status = err.status ?? 500;
    const message = err.message ?? "Error al convertir la cotización";
    if (status === 500) console.error("[api/cotizaciones/[id]/convert POST]", error);
    return NextResponse.json({ success: false, error: message }, { status });
  }
}
