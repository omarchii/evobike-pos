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
  CATEGORIA_LABELS,
  CATEGORIAS_ACTIVAS,
  type ModeloRow,
  type ColorRow,
} from "./shared";

type CategoriaFilter = "TODAS" | (typeof CATEGORIAS_ACTIVAS)[number];

export function TabModelos({
  modelos,
  colores,
  onChange,
}: {
  modelos: ModeloRow[];
  colores: ColorRow[];
  onChange: (next: ModeloRow[]) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ModeloRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const [categoriaFilter, setCategoriaFilter] = useState<CategoriaFilter>("TODAS");

  async function handleToggle(m: ModeloRow): Promise<void> {
    if (m.isActive) {
      const ok = confirm(
        `Desactivar "${m.nombre}" también desactivará todas sus variantes. ¿Continuar?`,
      );
      if (!ok) return;
      try {
        const res = await fetch(`/api/configuracion/modelos/${m.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error ?? "No se pudo desactivar");
          return;
        }
        toast.success(
          `Modelo desactivado (${json.data.affectedVariants} variantes afectadas)`,
        );
        onChange(modelos.map((x) => (x.id === m.id ? { ...x, isActive: false } : x)));
      } catch {
        toast.error("Error de red");
      }
    } else {
      try {
        const res = await fetch(`/api/configuracion/modelos/${m.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error ?? "No se pudo activar");
          return;
        }
        toast.success("Modelo activado");
        onChange(modelos.map((x) => (x.id === m.id ? { ...x, isActive: true } : x)));
      } catch {
        toast.error("Error de red");
      }
    }
  }

  // Este tab muestra sólo modelos de vehículo. Modelos de batería (esBateria=true) viven en el tab Baterías.
  const vehiculos = useMemo(
    () => modelos.filter((m) => !m.esBateria),
    [modelos],
  );

  const visible = useMemo(() => {
    let list = showInactive ? vehiculos : vehiculos.filter((m) => m.isActive);
    if (categoriaFilter !== "TODAS") {
      list = list.filter((m) => m.categoria === categoriaFilter);
    }
    return list;
  }, [vehiculos, showInactive, categoriaFilter]);

  // Agrupar por categoría (sólo cuando filtro = TODAS; si hay filtro específico, una sola sección).
  const grouped = useMemo(() => {
    if (categoriaFilter !== "TODAS") {
      return [{ categoria: categoriaFilter, rows: visible }];
    }
    const order = [...CATEGORIAS_ACTIVAS, "BICICLETA", "SIN_CATEGORIA"] as const;
    const buckets = new Map<string, ModeloRow[]>();
    for (const m of visible) {
      const key = m.categoria ?? "SIN_CATEGORIA";
      const arr = buckets.get(key) ?? [];
      arr.push(m);
      buckets.set(key, arr);
    }
    return order
      .filter((k) => (buckets.get(k) ?? []).length > 0)
      .map((k) => ({ categoria: k, rows: buckets.get(k)! }));
  }, [visible, categoriaFilter]);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <FilterChip
            active={categoriaFilter === "TODAS"}
            onClick={() => setCategoriaFilter("TODAS")}
            count={vehiculos.filter((m) => showInactive || m.isActive).length}
          >
            Todas
          </FilterChip>
          {CATEGORIAS_ACTIVAS.map((c) => {
            const count = vehiculos.filter(
              (m) => m.categoria === c && (showInactive || m.isActive),
            ).length;
            return (
              <FilterChip
                key={c}
                active={categoriaFilter === c}
                onClick={() => setCategoriaFilter(c)}
                count={count}
              >
                {CATEGORIA_LABELS[c]}
              </FilterChip>
            );
          })}
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[var(--on-surf-var)]">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inactivos
          </label>
          <button
            onClick={() => setShowCreate(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
            style={{ background: "var(--p)", color: "#ffffff" }}
          >
            <Plus className="h-4 w-4" />
            Nuevo modelo
          </button>
        </div>
      </div>

      <div className="space-y-3">
        {grouped.length === 0 && (
          <div
            className="rounded-2xl p-6 text-center text-sm text-[var(--on-surf-var)]"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
          >
            Sin modelos en esta categoría.
          </div>
        )}
        {grouped.map((g) => (
          <div
            key={g.categoria}
            className="rounded-2xl overflow-hidden"
            style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
          >
            <div
              className="px-5 py-3 flex items-center justify-between"
              style={{ borderBottom: "1px solid var(--ghost-border)" }}
            >
              <div
                className="text-xs font-medium uppercase tracking-widest"
                style={{ color: "var(--on-surf-var)" }}
              >
                {g.categoria === "SIN_CATEGORIA"
                  ? "Sin categoría"
                  : (CATEGORIA_LABELS[g.categoria] ?? g.categoria)}
              </div>
              <div className="text-xs text-[var(--on-surf-var)]">{g.rows.length}</div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                    <Th>Img</Th>
                    <Th>Nombre</Th>
                    <Th>Colores</Th>
                    <Th>VIN</Th>
                    <Th>Garantía</Th>
                    <Th>Estado</Th>
                    <Th align="right">Acciones</Th>
                  </tr>
                </thead>
                <tbody>
                  {g.rows.map((m) => (
                    <tr
                      key={m.id}
                      style={{
                        borderBottom: "1px solid var(--ghost-border-soft)",
                        opacity: m.isActive ? 1 : 0.55,
                      }}
                    >
                      <td className="px-5 py-3">
                        {m.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={m.imageUrl}
                            alt={m.nombre}
                            style={{
                              width: 40,
                              height: 40,
                              objectFit: "cover",
                              borderRadius: "var(--r-md)",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              borderRadius: "var(--r-md)",
                              background: "var(--surf-high)",
                            }}
                          />
                        )}
                      </td>
                      <td className="px-5 py-3 text-[var(--on-surf)]">{m.nombre}</td>
                      <td className="px-5 py-3 text-[var(--on-surf-var)]">{m.colorIds.length}</td>
                      <td className="px-5 py-3 text-[var(--on-surf-var)]">
                        {m.requiere_vin ? "Sí" : "No"}
                      </td>
                      <td className="px-5 py-3 text-[var(--on-surf-var)]">
                        {m.warrantyDays != null ? `${m.warrantyDays}d` : "—"}
                      </td>
                      <td className="px-5 py-3 text-[var(--on-surf-var)]">
                        {m.isActive ? "Activo" : "Inactivo"}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          <IconButton onClick={() => setEditing(m)} title="Editar">
                            <Pencil className="h-4 w-4" />
                          </IconButton>
                          <IconButton
                            onClick={() => handleToggle(m)}
                            title={m.isActive ? "Desactivar" : "Activar"}
                          >
                            <Power
                              className="h-4 w-4"
                              style={{
                                color: m.isActive ? "var(--sec)" : "var(--on-surf-var)",
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
        ))}
      </div>

      {showCreate && (
        <ModeloDialog
          colores={colores}
          onClose={() => setShowCreate(false)}
          onSaved={(m) => onChange([m, ...modelos])}
        />
      )}
      {editing && (
        <ModeloDialog
          modelo={editing}
          colores={colores}
          onClose={() => setEditing(null)}
          onSaved={(m) =>
            onChange(modelos.map((x) => (x.id === m.id ? m : x)))
          }
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

function FilterChip({
  active,
  onClick,
  count,
  children,
}: {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors"
      style={{
        background: active ? "var(--p)" : "var(--surf-low)",
        color: active ? "#ffffff" : "var(--on-surf)",
      }}
    >
      {children}
      <span
        className="inline-flex items-center justify-center min-w-5 h-5 px-1.5 rounded-full text-[10px]"
        style={{
          background: active
            ? "rgba(255,255,255,0.25)"
            : "var(--surf-high)",
          color: active ? "#ffffff" : "var(--on-surf-var)",
        }}
      >
        {count}
      </span>
    </button>
  );
}

function IconButton({
  children,
  onClick,
  title,
  disabled,
}: {
  children: React.ReactNode;
  onClick: () => void;
  title: string;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      className="p-1.5 rounded-lg"
      style={{
        color: "var(--on-surf-var)",
        opacity: disabled ? 0.4 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      {children}
    </button>
  );
}

function ModeloDialog({
  modelo,
  colores,
  onClose,
  onSaved,
}: {
  modelo?: ModeloRow;
  colores: ColorRow[];
  onClose: () => void;
  onSaved: (m: ModeloRow) => void;
}) {
  const isEdit = !!modelo;
  const [saving, setSaving] = useState(false);
  const [nombre, setNombre] = useState(modelo?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(modelo?.descripcion ?? "");
  // `categoria` es null cuando esBateria=true (coherente con el schema).
  const [categoria, setCategoria] = useState<string | null>(
    modelo?.categoria ?? (modelo?.esBateria ? null : "BASE"),
  );
  const [requiereVin, setRequiereVin] = useState(modelo?.requiere_vin ?? true);
  const [esBateria, setEsBateria] = useState(modelo?.esBateria ?? false);
  const [colorIds, setColorIds] = useState<string[]>(modelo?.colorIds ?? []);
  const [imageUrl, setImageUrl] = useState<string | null>(modelo?.imageUrl ?? null);
  const [warrantyDays, setWarrantyDays] = useState<string>(
    modelo?.warrantyDays != null ? String(modelo.warrantyDays) : "",
  );
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function toggleColor(id: string): void {
    setColorIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    if (!modelo) {
      toast.error("Guarda el modelo antes de subir imagen");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const res = await fetch(`/api/configuracion/modelos/${modelo.id}/image`, {
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
    if (!nombre.trim()) {
      toast.error("Nombre requerido");
      return;
    }
    setSaving(true);
    try {
      const parsedWarrantyDays = warrantyDays.trim() ? parseInt(warrantyDays, 10) : null;
      if (parsedWarrantyDays != null && !requiereVin) {
        toast.error("Días de garantía solo aplica a modelos con VIN (requiere_vin)");
        setSaving(false);
        return;
      }
      const payload = {
        nombre: nombre.trim(),
        descripcion: descripcion.trim() || null,
        categoria: esBateria ? null : categoria,
        requiere_vin: requiereVin,
        esBateria,
        colorIds,
        warrantyDays: parsedWarrantyDays,
      };
      const res = await fetch(
        isEdit ? `/api/configuracion/modelos/${modelo!.id}` : "/api/configuracion/modelos",
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
      const m = json.data;
      onSaved({
        id: m.id,
        nombre: m.nombre,
        descripcion: m.descripcion,
        requiere_vin: m.requiere_vin,
        categoria: m.categoria,
        esBateria: m.esBateria,
        isActive: m.isActive,
        imageUrl: m.imageUrl ?? imageUrl,
        colorIds: m.coloresDisponibles?.map((mc: { color_id: string }) => mc.color_id) ?? colorIds,
        warrantyDays: m.warrantyDays ?? null,
      });
      toast.success(isEdit ? "Modelo actualizado" : "Modelo creado");
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-2xl max-h-[90vh] overflow-y-auto" style={modalStyle()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            {isEdit ? "Editar modelo" : "Nuevo modelo"}
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
                  style={{
                    width: 80,
                    height: 80,
                    objectFit: "cover",
                    borderRadius: "var(--r-lg)",
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 80,
                    height: 80,
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
              <div>
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
                  {uploading ? "Subiendo…" : imageUrl ? "Cambiar imagen" : "Subir imagen"}
                </button>
              </div>
            </div>
          )}
          <Field label="Nombre">
            <input style={INPUT_STYLE} value={nombre} onChange={(e) => setNombre(e.target.value)} />
          </Field>
          <Field label="Descripción">
            <input
              style={INPUT_STYLE}
              value={descripcion ?? ""}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </Field>
          {!esBateria && (
            <Field label="Categoría">
              <select
                style={SELECT_STYLE}
                value={categoria ?? "BASE"}
                onChange={(e) => setCategoria(e.target.value)}
              >
                {CATEGORIAS_ACTIVAS.map((c) => (
                  <option key={c} value={c}>
                    {CATEGORIA_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
          )}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-[var(--on-surf)]">
              <input
                type="checkbox"
                checked={requiereVin}
                onChange={(e) => setRequiereVin(e.target.checked)}
              />
              Requiere VIN
            </label>
            <label className="flex items-center gap-2 text-sm text-[var(--on-surf)]">
              <input
                type="checkbox"
                checked={esBateria}
                onChange={(e) => setEsBateria(e.target.checked)}
              />
              Es modelo de batería
            </label>
          </div>
          {requiereVin && (
            <Field label="Días de garantía (vacío = sin póliza)">
              <input
                type="number"
                min={0}
                style={INPUT_STYLE}
                value={warrantyDays}
                onChange={(e) => setWarrantyDays(e.target.value)}
                placeholder="ej. 180"
              />
            </Field>
          )}
          <Field label="Colores disponibles">
            <div
              className="grid grid-cols-2 md:grid-cols-3 gap-1.5 p-3 rounded-xl"
              style={{ background: "var(--surf-low)" }}
            >
              {colores
                .filter((c) => c.isActive)
                .map((c) => (
                  <label
                    key={c.id}
                    className="flex items-center gap-2 text-sm text-[var(--on-surf)]"
                  >
                    <input
                      type="checkbox"
                      checked={colorIds.includes(c.id)}
                      onChange={() => toggleColor(c.id)}
                    />
                    {c.nombre}
                  </label>
                ))}
            </div>
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
