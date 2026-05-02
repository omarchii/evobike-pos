import type { BranchedSessionUser } from "@/lib/auth-types";
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";
import { requireActiveUser, UserInactiveError } from "@/lib/auth-helpers";
import {
  getActiveSession,
  assertSessionFreshOrThrow,
  OrphanedCashSessionError,
} from "@/lib/cash-register";
import { paymentMethodsArraySchema } from "@/lib/validators/payment";
import { createPaymentInTransactions } from "@/lib/cash-transaction";
import { getCustomerCreditBalance } from "@/lib/customer-credit";

// Frozen items from quotation conversion (nullable productVariantId for free-form lines)
const pedidoFrozenItemSchema = z.object({
  productVariantId: z.string().nullable().optional(),
  simpleProductId: z.string().nullable().optional(),
  description: z.string(),
  isFreeForm: z.boolean().default(false),
  quantity: z.number().int().positive(),
  unitPrice: z.number().nonnegative(),
});

// Pack E.6 — shape unificado: paymentMethods[] reemplaza paymentMethod /
// secondaryPaymentMethod / secondaryDepositAmount / isSplitPayment.
// depositAmount sigue presente como agregado (lo derivamos de paymentMethods
// si es coherente; el cliente lo manda explícito por compat con flujos
// existentes y validación clara contra el total).
const pedidoSchema = z.object({
  customerId: z.string().uuid(),
  productVariantId: z.string().uuid(),
  quantity: z.number().int().positive(),
  unitPrice: z.number().positive(),
  depositAmount: z.number().nonnegative(),
  paymentMethods: paymentMethodsArraySchema.optional(),
  orderType: z.enum(["LAYAWAY", "BACKORDER"]),
  expectedDeliveryDate: z.string().optional(),
  notes: z.string().optional(),
  // Optional quotation conversion fields (additive — does not affect existing callers)
  quotationId: z.string().optional(),
  frozenItems: z.array(pedidoFrozenItemSchema).optional(),
  total: z.number().nonnegative().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
    }

    const { id: userId, branchId } = session.user as unknown as BranchedSessionUser;
    if (!branchId) {
      return NextResponse.json(
        { success: false, error: "Usuario sin sucursal asignada" },
        { status: 400 }
      );
    }

    const body: unknown = await req.json();
    const parsed = pedidoSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0].message },
        { status: 422 }
      );
    }

    const {
      customerId,
      productVariantId,
      quantity,
      unitPrice,
      depositAmount,
      paymentMethods,
      orderType,
      expectedDeliveryDate,
      notes,
      quotationId,
      frozenItems,
      total: parsedTotal,
    } = parsed.data;

    // Validar coherencia entre depositAmount y paymentMethods (Pack E.6)
    if (depositAmount > 0) {
      if (!paymentMethods || paymentMethods.length === 0) {
        return NextResponse.json(
          { success: false, error: "Captura al menos un método de pago para el anticipo" },
          { status: 422 },
        );
      }
      const sumMethods = paymentMethods.reduce((s, e) => s + e.amount, 0);
      if (Math.abs(sumMethods - depositAmount) > 0.005) {
        return NextResponse.json(
          { success: false, error: "La suma de métodos no coincide con el anticipo" },
          { status: 422 },
        );
      }
    }

    await requireActiveUser(session);

    const activeSession = await getActiveSession(branchId);
    if (!activeSession) {
      return NextResponse.json(
        { success: false, error: "Caja cerrada. Abre la caja para registrar pedidos." },
        { status: 409 }
      );
    }
    assertSessionFreshOrThrow(activeSession);

    const total = frozenItems && frozenItems.length > 0
      ? (parsedTotal ?? unitPrice * quantity)
      : unitPrice * quantity;

    const result = await prisma.$transaction(async (tx) => {
      // ── QUOTATION CONVERSION PATH ──────────────────────────────────────────
      // When frozenItems is present, create multiple SaleItems from the quotation.
      if (frozenItems && frozenItems.length > 0) {
        // Stock check + decrement for catalog items (LAYAWAY only) — polimórfico
        if (orderType === "LAYAWAY") {
          for (const item of frozenItems) {
            if (item.isFreeForm) continue;
            if (item.productVariantId) {
              const stock = await tx.stock.findUnique({
                where: { productVariantId_branchId: { productVariantId: item.productVariantId, branchId } },
              });
              if (!stock || stock.quantity < item.quantity) {
                throw new Error(`Stock insuficiente para: ${item.description}`);
              }
              await tx.stock.update({ where: { id: stock.id }, data: { quantity: { decrement: item.quantity } } });
            } else if (item.simpleProductId) {
              const stock = await tx.stock.findUnique({
                where: { simpleProductId_branchId: { simpleProductId: item.simpleProductId, branchId } },
              });
              if (!stock || stock.quantity < item.quantity) {
                throw new Error(`Stock insuficiente para: ${item.description}`);
              }
              await tx.stock.update({ where: { id: stock.id }, data: { quantity: { decrement: item.quantity } } });
            }
          }
        }

        // Folio
        const updatedBranchFrozen = await tx.branch.update({
          where: { id: branchId },
          data: { lastSaleFolioNumber: { increment: 1 } },
          select: { lastSaleFolioNumber: true, name: true },
        });
        const branchPrefixFrozen = updatedBranchFrozen.name
          .replace(/[^a-zA-Z0-9]/g, "")
          .substring(0, 3)
          .toUpperCase();
        const folioPrefixFrozen = orderType === "LAYAWAY" ? "A" : "B";
        const frozenFolio = `${branchPrefixFrozen}${folioPrefixFrozen}-${String(updatedBranchFrozen.lastSaleFolioNumber).padStart(4, "0")}`;

        // Compute subtotal from frozen items
        const frozenSubtotal = frozenItems.reduce((sum, i) => sum + i.unitPrice * i.quantity, 0);

        // Invariante Sale.type (ver schema.prisma): orderType != null →
        // type ∈ {LAYAWAY, BACKORDER} (match orderType).
        const frozenSale = await tx.sale.create({
          data: {
            folio: frozenFolio,
            branchId,
            userId,
            customerId,
            status: "LAYAWAY",
            orderType,
            type: orderType,
            subtotal: frozenSubtotal,
            discount: 0,
            total,
            notes: notes ?? null,
            quotationId: quotationId ?? null,
            expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
          },
        });

        // SaleItems
        for (const item of frozenItems) {
          await tx.saleItem.create({
            data: {
              saleId: frozenSale.id,
              productVariantId: item.productVariantId ?? null,
              simpleProductId: item.simpleProductId ?? null,
              description: item.description,
              isFreeForm: item.isFreeForm,
              quantity: item.quantity,
              price: item.unitPrice,
              discount: 0,
            },
          });
        }

        // CashTransactions (Pack E.6 helper)
        if (depositAmount > 0 && paymentMethods) {
          const creditEntry = paymentMethods.find((p) => p.method === "CREDIT_BALANCE");
          if (creditEntry) {
            const { total: available } = await getCustomerCreditBalance(customerId, tx);
            if (available < creditEntry.amount) {
              throw new Error(
                `Saldo insuficiente. El cliente tiene $${available.toFixed(2)} a favor.`,
              );
            }
          }
          await createPaymentInTransactions(tx, {
            saleId: frozenSale.id,
            sessionId: activeSession.id,
            userId,
            customerId,
            entries: paymentMethods,
          });
        }

        return { saleId: frozenSale.id, folio: frozenSale.folio };
      }

      // ── NORMAL PATH (unchanged) ────────────────────────────────────────────

      // 1. Stock check and decrement (solo LAYAWAY)
      if (orderType === "LAYAWAY") {
        const stock = await tx.stock.findUnique({
          where: {
            productVariantId_branchId: { productVariantId, branchId },
          },
        });
        if (!stock || stock.quantity < quantity) {
          throw new Error("Stock insuficiente para apartar este producto");
        }
        await tx.stock.update({
          where: { id: stock.id },
          data: { quantity: { decrement: quantity } },
        });
      }

      // 2. Folio secuencial
      const updatedBranch = await tx.branch.update({
        where: { id: branchId },
        data: { lastSaleFolioNumber: { increment: 1 } },
        select: { lastSaleFolioNumber: true, name: true },
      });
      const branchPrefix = updatedBranch.name
        .replace(/[^a-zA-Z0-9]/g, "")
        .substring(0, 3)
        .toUpperCase();
      const folioPrefix = orderType === "LAYAWAY" ? "A" : "B";
      const folio = `${branchPrefix}${folioPrefix}-${String(updatedBranch.lastSaleFolioNumber).padStart(4, "0")}`;

      // 3. Crear Sale
      // Invariante Sale.type (ver schema.prisma): orderType != null →
      // type ∈ {LAYAWAY, BACKORDER} (match orderType).
      const sale = await tx.sale.create({
        data: {
          folio,
          branchId,
          userId,
          customerId,
          status: "LAYAWAY",
          orderType,
          type: orderType,
          subtotal: total,
          discount: 0,
          total,
          notes: notes ?? null,
          expectedDeliveryDate: expectedDeliveryDate ? new Date(expectedDeliveryDate) : null,
        },
      });

      // 4. Crear SaleItem
      await tx.saleItem.create({
        data: {
          saleId: sale.id,
          productVariantId,
          quantity,
          price: unitPrice,
          discount: 0,
        },
      });

      // 5. CashTransaction(s) con el depósito inicial — Pack E.6 helper
      if (depositAmount > 0 && paymentMethods) {
        const creditEntry = paymentMethods.find((p) => p.method === "CREDIT_BALANCE");
        if (creditEntry) {
          const { total: available } = await getCustomerCreditBalance(customerId, tx);
          if (available < creditEntry.amount) {
            throw new Error(
              `Saldo insuficiente. El cliente tiene $${available.toFixed(2)} a favor.`,
            );
          }
        }
        await createPaymentInTransactions(tx, {
          saleId: sale.id,
          sessionId: activeSession.id,
          userId,
          customerId,
          entries: paymentMethods,
        });
      }

      return { saleId: sale.id, folio: sale.folio };
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
    console.error("[api/pedidos POST]", error);
    const message = error instanceof Error ? error.message : "Error al crear el pedido";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
