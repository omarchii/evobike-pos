"use client";

import { useState, useMemo, useRef } from "react";
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
  SIMPLE_CATEGORIA_LABELS,
  type SimpleProductRow,
} from "./shared";

const CATEGORIAS = ["ACCESORIO", "CARGADOR", "REFACCION", "BATERIA_STANDALONE"];

export function TabSimpleProducts({
  items,
  onChange,
}: {
  items: SimpleProductRow[];
  onChange: (next: SimpleProductRow[]) => void;
}) {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SimpleProductRow | null>(null);
  const [filterCategoria, setFilterCategoria] = useState<string>("");
  const [showInactive, setShowInactive] = useState(false);
  const [search, setSearch] = useState("");

  const visible = useMemo(() => {
    const q = search.toLowerCase().trim();
    return items.filter((x) => {
      if (!showInactive && !x.isActive) return false;
      if (filterCategoria && x.categoria !== filterCategoria) return false;
      if (q && !x.codigo.toLowerCase().includes(q) && !x.nombre.toLowerCase().includes(q) && !(x.descripcion ?? "").toLowerCase().includes(q)) return false;
      return true;
    });
  }, [items, filterCategoria, showInactive, search]);

  const modeloAplicableSuggestions = useMemo(() => {
    const s = new Set<string>();
    for (const it of items) if (it.modeloAplicable) s.add(it.modeloAplicable);
    return Array.from(s).sort();
  }, [items]);

  async function handleToggle(sp: SimpleProductRow): Promise<void> {
    const next = !sp.isActive;
    try {
      if (next) {
        const res = await fetch(`/api/configuracion/simple-products/${sp.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ isActive: true }),
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error ?? "No se pudo");
          return;
        }
      } else {
        const res = await fetch(`/api/configuracion/simple-products/${sp.id}`, {
          method: "DELETE",
        });
        const json = await res.json();
        if (!res.ok || !json.success) {
          toast.error(json.error ?? "No se pudo");
          return;
        }
      }
      onChange(items.map((x) => (x.id === sp.id ? { ...x, isActive: next } : x)));
      toast.success(next ? "Activado" : "Desactivado");
    } catch {
      toast.error("Error de red");
    }
  }

  return (
    <div className="space-y-4 mt-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap">
          <input
            style={{ ...INPUT_STYLE, width: 220 }}
            placeholder="Buscar código, nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <select
            value={filterCategoria}
            onChange={(e) => setFilterCategoria(e.target.value)}
            style={{ ...SELECT_STYLE, width: 240 }}
          >
            <option value="">Todas las categorías</option>
            {CATEGORIAS.map((c) => (
              <option key={c} value={c}>
                {SIMPLE_CATEGORIA_LABELS[c]}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm text-[var(--on-surf-var)]">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inactivos
          </label>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "var(--p)", color: "#ffffff" }}
        >
          <Plus className="h-4 w-4" />
          Nuevo producto
        </button>
      </div>

      <div
        className="rounded-2xl overflow-hidden"
        style={{ background: "var(--surf-lowest)", boxShadow: "var(--shadow)" }}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
                <Th>Img</Th>
                <Th>Código</Th>
                <Th>Nombre</Th>
                <Th>Categoría</Th>
                <Th>Aplica a</Th>
                <Th align="right">Precio</Th>
                <Th align="right">Costo int.</Th>
                <Th>Estado</Th>
                <Th align="right">Acciones</Th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-6 text-center text-sm text-[var(--on-surf-var)]">
                    Sin productos.
                  </td>
                </tr>
              )}
              {visible.map((sp) => (
                <tr
                  key={sp.id}
                  style={{
                    borderBottom: "1px solid var(--ghost-border-soft)",
                    opacity: sp.isActive ? 1 : 0.55,
                  }}
                >
                  <td className="px-5 py-3">
                    {sp.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sp.imageUrl}
                        alt={sp.nombre}
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
                  <td className="px-5 py-3 font-mono text-xs text-[var(--on-surf)]">{sp.codigo}</td>
                  <td className="px-5 py-3 text-[var(--on-surf)]" title={sp.descripcion ?? undefined}>
                    {sp.nombre}
                    {sp.descripcion && (
                      <div className="text-xs text-[var(--on-surf-var)] truncate max-w-[260px]">{sp.descripcion}</div>
                    )}
                  </td>
                  <td className="px-5 py-3 text-[var(--on-surf-var)]">
                    {SIMPLE_CATEGORIA_LABELS[sp.categoria] ?? sp.categoria}
                  </td>
                  <td className="px-5 py-3 text-[var(--on-surf-var)]">
                    {sp.modeloAplicable ?? "GLOBAL"}
                  </td>
                  <td className="px-5 py-3 text-right">${sp.precioPublico.toLocaleString("es-MX")}</td>
                  <td className="px-5 py-3 text-right text-[var(--on-surf-var)]">
                    ${sp.costoInterno.toLocaleString("es-MX")}
                  </td>
                  <td className="px-5 py-3 text-[var(--on-surf-var)]">
                    {sp.isActive ? "Activo" : "Inactivo"}
                  </td>
                  <td className="px-5 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <IconBtn onClick={() => setEditing(sp)} title="Editar">
                        <Pencil className="h-4 w-4" />
                      </IconBtn>
                      <IconBtn
                        onClick={() => handleToggle(sp)}
                        title={sp.isActive ? "Desactivar" : "Activar"}
                      >
                        <Power
                          className="h-4 w-4"
                          style={{ color: sp.isActive ? "var(--sec)" : "var(--on-surf-var)" }}
                        />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showCreate && (
        <SimpleProductDialog
          suggestions={modeloAplicableSuggestions}
          onClose={() => setShowCreate(false)}
          onSaved={(sp) => onChange([sp, ...items])}
        />
      )}
      {editing && (
        <SimpleProductDialog
          item={editing}
          suggestions={modeloAplicableSuggestions}
          onClose={() => setEditing(null)}
          onSaved={(sp) => onChange(items.map((x) => (x.id === sp.id ? sp : x)))}
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

function SimpleProductDialog({
  item,
  suggestions,
  onClose,
  onSaved,
}: {
  item?: SimpleProductRow;
  suggestions: string[];
  onClose: () => void;
  onSaved: (sp: SimpleProductRow) => void;
}) {
  const isEdit = !!item;
  const [saving, setSaving] = useState(false);
  const [codigo, setCodigo] = useState(item?.codigo ?? "");
  const [nombre, setNombre] = useState(item?.nombre ?? "");
  const [descripcion, setDescripcion] = useState(item?.descripcion ?? "");
  const [categoria, setCategoria] = useState(item?.categoria ?? "ACCESORIO");
  const [modeloAplicable, setModeloAplicable] = useState(item?.modeloAplicable ?? "");
  const [precioPublico, setPrecioPublico] = useState(item ? String(item.precioPublico) : "");
  const [costoInterno, setCostoInterno] = useState(item ? String(item.costoInterno) : "");
  const [stockMinimo, setStockMinimo] = useState(item ? String(item.stockMinimo) : "0");
  const [stockMaximo, setStockMaximo] = useState(item ? String(item.stockMaximo) : "0");
  const [imageUrl, setImageUrl] = useState<string | null>(item?.imageUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const datalistId = "simple-modelo-aplicable-list";

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>): Promise<void> {
    if (!item) {
      toast.error("Guarda antes de subir imagen");
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append("file", file);
    setUploading(true);
    try {
      const res = await fetch(`/api/configuracion/simple-products/${item.id}/image`, {
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
    if (!codigo.trim() || !nombre.trim()) {
      toast.error("Completa código y nombre");
      return;
    }
    const payload = {
      codigo: codigo.trim(),
      nombre: nombre.trim(),
      descripcion: descripcion.trim() || null,
      categoria,
      modeloAplicable: modeloAplicable.trim() || null,
      precioPublico: Number.parseFloat(precioPublico),
      costoInterno: Number.parseFloat(costoInterno),
      stockMinimo: Number.parseInt(stockMinimo, 10) || 0,
      stockMaximo: Number.parseInt(stockMaximo, 10) || 0,
    };
    setSaving(true);
    try {
      const res = await fetch(
        isEdit
          ? `/api/configuracion/simple-products/${item!.id}`
          : "/api/configuracion/simple-products",
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
      const sp = json.data;
      onSaved({
        id: sp.id,
        codigo: sp.codigo,
        nombre: sp.nombre,
        descripcion: sp.descripcion,
        categoria: sp.categoria,
        modeloAplicable: sp.modeloAplicable,
        precioPublico: Number(sp.precioPublico),
        costoInterno: Number(sp.costoInterno),
        stockMinimo: sp.stockMinimo,
        stockMaximo: sp.stockMaximo,
        imageUrl: sp.imageUrl ?? imageUrl,
        isActive: sp.isActive,
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
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-2xl max-h-[90vh] overflow-y-auto" style={modalStyle()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            {isEdit ? "Editar producto simple" : "Nuevo producto simple"}
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
          <div className="grid grid-cols-2 gap-3">
            <Field label="Código">
              <input
                style={{ ...INPUT_STYLE, fontFamily: "monospace" }}
                value={codigo}
                onChange={(e) => setCodigo(e.target.value)}
              />
            </Field>
            <Field label="Nombre">
              <input style={INPUT_STYLE} value={nombre} onChange={(e) => setNombre(e.target.value)} />
            </Field>
          </div>
          <Field label="Descripción">
            <textarea
              style={{ ...INPUT_STYLE, minHeight: 38, resize: "vertical" }}
              className="[field-sizing:content]"
              rows={1}
              value={descripcion ?? ""}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría">
              <select
                style={SELECT_STYLE}
                value={categoria}
                onChange={(e) => setCategoria(e.target.value)}
              >
                {CATEGORIAS.map((c) => (
                  <option key={c} value={c}>
                    {SIMPLE_CATEGORIA_LABELS[c]}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Modelo aplicable (vacío = GLOBAL)">
              <input
                style={INPUT_STYLE}
                value={modeloAplicable ?? ""}
                onChange={(e) => setModeloAplicable(e.target.value)}
                list={datalistId}
                placeholder="ej. AGUILA"
              />
              <datalist id={datalistId}>
                {suggestions.map((s) => (
                  <option key={s} value={s} />
                ))}
              </datalist>
            </Field>
            <Field label="Precio público">
              <input
                style={INPUT_STYLE}
                type="number"
                step="0.01"
                value={precioPublico}
                onChange={(e) => setPrecioPublico(e.target.value)}
              />
            </Field>
            <Field label="Costo interno">
              <input
                style={INPUT_STYLE}
                type="number"
                step="0.01"
                value={costoInterno}
                onChange={(e) => setCostoInterno(e.target.value)}
              />
            </Field>
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
