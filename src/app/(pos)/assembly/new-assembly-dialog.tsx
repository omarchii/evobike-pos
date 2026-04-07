"use client";

import { useState, useEffect, useCallback } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle, AlertCircle, ChevronRight, Zap } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface ConfigModelo {
  id: string;
  nombre: string;
  voltajes: { id: string; valor: number; label: string }[];
  colores: { id: string; nombre: string }[];
}

interface BatteryConfig {
  modeloId: string;
  voltajeId: string;
  quantity: number;
}

interface AssemblyConfig {
  modelos: ConfigModelo[];
  configurations: BatteryConfig[];
  branchId: string | null;
}

interface BatteryCheckResult {
  found: boolean;
  status: string | null;
  message: string;
  batteryId?: string;
  lot?: { id: string; reference: string | null; supplier: string | null } | null;
}

type BatteryValidationState = "idle" | "checking" | "valid" | "invalid";

interface BatteryInput {
  serial: string;
  state: BatteryValidationState;
  message: string;
  lotReference: string | null;
}

// ── Schemas ────────────────────────────────────────────────────────────────────

const step1Schema = z.object({
  modeloId: z.string().min(1, "Selecciona un modelo"),
  voltajeId: z.string().min(1, "Selecciona el voltaje"),
  colorId: z.string().min(1, "Selecciona el color"),
  vin: z
    .string()
    .min(3, "El VIN debe tener al menos 3 caracteres")
    .transform((v) => v.trim().toUpperCase()),
});

type Step1Values = z.infer<typeof step1Schema>;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

// ── Component ──────────────────────────────────────────────────────────────────

export function NewAssemblyDialog({ open, onOpenChange, onSuccess }: Props): React.JSX.Element {
  const [step, setStep] = useState<1 | 2>(1);
  const [config, setConfig] = useState<AssemblyConfig | null>(null);
  const [loadingConfig, setLoadingConfig] = useState(false);

  const [batteryInputs, setBatteryInputs] = useState<BatteryInput[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [vinValidState, setVinValidState] = useState<"idle" | "checking" | "ok" | "taken">("idle");

  const form = useForm<Step1Values>({
    resolver: zodResolver(step1Schema),
    defaultValues: { modeloId: "", voltajeId: "", colorId: "", vin: "" },
  });

  const selectedModeloId = form.watch("modeloId");
  const selectedVoltajeId = form.watch("voltajeId");
  const selectedVin = form.watch("vin");

  // ── Load config on open ────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) return;
    setLoadingConfig(true);
    fetch("/api/assembly/config")
      .then((r) => r.json() as Promise<{ success: boolean; data?: AssemblyConfig; error?: string }>)
      .then((res) => {
        if (res.success && res.data) setConfig(res.data);
        else toast.error(res.error ?? "Error cargando configuración");
      })
      .catch(() => toast.error("Error de conexión"))
      .finally(() => setLoadingConfig(false));
  }, [open]);

  // ── Reset on close ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (!open) {
      setStep(1);
      form.reset();
      setBatteryInputs([]);
      setVinValidState("idle");
    }
  }, [open, form]);

  // ── Derived: available voltajes & colores ─────────────────────────────────
  const selectedModelo = config?.modelos.find((m) => m.id === selectedModeloId);
  const availableVoltajes = selectedModelo?.voltajes ?? [];
  const availableColores = selectedModelo?.colores ?? [];

  // ── Required batteries from config ────────────────────────────────────────
  const requiredBatteries =
    config?.configurations.find(
      (c) => c.modeloId === selectedModeloId && c.voltajeId === selectedVoltajeId
    )?.quantity ?? null;

  // ── VIN real-time validation ───────────────────────────────────────────────
  const checkVin = useCallback(
    async (vin: string) => {
      if (vin.length < 3) {
        setVinValidState("idle");
        return;
      }
      setVinValidState("checking");
      try {
        const res = await fetch(`/api/serial-search?q=${encodeURIComponent(vin)}`);
        const data = (await res.json()) as { id: string }[];
        // VIN libre = array vacío; VIN ocupado = tiene coincidencias
        setVinValidState(data.length > 0 ? "taken" : "ok");
      } catch {
        setVinValidState("idle");
      }
    },
    []
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      if (selectedVin) checkVin(selectedVin.trim().toUpperCase());
    }, 500);
    return () => clearTimeout(timer);
  }, [selectedVin, checkVin]);

  // ── Battery serial validation ──────────────────────────────────────────────
  const checkBatterySerial = useCallback(
    async (index: number, serial: string, branchId: string | null) => {
      if (!serial.trim() || !branchId) return;

      setBatteryInputs((prev) =>
        prev.map((b, i) => (i === index ? { ...b, state: "checking" as const } : b))
      );

      try {
        const res = await fetch(
          `/api/batteries/check?serial=${encodeURIComponent(serial.trim())}&branchId=${branchId}`
        );
        const data = (await res.json()) as BatteryCheckResult;

        setBatteryInputs((prev) =>
          prev.map((b, i) => {
            if (i !== index) return b;
            if (data.found && data.status === "IN_STOCK") {
              return {
                ...b,
                state: "valid" as const,
                message: "Disponible",
                lotReference: data.lot?.reference ?? null,
              };
            }
            return {
              ...b,
              state: "invalid" as const,
              message: data.message,
              lotReference: null,
            };
          })
        );
      } catch {
        setBatteryInputs((prev) =>
          prev.map((b, i) =>
            i === index ? { ...b, state: "invalid" as const, message: "Error de conexión" } : b
          )
        );
      }
    },
    []
  );

  const handleSerialChange = useCallback(
    (index: number, value: string) => {
      setBatteryInputs((prev) =>
        prev.map((b, i) =>
          i === index
            ? { ...b, serial: value.toUpperCase(), state: "idle" as const, message: "", lotReference: null }
            : b
        )
      );

      const branchId = config?.branchId ?? null;
      const timer = setTimeout(() => {
        if (value.trim().length >= 3) {
          checkBatterySerial(index, value.trim(), branchId);
        }
      }, 500);
      return () => clearTimeout(timer);
    },
    [config, checkBatterySerial]
  );

  // ── Step 1 → Step 2 ────────────────────────────────────────────────────────
  const handleStep1Next = form.handleSubmit(() => {
    if (vinValidState === "taken") {
      form.setError("vin", { message: "Este VIN ya está registrado en la sucursal" });
      return;
    }
    if (vinValidState === "checking") return;
    if (requiredBatteries === null) {
      toast.error("No hay configuración de baterías para este modelo y voltaje");
      return;
    }
    // Init battery inputs
    setBatteryInputs(
      Array.from({ length: requiredBatteries }, () => ({
        serial: "",
        state: "idle" as const,
        message: "",
        lotReference: null,
      }))
    );
    setStep(2);
  });

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = async (completeNow: boolean) => {
    const values = form.getValues();
    const batterySerials = completeNow ? batteryInputs.map((b) => b.serial.trim()) : undefined;

    if (completeNow) {
      const allValid = batteryInputs.every((b) => b.state === "valid");
      if (!allValid) {
        toast.error("Valida todos los seriales de batería antes de completar");
        return;
      }
      const serials = batteryInputs.map((b) => b.serial.trim());
      const unique = new Set(serials);
      if (unique.size !== serials.length) {
        toast.error("Hay números de serie duplicados");
        return;
      }
    }

    setSubmitting(true);
    const toastId = completeNow ? "assembly-complete" : "assembly-pending";
    toast.loading(completeNow ? "Creando y completando montaje..." : "Guardando orden pendiente...", {
      id: toastId,
    });

    try {
      const res = await fetch("/api/assembly", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          modeloId: values.modeloId,
          voltajeId: values.voltajeId,
          colorId: values.colorId,
          vin: values.vin,
          batterySerials,
          completeNow,
        }),
      }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);

      if (res.success) {
        toast.success(
          completeNow ? "Montaje completado exitosamente" : "Orden guardada como pendiente",
          { id: toastId }
        );
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error ?? "Error al procesar la orden", { id: toastId });
      }
    } catch {
      toast.error("Error de conexión", { id: toastId });
    } finally {
      setSubmitting(false);
    }
  };

  const allBatteriesValid =
    batteryInputs.length > 0 && batteryInputs.every((b) => b.state === "valid");

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-lg"
        style={{
          background: "var(--surf-bright)",
          borderRadius: "1.25rem",
          border: "none",
          boxShadow: "0 8px 40px rgba(0,0,0,0.18)",
        }}
      >
        <DialogHeader>
          <DialogTitle
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--on-surf)",
            }}
          >
            {step === 1 ? "Nueva Orden de Montaje" : "Asignar Baterías"}
          </DialogTitle>
          <DialogDescription style={{ fontSize: "0.8rem", color: "var(--on-surf-var)" }}>
            {step === 1
              ? "Selecciona el modelo, voltaje, color y captura el VIN del vehículo"
              : `Se requieren ${requiredBatteries} baterías para este ensamble`}
          </DialogDescription>
        </DialogHeader>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-2">
          {[1, 2].map((s) => (
            <div
              key={s}
              className="flex items-center gap-1.5"
            >
              <div
                style={{
                  width: "1.5rem",
                  height: "1.5rem",
                  borderRadius: 999,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  background:
                    step >= s
                      ? "linear-gradient(135deg, #1b4332, #2ecc71)"
                      : "var(--surf-high)",
                  color: step >= s ? "#fff" : "var(--on-surf-var)",
                }}
              >
                {s}
              </div>
              <span
                style={{
                  fontSize: "0.72rem",
                  color: step >= s ? "var(--on-surf)" : "var(--on-surf-var)",
                  fontWeight: step === s ? 600 : 400,
                }}
              >
                {s === 1 ? "Vehículo" : "Baterías"}
              </span>
              {s < 2 && <ChevronRight className="h-3 w-3" style={{ color: "var(--on-surf-var)" }} />}
            </div>
          ))}
        </div>

        {loadingConfig ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-6 w-6 animate-spin" style={{ color: "var(--p-bright)" }} />
          </div>
        ) : step === 1 ? (
          // ── STEP 1 ──────────────────────────────────────────────────────────
          <Form {...form}>
            <form onSubmit={handleStep1Next} className="space-y-4">
              {/* Modelo */}
              <FormField
                control={form.control}
                name="modeloId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ fontSize: "0.8rem", color: "var(--on-surf-var)" }}>
                      Modelo
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={(v) => {
                        field.onChange(v);
                        form.setValue("voltajeId", "");
                        form.setValue("colorId", "");
                      }}
                    >
                      <FormControl>
                        <SelectTrigger
                          style={{
                            background: "var(--surf-high)",
                            border: "none",
                            borderRadius: "0.75rem",
                          }}
                        >
                          <SelectValue placeholder="Selecciona un modelo" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {config?.modelos.map((m) => (
                          <SelectItem key={m.id} value={m.id}>
                            {m.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Voltaje */}
              <FormField
                control={form.control}
                name="voltajeId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ fontSize: "0.8rem", color: "var(--on-surf-var)" }}>
                      Voltaje
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedModeloId}
                    >
                      <FormControl>
                        <SelectTrigger
                          style={{
                            background: "var(--surf-high)",
                            border: "none",
                            borderRadius: "0.75rem",
                          }}
                        >
                          <SelectValue placeholder="Selecciona voltaje" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableVoltajes.map((v) => (
                          <SelectItem key={v.id} value={v.id}>
                            {v.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Indicador de baterías requeridas */}
              {selectedModeloId && selectedVoltajeId && (
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-xl"
                  style={{
                    background: requiredBatteries !== null ? "var(--surf-high)" : "var(--ter-container)",
                  }}
                >
                  <Zap
                    className="h-4 w-4 shrink-0"
                    style={{ color: requiredBatteries !== null ? "var(--p-bright)" : "var(--ter)" }}
                  />
                  <span style={{ fontSize: "0.78rem", color: "var(--on-surf)" }}>
                    {requiredBatteries !== null
                      ? `${requiredBatteries} bater${requiredBatteries === 1 ? "ía requerida" : "ías requeridas"}`
                      : "Sin configuración de baterías para este voltaje"}
                  </span>
                </div>
              )}

              {/* Color */}
              <FormField
                control={form.control}
                name="colorId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ fontSize: "0.8rem", color: "var(--on-surf-var)" }}>
                      Color
                    </FormLabel>
                    <Select
                      value={field.value}
                      onValueChange={field.onChange}
                      disabled={!selectedModeloId}
                    >
                      <FormControl>
                        <SelectTrigger
                          style={{
                            background: "var(--surf-high)",
                            border: "none",
                            borderRadius: "0.75rem",
                          }}
                        >
                          <SelectValue placeholder="Selecciona color" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {availableColores.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nombre}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* VIN */}
              <FormField
                control={form.control}
                name="vin"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel style={{ fontSize: "0.8rem", color: "var(--on-surf-var)" }}>
                      Número de Serie del Vehículo (VIN)
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          {...field}
                          placeholder="EVO-2024-XXXXX"
                          className="font-mono pr-10"
                          style={{
                            background: "var(--surf-high)",
                            border: "none",
                            borderRadius: "0.75rem",
                            textTransform: "uppercase",
                          }}
                          onChange={(e) => field.onChange(e.target.value.toUpperCase())}
                        />
                        <div className="absolute right-3 top-2.5">
                          {vinValidState === "checking" && (
                            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--on-surf-var)" }} />
                          )}
                          {vinValidState === "ok" && (
                            <CheckCircle className="h-4 w-4" style={{ color: "var(--sec)" }} />
                          )}
                          {vinValidState === "taken" && (
                            <AlertCircle className="h-4 w-4" style={{ color: "var(--ter)" }} />
                          )}
                        </div>
                      </div>
                    </FormControl>
                    {vinValidState === "taken" && (
                      <p style={{ fontSize: "0.75rem", color: "var(--ter)", marginTop: "0.25rem" }}>
                        Este VIN ya está registrado
                      </p>
                    )}
                    {vinValidState === "ok" && (
                      <p style={{ fontSize: "0.75rem", color: "var(--sec)", marginTop: "0.25rem" }}>
                        VIN disponible
                      </p>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => onOpenChange(false)}
                  style={{ fontSize: "0.85rem" }}
                >
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={vinValidState === "checking" || vinValidState === "taken" || !requiredBatteries}
                  style={{
                    background: "linear-gradient(135deg, #1b4332, #2ecc71)",
                    color: "#fff",
                    borderRadius: "1.5rem",
                    border: "none",
                    fontSize: "0.85rem",
                  }}
                >
                  Siguiente
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </form>
          </Form>
        ) : (
          // ── STEP 2 ──────────────────────────────────────────────────────────
          <div className="space-y-4">
            <div className="space-y-3">
              {batteryInputs.map((b, i) => (
                <div key={i} className="space-y-1">
                  <label
                    style={{ fontSize: "0.78rem", color: "var(--on-surf-var)", fontWeight: 500 }}
                  >
                    Batería {i + 1} de {batteryInputs.length}
                  </label>
                  <div className="relative">
                    <Input
                      value={b.serial}
                      onChange={(e) => handleSerialChange(i, e.target.value)}
                      placeholder={`Serial batería ${i + 1}`}
                      className="font-mono pr-10"
                      style={{
                        background:
                          b.state === "valid"
                            ? "var(--sec-container)"
                            : b.state === "invalid"
                            ? "var(--ter-container)"
                            : "var(--surf-high)",
                        border: "none",
                        borderRadius: "0.75rem",
                      }}
                    />
                    <div className="absolute right-3 top-2.5">
                      {b.state === "checking" && (
                        <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--on-surf-var)" }} />
                      )}
                      {b.state === "valid" && (
                        <CheckCircle className="h-4 w-4" style={{ color: "var(--sec)" }} />
                      )}
                      {b.state === "invalid" && (
                        <AlertCircle className="h-4 w-4" style={{ color: "var(--ter)" }} />
                      )}
                    </div>
                  </div>
                  {b.state === "valid" && b.lotReference && (
                    <p style={{ fontSize: "0.7rem", color: "var(--sec)", paddingLeft: "0.5rem" }}>
                      Lote: {b.lotReference}
                    </p>
                  )}
                  {b.state === "invalid" && (
                    <p style={{ fontSize: "0.7rem", color: "var(--ter)", paddingLeft: "0.5rem" }}>
                      {b.message}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <div className="flex justify-between gap-3 pt-2">
              <Button
                variant="ghost"
                onClick={() => setStep(1)}
                style={{ fontSize: "0.82rem" }}
                disabled={submitting}
              >
                ← Volver
              </Button>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => handleSubmit(false)}
                  disabled={submitting}
                  style={{
                    fontSize: "0.82rem",
                    borderRadius: "1.5rem",
                    border: "1px solid var(--outline-variant)",
                  }}
                >
                  {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Guardar Pendiente
                </Button>
                <Button
                  onClick={() => handleSubmit(true)}
                  disabled={!allBatteriesValid || submitting}
                  style={{
                    background: "linear-gradient(135deg, #1b4332, #2ecc71)",
                    color: "#fff",
                    borderRadius: "1.5rem",
                    border: "none",
                    fontSize: "0.82rem",
                  }}
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin mr-1" />
                  ) : null}
                  Crear y Completar ▶
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
