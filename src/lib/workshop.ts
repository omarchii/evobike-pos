import { randomBytes } from "node:crypto";
import { Prisma, type ServiceOrder } from "@prisma/client";

// ═══════════════════════════════════════════════════════════════════════════
// Helpers del módulo de taller (Sub-fase A del rediseño).
// Consumidos desde:
//   - src/app/api/workshop/orders/** (create, items, status, cancel)
//   - src/app/api/service-orders/** (deliver, assign, sub-status, qa, approvals)
//   - src/app/api/service-orders/public/** (portal sin auth)
//   - prisma/seed-transactional.ts (genera tokens en el seed para paridad dev/QA)
//   - prisma/backfill-workshop-tokens.ts (backfill idempotente una vez)
// ═══════════════════════════════════════════════════════════════════════════

/** Token opaco URL-safe (base64url de 16 bytes → 22 chars). */
export function generatePublicToken(): string {
  return randomBytes(16).toString("base64url");
}

/**
 * Calcula el precio server-side para un ítem HOURLY del taller.
 * El precio vivo de las variantes FIJAS sigue siendo `ServiceCatalog.basePrice`.
 *
 * @throws Error si la sucursal no tiene `hourlyRate` configurada o los
 *         minutos son <= 0. El caller mapea a 422 con mensaje en español.
 */
export function calculateHourlyPrice(
  hourlyRate: Prisma.Decimal | number | null | undefined,
  minutes: number,
): Prisma.Decimal {
  if (hourlyRate == null) {
    throw new Error("La sucursal no tiene tarifa por hora configurada");
  }
  if (!Number.isInteger(minutes) || minutes <= 0) {
    throw new Error("Los minutos de mano de obra deben ser un entero positivo");
  }
  const rate =
    typeof hourlyRate === "number" ? new Prisma.Decimal(hourlyRate) : hourlyRate;
  if (rate.lessThanOrEqualTo(0)) {
    throw new Error("La tarifa por hora de la sucursal debe ser positiva");
  }
  // rate * minutes / 60, redondeado a 2 decimales (half-up implícito de Decimal).
  return rate.mul(minutes).div(60).toDecimalPlaces(2);
}

/**
 * Gate de QA para transicionar a DELIVERED.
 * Matriz (decisión #9 del rediseño):
 *   PAID                → exige qaPassedAt
 *   WARRANTY            → exige qaPassedAt
 *   POLICY_MAINTENANCE  → exige qaPassedAt
 *   COURTESY            → exento (revisión de cortesía, sin compromiso formal)
 *
 * @throws QaNotPassedError si aplica y qaPassedAt es null.
 */
export function assertQaPassed(
  order: Pick<ServiceOrder, "type" | "qaPassedAt">,
): void {
  if (order.type === "COURTESY") return;
  if (order.qaPassedAt == null) {
    throw new QaNotPassedError(
      "La orden requiere control de calidad antes de entregarse",
    );
  }
}

/**
 * Guard formal de vigencia de póliza para POLICY_MAINTENANCE.
 *
 * TODO: pendiente modelar póliza en CustomerBike.
 * Hoy este helper es no-op por decisión explícita de Sub-fase A (opción c):
 * el enum POLICY_MAINTENANCE existe, el create exige customerBikeId como
 * guard mínimo, pero no hay campos de fecha de vigencia todavía.
 *
 * La firma queda `async` + recibe `tx` desde ya para que, cuando se modele
 * la póliza en una sub-fase dedicada, se pueda llenar el cuerpo sin
 * breaking change en los callers (create, deliver).
 *
 * Los callers que lo invocan ya registran `console.warn(serviceOrderId)`
 * para dejar traza de que el guard corrió en no-op.
 */
export async function assertPolicyActive(
  _bikeId: string,
  _tx: Prisma.TransactionClient,
): Promise<void> {
  // Intencionalmente vacío. Ver docstring.
  // Los params quedan referenciados formalmente para que el lint no los
  // marque como unused hasta que el cuerpo se escriba.
  void _bikeId;
  void _tx;
}

// ═══════════════════════════════════════════════════════════════════════════
// Errores tipados — mapeo en handlers:
//   QaNotPassedError                    → 422
//   PolicyNotActiveError                → 422
//   InvalidServiceOrderTransitionError  → 422
// ═══════════════════════════════════════════════════════════════════════════

export class QaNotPassedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "QaNotPassedError";
  }
}

export class PolicyNotActiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PolicyNotActiveError";
  }
}

export class InvalidServiceOrderTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidServiceOrderTransitionError";
  }
}

/**
 * Construye el link público `wa.me/52{phone}?text=...` para enviar al
 * cliente al crear un ServiceOrderApproval con canal WHATSAPP_PUBLIC.
 *
 * Retorna `null` + razón discriminante cuando no se puede armar el link.
 * La UI de Sub-fase D decide si mostrar u ocultar el botón; el approval
 * se crea igualmente (decisión del usuario en respuesta #1 al plan).
 */
export type WhatsappLinkReason =
  | "TEMPLATE_NOT_CONFIGURED"
  | "CUSTOMER_HAS_NO_PHONE"
  | null;

export interface WhatsappLinkResult {
  url: string | null;
  reason: WhatsappLinkReason;
}

export function buildWorkshopWhatsappLink(args: {
  template: string | null | undefined;
  customerPhone: string | null | undefined;
  folio: string;
  estado: string; // label en español del ServiceOrderStatus/SubStatus actual
  total: string; // ya formateado "$1,234.00"
  publicUrl: string; // URL completa al portal público
}): WhatsappLinkResult {
  if (!args.template || args.template.trim().length === 0) {
    return { url: null, reason: "TEMPLATE_NOT_CONFIGURED" };
  }
  const phone = normalizeMxPhone(args.customerPhone);
  if (!phone) {
    return { url: null, reason: "CUSTOMER_HAS_NO_PHONE" };
  }
  const text = args.template
    .replaceAll("{folio}", args.folio)
    .replaceAll("{estado}", args.estado)
    .replaceAll("{total}", args.total)
    .replaceAll("{linkPublico}", args.publicUrl);
  const url = `https://wa.me/52${phone}?text=${encodeURIComponent(text)}`;
  return { url, reason: null };
}

/** Retorna los 10 dígitos del celular MX o null si no es válido. */
export function normalizeMxPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const digits = raw.replace(/\D/g, "");
  // Acepta 10 dígitos directos, o con lada 52 / 521 al frente.
  if (digits.length === 10) return digits;
  if (digits.length === 12 && digits.startsWith("52")) return digits.slice(2);
  if (digits.length === 13 && digits.startsWith("521")) return digits.slice(3);
  return null;
}
