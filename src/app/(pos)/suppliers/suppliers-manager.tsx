"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Power, ExternalLink } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const INPUT_STYLE: React.CSSProperties = {
  background: "var(--surf-low)",
  border: "none",
  borderRadius: "var(--r-lg)",
  color: "var(--on-surf)",
  fontFamily: "var(--font-body, 'Inter')",
  fontSize: "0.875rem",
  height: 44,
  width: "100%",
  paddingLeft: "0.75rem",
  paddingRight: "0.75rem",
  outline: "none",
};

const TEXTAREA_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  height: "auto",
  minHeight: 80,
  paddingTop: "0.625rem",
  paddingBottom: "0.625rem",
  resize: "vertical",
};

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "0.75rem",
  fontWeight: 500,
  color: "var(--on-surf-var)",
  marginBottom: "0.375rem",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};

interface SupplierRow {
  id: string;
  nombre: string;
  rfc: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  notas: string | null;
  isActive: boolean;
  receiptCount: number;
  expenseCount: number;
}

const supplierSchema = z.object({
  nombre: z.string().trim().min(1, "Nombre requerido"),
  rfc: z.string().trim().max(20).optional().or(z.literal("")),
  contacto: z.string().trim().optional().or(z.literal("")),
  telefono: z.string().trim().optional().or(z.literal("")),
  email: z.string().trim().email("Email inválido").optional().or(z.literal("")),
  direccion: z.string().trim().optional().or(z.literal("")),
  notas: z.string().trim().optional().or(z.literal("")),
});
type SupplierValues = z.infer<typeof supplierSchema>;

export function SuppliersManager({
  initialSuppliers,
}: {
  initialSuppliers: SupplierRow[];
}) {
  const router = useRouter();
  const [suppliers, setSuppliers] = useState<SupplierRow[]>(initialSuppliers);
  const [filter, setFilter] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<SupplierRow | null>(null);

  async function handleToggleActive(s: SupplierRow): Promise<void> {
    const next = !s.isActive;
    try {
      const res = await fetch(`/api/suppliers/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo actualizar");
        return;
      }
      setSuppliers((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, isActive: next } : x)),
      );
      toast.success(next ? "Proveedor activado" : "Proveedor desactivado");
      router.refresh();
    } catch {
      toast.error("Error de red");
    }
  }

  const filterLower = filter.trim().toLowerCase();
  const matches = (s: SupplierRow): boolean => {
    if (!filterLower) return true;
    return (
      s.nombre.toLowerCase().includes(filterLower) ||
      (s.rfc?.toLowerCase().includes(filterLower) ?? false) ||
      (s.contacto?.toLowerCase().includes(filterLower) ?? false)
    );
  };

  const activeSuppliers = suppliers.filter((s) => s.isActive && matches(s));
  const inactiveSuppliers = suppliers.filter((s) => !s.isActive && matches(s));

  return (
    <>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <input
          type="search"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Buscar por nombre, RFC o contacto…"
          className="text-sm"
          style={{
            ...INPUT_STYLE,
            width: 320,
            maxWidth: "100%",
          }}
        />
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "var(--p)", color: "#ffffff" }}
        >
          <Plus className="h-4 w-4" />
          Nuevo proveedor
        </button>
      </div>

      <Section title={`Activos (${activeSuppliers.length})`}>
        <SuppliersTable
          rows={activeSuppliers}
          onEdit={setEditing}
          onToggle={handleToggleActive}
        />
      </Section>

      {inactiveSuppliers.length > 0 && (
        <Section title={`Inactivos (${inactiveSuppliers.length})`} dim>
          <SuppliersTable
            rows={inactiveSuppliers}
            onEdit={setEditing}
            onToggle={handleToggleActive}
          />
        </Section>
      )}

      {showCreate && (
        <SupplierDialog
          mode="create"
          onClose={() => setShowCreate(false)}
          onSaved={(s) => {
            setSuppliers((prev) => [
              { ...s, receiptCount: 0, expenseCount: 0 },
              ...prev,
            ]);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <SupplierDialog
          mode="edit"
          supplier={editing}
          onClose={() => setEditing(null)}
          onSaved={(s) => {
            setSuppliers((prev) =>
              prev.map((x) =>
                x.id === s.id
                  ? { ...x, ...s }
                  : x,
              ),
            );
            router.refresh();
          }}
        />
      )}
    </>
  );
}

function Section({
  title,
  dim,
  children,
}: {
  title: string;
  dim?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-2xl overflow-hidden"
      style={{
        background: "var(--surf-lowest)",
        boxShadow: "var(--shadow)",
        opacity: dim ? 0.7 : 1,
      }}
    >
      <div
        className="px-5 py-3 text-xs font-medium uppercase tracking-widest"
        style={{ color: "var(--on-surf-var)" }}
      >
        {title}
      </div>
      {children}
    </div>
  );
}

function SuppliersTable({
  rows,
  onEdit,
  onToggle,
}: {
  rows: SupplierRow[];
  onEdit: (s: SupplierRow) => void;
  onToggle: (s: SupplierRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-6 text-center text-sm text-[var(--on-surf-var)]">
        Sin proveedores.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
            <Th>Nombre</Th>
            <Th>RFC</Th>
            <Th>Contacto</Th>
            <Th>Teléfono</Th>
            <Th align="right">Recepciones</Th>
            <Th align="right">Gastos</Th>
            <Th align="right">Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.id}
              style={{ borderBottom: "1px solid var(--ghost-border-soft)" }}
            >
              <td className="px-5 py-3 text-[var(--on-surf)]">
                <Link
                  href={`/suppliers/${s.id}`}
                  className="font-medium hover:underline"
                  style={{ color: "var(--p)" }}
                >
                  {s.nombre}
                </Link>
              </td>
              <td className="px-5 py-3 text-[var(--on-surf-var)] tabular-nums">
                {s.rfc ?? "—"}
              </td>
              <td className="px-5 py-3 text-[var(--on-surf-var)]">
                {s.contacto ?? "—"}
              </td>
              <td className="px-5 py-3 text-[var(--on-surf-var)] tabular-nums">
                {s.telefono ?? "—"}
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-[var(--on-surf-var)]">
                {s.receiptCount}
              </td>
              <td className="px-5 py-3 text-right tabular-nums text-[var(--on-surf-var)]">
                {s.expenseCount}
              </td>
              <td className="px-5 py-3 text-right">
                <div className="inline-flex items-center gap-1">
                  <Link
                    href={`/suppliers/${s.id}`}
                    title="Estado de cuenta"
                    className="p-1.5 rounded-lg inline-flex items-center"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Link>
                  <IconButton onClick={() => onEdit(s)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton
                    onClick={() => onToggle(s)}
                    title={s.isActive ? "Desactivar" : "Activar"}
                  >
                    <Power
                      className="h-4 w-4"
                      style={{
                        color: s.isActive ? "var(--sec)" : "var(--on-surf-var)",
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
  );
}

function Th({
  children,
  align = "left",
}: {
  children: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className="px-5 py-3 text-xs font-medium uppercase tracking-widest"
      style={{
        color: "var(--on-surf-var)",
        textAlign: align,
      }}
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

function modalStyle(): React.CSSProperties {
  return {
    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
  };
}

interface SavedSupplier {
  id: string;
  nombre: string;
  rfc: string | null;
  contacto: string | null;
  telefono: string | null;
  email: string | null;
  direccion: string | null;
  notas: string | null;
  isActive: boolean;
}

function SupplierDialog({
  mode,
  supplier,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  supplier?: SupplierRow;
  onClose: () => void;
  onSaved: (s: SavedSupplier) => void;
}) {
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SupplierValues>({
    resolver: zodResolver(supplierSchema),
    defaultValues: {
      nombre: supplier?.nombre ?? "",
      rfc: supplier?.rfc ?? "",
      contacto: supplier?.contacto ?? "",
      telefono: supplier?.telefono ?? "",
      email: supplier?.email ?? "",
      direccion: supplier?.direccion ?? "",
      notas: supplier?.notas ?? "",
    },
  });

  const onSubmit = async (values: SupplierValues): Promise<void> => {
    setSaving(true);
    try {
      const url =
        mode === "create" ? "/api/suppliers" : `/api/suppliers/${supplier!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo guardar");
        return;
      }
      toast.success(
        mode === "create" ? "Proveedor creado" : "Proveedor actualizado",
      );
      onSaved(json.data);
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden max-w-lg"
        style={modalStyle()}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            {mode === "create" ? "Nuevo proveedor" : "Editar proveedor"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-3">
          <Field label="Nombre" error={errors.nombre?.message}>
            <input {...register("nombre")} style={INPUT_STYLE} autoFocus />
          </Field>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="RFC" error={errors.rfc?.message}>
              <input {...register("rfc")} style={INPUT_STYLE} />
            </Field>
            <Field label="Teléfono" error={errors.telefono?.message}>
              <input {...register("telefono")} style={INPUT_STYLE} />
            </Field>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Contacto" error={errors.contacto?.message}>
              <input {...register("contacto")} style={INPUT_STYLE} />
            </Field>
            <Field label="Email" error={errors.email?.message}>
              <input {...register("email")} style={INPUT_STYLE} />
            </Field>
          </div>
          <Field label="Dirección" error={errors.direccion?.message}>
            <input {...register("direccion")} style={INPUT_STYLE} />
          </Field>
          <Field label="Notas" error={errors.notas?.message}>
            <textarea {...register("notas")} style={TEXTAREA_STYLE} rows={3} />
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
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{
                background: "var(--p)",
                color: "#ffffff",
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving
                ? mode === "create"
                  ? "Creando…"
                  : "Guardando…"
                : mode === "create"
                  ? "Crear"
                  : "Guardar"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label style={LABEL_STYLE}>{label}</label>
      {children}
      {error && (
        <p className="text-xs mt-1" style={{ color: "#dc2626" }}>
          {error}
        </p>
      )}
    </div>
  );
}
