// Server-side helper. NO incluye `import "server-only"` porque seed-transactional.ts
// (Node + tsx) lo importa, y el package `server-only` throws fuera de RSC context.
// Convención de path (`src/lib/`) preserva la separación server/client implícitamente.
import type { Prisma, PrismaClient, BatteryConfiguration } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Tipo unión `Prisma.TransactionClient | PrismaClient` para helpers que se llaman
 * tanto desde transacciones (`prisma.$transaction(async (tx) => { … })`) como
 * desde código top-level. Espejo de `customers/service.ts:8` — único alias del
 * repo para el patrón cross-tx.
 */
export type Tx = Prisma.TransactionClient | PrismaClient;

/**
 * Llave de negocio (3 axes) para resolver una `BatteryConfiguration` única.
 *
 * - `modeloId` y `voltajeId` vienen de la bici (capturados al armar/vender).
 * - `batteryCapacidadId` es selección runtime del usuario porque las bicis tienen
 *   `ProductVariant.capacidad_id = null` (`schema.prisma:204` "null en variantes
 *   de vehículo; set en variantes de batería"). La capacidad NO es atributo de
 *   la bici, es atributo de la batería que el cajero/técnico elige al armar.
 *
 * Convención A1' decidida en Pack A.2 (`CLUSTER_DECISIONS.md §1.3.6 I10.3`).
 */
export type BatteryConfigKey = {
  modeloId: string;
  voltajeId: string;
  batteryCapacidadId: string;
};

/**
 * Devuelve TODAS las configs candidatas para un par (modelo, voltaje).
 *
 * Usar SOLO para selectores UI o listings que iteran configs candidatas
 * (POS/Assembly/Catálogo "qué baterías acepta esta bici"). NO uses `[0]`,
 * `find()`, ni asumas shape único — eso reproduce el bug S1 (el mismo
 * (modelo, voltaje) puede tener N configs distintas según la batería, ej:
 * Evotank 48V tiene config 45Ah y config 52Ah).
 *
 * Si ya tienes la capacidad seleccionada por el usuario → `resolveConfigForBike`.
 */
export async function findConfigsByModelVoltage(
  modeloId: string,
  voltajeId: string,
  db: Tx = prisma,
): Promise<BatteryConfiguration[]> {
  return db.batteryConfiguration.findMany({
    where: { modeloId, voltajeId },
  });
}

/**
 * Resuelve la `BatteryConfiguration` única para una combinación (modelo,
 * voltaje, capacidad). Implementado con relation filter 1-shot — un solo
 * round-trip a la DB filtra por `batteryVariant.capacidad_id`.
 *
 * Política unificada **throw-on-2+ matches** (Pack A.2 §I10.3):
 * - 0 matches → `null` (caller decide qué hacer; no es error fatal).
 * - 1 match → la config.
 * - 2+ matches → `Error`. Significa que los 3 axes no bastan para diferenciar
 *   (caso teórico: dos packs 48V/52Ah que se diferencian por color o algún
 *   atributo no modelado todavía). El error lista los IDs para diagnóstico.
 */
export async function resolveConfigForBike(
  key: BatteryConfigKey,
  db: Tx = prisma,
): Promise<BatteryConfiguration | null> {
  const matches = await db.batteryConfiguration.findMany({
    where: {
      modeloId: key.modeloId,
      voltajeId: key.voltajeId,
      batteryVariant: { capacidad_id: key.batteryCapacidadId },
    },
  });

  if (matches.length === 0) return null;
  if (matches.length === 1) return matches[0];

  throw new Error(
    `[I10] resolveConfigForBike: ${matches.length} configs match (modeloId=${key.modeloId}, voltajeId=${key.voltajeId}, batteryCapacidadId=${key.batteryCapacidadId}). Axis insuficiente — probable atributo extra (color?). Configs: ${matches.map((c) => c.id).join(", ")}`,
  );
}
