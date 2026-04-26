// Serialized types shared between page.tsx (server) and workshop-board.tsx (client).
// Lives in a separate file to avoid circular imports.

export type SerializedBoardOrder = {
  id: string;
  branchId: string;
  folio: string;
  status: "PENDING" | "IN_PROGRESS" | "COMPLETED";
  subStatus: "WAITING_PARTS" | "WAITING_APPROVAL" | "PAUSED" | null;
  type: "PAID" | "WARRANTY" | "COURTESY" | "POLICY_MAINTENANCE";
  createdAtMs: number;
  updatedAtMs: number;
  customer: { id: string; name: string };
  assignedTech: { id: string; name: string } | null;
  bikeDisplay: string | null;
};

export type SerializedDeliveredOrder = {
  id: string;
  folio: string;
  updatedAtMs: number;
  customerName: string;
  techName: string | null;
};

export type SerializedCancelledOrder = {
  id: string;
  folio: string;
  updatedAtMs: number;
  customerName: string;
};

export type TechnicianOption = { id: string; name: string };
