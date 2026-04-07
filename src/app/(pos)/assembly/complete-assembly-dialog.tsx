"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Loader2, Zap, AlertCircle } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface BatteryInput {
  serial: string;
  isDuplicate: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  // null cuando la orden fue generada por recepción y aún no tiene VIN
  vin: string | null;
  modelName: string | null;
  voltajeLabel: string | null;
  requiredQuantity: number;
  branchId: string | null;
  onSuccess: () => void;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function computeDuplicates(inputs: BatteryInput[]): BatteryInput[] {
  const counts = new Map<string, number>();
  inputs.forEach((b) => {
    const s = b.serial.trim();
    if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
  });
  return inputs.map((b) => ({
    ...b,
    isDuplicate: b.serial.trim().length > 0 && (counts.get(b.serial.trim()) ?? 0) > 1,
  }));
}

// ── Component ──────────────────────────────────────────────────────────────────

export function CompleteAssemblyDialog({
  open,
  onOpenChange,
  orderId,
  vin,
  modelName,
  voltajeLabel,
  requiredQuantity,
  onSuccess,
}: Props): React.JSX.Element {
  const requiresVin = vin === null;
  const [vinInput, setVinInput] = useState("");
  const [lotReference, setLotReference] = useState("");
  const [batteryInputs, setBatteryInputs] = useState<BatteryInput[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Init on open
  useEffect(() => {
    if (open) {
      setVinInput("");
      setLotReference("");
      setBatteryInputs(
        Array.from({ length: requiredQuantity }, () => ({ serial: "", isDuplicate: false }))
      );
    }
  }, [open, requiredQuantity]);

  useEffect(() => {
    if (!open) {
      setVinInput("");
      setLotReference("");
      setBatteryInputs([]);
    }
  }, [open]);

  const handleSerialChange = (index: number, value: string) => {
    const upper = value.toUpperCase();
    const next = batteryInputs.map((b, i) =>
      i === index ? { ...b, serial: upper } : b
    );
    setBatteryInputs(computeDuplicates(next));
  };

  // ── Validación local (sin API check) ─────────────────────────────────────────
  const vinTrimmed = vinInput.trim().toUpperCase();
  const vinValid = !requiresVin || vinTrimmed.length >= 3;
  const lotValid = lotReference.trim().length >= 1;
  const allSerialsFilled = batteryInputs.length > 0 && batteryInputs.every((b) => b.serial.trim().length >= 1);
  const hasDuplicates = batteryInputs.some((b) => b.isDuplicate);
  const canSubmit = vinValid && lotValid && allSerialsFilled && !hasDuplicates;

  const handleComplete = async () => {
    if (!canSubmit) return;

    setSubmitting(true);
    toast.loading("Completando montaje...", { id: "complete-assembly" });

    try {
      const payload: { batterySerials: string[]; lotReference: string; vin?: string } = {
        batterySerials: batteryInputs.map((b) => b.serial.trim()),
        lotReference: lotReference.trim(),
      };
      if (requiresVin) payload.vin = vinTrimmed;

      const res = await fetch(`/api/assembly/${orderId}/complete`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);

      if (res.success) {
        toast.success("Montaje completado exitosamente", { id: "complete-assembly" });
        onOpenChange(false);
        onSuccess();
      } else {
        toast.error(res.error ?? "Error al completar el montaje", { id: "complete-assembly" });
      }
    } catch {
      toast.error("Error de conexión", { id: "complete-assembly" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
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
            Completar Montaje
          </DialogTitle>
          <DialogDescription style={{ fontSize: "0.8rem", color: "var(--on-surf-var)" }}>
            {vin ? (
              <>
                VIN:{" "}
                <span className="font-mono font-semibold" style={{ color: "var(--on-surf)" }}>
                  {vin}
                </span>
              </>
            ) : (
              "Ingresa el VIN del vehículo y los seriales de las baterías"
            )}
            {modelName && voltajeLabel && (
              <span> · {modelName} {voltajeLabel}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* VIN — solo para órdenes sin VIN (generadas por recepción) */}
          {requiresVin && (
            <div className="space-y-1">
              <label style={{ fontSize: "0.78rem", color: "var(--on-surf-var)", fontWeight: 500 }}>
                Número de serie del vehículo (VIN)
              </label>
              <Input
                value={vinInput}
                onChange={(e) => setVinInput(e.target.value.toUpperCase())}
                placeholder="Ej. EVOBIKE-2024-001"
                className="font-mono"
                style={{ background: "var(--surf-high)", border: "none", borderRadius: "0.75rem" }}
              />
            </div>
          )}

          {/* Número de lote */}
          <div className="space-y-1">
            <label style={{ fontSize: "0.78rem", color: "var(--on-surf-var)", fontWeight: 500 }}>
              Número de lote de baterías
            </label>
            <Input
              value={lotReference}
              onChange={(e) => setLotReference(e.target.value.toUpperCase())}
              placeholder="Ej. LOTE-2024-001"
              className="font-mono"
              style={{ background: "var(--surf-high)", border: "none", borderRadius: "0.75rem" }}
            />
          </div>

          {/* Indicador de cantidad */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "var(--surf-high)" }}
          >
            <Zap className="h-4 w-4 shrink-0" style={{ color: "var(--p-bright)" }} />
            <span style={{ fontSize: "0.78rem", color: "var(--on-surf)" }}>
              {requiredQuantity} bater{requiredQuantity === 1 ? "ía requerida" : "ías requeridas"}
            </span>
          </div>

          {/* Seriales de baterías */}
          <div className="space-y-3">
            {batteryInputs.map((b, i) => (
              <div key={i} className="space-y-1">
                <label style={{ fontSize: "0.78rem", color: "var(--on-surf-var)", fontWeight: 500 }}>
                  Batería {i + 1} de {batteryInputs.length}
                </label>
                <div className="relative">
                  <Input
                    value={b.serial}
                    onChange={(e) => handleSerialChange(i, e.target.value)}
                    placeholder={`Serial batería ${i + 1}`}
                    className="font-mono pr-8"
                    style={{
                      background: b.isDuplicate ? "var(--ter-container)" : "var(--surf-high)",
                      border: "none",
                      borderRadius: "0.75rem",
                    }}
                  />
                  {b.isDuplicate && (
                    <div className="absolute right-3 top-2.5">
                      <AlertCircle className="h-4 w-4" style={{ color: "var(--ter)" }} />
                    </div>
                  )}
                </div>
                {b.isDuplicate && (
                  <p style={{ fontSize: "0.7rem", color: "var(--ter)", paddingLeft: "0.5rem" }}>
                    Serial duplicado
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <Button
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={submitting}
            style={{ fontSize: "0.85rem" }}
          >
            Cancelar
          </Button>
          <Button
            onClick={handleComplete}
            disabled={!canSubmit || submitting}
            style={{
              background: "linear-gradient(135deg, #1b4332, #2ecc71)",
              color: "#fff",
              borderRadius: "1.5rem",
              border: "none",
              fontSize: "0.85rem",
            }}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
            Confirmar Montaje
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
