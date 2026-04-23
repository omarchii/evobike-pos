import type {
  Prisma,
  ServiceOrderStatus,
  ServiceOrderSubStatus,
  ServiceOrderType,
} from "@prisma/client";

// ═════════════════════════════════════════════════════════════════════════
// Serializer dedicado al dashboard móvil del técnico (P13-G).
//
// Convierte el row de Prisma a una forma plain JS serializable (Decimal→
// number, Date→ISO string) para pasar de Server Component → Client
// Component sin "cannot serialize" en el boundary.
//
// Se crea aparte del helper de la ficha técnica porque el móvil lee un
// subset muy reducido (solo lo que la card necesita) y no quiero
// contaminar el helper general. Si más consumers lo comparten, se
// promueve a un módulo compartido — hoy es scope-único.
// ═════════════════════════════════════════════════════════════════════════

export const MOBILE_ORDER_SELECT = {
  id: true,
  folio: true,
  status: true,
  subStatus: true,
  type: true,
  diagnosis: true,
  bikeInfo: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { name: true } },
  customerBike: {
    select: {
      brand: true,
      model: true,
      color: true,
      productVariant: {
        select: {
          modelo: { select: { nombre: true } },
          voltaje: { select: { valor: true } },
          capacidad: { select: { valorAh: true } },
        },
      },
    },
  },
} as const satisfies Prisma.ServiceOrderSelect;

export type MobileOrderRow = Prisma.ServiceOrderGetPayload<{
  select: typeof MOBILE_ORDER_SELECT;
}>;

export interface SerializedMobileOrder {
  id: string;
  folio: string;
  status: ServiceOrderStatus;
  subStatus: ServiceOrderSubStatus | null;
  type: ServiceOrderType;
  bikeDisplay: string | null;
  diagnosisShort: string | null;
  customerName: string;
  customerInitials: string;
  updatedAtIso: string;
  createdAtIso: string;
}

// Regla de display de bici: productVariant (modelo · V · Ah) → brand+model →
// bikeInfo → null. Paralela al `computeBikeDisplay` del Kanban desktop.
function bikeDisplayFromRow(row: MobileOrderRow): string | null {
  const bike = row.customerBike;
  if (bike?.productVariant) {
    const v = bike.productVariant;
    const parts: string[] = [];
    if (v.modelo?.nombre) parts.push(v.modelo.nombre);
    if (v.voltaje?.valor) parts.push(`${v.voltaje.valor}V`);
    if (v.capacidad?.valorAh) parts.push(`${v.capacidad.valorAh}Ah`);
    if (parts.length > 0) return parts.join(" · ");
  }
  if (bike) {
    const fallback = [bike.brand, bike.model].filter(Boolean).join(" ");
    if (fallback) return fallback;
  }
  return row.bikeInfo ?? null;
}

export function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 1).toUpperCase();
  return (parts[0].slice(0, 1) + parts[1].slice(0, 1)).toUpperCase();
}

function truncate(s: string, max: number): string {
  return s.length > max ? `${s.slice(0, max - 1).trimEnd()}…` : s;
}

export function serializeMobileOrder(row: MobileOrderRow): SerializedMobileOrder {
  const customerName = row.customer?.name ?? "Cliente";
  return {
    id: row.id,
    folio: row.folio,
    status: row.status,
    subStatus: row.subStatus,
    type: row.type,
    bikeDisplay: bikeDisplayFromRow(row),
    diagnosisShort: row.diagnosis ? truncate(row.diagnosis, 40) : null,
    customerName,
    customerInitials: initialsFromName(customerName),
    updatedAtIso: row.updatedAt.toISOString(),
    createdAtIso: row.createdAt.toISOString(),
  };
}

// ─── Clasificación por tab ───────────────────────────────────────────────

export type MobileTab = "queue" | "waiting" | "done";

export function tabOfOrder(o: Pick<SerializedMobileOrder, "status" | "subStatus">): MobileTab {
  if (o.status === "COMPLETED") return "done";
  if (o.status === "IN_PROGRESS" && o.subStatus !== null) return "waiting";
  // PENDING o IN_PROGRESS sin sub-estado
  return "queue";
}
