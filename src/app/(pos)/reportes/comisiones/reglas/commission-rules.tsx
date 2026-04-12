"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Plus,
  Pencil,
  ToggleLeft,
  ToggleRight,
  Percent,
  DollarSign,
  ShieldCheck,
  ArrowLeft,
} from "lucide-react";
import type { RuleRow, ModeloOption } from "./page";
import Link from "next/link";

// ── Props ────────────────────────────────────────────────────────────────────

interface CommissionRulesProps {
  initialRules: RuleRow[];
  modelos: ModeloOption[];
  role: string;
}

// ── Constants ────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  SELLER: "Vendedor",
  TECHNICIAN: "Técnico",
  MANAGER: "Gerente",
};

const ROLE_OPTIONS = [
  { value: "SELLER", label: "Vendedor" },
  { value: "TECHNICIAN", label: "Técnico" },
  { value: "MANAGER", label: "Gerente" },
] as const;

// ── Main Component ──────────────────────────────────────────────────────────

export function CommissionRules({
  initialRules,
  modelos,
  role: _userRole,
}: CommissionRulesProps): React.JSX.Element {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rules, setRules] = useState<RuleRow[]>(initialRules);
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<RuleRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formRole, setFormRole] = useState("SELLER");
  const [formType, setFormType] = useState<"PERCENTAGE" | "FIXED_AMOUNT">("PERCENTAGE");
  const [formValue, setFormValue] = useState("");
  const [formModeloId, setFormModeloId] = useState<string>("__all__");

  function openCreate(): void {
    setEditingRule(null);
    setFormRole("SELLER");
    setFormType("PERCENTAGE");
    setFormValue("");
    setFormModeloId("__all__");
    setError(null);
    setShowModal(true);
  }

  function openEdit(rule: RuleRow): void {
    setEditingRule(rule);
    setFormRole(rule.role);
    setFormType(rule.commissionType);
    setFormValue(String(rule.value));
    setFormModeloId(rule.modeloId ?? "__all__");
    setError(null);
    setShowModal(true);
  }

  async function handleSave(): Promise<void> {
    const val = parseFloat(formValue);
    if (isNaN(val) || val <= 0) {
      setError("Ingresa un valor positivo.");
      return;
    }

    setSaving(true);
    setError(null);

    const payload = {
      role: formRole,
      commissionType: formType,
      value: val,
      modeloId: formModeloId === "__all__" ? null : formModeloId,
    };

    try {
      const url = editingRule
        ? `/api/comisiones/reglas/${editingRule.id}`
        : "/api/comisiones/reglas";
      const method = editingRule ? "PATCH" : "POST";

      const body = editingRule
        ? { commissionType: formType, value: val }
        : payload;

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Error al guardar");
        setSaving(false);
        return;
      }

      setShowModal(false);
      startTransition(() => router.refresh());
      // Optimistic update
      if (editingRule) {
        setRules((prev) =>
          prev.map((r) => (r.id === editingRule.id ? json.data : r)),
        );
      } else {
        setRules((prev) => [json.data, ...prev]);
      }
    } catch {
      setError("Error de conexión");
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(rule: RuleRow): Promise<void> {
    try {
      const res = await fetch(`/api/comisiones/reglas/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });

      const json = await res.json();
      if (!json.success) {
        setError(json.error ?? "Error al actualizar");
        return;
      }

      setRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, isActive: !r.isActive } : r)),
      );
      startTransition(() => router.refresh());
    } catch {
      setError("Error de conexión");
    }
  }

  const activeRules = rules.filter((r) => r.isActive);
  const inactiveRules = rules.filter((r) => !r.isActive);

  return (
    <div className="min-h-screen p-6" style={{ background: "var(--surface)" }}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link
          href="/reportes/comisiones"
          className="flex items-center justify-center w-8 h-8 rounded-lg transition-colors"
          style={{ background: "var(--surf-high)", color: "var(--on-surf-var)" }}
        >
          <ArrowLeft size={16} />
        </Link>
        <div className="flex-1">
          <h1
            className="text-2xl font-bold"
            style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
          >
            Reglas de Comisión
          </h1>
          <p className="text-xs mt-1" style={{ color: "var(--on-surf-var)" }}>
            Configura las comisiones por rol y modelo de vehículo
          </p>
        </div>
        <button
          onClick={openCreate}
          className="flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-all"
          style={{
            background: "linear-gradient(135deg, #1b4332, #2ecc71)",
            color: "#fff",
          }}
        >
          <Plus size={16} />
          Nueva regla
        </button>
      </div>

      {error && (
        <div
          className="mb-4 px-4 py-3 rounded-lg text-sm"
          style={{
            background: "var(--ter-container)",
            color: "var(--on-ter-container)",
          }}
        >
          {error}
          <button
            onClick={() => setError(null)}
            className="ml-3 underline text-xs"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Active Rules */}
      <div
        className="rounded-2xl mb-6 overflow-hidden"
        style={{
          background: "var(--surf-lowest)",
          boxShadow: "var(--shadow)",
        }}
      >
        <div className="px-5 py-4 flex items-center gap-2">
          <ShieldCheck size={16} style={{ color: "var(--sec)" }} />
          <span
            className="text-xs font-medium uppercase tracking-wider"
            style={{ color: "var(--on-surf-var)", letterSpacing: "0.05em" }}
          >
            Reglas Activas ({activeRules.length})
          </span>
        </div>

        {activeRules.length === 0 ? (
          <div
            className="px-5 py-8 text-center text-sm"
            style={{ color: "var(--on-surf-var)" }}
          >
            No hay reglas activas. Crea una para comenzar a generar comisiones.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(178,204,192,0.15)" }}>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Rol
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Tipo
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Valor
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Modelo
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {activeRules.map((rule) => (
                  <RuleTableRow
                    key={rule.id}
                    rule={rule}
                    onEdit={() => openEdit(rule)}
                    onToggle={() => handleToggleActive(rule)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Inactive Rules */}
      {inactiveRules.length > 0 && (
        <div
          className="rounded-2xl overflow-hidden"
          style={{
            background: "var(--surf-lowest)",
            boxShadow: "var(--shadow)",
            opacity: 0.7,
          }}
        >
          <div className="px-5 py-4">
            <span
              className="text-xs font-medium uppercase tracking-wider"
              style={{ color: "var(--on-surf-var)", letterSpacing: "0.05em" }}
            >
              Inactivas ({inactiveRules.length})
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr style={{ borderBottom: "1px solid rgba(178,204,192,0.15)" }}>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Rol
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Tipo
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Valor
                  </th>
                  <th className="text-left px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Modelo
                  </th>
                  <th className="text-right px-5 py-3 text-xs font-medium uppercase tracking-wider" style={{ color: "var(--on-surf-var)" }}>
                    Acciones
                  </th>
                </tr>
              </thead>
              <tbody>
                {inactiveRules.map((rule) => (
                  <RuleTableRow
                    key={rule.id}
                    rule={rule}
                    onEdit={() => openEdit(rule)}
                    onToggle={() => handleToggleActive(rule)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: "rgba(0,0,0,0.4)" }}
          onClick={() => !saving && setShowModal(false)}
        >
          <div
            className="w-full max-w-md mx-4 rounded-2xl p-6"
            style={{
              background: "var(--surf-bright)",
              backdropFilter: "blur(20px)",
              boxShadow: "var(--shadow)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2
              className="text-lg font-bold mb-5"
              style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
            >
              {editingRule ? "Editar regla" : "Nueva regla de comisión"}
            </h2>

            <div className="space-y-4">
              {/* Role select */}
              <div>
                <label
                  className="block text-xs font-medium uppercase tracking-wider mb-1.5"
                  style={{ color: "var(--on-surf-var)", letterSpacing: "0.05em" }}
                >
                  Rol
                </label>
                <select
                  value={formRole}
                  onChange={(e) => setFormRole(e.target.value)}
                  disabled={!!editingRule}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{
                    background: "var(--surf-lowest)",
                    color: "var(--on-surf)",
                    border: "1px solid rgba(178,204,192,0.15)",
                    opacity: editingRule ? 0.6 : 1,
                  }}
                >
                  {ROLE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Commission type */}
              <div>
                <label
                  className="block text-xs font-medium uppercase tracking-wider mb-1.5"
                  style={{ color: "var(--on-surf-var)", letterSpacing: "0.05em" }}
                >
                  Tipo de comisión
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setFormType("PERCENTAGE")}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background:
                        formType === "PERCENTAGE"
                          ? "var(--p-container)"
                          : "var(--surf-lowest)",
                      color:
                        formType === "PERCENTAGE"
                          ? "var(--on-p-container)"
                          : "var(--on-surf-var)",
                      border: "1px solid rgba(178,204,192,0.15)",
                    }}
                  >
                    <Percent size={14} />
                    Porcentaje
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormType("FIXED_AMOUNT")}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium transition-all"
                    style={{
                      background:
                        formType === "FIXED_AMOUNT"
                          ? "var(--p-container)"
                          : "var(--surf-lowest)",
                      color:
                        formType === "FIXED_AMOUNT"
                          ? "var(--on-p-container)"
                          : "var(--on-surf-var)",
                      border: "1px solid rgba(178,204,192,0.15)",
                    }}
                  >
                    <DollarSign size={14} />
                    Monto fijo
                  </button>
                </div>
              </div>

              {/* Value */}
              <div>
                <label
                  className="block text-xs font-medium uppercase tracking-wider mb-1.5"
                  style={{ color: "var(--on-surf-var)", letterSpacing: "0.05em" }}
                >
                  {formType === "PERCENTAGE" ? "Porcentaje (%)" : "Monto fijo (MXN)"}
                </label>
                <input
                  type="number"
                  value={formValue}
                  onChange={(e) => setFormValue(e.target.value)}
                  placeholder={formType === "PERCENTAGE" ? "3.5" : "50.00"}
                  step={formType === "PERCENTAGE" ? "0.01" : "1"}
                  min="0"
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{
                    background: "var(--surf-lowest)",
                    color: "var(--on-surf)",
                    border: "1px solid rgba(178,204,192,0.15)",
                  }}
                />
              </div>

              {/* Modelo select */}
              <div>
                <label
                  className="block text-xs font-medium uppercase tracking-wider mb-1.5"
                  style={{ color: "var(--on-surf-var)", letterSpacing: "0.05em" }}
                >
                  Modelo
                </label>
                <select
                  value={formModeloId}
                  onChange={(e) => setFormModeloId(e.target.value)}
                  disabled={!!editingRule}
                  className="w-full px-3 py-2 rounded-xl text-sm"
                  style={{
                    background: "var(--surf-lowest)",
                    color: "var(--on-surf)",
                    border: "1px solid rgba(178,204,192,0.15)",
                    opacity: editingRule ? 0.6 : 1,
                  }}
                >
                  <option value="__all__">Todos los modelos</option>
                  {modelos.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.nombre}
                    </option>
                  ))}
                </select>
              </div>

              {error && (
                <p className="text-xs" style={{ color: "var(--ter)" }}>
                  {error}
                </p>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                disabled={saving}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-medium transition-all"
                style={{
                  background: "var(--surf-high)",
                  color: "var(--on-surf)",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleSave}
                disabled={saving || isPending}
                className="flex-1 px-4 py-2.5 rounded-full text-sm font-semibold transition-all"
                style={{
                  background: "linear-gradient(135deg, #1b4332, #2ecc71)",
                  color: "#fff",
                  opacity: saving ? 0.6 : 1,
                }}
              >
                {saving ? "Guardando..." : editingRule ? "Actualizar" : "Crear"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Table Row Component ─────────────────────────────────────────────────────

function RuleTableRow({
  rule,
  onEdit,
  onToggle,
}: {
  rule: RuleRow;
  onEdit: () => void;
  onToggle: () => void;
}): React.JSX.Element {
  return (
    <tr
      className="transition-colors"
      style={{
        borderBottom: "1px solid rgba(178,204,192,0.08)",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = "var(--surf-high)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      <td className="px-5 py-3">
        <span
          className="inline-block px-2.5 py-1 rounded-full text-xs font-medium"
          style={{
            background: "var(--p-container)",
            color: "var(--on-p-container)",
          }}
        >
          {ROLE_LABELS[rule.role] ?? rule.role}
        </span>
      </td>
      <td className="px-5 py-3">
        <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--on-surf)" }}>
          {rule.commissionType === "PERCENTAGE" ? (
            <Percent size={12} style={{ color: "var(--sec)" }} />
          ) : (
            <DollarSign size={12} style={{ color: "var(--sec)" }} />
          )}
          {rule.commissionType === "PERCENTAGE" ? "Porcentaje" : "Monto fijo"}
        </span>
      </td>
      <td
        className="px-5 py-3 text-right text-sm font-semibold"
        style={{ fontFamily: "var(--font-display)", color: "var(--on-surf)" }}
      >
        {rule.commissionType === "PERCENTAGE"
          ? `${rule.value}%`
          : `$${rule.value.toFixed(2)}`}
      </td>
      <td className="px-5 py-3 text-xs" style={{ color: "var(--on-surf)" }}>
        {rule.modeloNombre ?? (
          <span style={{ color: "var(--on-surf-var)" }}>Todos</span>
        )}
      </td>
      <td className="px-5 py-3 text-right">
        <div className="flex items-center justify-end gap-2">
          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg transition-colors"
            style={{ color: "var(--on-surf-var)" }}
            title="Editar"
          >
            <Pencil size={14} />
          </button>
          <button
            onClick={onToggle}
            className="p-1.5 rounded-lg transition-colors"
            style={{
              color: rule.isActive ? "var(--sec)" : "var(--on-surf-var)",
            }}
            title={rule.isActive ? "Desactivar" : "Activar"}
          >
            {rule.isActive ? (
              <ToggleRight size={18} />
            ) : (
              <ToggleLeft size={18} />
            )}
          </button>
        </div>
      </td>
    </tr>
  );
}
