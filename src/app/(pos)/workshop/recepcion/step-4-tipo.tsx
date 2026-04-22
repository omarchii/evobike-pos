"use client";

import { useState } from "react";
import { useWatch, useFieldArray } from "react-hook-form";
import type { Control, UseFormSetValue, UseFormGetValues, FieldErrors } from "react-hook-form";
import {
  CreditCard,
  ShieldCheck,
  Gift,
  Star,
  Plus,
  Trash2,
  X,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { TechnicianOption } from "@/lib/workshop-types";
import type { WizardFormData, ServiceOption } from "./recepcion-wizard";
import { SERVICE_ORDER_TYPES } from "@/lib/workshop-enums";

const ORDER_TYPE_CONFIG: Record<
  (typeof SERVICE_ORDER_TYPES)[number],
  { icon: React.ElementType; label: string; desc: string }
> = {
  PAID: { icon: CreditCard, label: "Pagada", desc: "El cliente cubre el costo del servicio" },
  WARRANTY: { icon: ShieldCheck, label: "Garantía", desc: "Cubierta por garantía del producto" },
  COURTESY: { icon: Gift, label: "Cortesía", desc: "Servicio sin costo para el cliente" },
  POLICY_MAINTENANCE: { icon: Star, label: "Mantenimiento Póliza", desc: "Incluido en póliza de mantenimiento" },
};

// ⚠️ Encontré esto también: Branch.ivaPct no existe en el schema.
// Se usa IVA fijo de 16% como placeholder hasta que se modele el campo.
const IVA_PCT = 0.16;

interface Step4Props {
  control: Control<WizardFormData>;
  setValue: UseFormSetValue<WizardFormData>;
  getValues: UseFormGetValues<WizardFormData>;
  errors: FieldErrors<WizardFormData>;
  technicians: TechnicianOption[];
  maintenanceServices: { id: string; name: string; basePrice: number }[];
  allServices: ServiceOption[];
}

function SummaryPanel({
  control,
  collapsed,
  onToggle,
}: {
  control: Control<WizardFormData>;
  collapsed: boolean;
  onToggle: () => void;
}) {
  const items = useWatch({ control, name: "items" }) ?? [];
  const subtotal = items.reduce((acc, item) => acc + (item.price ?? 0) * (item.quantity ?? 1), 0);
  const iva = subtotal * IVA_PCT;
  const total = subtotal + iva;

  return (
    <div
      className="rounded-xl overflow-hidden"
      style={{ background: "var(--surf-low)" }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 md:cursor-default"
        aria-expanded={!collapsed}
      >
        <span className="text-sm font-semibold" style={{ color: "var(--on-surf)" }}>
          Resumen de orden
        </span>
        <span className="md:hidden">
          {collapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
        </span>
      </button>

      <div className={`${collapsed ? "hidden" : "block"} md:block px-4 pb-4 space-y-2`}>
        {items.length === 0 ? (
          <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
            Sin ítems agregados.
          </p>
        ) : (
          <>
            {items.map((item, idx) => (
              <div key={idx} className="flex justify-between gap-2 text-xs">
                <span style={{ color: "var(--on-surf)" }}>
                  {item.description} ×{item.quantity}
                </span>
                <span className="shrink-0" style={{ color: "var(--on-surf)" }}>
                  ${(item.price * item.quantity).toFixed(2)}
                </span>
              </div>
            ))}

            <div
              className="pt-2 mt-2"
              style={{ borderTop: "1px solid var(--ghost-border, rgba(0,0,0,0.08))" }}
            >
              <div className="flex justify-between text-xs">
                <span style={{ color: "var(--on-surf-var)" }}>Subtotal</span>
                <span style={{ color: "var(--on-surf)" }}>${subtotal.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-xs mt-1">
                <span style={{ color: "var(--on-surf-var)" }}>IVA (16%)</span>
                <span style={{ color: "var(--on-surf)" }}>${iva.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm font-semibold mt-2">
                <span style={{ color: "var(--on-surf)" }}>Total estimado</span>
                <span style={{ color: "var(--p)" }}>${total.toFixed(2)}</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export function Step4Tipo({
  control,
  setValue,
  getValues,
  errors,
  technicians,
  maintenanceServices,
  allServices,
}: Step4Props) {
  const [showAddService, setShowAddService] = useState(false);
  const [summaryCollapsed, setSummaryCollapsed] = useState(true);
  const [laborMinutes, setLaborMinutes] = useState<Record<string, number>>({});

  const { fields, append, remove } = useFieldArray({ control, name: "items" });
  const selectedType = useWatch({ control, name: "type" });
  const customerBikeId = useWatch({ control, name: "customerBikeId" });

  const maintIds = new Set(maintenanceServices.map((s) => s.id));

  const addService = (svc: ServiceOption) => {
    if (svc.chargeModel === "HOURLY") {
      const mins = laborMinutes[svc.id] ?? 60;
      const pricePerMin = svc.basePrice / 60;
      append({
        serviceCatalogId: svc.id,
        description: svc.name,
        quantity: 1,
        price: Number((pricePerMin * mins).toFixed(2)),
      });
    } else {
      append({
        serviceCatalogId: svc.id,
        description: svc.name,
        quantity: 1,
        price: svc.basePrice,
      });
    }
    setShowAddService(false);
  };

  const today = new Date().toISOString().slice(0, 10);

  return (
    <section aria-labelledby="step4-title" className="space-y-6">
      <h2 id="step4-title" className="sr-only">
        Paso 4: Tipo, técnico e ítems
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Tipo de orden */}
          <div className="space-y-3">
            <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
              Tipo de orden
            </p>
            <div className="grid grid-cols-2 gap-2">
              {SERVICE_ORDER_TYPES.map((type) => {
                const cfg = ORDER_TYPE_CONFIG[type];
                const Icon = cfg.icon;
                const isSelected = selectedType === type;
                const isDisabled = type === "POLICY_MAINTENANCE" && !customerBikeId;
                const isPolicyType = type === "POLICY_MAINTENANCE";

                return (
                  <button
                    key={type}
                    type="button"
                    disabled={isDisabled}
                    onClick={() => setValue("type", type)}
                    className="text-left rounded-xl p-3 transition-all"
                    style={{
                      background: isSelected
                        ? isPolicyType
                          ? "var(--warn-container, rgba(245,124,0,0.12))"
                          : "rgba(var(--p-rgb, 27,67,50),0.10)"
                        : "var(--surf-low)",
                      border: `1.5px solid ${isSelected ? (isPolicyType ? "#f57c00" : "var(--p)") : "transparent"}`,
                      opacity: isDisabled ? 0.4 : 1,
                      cursor: isDisabled ? "not-allowed" : "pointer",
                    }}
                    aria-pressed={isSelected}
                    title={isDisabled ? "Selecciona una bicicleta registrada en el paso 1" : undefined}
                  >
                    <Icon
                      size={16}
                      style={{ color: isSelected ? (isPolicyType ? "#f57c00" : "var(--p)") : "var(--on-surf-var)" }}
                      aria-hidden
                    />
                    <p
                      className="mt-1.5 text-sm font-semibold"
                      style={{ color: isSelected ? "var(--on-surf)" : "var(--on-surf-var)" }}
                    >
                      {cfg.label}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                      {cfg.desc}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Técnico asignado */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
              Técnico asignado (opcional)
            </label>
            <select
              value={getValues("assignedTechId") ?? ""}
              onChange={(e) => setValue("assignedTechId", e.target.value || null)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--surf-low)", color: "var(--on-surf)" }}
              aria-label="Seleccionar técnico"
            >
              <option value="">— Sin asignar —</option>
              {technicians.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.role === "TECHNICIAN" ? "Técnico" : "Encargado"})
                </option>
              ))}
            </select>
          </div>

          {/* Items list */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                Servicios / ítems
              </p>
              <button
                type="button"
                onClick={() => setShowAddService(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                style={{ background: "var(--surf-low)", color: "var(--p)" }}
              >
                <Plus size={12} />
                Agregar servicio
              </button>
            </div>

            {fields.length === 0 ? (
              <p className="text-sm py-4 text-center" style={{ color: "var(--on-surf-var)" }}>
                Sin ítems. Agrega servicios con el botón de arriba.
              </p>
            ) : (
              <div className="space-y-2">
                {fields.map((field, index) => {
                  const isMaintItem = maintIds.has(field.serviceCatalogId ?? "");
                  return (
                    <div
                      key={field.id}
                      className="flex items-center gap-3 rounded-xl px-3 py-2.5"
                      style={{ background: "var(--surf-low)" }}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate" style={{ color: "var(--on-surf)" }}>
                            {field.description}
                          </p>
                          {isMaintItem && (
                            <span
                              className="px-1.5 py-0.5 rounded text-xs font-medium shrink-0"
                              style={{ background: "rgba(245,124,0,0.15)", color: "#f57c00" }}
                            >
                              Póliza
                            </span>
                          )}
                        </div>
                        <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                          ×{field.quantity} — ${(field.price * field.quantity).toFixed(2)}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => remove(index)}
                        className="shrink-0 rounded-lg p-1.5 transition-colors hover:bg-[var(--surf-bright)]"
                        aria-label={`Quitar ${field.description}`}
                      >
                        <Trash2 size={13} style={{ color: "var(--on-surf-var)" }} />
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Diagnosis */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
              Diagnóstico inicial (opcional)
            </label>
            <textarea
              rows={3}
              placeholder="Diagnóstico inicial (opcional) — síntomas o problemas reportados por el cliente"
              value={getValues("diagnosis") ?? ""}
              onChange={(e) => setValue("diagnosis", e.target.value)}
              className="w-full rounded-xl px-3 py-2.5 text-sm outline-none resize-none"
              style={{ background: "var(--surf-low)", color: "var(--on-surf)" }}
              aria-label="Diagnóstico inicial (opcional)"
            />
            {errors.diagnosis && (
              <p className="text-xs" style={{ color: "var(--err)" }}>
                {String(errors.diagnosis.message)}
              </p>
            )}
          </div>

          {/* Expected delivery date */}
          <div className="space-y-2">
            <label className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
              Fecha estimada de entrega (opcional)
            </label>
            <input
              type="date"
              min={today}
              value={getValues("expectedDeliveryDate") ?? ""}
              onChange={(e) => setValue("expectedDeliveryDate", e.target.value || undefined)}
              className="rounded-xl px-3 py-2.5 text-sm outline-none"
              style={{ background: "var(--surf-low)", color: "var(--on-surf)" }}
              aria-label="Fecha estimada de entrega"
            />
          </div>
        </div>

        {/* Sticky summary */}
        <div className="lg:sticky lg:top-4 lg:self-start space-y-4">
          <SummaryPanel
            control={control}
            collapsed={summaryCollapsed}
            onToggle={() => setSummaryCollapsed((c) => !c)}
          />
        </div>
      </div>

      {/* Add service dialog */}
      <Dialog open={showAddService} onOpenChange={setShowAddService}>
        <DialogContent
          style={{
            background: "var(--surf-bright)",
            backdropFilter: "blur(16px)",
            border: "1px solid var(--ghost-border, rgba(255,255,255,0.08))",
          }}
        >
          <DialogHeader>
            <DialogTitle style={{ color: "var(--on-surf)" }}>Agregar servicio</DialogTitle>
          </DialogHeader>
          <button
            type="button"
            onClick={() => setShowAddService(false)}
            className="absolute top-3 right-3 rounded-lg p-1.5"
            style={{ background: "var(--surf-low)" }}
            aria-label="Cerrar"
          >
            <X size={14} style={{ color: "var(--on-surf-var)" }} />
          </button>

          <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
            {allServices.length === 0 ? (
              <p className="text-sm text-center py-4" style={{ color: "var(--on-surf-var)" }}>
                No hay servicios activos en esta sucursal.
              </p>
            ) : (
              allServices.map((svc) => {
                const isHourly = svc.chargeModel === "HOURLY";
                return (
                  <div
                    key={svc.id}
                    className="rounded-xl p-3 space-y-2"
                    style={{ background: "var(--surf-low)" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                          {svc.name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                          {isHourly ? "Por hora" : `$${svc.basePrice.toFixed(2)}`}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addService(svc)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium shrink-0"
                        style={{ background: "var(--p)", color: "#fff" }}
                      >
                        <Plus size={11} className="inline mr-1" />
                        Agregar
                      </button>
                    </div>
                    {isHourly && (
                      <div className="flex items-center gap-2">
                        <label className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                          Minutos:
                        </label>
                        <input
                          type="number"
                          min={1}
                          step={15}
                          value={laborMinutes[svc.id] ?? 60}
                          onChange={(e) =>
                            setLaborMinutes((prev) => ({
                              ...prev,
                              [svc.id]: Number(e.target.value),
                            }))
                          }
                          className="w-20 rounded-lg px-2 py-1 text-xs outline-none"
                          style={{ background: "var(--surf-bright)", color: "var(--on-surf)" }}
                          aria-label={`Minutos de mano de obra para ${svc.name}`}
                        />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </DialogContent>
      </Dialog>
    </section>
  );
}
