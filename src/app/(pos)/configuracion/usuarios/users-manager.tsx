"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { Plus, Pencil, KeyRound, Power, Lock } from "lucide-react";
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

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  MANAGER: "Gerente",
  SELLER: "Vendedor",
  TECHNICIAN: "Técnico",
};

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  branchId: string | null;
  branchName: string | null;
  branchCode: string | null;
  hasPin: boolean;
}

const PIN_ELIGIBLE = new Set(["MANAGER", "ADMIN"]);

interface Branch {
  id: string;
  code: string;
  name: string;
}

const createSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  password: z.string().min(8, "Mínimo 8 caracteres"),
  role: z.enum(["ADMIN", "MANAGER", "SELLER", "TECHNICIAN"]),
  branchId: z.string().uuid("Selecciona una sucursal"),
});
type CreateValues = z.infer<typeof createSchema>;

const editSchema = z.object({
  name: z.string().min(1, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  role: z.enum(["ADMIN", "MANAGER", "SELLER", "TECHNICIAN"]),
  branchId: z.string().uuid("Selecciona una sucursal"),
});
type EditValues = z.infer<typeof editSchema>;

export function UsersManager({
  initialUsers,
  branches,
  currentUserId,
}: {
  initialUsers: UserRow[];
  branches: Branch[];
  currentUserId: string;
}) {
  const router = useRouter();
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<UserRow | null>(null);
  const [resetTarget, setResetTarget] = useState<UserRow | null>(null);
  const [pinTarget, setPinTarget] = useState<UserRow | null>(null);

  async function handleToggleActive(u: UserRow): Promise<void> {
    if (u.id === currentUserId) {
      toast.error("No puedes desactivarte a ti mismo");
      return;
    }
    const next = !u.isActive;
    try {
      const res = await fetch(`/api/configuracion/usuarios/${u.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: next }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo actualizar");
        return;
      }
      setUsers((prev) => prev.map((x) => (x.id === u.id ? { ...x, isActive: next } : x)));
      toast.success(next ? "Usuario activado" : "Usuario desactivado");
      router.refresh();
    } catch {
      toast.error("Error de red");
    }
  }

  const activeUsers = users.filter((u) => u.isActive);
  const inactiveUsers = users.filter((u) => !u.isActive);

  return (
    <>
      <div className="flex justify-end">
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium"
          style={{ background: "var(--p)", color: "#ffffff" }}
        >
          <Plus className="h-4 w-4" />
          Nuevo usuario
        </button>
      </div>

      <Section title={`Activos (${activeUsers.length})`}>
        <UsersTable
          rows={activeUsers}
          currentUserId={currentUserId}
          onEdit={setEditing}
          onReset={setResetTarget}
          onPin={setPinTarget}
          onToggle={handleToggleActive}
        />
      </Section>

      {inactiveUsers.length > 0 && (
        <Section title={`Inactivos (${inactiveUsers.length})`} dim>
          <UsersTable
            rows={inactiveUsers}
            currentUserId={currentUserId}
            onEdit={setEditing}
            onReset={setResetTarget}
            onPin={setPinTarget}
            onToggle={handleToggleActive}
          />
        </Section>
      )}

      {showCreate && (
        <CreateUserDialog
          branches={branches}
          onClose={() => setShowCreate(false)}
          onCreated={(u) => {
            setUsers((prev) => [u, ...prev]);
            router.refresh();
          }}
        />
      )}
      {editing && (
        <EditUserDialog
          user={editing}
          branches={branches}
          onClose={() => setEditing(null)}
          onSaved={(u) => {
            setUsers((prev) => prev.map((x) => (x.id === u.id ? u : x)));
            router.refresh();
          }}
        />
      )}
      {resetTarget && (
        <ResetPasswordDialog
          user={resetTarget}
          onClose={() => setResetTarget(null)}
        />
      )}
      {pinTarget && (
        <SetPinDialog
          user={pinTarget}
          onClose={() => setPinTarget(null)}
          onChanged={(hasPin) => {
            setUsers((prev) =>
              prev.map((x) => (x.id === pinTarget.id ? { ...x, hasPin } : x)),
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

function UsersTable({
  rows,
  currentUserId,
  onEdit,
  onReset,
  onPin,
  onToggle,
}: {
  rows: UserRow[];
  currentUserId: string;
  onEdit: (u: UserRow) => void;
  onReset: (u: UserRow) => void;
  onPin: (u: UserRow) => void;
  onToggle: (u: UserRow) => void;
}) {
  if (rows.length === 0) {
    return (
      <div className="px-5 py-6 text-center text-sm text-[var(--on-surf-var)]">
        Sin usuarios.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr style={{ borderBottom: "1px solid var(--ghost-border)" }}>
            <Th>Nombre</Th>
            <Th>Email</Th>
            <Th>Rol</Th>
            <Th>Sucursal</Th>
            <Th align="right">Acciones</Th>
          </tr>
        </thead>
        <tbody>
          {rows.map((u) => (
            <tr
              key={u.id}
              style={{ borderBottom: "1px solid var(--ghost-border-soft)" }}
            >
              <td className="px-5 py-3 text-[var(--on-surf)]">{u.name}</td>
              <td className="px-5 py-3 text-[var(--on-surf-var)]">{u.email}</td>
              <td className="px-5 py-3">
                <div className="inline-flex items-center gap-2">
                  <span
                    className="inline-block px-2.5 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: "var(--p-container)",
                      color: "var(--on-p-container)",
                    }}
                  >
                    {ROLE_LABELS[u.role] ?? u.role}
                  </span>
                  {PIN_ELIGIBLE.has(u.role) && !u.hasPin && (
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium uppercase tracking-wide"
                      style={{
                        background: "rgba(220, 38, 38, 0.12)",
                        color: "#dc2626",
                      }}
                      title="Este usuario aún no tiene PIN de autorización"
                    >
                      Sin PIN
                    </span>
                  )}
                </div>
              </td>
              <td className="px-5 py-3 text-[var(--on-surf-var)]">
                {u.branchCode ? `${u.branchCode} — ${u.branchName}` : "—"}
              </td>
              <td className="px-5 py-3 text-right">
                <div className="inline-flex items-center gap-1">
                  <IconButton onClick={() => onEdit(u)} title="Editar">
                    <Pencil className="h-4 w-4" />
                  </IconButton>
                  <IconButton onClick={() => onReset(u)} title="Resetear contraseña">
                    <KeyRound className="h-4 w-4" />
                  </IconButton>
                  {PIN_ELIGIBLE.has(u.role) && (
                    <IconButton
                      onClick={() => onPin(u)}
                      title={u.hasPin ? "Cambiar PIN de autorización" : "Establecer PIN de autorización"}
                    >
                      <Lock
                        className="h-4 w-4"
                        style={{ color: u.hasPin ? "var(--sec)" : "var(--on-surf-var)" }}
                      />
                    </IconButton>
                  )}
                  <IconButton
                    onClick={() => onToggle(u)}
                    title={u.isActive ? "Desactivar" : "Activar"}
                    disabled={u.id === currentUserId}
                  >
                    <Power
                      className="h-4 w-4"
                      style={{ color: u.isActive ? "var(--sec)" : "var(--on-surf-var)" }}
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

function modalStyle(): React.CSSProperties {
  return {
    background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
    backdropFilter: "blur(20px)",
    WebkitBackdropFilter: "blur(20px)",
    boxShadow: "var(--shadow)",
    borderRadius: "var(--r-xl)",
  };
}

function CreateUserDialog({
  branches,
  onClose,
  onCreated,
}: {
  branches: Branch[];
  onClose: () => void;
  onCreated: (u: UserRow) => void;
}) {
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CreateValues>({
    resolver: zodResolver(createSchema),
    defaultValues: {
      name: "",
      email: "",
      password: "",
      role: "SELLER",
      branchId: branches[0]?.id ?? "",
    },
  });

  const onSubmit = async (values: CreateValues): Promise<void> => {
    setSaving(true);
    try {
      const res = await fetch("/api/configuracion/usuarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo crear");
        return;
      }
      toast.success("Usuario creado");
      onCreated({
        ...json.data,
        branchCode: json.data.branch?.code ?? null,
        branchName: json.data.branch?.name ?? null,
        hasPin: false,
      });
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-lg" style={modalStyle()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            Nuevo usuario
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-3">
          <Field label="Nombre" error={errors.name?.message}>
            <input {...register("name")} style={INPUT_STYLE} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input {...register("email")} style={INPUT_STYLE} />
          </Field>
          <Field label="Contraseña inicial" error={errors.password?.message}>
            <input type="password" {...register("password")} style={INPUT_STYLE} />
          </Field>
          <Field label="Rol" error={errors.role?.message}>
            <select {...register("role")} style={SELECT_STYLE}>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Gerente</option>
              <option value="SELLER">Vendedor</option>
              <option value="TECHNICIAN">Técnico</option>
            </select>
          </Field>
          <Field label="Sucursal" error={errors.branchId?.message}>
            <select {...register("branchId")} style={SELECT_STYLE}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
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
              {saving ? "Creando…" : "Crear usuario"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditUserDialog({
  user,
  branches,
  onClose,
  onSaved,
}: {
  user: UserRow;
  branches: Branch[];
  onClose: () => void;
  onSaved: (u: UserRow) => void;
}) {
  const [saving, setSaving] = useState(false);
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<EditValues>({
    resolver: zodResolver(editSchema),
    defaultValues: {
      name: user.name,
      email: user.email,
      role: user.role as EditValues["role"],
      branchId: user.branchId ?? branches[0]?.id ?? "",
    },
  });

  const onSubmit = async (values: EditValues): Promise<void> => {
    setSaving(true);
    try {
      const res = await fetch(`/api/configuracion/usuarios/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo actualizar");
        return;
      }
      toast.success("Usuario actualizado");
      onSaved({
        ...json.data,
        branchCode: json.data.branch?.code ?? null,
        branchName: json.data.branch?.name ?? null,
        hasPin: user.hasPin,
      });
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-lg" style={modalStyle()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            Editar usuario
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="px-6 pb-6 space-y-3">
          <Field label="Nombre" error={errors.name?.message}>
            <input {...register("name")} style={INPUT_STYLE} />
          </Field>
          <Field label="Email" error={errors.email?.message}>
            <input {...register("email")} style={INPUT_STYLE} />
          </Field>
          <Field label="Rol" error={errors.role?.message}>
            <select {...register("role")} style={SELECT_STYLE}>
              <option value="ADMIN">Admin</option>
              <option value="MANAGER">Gerente</option>
              <option value="SELLER">Vendedor</option>
              <option value="TECHNICIAN">Técnico</option>
            </select>
          </Field>
          <Field label="Sucursal" error={errors.branchId?.message}>
            <select {...register("branchId")} style={SELECT_STYLE}>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.code} — {b.name}
                </option>
              ))}
            </select>
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
              {saving ? "Guardando…" : "Guardar"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ResetPasswordDialog({
  user,
  onClose,
}: {
  user: UserRow;
  onClose: () => void;
}) {
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("La contraseña debe tener al menos 8 caracteres");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(
        `/api/configuracion/usuarios/${user.id}/reset-password`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password }),
        },
      );
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo resetear");
        return;
      }
      toast.success("Contraseña actualizada");
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-md" style={modalStyle()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            Resetear contraseña
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="px-6 pb-6 space-y-3">
          <p className="text-sm text-[var(--on-surf-var)]">
            Nueva contraseña para <strong>{user.name}</strong> ({user.email}).
          </p>
          <Field label="Nueva contraseña">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={INPUT_STYLE}
              autoFocus
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
              type="submit"
              disabled={saving}
              className="px-4 py-2 rounded-xl text-sm font-medium"
              style={{
                background: "var(--p)",
                color: "#ffffff",
                opacity: saving ? 0.5 : 1,
              }}
            >
              {saving ? "Guardando…" : "Actualizar"}
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function SetPinDialog({
  user,
  onClose,
  onChanged,
}: {
  user: UserRow;
  onClose: () => void;
  onChanged: (hasPin: boolean) => void;
}) {
  const [pin, setPin] = useState("");
  const [confirmPin, setConfirmPin] = useState("");
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);

  const onSubmit = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();
    if (!/^\d{4,6}$/.test(pin)) {
      toast.error("El PIN debe ser de 4 a 6 dígitos numéricos");
      return;
    }
    if (pin !== confirmPin) {
      toast.error("Los PINs no coinciden");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/configuracion/usuarios/${user.id}/pin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo guardar el PIN");
        return;
      }
      toast.success(user.hasPin ? "PIN actualizado" : "PIN establecido");
      onChanged(true);
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setSaving(false);
    }
  };

  const onRemove = async (): Promise<void> => {
    if (!confirm("¿Eliminar el PIN de este usuario? No podrá autorizar hasta que configure uno nuevo.")) return;
    setRemoving(true);
    try {
      const res = await fetch(`/api/configuracion/usuarios/${user.id}/pin`, {
        method: "DELETE",
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        toast.error(json.error ?? "No se pudo eliminar el PIN");
        return;
      }
      toast.success("PIN eliminado");
      onChanged(false);
      onClose();
    } catch {
      toast.error("Error de red");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="p-0 gap-0 overflow-hidden max-w-md" style={modalStyle()}>
        <DialogHeader className="px-6 pt-6 pb-2">
          <DialogTitle style={{ fontFamily: "var(--font-display)" }}>
            {user.hasPin ? "Cambiar PIN" : "Establecer PIN"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={onSubmit} className="px-6 pb-6 space-y-3">
          <p className="text-sm text-[var(--on-surf-var)]">
            PIN de autorización para <strong>{user.name}</strong>. Se usa para aprobar cancelaciones y descuentos en el POS.
          </p>
          <Field label="Nuevo PIN (4 a 6 dígitos)">
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              style={INPUT_STYLE}
              autoFocus
            />
          </Field>
          <Field label="Confirmar PIN">
            <input
              type="password"
              inputMode="numeric"
              pattern="\d*"
              maxLength={6}
              value={confirmPin}
              onChange={(e) => setConfirmPin(e.target.value.replace(/\D/g, ""))}
              style={INPUT_STYLE}
            />
          </Field>
          <div className="flex items-center justify-between gap-2 pt-2">
            <div>
              {user.hasPin && (
                <button
                  type="button"
                  onClick={onRemove}
                  disabled={removing || saving}
                  className="px-3 py-2 rounded-xl text-sm font-medium"
                  style={{
                    background: "rgba(220, 38, 38, 0.12)",
                    color: "#dc2626",
                    opacity: removing || saving ? 0.5 : 1,
                  }}
                >
                  {removing ? "Eliminando…" : "Eliminar PIN"}
                </button>
              )}
            </div>
            <div className="inline-flex items-center gap-2">
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
                disabled={saving || removing}
                className="px-4 py-2 rounded-xl text-sm font-medium"
                style={{
                  background: "var(--p)",
                  color: "#ffffff",
                  opacity: saving || removing ? 0.5 : 1,
                }}
              >
                {saving ? "Guardando…" : "Guardar"}
              </button>
            </div>
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
