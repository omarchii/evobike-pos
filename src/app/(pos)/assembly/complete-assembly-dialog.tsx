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
import { Loader2, Zap, AlertCircle, ChevronDown, Package, PencilLine } from "lucide-react";

// ── Types ──────────────────────────────────────────────────────────────────────

interface AvailableLot {
  lotId: string;
  reference: string;
  supplier: string | null;
  receivedAt: string;
  inStock: number;
  serials: string[]; // primeros N seriales IN_STOCK
}

interface BatteryInput {
  serial: string;
  isDuplicate: boolean;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  vin: string | null;
  modelName: string | null;
  voltajeLabel: string | null;
  requiredQuantity: number;
  branchId: string | null;
  onSuccess: () => void;
}

type Mode = "lot" | "manual";

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

  const [mode, setMode] = useState<Mode>("lot");
  const [vinInput, setVinInput] = useState("");

  // Modo lote
  const [lots, setLots] = useState<AvailableLot[]>([]);
  const [lotsLoading, setLotsLoading] = useState(false);
  const [selectedLotId, setSelectedLotId] = useState<string>("");
  const [selectedSerials, setSelectedSerials] = useState<string[]>([]);

  // Cantidad real requerida según la config resuelta server-side. La prop
  // `requiredQuantity` puede divergir cuando hay multi-config (Evotank 45/52Ah,
  // I10 deferred): el board hace `find()` arbitrario y el API usa el
  // `batteryConfigurationId` pre-asignado a la orden. Usar la del API como
  // fuente de verdad evita que el botón quede deshabilitado por un length
  // mismatch.
  const [apiRequiredQuantity, setApiRequiredQuantity] = useState<number | null>(null);
  const effectiveRequiredQuantity = apiRequiredQuantity ?? requiredQuantity;

  // Modo manual
  const [batteryInputs, setBatteryInputs] = useState<BatteryInput[]>([]);
  const [lotReference, setLotReference] = useState("");

  const [submitting, setSubmitting] = useState(false);

  // ── Reset al abrir ─────────────────────────────────────────────────────────
  useEffect(() => {
    if (open) {
      setMode("lot");
      setVinInput("");
      setSelectedLotId("");
      setSelectedSerials([]);
      setBatteryInputs(
        Array.from({ length: requiredQuantity }, () => ({ serial: "", isDuplicate: false }))
      );
      setLotReference("");
      setLotsLoading(true);

      fetch(`/api/assembly/${orderId}/available-batteries`)
        .then((r) => r.json() as Promise<{ success: boolean; data?: { requiredQuantity: number; lots: AvailableLot[] } }>)
        .then((res) => {
          if (res.success && res.data) {
            const apiQty = res.data.requiredQuantity;
            setLots(res.data.lots);
            setApiRequiredQuantity(apiQty);
            // Re-sincronizar inputs manuales al count real del API
            if (apiQty !== requiredQuantity) {
              setBatteryInputs(
                Array.from({ length: apiQty }, () => ({ serial: "", isDuplicate: false }))
              );
            }
            // Si solo hay un lote disponible, pre-seleccionarlo
            if (res.data.lots.length === 1) {
              const l = res.data.lots[0];
              setSelectedLotId(l.lotId);
              setSelectedSerials(l.serials);
            }
          }
        })
        .catch(() => {
          // Si falla, modo manual de fallback
          setMode("manual");
        })
        .finally(() => setLotsLoading(false));
    } else {
      setLots([]);
      setApiRequiredQuantity(null);
    }
  }, [open, orderId, requiredQuantity]);

  // ── Selección de lote ──────────────────────────────────────────────────────
  const handleLotSelect = (lotId: string) => {
    setSelectedLotId(lotId);
    const lot = lots.find((l) => l.lotId === lotId);
    setSelectedSerials(lot?.serials ?? []);
  };

  // ── Manual serial change ───────────────────────────────────────────────────
  const handleSerialChange = (index: number, value: string) => {
    const upper = value.toUpperCase();
    const next = batteryInputs.map((b, i) =>
      i === index ? { ...b, serial: upper } : b
    );
    setBatteryInputs(computeDuplicates(next));
  };

  // ── Validación ─────────────────────────────────────────────────────────────
  const vinTrimmed = vinInput.trim().toUpperCase();
  const vinValid = !requiresVin || vinTrimmed.length >= 3;

  const lotModeReady =
    mode === "lot" &&
    selectedLotId !== "" &&
    selectedSerials.length === effectiveRequiredQuantity;

  const manualModeReady =
    mode === "manual" &&
    batteryInputs.length === effectiveRequiredQuantity &&
    lotReference.trim().length >= 1 &&
    batteryInputs.every((b) => b.serial.trim().length >= 1) &&
    !batteryInputs.some((b) => b.isDuplicate);

  const canSubmit = vinValid && (lotModeReady || manualModeReady);

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleComplete = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    toast.loading("Completando montaje...", { id: "complete-assembly" });

    try {
      const serials =
        mode === "lot"
          ? selectedSerials
          : batteryInputs.map((b) => b.serial.trim());

      const ref =
        mode === "lot"
          ? (lots.find((l) => l.lotId === selectedLotId)?.reference ?? selectedLotId)
          : lotReference.trim();

      const payload: { batterySerials: string[]; lotReference: string; vin?: string } = {
        batterySerials: serials,
        lotReference: ref,
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
              "Ingresa el VIN del vehículo"
            )}
            {modelName && voltajeLabel && (
              <span> · {modelName} {voltajeLabel}</span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* VIN — solo cuando la orden no tiene VIN */}
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
                style={{ background: "var(--surf-lowest)", border: "none", borderRadius: "0.75rem" }}
              />
            </div>
          )}

          {/* Indicador de cantidad requerida */}
          <div
            className="flex items-center gap-2 px-3 py-2 rounded-xl"
            style={{ background: "var(--surf-high)" }}
          >
            <Zap className="h-4 w-4 shrink-0" style={{ color: "var(--p-bright)" }} />
            <span style={{ fontSize: "0.78rem", color: "var(--on-surf)" }}>
              {effectiveRequiredQuantity} bater{effectiveRequiredQuantity === 1 ? "ía requerida" : "ías requeridas"}
            </span>
          </div>

          {/* Toggle modo */}
          <div
            className="flex items-center gap-1 p-0.5 rounded-xl"
            style={{ background: "var(--surf-high)" }}
          >
            <button
              onClick={() => setMode("lot")}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={
                mode === "lot"
                  ? { background: "var(--surf-bright)", color: "var(--p)" }
                  : { color: "var(--on-surf-var)" }
              }
            >
              <Package className="h-3.5 w-3.5" />
              Elegir del inventario
            </button>
            <button
              onClick={() => setMode("manual")}
              className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold transition-all"
              style={
                mode === "manual"
                  ? { background: "var(--surf-bright)", color: "var(--p)" }
                  : { color: "var(--on-surf-var)" }
              }
            >
              <PencilLine className="h-3.5 w-3.5" />
              Ingresar manualmente
            </button>
          </div>

          {/* ── Modo: Selección por lote ───────────────────────────────────── */}
          {mode === "lot" && (
            <div className="space-y-3">
              {lotsLoading ? (
                <div className="flex items-center justify-center py-6">
                  <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--on-surf-var)" }} />
                  <span className="ml-2 text-sm" style={{ color: "var(--on-surf-var)" }}>
                    Buscando baterías disponibles...
                  </span>
                </div>
              ) : lots.length === 0 ? (
                <div
                  className="flex flex-col items-center py-5 rounded-xl gap-1"
                  style={{ background: "var(--surf-high)" }}
                >
                  <AlertCircle className="h-5 w-5" style={{ color: "var(--warn)" }} />
                  <p className="text-xs font-medium" style={{ color: "var(--on-surf)" }}>
                    Sin lotes disponibles
                  </p>
                  <p className="text-xs text-center" style={{ color: "var(--on-surf-var)" }}>
                    No hay {requiredQuantity} baterías del tipo correcto en inventario.
                    Usa entrada manual o registra un lote primero.
                  </p>
                </div>
              ) : (
                <>
                  {/* Selector de lote */}
                  <div className="space-y-1">
                    <label style={{ fontSize: "0.78rem", color: "var(--on-surf-var)", fontWeight: 500 }}>
                      Seleccionar lote de baterías
                    </label>
                    <div className="relative">
                      <select
                        value={selectedLotId}
                        onChange={(e) => handleLotSelect(e.target.value)}
                        className="w-full appearance-none font-mono text-sm pr-8"
                        style={{
                          background: "var(--surf-lowest)",
                          border: "none",
                          borderRadius: "0.75rem",
                          padding: "0.6rem 0.875rem",
                          color: "var(--on-surf)",
                          outline: "1px solid var(--ghost-border)",
                          outlineOffset: "-1px",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">— Elige un lote —</option>
                        {lots.map((l) => (
                          <option key={l.lotId} value={l.lotId}>
                            {l.reference}
                            {l.supplier ? ` · ${l.supplier}` : ""}
                            {" "}({l.inStock} disponibles)
                          </option>
                        ))}
                      </select>
                      <ChevronDown
                        className="absolute right-3 top-2.5 h-4 w-4 pointer-events-none"
                        style={{ color: "var(--on-surf-var)" }}
                      />
                    </div>
                  </div>

                  {/* Preview de seriales seleccionados */}
                  {selectedLotId && selectedSerials.length > 0 && (
                    <div
                      className="rounded-xl p-3 space-y-1.5"
                      style={{ background: "var(--surf-high)" }}
                    >
                      <p style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--on-surf-var)" }}>
                        Seriales a instalar:
                      </p>
                      {selectedSerials.map((s) => (
                        <div key={s} className="flex items-center gap-2">
                          <div
                            className="w-1.5 h-1.5 rounded-full shrink-0"
                            style={{ background: "var(--sec)" }}
                          />
                          <span
                            style={{
                              fontSize: "0.78rem",
                              fontFamily: "monospace",
                              color: "var(--on-surf)",
                            }}
                          >
                            {s}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ── Modo: Entrada manual ───────────────────────────────────────── */}
          {mode === "manual" && (
            <div className="space-y-3">
              <div className="space-y-1">
                <label style={{ fontSize: "0.78rem", color: "var(--on-surf-var)", fontWeight: 500 }}>
                  Número de lote de referencia
                </label>
                <Input
                  value={lotReference}
                  onChange={(e) => setLotReference(e.target.value.toUpperCase())}
                  placeholder="Ej. LOTE-2024-001"
                  className="font-mono"
                  style={{ background: "var(--surf-lowest)", border: "none", borderRadius: "0.75rem" }}
                />
              </div>

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
                        background: b.isDuplicate ? "var(--ter-container)" : "var(--surf-lowest)",
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
          )}
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
              background: "var(--velocity-gradient)",
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
