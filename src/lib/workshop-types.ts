import type { ChecklistEntry } from "./workshop-checklist";

// ── GET /api/workshop/technicians ──
export interface TechnicianOption {
  id: string;
  name: string;
  role: "TECHNICIAN" | "MANAGER";
}

// ── getBranchMaintenanceServices ──
export interface MaintenanceServiceOption {
  id: string;
  name: string;
  basePrice: number;
}

// ── Body del POST /api/workshop/orders — campos de recepción (Sub-fase C) ──
export interface ReceptionPayload {
  checklist?: ChecklistEntry[];
  signatureData?: string | null;
  signatureRejected?: boolean;
  photoUrls?: string[];
  expectedDeliveryDate?: string;
}

// ── Forma serializada de los 5 campos nuevos de ServiceOrder ──
// Usada en Server Components y Client Components para mostrar datos de recepción.
export interface ServiceOrderReceptionFields {
  checklist: ChecklistEntry[] | null;
  signatureData: string | null;
  signatureRejected: boolean;
  photoUrls: string[] | null;
  expectedDeliveryDate: string | null;
}
