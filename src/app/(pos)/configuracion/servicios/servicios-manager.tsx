"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, Power, Wrench } from "lucide-react";
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

const SELECT_STYLE: React.CSSProperties = {
  ...INPUT_STYLE,
  appearance: "none",
  WebkitAppearance: "none",
  cursor: "pointer",
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

interface ServiceRow {
  id: string;
  name: string;
  basePrice: number;
  isActive: boolean;
  esMantenimiento: boolean;
  branchId: string;
  branchCode: string | null;
  branchName: string | null;
}

interface Branch {
  id: string;
  code: string;
  name: string;
}

const upsertSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  basePrice: z.number({ error: "Precio ≥ 0" }).nonnegative("Precio ≥ 0"),
  branchId: z.string().uuid("Selecciona una sucursal"),
  esMantenimiento: z.boolean(),
});
type UpsertValues = z.infer<typeof upsertSchema>;

function currency(n: number): string {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
  }).format(n);
}

export function ServiciosManager({
  initialServices,
  branches,
  isAdmin,
  currentBranchId,
  selectedBranchId,
}: {
  initialServices: ServiceRow[];
  branches: Branch[];
  isAdmin: boolean;
  currentBranchId: string;
  selectedBranchId: string | null;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<ServiceRow[]>(initialServices);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<ServiceRow | null>(null);

  async function onToggle(s: ServiceRow): Promise<void> {
    const next = !s.isActive;
    try {
      const res = await fetch(`/api/configuracion/servicios/${s.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo actualizar");
        return;
      }
      setRows((prev) =>
        prev.map((x) => (x.id === s.id ? { ...x, isActive: next } : x)),
      );
      toast.success(next ? "Servicio activado" : "Servicio desactivado");
      router.refresh();
    } catch {
      toast.error("Error de red");
    }
  }

  const active = rows.filter((r) => r.isActive);
  const inactive = rows.filter((r) => !r.isActive);

  return (
    <>
      <div className="flex items-center justify-between gap-4 flex-wrap">
        {isAdmin && (
          <form action="/configuracion/servicios" method="get" className="flex items-center gap-2">
            <label
              htmlFor="branchId"
              className="text-xs uppercase tracking-widest text-[var(--on-surf-var)]"
            >
              Sucursal
            </label>
            <select
              id="branchId"
              name="branchId"
              defaultValue={selectedBranchId ?? ""}
              style={{ ...SELECT_STYLE, width: 240 }}
            >
              <option value="">Todas</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="text-xs font-medium px-3 py-2 rounded-xl"
              style={{ background: "var(--surf-high)", color: "var(--on-surf)" }}
            >
              Filtrar
            </button>
          </form>
        )}
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ml-auto"
          style={{ background: "var(--p)", color: "#ffffff" }}
        >
          <Plus className="h-4 w-4" />
          Nuevo servicio
        </button>
      </div>

      <Section title={`Activos (${active.length})`}>
        <Table
          rows={active}
          isAdmin={isAdmin}
          onEdit={setEditing}
          onToggle={onToggle}
        />
      </Section>

      {inactive.length > 0 && (
        <Section title={`Inactivos (${inactive.length})`} dim>
          <Table
            rows={inactive}
            isAdmin={isAdmin}
            onEdit={setEditing}
            onToggle={onToggle}
          />
        </Section>
      )}

      {showCreate && (
        <ServiceDialog
          mode="create"
          branches={branches}
          defaultBranchId={selectedBranchId ?? currentBranchId}
          isAdmin={isAdmin}
          onClose={() => setShowCreate(false)}
          onSaved={(s) => {
            setRows((prev) => [s, ...prev]);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <ServiceDialog
          mode="edit"
          service={editing}
          branches={branches}
          defaultBranchId={editing.branchId}
          isAdmin={isAdmin}
          onClose={() => setEditing(null)}
          onSaved={(s) => {
            setRows((prev) => prev.map((x) => (x.id === s.id ? s : x)));
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

function Table({
  rows,
  isAdmin,
  onEdit,
  onToggle,
}: {
  rows: ServiceRow[];
  isAdmin: boolean;
  onEdit: (s: ServiceRow) => void;
  onToggle: (s: ServiceRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-6 text-center text-sm text-[var(--on-surf-var)]">
        Sin servicios.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
            <Th>Servicio</Th>
            <Th align="right">Precio base</Th>
            {isAdmin && <Th>Sucursal</Th>}
            <Th align="right">Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr
              key={s.id}
              style={{ borderBottom: "1px solid rgba(178,204,192,0.08)" }}
            >
              <td className="px-5 py-3 text-[var(--on-surf)]">
                <span className="inline-flex items-center gap-2">
                  {s.name}
                  {s.esMantenimiento && (
                    <span
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.625rem] font-medium uppercase tracking-[0.04em]"
                      style={{ background: "var(--p-container)", color: "var(--on-p-container)" }}
                      title="Cuenta como mantenimiento"
                    >
                      <Wrench className="h-3 w-3" />
                      Mtto
                    </span>
                  )}
                </span>
              </td>
              <td className="px-5 py-3 text-right font-medium text-[var(--on-surf)]">
                {currency(s.basePrice)}
              </td>
              {isAdmin && (
                <td className="px-5 py-3 text-[var(--on-surf-var)] text-xs">
                  {s.branchCode ?? "—"}
                </td>
              )}
              <td className="px-5 py-3 text-right">
                <div className="inline-flex items-center gap-1">
                  <button
                    onClick={() => onEdit(s)}
                    className="p-1.5 rounded-lg"
                    style={{ color: "var(--on-surf-var)" }}
                    title="Editar"
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => onToggle(s)}
                    className="p-1.5 rounded-lg"
                    style={{ color: s.isActive ? "var(--sec)" : "var(--on-surf-var)" }}
                    title={s.isActive ? "Desactivar" : "Activar"}
                  >
                    <Power className="h-4 w-4" />
                  </button>
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
      style={{ color: "var(--on-surf-var)", textAlign: align }}
    >
      {children}
    </th>
  );
}

function ServiceDialog({
  mode,
  service,
  branches,
  defaultBranchId,
  isAdmin,
  onClose,
  onSaved,
}: {
  mode: "create" | "edit";
  service?: ServiceRow;
  branches: Branch[];
  defaultBranchId: string;
  isAdmin: boolean;
  onClose: () => void;
  onSaved: (s: ServiceRow) => void;
}) {
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<UpsertValues>({
    resolver: zodResolver(upsertSchema),
    defaultValues: {
      name: service?.name ?? "",
      basePrice: service?.basePrice ?? 0,
      branchId: defaultBranchId,
      esMantenimiento: service?.esMantenimiento ?? false,
    },
  });

  const onSubmit = async (values: UpsertValues): Promise<void> => {
    setSaving(true);
    try {
      const url =
        mode === "create"
          ? "/api/configuracion/servicios"
          : `/api/configuracion/servicios/${service!.id}`;
      const method = mode === "create" ? "POST" : "PATCH";
      const body =
        mode === "create"
          ? values
          : { name: values.name, basePrice: values.basePrice, esMantenimiento: values.esMantenimiento };
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo guardar");
        return;
      }
      toast.success(mode === "create" ? "Servicio creado" : "Servicio actualizado");
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
        className="p-0 gap-0 overflow-hidden max-w-md"
        style={{
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "var(--shadow)",
          borderRadius: "var(--r-xl)",
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-heading, 'Space Grotesk')" }}>
            {mode === "create" ? "Nuevo servicio" : "Editar servicio"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-3">
          <div>
            <label style={LABEL_STYLE}>Nombre</label>
            <input {...register("name")} style={INPUT_STYLE} />
            {errors.name && (
              <p className="text-xs mt-1" style={{ color: "#dc2626" }}>
                {errors.name.message}
              </p>
            )}
          </div>
          <div>
            <label style={LABEL_STYLE}>Precio base (MXN)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              {...register("basePrice", { valueAsNumber: true })}
              style={INPUT_STYLE}
            />
            {errors.basePrice && (
              <p className="text-xs mt-1" style={{ color: "#dc2626" }}>
                {errors.basePrice.message}
              </p>
            )}
          </div>
          {mode === "create" && isAdmin && (
            <div>
              <label style={LABEL_STYLE}>Sucursal</label>
              <select {...register("branchId")} style={SELECT_STYLE}>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.code} — {b.name}
                  </option>
                ))}
              </select>
              {errors.branchId && (
                <p className="text-xs mt-1" style={{ color: "var(--ter)" }}>
                  {errors.branchId.message}
                </p>
              )}
            </div>
          )}
          <label
            className="flex items-center gap-3 cursor-pointer select-none"
            style={{
              padding: "0.75rem",
              borderRadius: "var(--r-md)",
              background: "var(--surf-low)",
            }}
          >
            <input
              type="checkbox"
              {...register("esMantenimiento")}
              className="h-4 w-4 rounded accent-[var(--p-bright)]"
            />
            <span className="text-sm" style={{ color: "var(--on-surf)" }}>
              Contar como mantenimiento (para seguimiento de pólizas)
            </span>
          </label>
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
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
