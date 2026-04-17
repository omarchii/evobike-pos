// Tuplas locales de enums del módulo de taller.
// Patrón obligatorio del repo: los enums de @prisma/client son server-only
// en runtime; importarlos desde un archivo "use client" llega como undefined
// y z.nativeEnum() truena. Los Client Components consumen estas tuplas con
// z.enum(...) y reconstruyen el tipo como (typeof TUPLE)[number]. El server
// sigue importando el enum real de Prisma como fuente de verdad.

export const SERVICE_ORDER_TYPES = [
  "PAID",
  "WARRANTY",
  "COURTESY",
  "POLICY_MAINTENANCE",
] as const;
export type ServiceOrderTypeLiteral = (typeof SERVICE_ORDER_TYPES)[number];

export const SERVICE_ORDER_SUB_STATUS = [
  "WAITING_PARTS",
  "WAITING_APPROVAL",
  "PAUSED",
] as const;
export type ServiceOrderSubStatusLiteral = (typeof SERVICE_ORDER_SUB_STATUS)[number];

export const SERVICE_ORDER_APPROVAL_STATUS = [
  "PENDING",
  "APPROVED",
  "REJECTED",
] as const;
export type ServiceOrderApprovalStatusLiteral =
  (typeof SERVICE_ORDER_APPROVAL_STATUS)[number];

export const SERVICE_ORDER_APPROVAL_CHANNELS = [
  "WHATSAPP_PUBLIC",
  "PHONE_CALL",
  "IN_PERSON",
  "OTHER",
] as const;
export type ServiceOrderApprovalChannelLiteral =
  (typeof SERVICE_ORDER_APPROVAL_CHANNELS)[number];

// Canales disponibles para la respuesta interna (el cliente sin auth usa
// WHATSAPP_PUBLIC forzado desde el endpoint público, nunca desde la UI interna).
export const INTERNAL_APPROVAL_CHANNELS = [
  "PHONE_CALL",
  "IN_PERSON",
  "OTHER",
] as const;

export const CHARGE_MODELS = ["FIXED", "HOURLY"] as const;
export type ChargeModelLiteral = (typeof CHARGE_MODELS)[number];
