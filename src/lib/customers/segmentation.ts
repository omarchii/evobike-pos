// Chips de segmentación automática (BRIEF §10.1).
// Cálculo puro — consume un objeto con los campos derivados (ltv, lastActivity,
// balance, arPending, etc.) ya computados en el query del directorio o del perfil.
// Persistencia: ninguna. Caché a nivel de endpoint se posterga a la Sub-fase de
// performance. Aquí solo la lógica booleana.

export type SegmentChip =
  | "EMPRESA"
  | "FRECUENTE"
  | "EN_RIESGO"
  | "INACTIVO"
  | "SALDO_SIN_USAR"
  | "SIN_CONSENTIMIENTO"
  | "CON_SALDO_POR_COBRAR";

export interface SegmentInput {
  isBusiness: boolean;
  phone: string | null;
  balance: number;
  communicationConsent: boolean;
  salesCountLast12mo: number;
  lastActivityAt: Date | null;
  arPending: number;
  balanceUpdatedAt: Date | null;
}

const DAY = 24 * 60 * 60 * 1000;

export function computeSegmentChips(input: SegmentInput, now: Date = new Date()): SegmentChip[] {
  const chips: SegmentChip[] = [];

  if (input.isBusiness) chips.push("EMPRESA");

  if (input.salesCountLast12mo >= 3) chips.push("FRECUENTE");

  if (input.lastActivityAt) {
    const daysSince = (now.getTime() - input.lastActivityAt.getTime()) / DAY;
    if (daysSince > 180) chips.push("INACTIVO");
    else if (daysSince >= 90) chips.push("EN_RIESGO");
  }

  if (input.arPending > 0) chips.push("CON_SALDO_POR_COBRAR");

  if (input.balance > 0) {
    // Más estricto si hubiera timestamp del último cambio (>90d sin mover);
    // sin él, se marca siempre que haya saldo. Campo `balanceUpdatedAt` queda
    // como input opcional para el día que se exponga (deuda post-Sub-fase I).
    const daysSince = input.balanceUpdatedAt
      ? (now.getTime() - input.balanceUpdatedAt.getTime()) / DAY
      : Infinity;
    if (!input.balanceUpdatedAt || daysSince > 90) chips.push("SALDO_SIN_USAR");
  }

  if (!input.communicationConsent && input.phone) chips.push("SIN_CONSENTIMIENTO");

  return chips;
}

export const SEGMENT_LABELS: Record<SegmentChip, string> = {
  EMPRESA: "Empresa",
  FRECUENTE: "Frecuente",
  EN_RIESGO: "En riesgo",
  INACTIVO: "Inactivo",
  SALDO_SIN_USAR: "Saldo sin usar",
  SIN_CONSENTIMIENTO: "Sin consent.",
  CON_SALDO_POR_COBRAR: "Saldo por cobrar",
};

export const SEGMENT_TOOLTIPS: Record<SegmentChip, string> = {
  EMPRESA: "Marcado como empresa (isBusiness)",
  FRECUENTE: "3 o más compras completadas en los últimos 12 meses",
  EN_RIESGO: "Última actividad hace 90–180 días",
  INACTIVO: "Sin actividad hace más de 180 días",
  SALDO_SIN_USAR: "Tiene saldo a favor disponible",
  SIN_CONSENTIMIENTO: "No ha aceptado comunicación por WhatsApp/email",
  CON_SALDO_POR_COBRAR: "Tiene apartados o crédito pendientes de cobrar",
};
