"use client";

import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  INPUT_STYLE,
  SELECT_STYLE,
  LABEL_STYLE,
  modalStyle,
  type ModeloRow,
  type VoltajeRow,
  type BatteryVariantRow,
  type BatteryConfigRow,
} from "./shared";

export function TabBatteryConfigs({
  configs,
  modelos,
  voltajes,
  batteryVariants,
  onChange,
}: {
  configs: BatteryConfigRow[];
  modelos: ModeloRow[];
  voltajes: VoltajeRow[];
  batteryVariants: BatteryVariantRow[];
  onChange: (next: BatteryConfigRow[]) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<BatteryConfigRow | null>(null);

  const grouped = useMemo(() => {
    const map = new Map<string, { modelo: string; rows: BatteryConfigRow[] }>();
    for (const c of configs) {
      const entry = map.get(c.modeloId);
      if (entry) {
        entry.rows.push(c);
      } else {
        map.set(c.modeloId, { modelo: c.modeloNombre, rows: [c] });
      }
    }
    return Array.from(map.values());
  }, [configs]);

  async function handleDelete(c: BatteryConfigRow): Promise<void> {
    const ok = confirm(
      `Eliminar config: ${c.modeloNombre} @ ${c.voltajeLabel} → ${c.batteryVariantSku}?`,
    );
    if (!ok) return;
    try {
      const res = await fetch(`/api/configuracion/battery-configs/${c.id}`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo eliminar");
        return;
      }
      onChange(configs.filter((x) => x.id !== c.id));
      toast.success("Configuración eliminada");
    } catch {
      toast.error("Error de red");
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "var(--p)", color: "#ffffff" }}
        >
          <Plus className="h-4 w-4" />
          Nueva configuración
        </button>
      </div>

      <div className="space-y-3">
        {grouped.length === 0 && (
          <div className="p-6 text-center text-sm text-[var(--on-surf-var)]">
            Sin configuraciones de batería.
          </div>
        )}
        {grouped.map((g) => (
          <div
            key={g.modelo}
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
          >
            <div
              className="px-5 py-3 text-xs font-medium uppercase tracking-widest"
              style={{ color: "var(--on-surf-var)" }}
            >
              {g.modelo}
            </div>
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                  <Th>Voltaje</Th>
                  <Th>Batería</Th>
                  <Th align="right">Cantidad</Th>
                  <Th align="right">Acciones</Th>
                </tr>
              </thead>
              <tbody>
                {g.rows.map((r) => (
                  <tr
                    key={r.id}
                    style={{ borderBottom: "1px solid var(--ghost-border-soft)" }}
                  >
                    <td className="px-5 py-3 text-[var(--on-surf)]">{r.voltajeLabel}</td>
                    <td className="px-5 py-3 text-[var(--on-surf-var)]">
                      {r.batteryCapacidadNombre ? (
                        <span>
                          <span className="font-medium text-[var(--on-surf)]">
                            {r.voltajeValor}V · {r.batteryCapacidadNombre}
                          </span>
                          <span className="ml-2 font-mono text-xs">{r.batteryVariantSku}</span>
                        </span>
                      ) : (
                        <span>
                          {r.batteryVariantModelo}
                          <span className="ml-2 font-mono text-xs">{r.batteryVariantSku}</span>
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right text-[var(--on-surf)]">{r.quantity}</td>
                    <td className="px-5 py-3 text-right">
                      <div className="inline-flex items-center gap-1">
                        <IconBtn onClick={() => setEditing(r)} title="Editar">
                          <Pencil className="h-4 w-4" />
                        </IconBtn>
                        <IconBtn onClick={() => handleDelete(r)} title="Eliminar">
                          <Trash2 className="h-4 w-4" />
                        </IconBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {showCreate && (
        <BatteryConfigDialog
          modelos={modelos}
          voltajes={voltajes}
          batteryVariants={batteryVariants}
          onClose={() => setShowCreate(false)}
          onSaved={(r) => onChange([...configs, r])}
        />
      )}
      {editing && (
        <BatteryConfigDialog
          config={editing}
          modelos={modelos}
          voltajes={voltajes}
          batteryVariants={batteryVariants}
          onClose={() => setEditing(null)}
          onSaved={(r) => onChange(configs.map((x) => (x.id === r.id ? r : x)))}
        />
      )}
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th
      className="px-5 py-3 text-xs font-medium uppercase tracking-widest"
      style={{ color: "var(--on-surf-var)", textAlign: align }}
    >
      {children}
    </th>
  );
}

function IconBtn({
  children,
  onClick,
  title,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className="p-1.5 rounded-lg"
      style={{ color: "var(--on-surf-var)" }}
    >
      {children}
    </button>
  );
}

function BatteryConfigDialog({
  config,
  modelos,
  voltajes,
  batteryVariants,
  onClose,
  onSaved,
}: {
  config?: BatteryConfigRow;
  modelos: ModeloRow[];
  voltajes: VoltajeRow[];
  batteryVariants: BatteryVariantRow[];
  onClose: () => void;
  onSaved: (r: BatteryConfigRow) => void;
}) {
  const isEdit = !!config;
  const [saving, setSaving] = useState(false);
  const [modeloId, setModeloId] = useState(config?.modeloId ?? "");
  const [voltajeId, setVoltajeId] = useState(config?.voltajeId ?? "");
  const [batteryVariantId, setBatteryVariantId] = useState(config?.batteryVariantId ?? "");
  const [quantity, setQuantity] = useState<string>(config ? String(config.quantity) : "1");

  // Batterías compatibles con el voltaje elegido. La API también valida la coincidencia.
  const batteryOptions = useMemo(() => {
    const list = batteryVariants.filter((v) => v.isActive);
    if (!voltajeId) return list;
    return list.filter((v) => v.voltajeId === voltajeId);
  }, [batteryVariants, voltajeId]);

  async function onSubmit(): Promise<void> {
    if (!modeloId || !voltajeId || !batteryVariantId) {
      toast.error("Completa todos los campos");
      return;
    }
    const q = Number.parseInt(quantity, 10);
    if (!Number.isFinite(q) || q <= 0) {
      toast.error("Cantidad inválida");
      return;
    }
    setSaving(true);
    try {
      const payload = isEdit
        ? { quantity: q, batteryVariantId }
        : { modeloId, voltajeId, batteryVariantId, quantity: q };
      const res = await fetch(
        isEdit
          ? `/api/configuracion/battery-configs/${config!.id}`
          : "/api/configuracion/battery-configs",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo guardar");
        return;
      }
      const r = json.data;
      onSaved({
        id: r.id,
        modeloId: r.modeloId,
        modeloNombre: r.modelo.nombre,
        voltajeId: r.voltajeId,
        voltajeValor: r.voltaje.valor,
        voltajeLabel: r.voltaje.label,
        batteryVariantId: r.batteryVariantId,
        batteryVariantSku: r.batteryVariant.sku,
        batteryVariantModelo: r.batteryVariant.modelo.nombre,
        batteryCapacidadAh: r.batteryVariant.capacidad?.valorAh ?? null,
        batteryCapacidadNombre: r.batteryVariant.capacidad?.nombre ?? null,
        quantity: r.quantity,
      });
      toast.success(isEdit ? "Actualizado" : "Creado");
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-lg" style={modalStyle()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-heading, 'Space Grotesk')" }}>
            {isEdit ? "Editar configuración" : "Nueva configuración"}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-3">
          <Field label="Modelo de vehículo">
            <select
              style={SELECT_STYLE}
              value={modeloId}
              onChange={(e) => setModeloId(e.target.value)}
              disabled={isEdit}
            >
              <option value="">Selecciona…</option>
              {modelos
                .filter((m) => m.isActive && !m.esBateria)
                .map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.nombre}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Voltaje">
            <select
              style={SELECT_STYLE}
              value={voltajeId}
              onChange={(e) => setVoltajeId(e.target.value)}
              disabled={isEdit}
            >
              <option value="">Selecciona…</option>
              {voltajes
                .filter((v) => v.isActive)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.label}
                  </option>
                ))}
            </select>
          </Field>
          <Field
            label={
              voltajeId
                ? "Batería a usar"
                : "Batería a usar (selecciona voltaje primero)"
            }
          >
            <select
              style={SELECT_STYLE}
              value={batteryVariantId}
              onChange={(e) => setBatteryVariantId(e.target.value)}
              disabled={!voltajeId}
            >
              <option value="">Selecciona…</option>
              {batteryOptions
                .slice()
                .sort((a, b) => a.capacidadValorAh - b.capacidadValorAh)
                .map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.voltajeValor}V · {v.capacidadNombre} · {v.sku}
                  </option>
                ))}
            </select>
          </Field>
          <Field label="Cantidad">
            <input
              style={INPUT_STYLE}
              type="number"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </Field>
          <div className="flex items-center justify-end gap-2 pt-2">
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
