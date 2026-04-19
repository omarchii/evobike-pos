"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  INPUT_STYLE,
  LABEL_STYLE,
  modalStyle,
  type VoltajeRow,
  type CapacidadRow,
  type BatteryVariantRow,
} from "./shared";

// Los 5 voltajes estándar del catálogo de baterías. Se filtran los voltajes
// activos; los que aparecen aquí son los que el usuario espera ver en la matriz.
const BATTERY_VOLTAGES = [24, 36, 48, 60, 72] as const;

type CellState =
  | { kind: "populated"; variant: BatteryVariantRow }
  | { kind: "empty"; voltajeId: string; voltaje: number; capacidadId: string; capacidadAh: number };

export function TabBaterias({
  variants,
  voltajes,
  capacidades,
  onChange,
}: {
  variants: BatteryVariantRow[];
  voltajes: VoltajeRow[];
  capacidades: CapacidadRow[];
  onChange: (next: BatteryVariantRow[]) => void;
}) {
  const [editing, setEditing] = useState<BatteryVariantRow | null>(null);
  const [creating, setCreating] = useState<{
    voltajeId: string;
    voltaje: number;
    capacidadId: string;
    capacidadAh: number;
  } | null>(null);

  // Filas = voltajes en BATTERY_VOLTAGES que existen en la DB.
  const rows = useMemo(() => {
    return BATTERY_VOLTAGES.map((v) => voltajes.find((vr) => vr.valor === v))
      .filter((v): v is VoltajeRow => Boolean(v));
  }, [voltajes]);

  // Cols = capacidades activas ordenadas por valorAh.
  const cols = useMemo(
    () =>
      capacidades
        .filter((c) => c.isActive)
        .slice()
        .sort((a, b) => a.valorAh - b.valorAh),
    [capacidades],
  );

  // Lookup (voltaje, capacidad) → variant
  const lookup = useMemo(() => {
    const m = new Map<string, BatteryVariantRow>();
    for (const v of variants) {
      m.set(`${v.voltajeId}-${v.capacidadId}`, v);
    }
    return m;
  }, [variants]);

  function cellFor(voltaje: VoltajeRow, capacidad: CapacidadRow): CellState {
    const v = lookup.get(`${voltaje.id}-${capacidad.id}`);
    if (v) return { kind: "populated", variant: v };
    return {
      kind: "empty",
      voltajeId: voltaje.id,
      voltaje: voltaje.valor,
      capacidadId: capacidad.id,
      capacidadAh: capacidad.valorAh,
    };
  }

  const totalPopulated = variants.length;
  const totalCells = rows.length * cols.length;

  return (
    <div className="space-y-4 mt-4">
      <div
        className="flex items-center justify-between px-4 py-3 rounded-2xl text-sm"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="text-[var(--on-surf-var)]">
          <span className="font-medium text-[var(--on-surf)]">{totalPopulated}</span>
          {" de "}
          {totalCells} combinaciones V × Ah en catálogo
        </div>
        <div className="text-xs text-[var(--on-surf-var)]">
          Click en celda para editar · celda vacía = crear variante
        </div>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
            <thead>
              <tr>
                <th
                  className="sticky left-0 px-4 py-3 text-xs font-medium uppercase tracking-widest text-left"
                  style={{
                    color: "var(--on-surf-var)",
                    background: "var(--surf-lowest)",
                    borderBottom: "1px solid var(--ghost-border)",
                    minWidth: 80,
                    zIndex: 2,
                  }}
                >
                  V \ Ah
                </th>
                {cols.map((c) => (
                  <th
                    key={c.id}
                    className="px-3 py-3 text-xs font-medium uppercase tracking-widest text-center"
                    style={{
                      color: "var(--on-surf-var)",
                      borderBottom: "1px solid var(--ghost-border)",
                      minWidth: 100,
                    }}
                  >
                    {c.nombre}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <th
                    className="sticky left-0 px-4 py-3 text-sm font-semibold text-left"
                    style={{
                      background: "var(--surf-lowest)",
                      color: "var(--on-surf)",
                      borderBottom: "1px solid rgba(178,204,192,0.08)",
                      zIndex: 1,
                    }}
                  >
                    {row.valor}V
                  </th>
                  {cols.map((col) => {
                    const cell = cellFor(row, col);
                    return (
                      <td
                        key={col.id}
                        className="px-2 py-2 text-center"
                        style={{ borderBottom: "1px solid rgba(178,204,192,0.08)" }}
                      >
                        {cell.kind === "populated" ? (
                          <CellPopulated
                            v={cell.variant}
                            onClick={() => setEditing(cell.variant)}
                          />
                        ) : (
                          <CellEmpty
                            onClick={() =>
                              setCreating({
                                voltajeId: cell.voltajeId,
                                voltaje: cell.voltaje,
                                capacidadId: cell.capacidadId,
                                capacidadAh: cell.capacidadAh,
                              })
                            }
                          />
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {editing && (
        <BatteryVariantDialog
          variant={editing}
          onClose={() => setEditing(null)}
          onSaved={(next) =>
            onChange(variants.map((v) => (v.id === next.id ? next : v)))
          }
          onDeleted={(id) => onChange(variants.filter((v) => v.id !== id))}
        />
      )}
      {creating && (
        <BatteryVariantDialog
          createFor={creating}
          onClose={() => setCreating(null)}
          onSaved={(next) => onChange([...variants, next])}
        />
      )}
    </div>
  );
}

function CellPopulated({
  v,
  onClick,
}: {
  v: BatteryVariantRow;
  onClick: () => void;
}) {
  const lowStock = v.stockMinimo > 0 && v.stockTotal <= v.stockMinimo;
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl px-2 py-2 transition-colors"
      style={{
        background: v.isActive ? "var(--surf-low)" : "var(--surf-high)",
        color: "var(--on-surf)",
        opacity: v.isActive ? 1 : 0.45,
        cursor: "pointer",
        border: lowStock ? "1px solid var(--err)" : "1px solid transparent",
      }}
      title={v.sku}
    >
      <div className="text-sm font-medium">
        ${v.precioPublico.toLocaleString("es-MX")}
      </div>
      <div
        className="text-[10px] mt-0.5"
        style={{
          color: lowStock ? "var(--err)" : "var(--on-surf-var)",
        }}
      >
        {v.stockTotal} en stock
      </div>
    </button>
  );
}

function CellEmpty({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl px-2 py-3 transition-opacity flex items-center justify-center"
      style={{
        background: "transparent",
        color: "var(--on-surf-var)",
        border: "1px dashed rgba(178,204,192,0.25)",
        cursor: "pointer",
        opacity: 0.55,
      }}
      title="Crear variante"
    >
      <Plus className="h-4 w-4" />
    </button>
  );
}

function BatteryVariantDialog({
  variant,
  createFor,
  onClose,
  onSaved,
  onDeleted,
}: {
  variant?: BatteryVariantRow;
  createFor?: {
    voltajeId: string;
    voltaje: number;
    capacidadId: string;
    capacidadAh: number;
  };
  onClose: () => void;
  onSaved: (v: BatteryVariantRow) => void;
  onDeleted?: (id: string) => void;
}) {
  const isEdit = !!variant;
  const v = variant;
  const ctx = createFor;
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const voltajeValor = v?.voltajeValor ?? ctx!.voltaje;
  const capacidadAh = v?.capacidadValorAh ?? ctx!.capacidadAh;

  // SKU convención: BAT-{V}V-{Ah}AH (punto en Ah → 'P'). Mismo patrón que el seed.
  const defaultSku = `BAT-${voltajeValor}V-${String(capacidadAh).replace(".", "P")}AH`;

  const [sku, setSku] = useState(v?.sku ?? defaultSku);
  const [precioPublico, setPrecioPublico] = useState(
    v ? String(v.precioPublico) : "0",
  );
  const [costo, setCosto] = useState(v ? String(v.costo) : "0");
  const [stockMinimo, setStockMinimo] = useState(v ? String(v.stockMinimo) : "0");
  const [stockMaximo, setStockMaximo] = useState(v ? String(v.stockMaximo) : "0");
  const [isActive, setIsActive] = useState(v?.isActive ?? true);

  async function onSubmit(): Promise<void> {
    const precioN = Number.parseFloat(precioPublico);
    const costoN = Number.parseFloat(costo);
    const sMin = Number.parseInt(stockMinimo, 10);
    const sMax = Number.parseInt(stockMaximo, 10);
    if (!sku.trim()) {
      toast.error("SKU requerido");
      return;
    }
    if (!Number.isFinite(precioN) || precioN < 0) {
      toast.error("Precio inválido");
      return;
    }
    if (!Number.isFinite(costoN) || costoN < 0) {
      toast.error("Costo inválido");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        isEdit
          ? `/api/configuracion/baterias/${v!.id}`
          : "/api/configuracion/baterias",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            isEdit
              ? {
                  sku: sku.trim(),
                  precioPublico: precioN,
                  costo: costoN,
                  stockMinimo: sMin,
                  stockMaximo: sMax,
                  isActive,
                }
              : {
                  voltaje_id: ctx!.voltajeId,
                  capacidad_id: ctx!.capacidadId,
                  sku: sku.trim(),
                  precioPublico: precioN,
                  costo: costoN,
                  stockMinimo: sMin,
                  stockMaximo: sMax,
                },
          ),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo guardar");
        return;
      }
      const d = json.data;
      onSaved({
        id: d.id,
        sku: d.sku,
        voltajeId: d.voltaje_id,
        voltajeValor: d.voltaje.valor,
        voltajeLabel: d.voltaje.label,
        capacidadId: d.capacidad_id,
        capacidadValorAh: d.capacidad.valorAh,
        capacidadNombre: d.capacidad.nombre,
        precioPublico: Number(d.precioPublico),
        costo: Number(d.costo),
        stockMinimo: d.stockMinimo,
        stockMaximo: d.stockMaximo,
        stockTotal: d.stockTotal ?? (v?.stockTotal ?? 0),
        isActive: d.isActive,
      });
      toast.success(isEdit ? "Actualizado" : "Creado");
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(): Promise<void> {
    if (!v) return;
    const ok = confirm(`Desactivar variante ${v.sku}?`);
    if (!ok) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/configuracion/baterias/${v.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo desactivar");
        return;
      }
      toast.success("Variante desactivada");
      onDeleted?.(v.id);
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-lg" style={modalStyle()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-heading, 'Space Grotesk')" }}>
            {isEdit ? "Editar batería" : "Crear batería"}
          </DialogTitle>
          <div className="text-xs text-[var(--on-surf-var)]">
            {voltajeValor}V · {capacidadAh}Ah
          </div>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-3">
          <Field label="SKU">
            <input
              style={INPUT_STYLE}
              value={sku}
              onChange={(e) => setSku(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Precio público">
              <input
                style={INPUT_STYLE}
                type="number"
                step="0.01"
                value={precioPublico}
                onChange={(e) => setPrecioPublico(e.target.value)}
              />
            </Field>
            <Field label="Costo">
              <input
                style={INPUT_STYLE}
                type="number"
                step="0.01"
                value={costo}
                onChange={(e) => setCosto(e.target.value)}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Stock mínimo">
              <input
                style={INPUT_STYLE}
                type="number"
                value={stockMinimo}
                onChange={(e) => setStockMinimo(e.target.value)}
              />
            </Field>
            <Field label="Stock máximo">
              <input
                style={INPUT_STYLE}
                type="number"
                value={stockMaximo}
                onChange={(e) => setStockMaximo(e.target.value)}
              />
            </Field>
          </div>
          {isEdit && (
            <label className="flex items-center gap-2 text-sm text-[var(--on-surf)]">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              Activa
            </label>
          )}
          <div className="flex items-center justify-between pt-2">
            {isEdit ? (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{
                  background: "transparent",
                  color: "var(--err)",
                  opacity: deleting ? 0.5 : 1,
                }}
              >
                {deleting ? "Desactivando…" : "Desactivar"}
              </button>
            ) : (
              <div />
            )}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onSubmit}
                disabled={saving}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{ background: "var(--p)", color: "#ffffff", opacity: saving ? 0.5 : 1 }}
              >
                {saving ? "Guardando…" : isEdit ? "Guardar" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
    </div>
  );
}
