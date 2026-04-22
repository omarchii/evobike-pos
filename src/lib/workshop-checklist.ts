export const CHECKLIST_ITEMS = [
  { key: "luces", label: "Luces" },
  { key: "frenos_delanteros", label: "Frenos delanteros" },
  { key: "frenos_traseros", label: "Frenos traseros" },
  { key: "llantas", label: "Llantas" },
  { key: "bateria", label: "Batería" },
  { key: "cargador", label: "Cargador" },
  { key: "manillar_controles", label: "Manillar y controles" },
  { key: "pedales_propulsion", label: "Pedales y propulsión" },
  { key: "chasis", label: "Chasis" },
  { key: "accesorios", label: "Accesorios" },
] as const;

export type ChecklistKey = (typeof CHECKLIST_ITEMS)[number]["key"];
export type ChecklistState = "OK" | "FAIL" | "NA";

export interface ChecklistEntry {
  key: ChecklistKey;
  state: ChecklistState;
  note: string | null;
}

export const CHECKLIST_KEYS = CHECKLIST_ITEMS.map((i) => i.key) as readonly ChecklistKey[];
