"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Zap } from "lucide-react";

export interface VoltajeOptionForDialog {
  id: string;
  valor: number;
  label: string;
}

interface VoltageChangeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentVoltajeLabel: string;
  voltajeOptions: VoltajeOptionForDialog[];
  onConfirm: (targetVoltajeId: string, targetVoltajeLabel: string) => void;
}

export function VoltageChangeDialog({
  open,
  onOpenChange,
  currentVoltajeLabel,
  voltajeOptions,
  onConfirm,
}: VoltageChangeDialogProps) {
  // Show only voltajes different from current
  const targets = voltajeOptions.filter(
    (v) => v.label !== currentVoltajeLabel
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden sm:max-w-sm"
        style={{
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "var(--shadow)",
          borderRadius: "var(--r-xl)",
          border: "none",
        }}
      >
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle
            style={{
              fontFamily: "var(--font-display)",
              fontSize: "1.1rem",
              fontWeight: 700,
              color: "var(--on-surf)",
            }}
          >
            Cambio de voltaje pre-venta
          </DialogTitle>
          <p style={{ color: "var(--on-surf-var)", fontSize: "0.75rem" }}>
            Esta unidad ya está ensamblada a {currentVoltajeLabel}. Al elegir
            otro voltaje se creará una orden de montaje automáticamente, sin
            costo para el cliente. La póliza se emite al completar el
            reensamble.
          </p>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-3">
          {/* Current voltage */}
          <div
            className="flex items-center gap-2 px-3 py-2.5 rounded-xl"
            style={{ background: "var(--surf-low)" }}
          >
            <span style={{ fontSize: "0.7rem", color: "var(--on-surf-var)" }}>
              Voltaje actual
            </span>
            <span
              className="ml-auto font-mono font-semibold text-sm"
              style={{ color: "var(--on-surf)" }}
            >
              {currentVoltajeLabel}
            </span>
          </div>

          {/* Target voltaje options */}
          {targets.length === 0 ? (
            <p
              className="text-center py-4 text-sm"
              style={{ color: "var(--on-surf-var)" }}
            >
              No hay otros voltajes disponibles para este modelo.
            </p>
          ) : (
            <div className="space-y-2">
              <p
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 600,
                  letterSpacing: "0.06em",
                  textTransform: "uppercase",
                  color: "var(--on-surf-var)",
                }}
              >
                Confirmar reensamble a
              </p>
              {targets.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    onConfirm(v.id, v.label);
                    onOpenChange(false);
                  }}
                  className="w-full flex items-center gap-3 transition-all"
                  style={{
                    background: "var(--ter-container)",
                    borderRadius: "var(--r-lg)",
                    padding: "0.75rem 1rem",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <Zap
                    className="w-4 h-4 shrink-0"
                    style={{ color: "var(--on-ter-container)" }}
                  />
                  <span
                    className="font-semibold"
                    style={{
                      fontFamily: "var(--font-display)",
                      fontSize: "0.95rem",
                      color: "var(--on-ter-container)",
                    }}
                  >
                    {v.label}
                  </span>
                  <span
                    className="ml-auto text-xs"
                    style={{ color: "var(--on-ter-container)", opacity: 0.7 }}
                  >
                    {v.valor}V
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
