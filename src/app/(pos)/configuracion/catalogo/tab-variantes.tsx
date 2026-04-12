"use client";

import { useState, useRef, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Power, ImagePlus } from "lucide-react";
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
  type ColorRow,
  type VoltajeRow,
  type VarianteRow,
} from "./shared";

export function TabVariantes({
  variantes,
  modelos,
  colores,
  voltajes,
  onChange,
}: {
  variantes: VarianteRow[];
  modelos: ModeloRow[];
  colores: ColorRow[];
  voltajes: VoltajeRow[];
  onChange: (next: VarianteRow[]) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<VarianteRow | null>(null);
  const [filterModelo, setFilterModelo] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);

  const visible = useMemo(() => {
    return variantes.filter((v) => {
      if (!showInactive && !v.isActive) return false;
      if (filterModelo && v.modelo_id !== filterModelo) return false;
      return true;
    });
  }, [variantes, filterModelo, showInactive]);

  async function handleToggle(v: VarianteRow): Promise<void> {
    const next = !v.isActive;
    try {
      if (next) {
        const res = await fetch(`/api/configuracion/variantes/${v.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error ?? "No se pudo activar");
          return;
        }
      } else {
        const res = await fetch(`/api/configuracion/variantes/${v.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error ?? "No se pudo desactivar");
          return;
        }
      }
      onChange(variantes.map((x) => (x.id === v.id ? { ...x, isActive: next } : x)));
      toast.success(next ? "Variante activada" : "Variante desactivada");
    } catch {
      toast.error("Error de red");
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <select
            value={filterModelo}
            onChange={(e) => setFilterModelo(e.target.value)}
            style={{ ...SELECT_STYLE, width: 280 }}
          >
            <option value="">Todos los modelos</option>
            {modelos
              .filter((m) => m.isActive)
              .map((m) => (
                <option key={m.id} value={m.id}>
                  {m.nombre}
                </option>
              ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-[var(--on-surf-var)]">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inactivas
          </label>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "var(--p)", color: "#ffffff" }}
        >
          <Plus className="h-4 w-4" />
          Nueva variante
        </button>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(178,204,192,0.15)" }}>
                <Th>Img</Th>
                <Th>SKU</Th>
                <Th>Modelo</Th>
                <Th>Color</Th>
                <Th>Voltaje</Th>
                <Th align="right">Precio</Th>
                <Th align="right">Costo</Th>
                <Th>Estado</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-6 text-center text-sm text-[var(--on-surf-var)]">
                    Sin variantes.
                  </td>
                </tr>
              )}
              {visible.map((v) => (
                <tr
                  key={v.id}
                  style={{
                    borderBottom: "1px solid rgba(178,204,192,0.08)",
                    opacity: v.isActive ? 1 : 0.55,
                  }}
                >
                  <td className="px-5 py-3">
                    {v.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={v.imageUrl}
                        alt={v.sku}
                        style={{
                          width: 36,
                          height: 36,
                          objectFit: "cover",
                          borderRadius: "var(--r-md)",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: 36,
                          height: 36,
                          borderRadius: "var(--r-md)",
                          background: "var(--surf-high)",
                        }}
                      />
                    )}
                  </td>
                  <td className="px-5 py-3 font-mono text-xs text-[var(--on-surf)]">{v.sku}</td>
                  <td className="px-5 py-3 text-[var(--on-surf)]">{v.modelo_nombre}</td>
                  <td className="px-5 py-3 text-[var(--on-surf-var)]">{v.color_nombre}</td>
                  <td className="px-5 py-3 text-[var(--on-surf-var)]">{v.voltaje_label}</td>
                  <td className="px-5 py-3 text-right text-[var(--on-surf)]">
                    ${v.precioPublico.toLocaleString("es-MX")}
                  </td>
                  <td className="px-5 py-3 text-right text-[var(--on-surf-var)]">
                    ${v.costo.toLocaleString("es-MX")}
                  </td>
                  <td className="px-5 py-3 text-[var(--on-surf-var)]">
                    {v.isActive ? "Activa" : "Inactiva"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <IconButton onClick={() => setEditing(v)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </IconButton>
                      <IconButton
                        onClick={() => handleToggle(v)}
                        title={v.isActive ? "Desactivar" : "Activar"}
                      >
                        <Power
                          className="h-4 w-4"
                          style={{
                            color: v.isActive ? "var(--sec)" : "var(--on-surf-var)",
                          }}
                        />
                      </IconButton>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <VariantDialog
          modelos={modelos}
          colores={colores}
          voltajes={voltajes}
          onClose={() => setShowCreate(false)}
          onSaved={(v) => onChange([v, ...variantes])}
        />
      )}
      {editing && (
        <VariantDialog
          variant={editing}
          modelos={modelos}
          colores={colores}
          voltajes={voltajes}
          onClose={() => setEditing(null)}
          onSaved={(v) => onChange(variantes.map((x) => (x.id === v.id ? v : x)))}
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

function IconButton({
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

function VariantDialog({
  variant,
  modelos,
  colores,
  voltajes,
  onClose,
  onSaved,
}: {
  variant?: VarianteRow;
  modelos: ModeloRow[];
  colores: ColorRow[];
  voltajes: VoltajeRow[];
  onClose: () => void;
  onSaved: (v: VarianteRow) => void;
}) {
  const isEdit = !!variant;
  const [saving, setSaving] = useState(false);
  const [historyLocked, setHistoryLocked] = useState(false);

  const [modeloId, setModeloId] = useState(variant?.modelo_id ?? modelos[0]?.id ?? "");
  const [colorId, setColorId] = useState(variant?.color_id ?? "");
  const [voltajeId, setVoltajeId] = useState(
    variant?.voltaje_id ?? voltajes.filter((v) => v.isActive)[0]?.id ?? "",
  );
  const [sku, setSku] = useState(variant?.sku ?? "");
  const [precioPublico, setPrecioPublico] = useState<string>(
    variant ? String(variant.precioPublico) : "",
  );
  const [costo, setCosto] = useState<string>(variant ? String(variant.costo) : "");
  const [precioDistribuidor, setPrecioDistribuidor] = useState<string>(
    variant?.precioDistribuidor !== null && variant?.precioDistribuidor !== undefined
      ? String(variant.precioDistribuidor)
      : "",
  );
  const [pdConfirmado, setPdConfirmado] = useState(
    variant?.precioDistribuidorConfirmado ?? false,
  );
  const [stockMinimo, setStockMinimo] = useState<string>(
    variant ? String(variant.stockMinimo) : "0",
  );
  const [stockMaximo, setStockMaximo] = useState<string>(
    variant ? String(variant.stockMaximo) : "0",
  );
  const [imageUrl, setImageUrl] = useState<string | null>(variant?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const modeloAvailableColors = useMemo(() => {
    const m = modelos.find((x) => x.id === modeloId);
    if (!m) return [];
    return colores.filter((c) => c.isActive && m.colorIds.includes(c.id));
  }, [modelos, modeloId, colores]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    if (!variant) {
      toast.error("Guarda la variante antes de subir imagen");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const res = await fetch(`/api/configuracion/variantes/${variant.id}/image`, {
        method: "POST",
        body: fd,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo subir");
        return;
      }
      setImageUrl(json.data.imageUrl);
      toast.success("Imagen actualizada");
    } catch {
      toast.error("Error de red");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function onSubmit(): Promise<void> {
    if (!modeloId || !colorId || !voltajeId || !sku.trim()) {
      toast.error("Completa modelo, color, voltaje y SKU");
      return;
    }
    const num = (s: string): number => Number.parseFloat(s);
    const intNum = (s: string): number => Number.parseInt(s, 10) || 0;

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        precioPublico: num(precioPublico),
        costo: num(costo),
        precioDistribuidor: precioDistribuidor ? num(precioDistribuidor) : null,
        precioDistribuidorConfirmado: pdConfirmado,
        stockMinimo: intNum(stockMinimo),
        stockMaximo: intNum(stockMaximo),
      };
      if (!isEdit) {
        payload.modelo_id = modeloId;
        payload.color_id = colorId;
        payload.voltaje_id = voltajeId;
        payload.sku = sku.trim();
      } else {
        // Grupo B only if changed AND not historyLocked
        if (!historyLocked) {
          if (sku.trim() !== variant!.sku) payload.sku = sku.trim();
          if (modeloId !== variant!.modelo_id) payload.modelo_id = modeloId;
          if (colorId !== variant!.color_id) payload.color_id = colorId;
          if (voltajeId !== variant!.voltaje_id) payload.voltaje_id = voltajeId;
        }
      }

      const res = await fetch(
        isEdit ? `/api/configuracion/variantes/${variant!.id}` : "/api/configuracion/variantes",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        if (json.hasHistory) {
          setHistoryLocked(true);
          toast.error(json.error);
        } else {
          toast.error(json.error ?? "No se pudo guardar");
        }
        return;
      }
      const v = json.data;
      onSaved({
        id: v.id,
        sku: v.sku,
        modelo_id: v.modelo_id,
        modelo_nombre: v.modelo.nombre,
        modelo_esBateria: modelos.find((m) => m.id === v.modelo_id)?.esBateria ?? false,
        color_id: v.color_id,
        color_nombre: v.color.nombre,
        voltaje_id: v.voltaje_id,
        voltaje_label: v.voltaje.label,
        precioPublico: Number(v.precioPublico),
        costo: Number(v.costo),
        precioDistribuidor: v.precioDistribuidor !== null ? Number(v.precioDistribuidor) : null,
        precioDistribuidorConfirmado: v.precioDistribuidorConfirmado,
        stockMinimo: v.stockMinimo,
        stockMaximo: v.stockMaximo,
        imageUrl: v.imageUrl ?? imageUrl,
        isActive: v.isActive,
      });
      toast.success(isEdit ? "Variante actualizada" : "Variante creada");
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  }

  const groupBDisabled = historyLocked && isEdit;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-2xl max-h-[90vh] overflow-y-auto" style={modalStyle()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-heading, 'Space Grotesk')" }}>
            {isEdit ? "Editar variante" : "Nueva variante"}
          </DialogTitle>
        </DialogHeader>
        <div className="px-6 pb-6 space-y-3">
          {isEdit && (
            <div className="flex items-center gap-3">
              {imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={imageUrl}
                  alt=""
                  style={{ width: 72, height: 72, objectFit: "cover", borderRadius: "var(--r-lg)" }}
                />
              ) : (
                <div
                  style={{
                    width: 72,
                    height: 72,
                    borderRadius: "var(--r-lg)",
                    background: "var(--surf-low)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--on-surf-var)",
                  }}
                >
                  <ImagePlus className="h-5 w-5" />
                </div>
              )}
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="hidden"
                onChange={handleUpload}
              />
              <button
                type="button"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
                className="px-3 py-1.5 rounded-lg text-xs"
                style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
              >
                {uploading ? "Subiendo…" : imageUrl ? "Cambiar" : "Subir imagen"}
              </button>
            </div>
          )}

          {historyLocked && (
            <div
              className="text-xs p-3 rounded-lg"
              style={{ background: "var(--e-container)", color: "var(--on-e-container)" }}
            >
              Esta variante tiene historial (ventas, movimientos o stock). No puedes cambiar SKU, modelo, color o voltaje. Si la necesitas distinta, desactívala y crea una nueva.
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <Field label="Modelo">
              <select
                style={SELECT_STYLE}
                value={modeloId}
                onChange={(e) => {
                  setModeloId(e.target.value);
                  setColorId("");
                }}
                disabled={groupBDisabled}
              >
                {modelos
                  .filter((m) => m.isActive)
                  .map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="Color">
              <select
                style={SELECT_STYLE}
                value={colorId}
                onChange={(e) => setColorId(e.target.value)}
                disabled={groupBDisabled}
              >
                <option value="">Selecciona…</option>
                {modeloAvailableColors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nombre}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Voltaje">
              <select
                style={SELECT_STYLE}
                value={voltajeId}
                onChange={(e) => setVoltajeId(e.target.value)}
                disabled={groupBDisabled}
              >
                {voltajes
                  .filter((v) => v.isActive)
                  .map((v) => (
                    <option key={v.id} value={v.id}>
                      {v.label}
                    </option>
                  ))}
              </select>
            </Field>
            <Field label="SKU">
              <input
                style={{ ...INPUT_STYLE, fontFamily: "monospace" }}
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                disabled={groupBDisabled}
              />
            </Field>
          </div>

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
            <Field label="Precio distribuidor (opcional)">
              <input
                style={INPUT_STYLE}
                type="number"
                step="0.01"
                value={precioDistribuidor}
                onChange={(e) => setPrecioDistribuidor(e.target.value)}
              />
            </Field>
            <div className="flex items-end pb-3">
              <label className="flex items-center gap-2 text-sm text-[var(--on-surf)]">
                <input
                  type="checkbox"
                  checked={pdConfirmado}
                  onChange={(e) => setPdConfirmado(e.target.checked)}
                />
                Precio distribuidor confirmado
              </label>
            </div>
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
