import bcrypt from "bcryptjs";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

// === Constantes ===

// Timeout de solicitudes REMOTA. Si nadie resuelve en 5min, se marca EXPIRED.
// Valor balanceado: suficiente para que el manager vea y resuelva, corto para no dejar
// tickets colgados que bloqueen al vendedor indefinidamente.
export const REMOTE_EXPIRATION_MS = 5 * 60 * 1000;

// === Validación de PIN ===

/**
 * Valida un PIN contra los usuarios MANAGER/ADMIN (con pin configurado) de una sucursal.
 * Retorna el primer usuario cuyo hash coincida, o null si ninguno.
 *
 * Nota: este helper SOLO verifica el PIN. La lógica de autoaprobación (manager no puede
 * resolver su propia solicitud) es responsabilidad del caller.
 */
export async function validatePinForBranch(
  pin: string,
  branchId: string,
): Promise<{ id: string; name: string } | null> {
  if (!/^\d{4,6}$/.test(pin)) return null;

  const managers = await prisma.user.findMany({
    where: {
      branchId,
      isActive: true,
      role: { in: ["MANAGER", "ADMIN"] },
      pin: { not: null },
    },
    select: { id: true, name: true, pin: true },
  });

  for (const m of managers) {
    if (!m.pin) continue;
    const ok = await bcrypt.compare(pin, m.pin);
    if (ok) return { id: m.id, name: m.name };
  }
  return null;
}

// === Expiración lazy ===

/**
 * Si la solicitud está PENDING y pasó su expiresAt, la marca EXPIRED y la devuelve.
 * Si no, la devuelve tal cual. Usa el cliente normal (no transaccional) porque es idempotente.
 */
export async function expireIfNeeded(
  req: {
    id: string;
    status: "PENDING" | "APPROVED" | "REJECTED" | "EXPIRED";
    expiresAt: Date | null;
  },
): Promise<"PENDING" | "APPROVED" | "REJECTED" | "EXPIRED"> {
  if (
    req.status === "PENDING" &&
    req.expiresAt &&
    req.expiresAt.getTime() < Date.now()
  ) {
    await prisma.authorizationRequest.update({
      where: { id: req.id, status: "PENDING" },
      data: { status: "EXPIRED", resolvedAt: new Date() },
    }).catch(() => {
      // Race: alguien más ya la resolvió. Ignorar.
    });
    return "EXPIRED";
  }
  return req.status;
}

// === Consumo ===

export type ConsumeInput =
  | {
      tipo: "CANCELACION";
      authorizationId: string;
      requestedBy: string; // debe coincidir con AuthorizationRequest.requestedBy
      saleId: string; // venta que se está cancelando — debe coincidir con la de la autorización
    }
  | {
      tipo: "DESCUENTO";
      authorizationId: string;
      requestedBy: string;
      saleId: string; // venta recién creada — la autorización NO debe tener saleId antes (marker de "no consumida")
      monto: Prisma.Decimal | number; // descuento aplicado — debe ser ≤ monto autorizado
    };

export class AuthorizationConsumeError extends Error {
  code: "NOT_FOUND" | "WRONG_STATUS" | "WRONG_TYPE" | "WRONG_USER" | "WRONG_SALE" | "EXCEEDS_AMOUNT" | "ALREADY_USED";
  constructor(code: AuthorizationConsumeError["code"], message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Valida y consume una autorización APPROVED dentro de una transacción.
 *
 * Para DESCUENTO: la autorización no debe tener saleId (marker de "no usada"). Al consumirla,
 * se setea saleId = nueva venta. Esto previene reusar una misma autorización en múltiples ventas.
 *
 * Para CANCELACION: la autorización ya trae el saleId desde que se creó. El lock natural es
 * Sale.status pasando a CANCELLED (el cancel endpoint rechaza cancelar una venta no COMPLETED).
 *
 * Debe llamarse DENTRO de una `$transaction` para evitar race conditions con el resto de
 * mutaciones de la venta/cancelación.
 */
export async function consumeAuthorization(
  tx: Prisma.TransactionClient,
  input: ConsumeInput,
): Promise<void> {
  const auth = await tx.authorizationRequest.findUnique({
    where: { id: input.authorizationId },
    select: {
      id: true,
      tipo: true,
      status: true,
      saleId: true,
      requestedBy: true,
      monto: true,
    },
  });

  if (!auth) {
    throw new AuthorizationConsumeError("NOT_FOUND", "Autorización no encontrada");
  }
  if (auth.tipo !== input.tipo) {
    throw new AuthorizationConsumeError("WRONG_TYPE", "Tipo de autorización no coincide");
  }
  if (auth.status !== "APPROVED") {
    throw new AuthorizationConsumeError(
      "WRONG_STATUS",
      `La autorización no está aprobada (estado actual: ${auth.status})`,
    );
  }
  if (auth.requestedBy !== input.requestedBy) {
    throw new AuthorizationConsumeError(
      "WRONG_USER",
      "La autorización pertenece a otro usuario",
    );
  }

  if (input.tipo === "CANCELACION") {
    if (auth.saleId !== input.saleId) {
      throw new AuthorizationConsumeError(
        "WRONG_SALE",
        "La autorización no corresponde a esta venta",
      );
    }
    // No-op de escritura: el lock es el cambio de Sale.status a CANCELLED.
    return;
  }

  // DESCUENTO
  if (auth.saleId !== null) {
    throw new AuthorizationConsumeError(
      "ALREADY_USED",
      "Esta autorización ya fue consumida en otra venta",
    );
  }
  const montoAutorizado = auth.monto ? Number(auth.monto) : 0;
  const montoSolicitado = typeof input.monto === "number" ? input.monto : Number(input.monto);
  if (montoSolicitado > montoAutorizado + 0.001) {
    throw new AuthorizationConsumeError(
      "EXCEEDS_AMOUNT",
      `El descuento aplicado ($${montoSolicitado.toFixed(2)}) excede el monto autorizado ($${montoAutorizado.toFixed(2)})`,
    );
  }

  await tx.authorizationRequest.update({
    where: { id: auth.id },
    data: { saleId: input.saleId },
  });
}
