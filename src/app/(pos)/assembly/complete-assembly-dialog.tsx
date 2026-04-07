"use client";

import { useState, useCallback, useEffect } from "react";
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
import { Loader2, CheckCircle, AlertCircle, Zap } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

type BatteryValidationState = "idle" | "checking" | "valid" | "invalid";

interface BatteryInput {
  serial: string;
  state: BatteryValidationState;
  message: string;
  lotReference: string | null;
}

interface BatteryCheckResult {
  found: boolean;
  status: string | null;
  message: string;
  lot?: { id: string; reference: string | null; supplier: string | null } | null;
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

// ── Component ──────────────────────────────────────────────────────────────────

export function CompleteAssemblyDialog({
  open,
  onOpenChange,
  orderId,
  vin,
  modelName,
  voltajeLabel,
  requiredQuantity,
  branchId,
  onSuccess,
}: Props): React.JSX.Element {
  const requiresVin = vin === null;
  const [vinInput, setVinInput] = useState("");
  const [batteryInputs, setBatteryInputs] = useState<BatteryInput[]>([]);
  const [submitting, setSubmitting] = useState(false);

  // Init states when dialog opens
  useEffect(() => {
    if (open) {
      setVinInput("");
      setBatteryInputs(
        Array.from({ length: requiredQuantity }, () => ({
          serial: "",
          state: "idle" as const,
          message: "",
          lotReference: null,
        }))
      );
    }
  }, [open, requiredQuantity]);

  useEffect(() => {
    if (!open) {
      setVinInput("");
      setBatteryInputs([]);
    }
  }, [open]);

  const checkBatterySerial = useCallback(
    async (index: number, serial: string) => {
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
    [branchId]
  );

  const handleSerialChange = useCallback(
    (index: number, value: string) => {
      const upper = value.toUpperCase();
      setBatteryInputs((prev) =>
        prev.map((b, i) =>
          i === index
            ? { ...b, serial: upper, state: "idle" as const, message: "", lotReference: null }
            : b
        )
      );

      const timer = setTimeout(() => {
        if (upper.trim().length >= 3) {
          checkBatterySerial(index, upper.trim());
        }
      }, 500);
      return () => clearTimeout(timer);
    },
    [checkBatterySerial]
  );

  const vinTrimmed = vinInput.trim().toUpperCase();
  const vinValid = !requiresVin || vinTrimmed.length >= 3;
  const allBatteriesValid =
    batteryInputs.length > 0 && batteryInputs.every((b) => b.state === "valid");
  const canSubmit = vinValid && allBatteriesValid;

  const handleComplete = async () => {
    if (!canSubmit) return;

    const serials = batteryInputs.map((b) => b.serial.trim());
    const unique = new Set(serials);
    if (unique.size !== serials.length) {
      toast.error("Hay números de serie duplicados");
      return;
    }

    setSubmitting(true);
    toast.loading("Completando montaje...", { id: "complete-assembly" });

    try {
      const payload: { batterySerials: string[]; vin?: string } = {
        batterySerials: serials,
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
              <span>
                {" "}
                · {modelName} {voltajeLabel}
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Campo VIN — solo cuando la orden no tiene VIN (generada por recepción) */}
        {requiresVin && (
          <div className="space-y-1">
            <label
              style={{ fontSize: "0.78rem", color: "var(--on-surf-var)", fontWeight: 500 }}
            >
              Número de serie del vehículo (VIN)
            </label>
            <Input
              value={vinInput}
              onChange={(e) => setVinInput(e.target.value.toUpperCase())}
              placeholder="Ej. EVOBIKE-2024-001"
              className="font-mono"
              style={{
                background: "var(--surf-high)",
                border: "none",
                borderRadius: "0.75rem",
              }}
            />
          </div>
        )}

        {/* Required batteries indicator */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-xl"
          style={{ background: "var(--surf-high)" }}
        >
          <Zap className="h-4 w-4 shrink-0" style={{ color: "var(--p-bright)" }} />
          <span style={{ fontSize: "0.78rem", color: "var(--on-surf)" }}>
            {requiredQuantity} bater{requiredQuantity === 1 ? "ía requerida" : "ías requeridas"}
          </span>
        </div>

        {/* Battery serial inputs */}
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
