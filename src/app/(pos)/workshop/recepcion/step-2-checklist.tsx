"use client";

import { useRef } from "react";
import dynamic from "next/dynamic";
import { useWatch, useController } from "react-hook-form";
import type { Control, UseFormSetValue } from "react-hook-form";
import { CHECKLIST_ITEMS } from "@/lib/workshop-checklist";
import type { ChecklistState } from "@/lib/workshop-checklist";
import type { WizardFormData } from "./recepcion-wizard";
import type { SignatureCanvasHandle } from "./signature-canvas";

const SignatureCanvas = dynamic(() => import("./signature-canvas"), { ssr: false });

const STATE_OPTIONS: { value: ChecklistState; label: string }[] = [
  { value: "OK", label: "OK" },
  { value: "FAIL", label: "FALLA" },
  { value: "NA", label: "N/A" },
];

function ChecklistRow({
  index,
  label,
  control,
}: {
  index: number;
  label: string;
  control: Control<WizardFormData>;
}) {
  const stateField = useController({
    control,
    name: `checklist.${index}.state` as const,
  });
  const noteField = useController({
    control,
    name: `checklist.${index}.note` as const,
  });

  const state = stateField.field.value as string;

  return (
    <div
      className="rounded-xl p-3"
      style={{ background: "var(--surf-low)" }}
    >
      <div className="flex items-center justify-between gap-3" role="radiogroup" aria-label={label}>
        <span className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
          {String(index + 1).padStart(2, "0")}. {label}
        </span>
        <div className="flex gap-1 shrink-0">
          {STATE_OPTIONS.map(({ value, label: optLabel }) => {
            const isActive = state === value;
            const activeColor =
              value === "OK"
                ? "var(--p-bright)"
                : value === "FAIL"
                  ? "var(--err, #d32f2f)"
                  : "var(--on-surf-var)";
            return (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={isActive}
                onClick={() => stateField.field.onChange(value)}
                className="px-3 py-1 rounded-lg text-xs font-semibold transition-colors"
                style={{
                  background: isActive ? `${activeColor}22` : "var(--surf-bright)",
                  color: isActive ? activeColor : "var(--on-surf-var)",
                  border: `1px solid ${isActive ? activeColor : "transparent"}`,
                }}
              >
                {optLabel}
              </button>
            );
          })}
        </div>
      </div>

      {state === "FAIL" && (
        <textarea
          placeholder="Describe el fallo (opcional)..."
          value={noteField.field.value ?? ""}
          onChange={(e) => noteField.field.onChange(e.target.value)}
          maxLength={500}
          rows={2}
          className="w-full mt-2 px-3 py-2 text-xs rounded-lg resize-none outline-none"
          style={{
            background: "var(--surf-bright)",
            color: "var(--on-surf)",
          }}
          aria-label={`Nota para ${label}`}
        />
      )}
    </div>
  );
}

interface Step2Props {
  control: Control<WizardFormData>;
  setValue: UseFormSetValue<WizardFormData>;
  step2Error: string | null;
}

export function Step2Checklist({ control, setValue, step2Error }: Step2Props) {
  const padRef = useRef<SignatureCanvasHandle>(null);
  const signatureRejected = useWatch({ control, name: "signatureRejected" });
  const signatureData = useWatch({ control, name: "signatureData" });

  const handleClear = () => {
    padRef.current?.clear();
    setValue("signatureData", null);
  };

  const handleReject = () => {
    handleClear();
    setValue("signatureRejected", true);
  };

  const handleUndoReject = () => {
    setValue("signatureRejected", false);
  };

  return (
    <section aria-labelledby="step2-title" className="space-y-6">
      <h2 id="step2-title" className="sr-only">
        Paso 2: Checklist e inspección
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Checklist */}
        <div className="space-y-2">
          <p className="text-sm font-medium mb-3" style={{ color: "var(--on-surf)" }}>
            Inspección de entrega (10 ítems)
          </p>
          {CHECKLIST_ITEMS.map((item, index) => (
            <ChecklistRow
              key={item.key}
              index={index}
              label={item.label}
              control={control}
            />
          ))}
        </div>

        {/* Right: Signature */}
        <div className="space-y-4">
          <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
            Firma de conformidad del cliente
          </p>

          <div
            className="rounded-xl p-4 space-y-3"
            style={{ background: "var(--surf-low)" }}
          >
            {signatureRejected ? (
              <div
                className="flex flex-col items-center justify-center rounded-lg"
                style={{ height: 160, background: "var(--surf-bright)", border: "1px dashed var(--on-surf-var)" }}
              >
                <p className="text-sm font-medium" style={{ color: "var(--on-surf-var)" }}>
                  Cliente rechazó firmar
                </p>
                <button
                  type="button"
                  onClick={handleUndoReject}
                  className="mt-2 text-xs underline"
                  style={{ color: "var(--p)" }}
                >
                  Deshacer
                </button>
              </div>
            ) : (
              <SignatureCanvas
                ref={padRef}
                onChange={(val) => setValue("signatureData", val)}
                disabled={signatureRejected}
                value={signatureData ?? null}
              />
            )}

            {!signatureRejected && (
              <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                Dibuja la firma del cliente en el área de arriba
              </p>
            )}

            <div className="flex gap-2">
              {!signatureRejected && (
                <button
                  type="button"
                  onClick={handleClear}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: "var(--surf-bright)", color: "var(--on-surf-var)" }}
                >
                  Limpiar
                </button>
              )}
              {!signatureRejected ? (
                <button
                  type="button"
                  onClick={handleReject}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium transition-colors"
                  style={{ background: "rgba(211,47,47,0.10)", color: "var(--err, #d32f2f)" }}
                >
                  Cliente rechaza
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleUndoReject}
                  className="px-4 py-1.5 rounded-lg text-xs font-medium"
                  style={{ background: "var(--surf-bright)", color: "var(--on-surf-var)" }}
                >
                  Deshacer rechazo
                </button>
              )}
            </div>

            {!signatureRejected && signatureData && (
              <p className="text-xs" style={{ color: "var(--p)" }}>
                ✓ Firma capturada
              </p>
            )}
          </div>
        </div>
      </div>

      {step2Error && (
        <div
          className="rounded-xl px-4 py-3"
          style={{ background: "rgba(211,47,47,0.08)", color: "var(--err, #d32f2f)" }}
          role="alert"
        >
          <p className="text-sm">{step2Error}</p>
        </div>
      )}
    </section>
  );
}
