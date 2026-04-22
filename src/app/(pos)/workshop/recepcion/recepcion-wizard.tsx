"use client";

import { useReducer, useState } from "react";
import { useForm } from "react-hook-form";
import type { Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { CHECKLIST_ITEMS } from "@/lib/workshop-checklist";
import { SERVICE_ORDER_TYPES } from "@/lib/workshop-enums";
import type { TechnicianOption, MaintenanceServiceOption } from "@/lib/workshop-types";
import { Step1Cliente } from "./step-1-cliente";
import { Step2Checklist } from "./step-2-checklist";
import { Step3Fotos } from "./step-3-fotos";
import { Step4Tipo } from "./step-4-tipo";

// ── Types ──────────────────────────────────────────────────────────────────

export interface ServiceOption {
  id: string;
  name: string;
  basePrice: number;
  chargeModel: string;
}

// ── Zod schema ─────────────────────────────────────────────────────────────
//
// `wizardSchema` keeps the shape loose (empty strings, no refinements) so that
// `useForm`'s resolver does not complain while the user is still drafting. The
// per-step `stepSchemas` below are what gate `handleNext` — they are strict and
// declarative. The server re-validates everything with its own schema.

const wizardSchema = z.object({
  customerId: z.string().optional(),
  customerName: z.string().min(1, "El nombre del cliente es obligatorio"),
  customerPhone: z.string().optional(),
  customerBikeId: z.string().optional(),
  bikeInfo: z.string().optional(),
  addMaintenance: z.boolean().default(false),
  maintenanceServiceId: z.string().optional(),

  checklist: z.array(
    z.object({
      key: z.string(),
      state: z.string(),
      note: z.string().max(500),
    }),
  ),
  signatureData: z.string().nullable().optional(),
  signatureRejected: z.boolean().default(false),

  photoUrls: z.array(z.string()).max(5).default([]),

  type: z.enum(SERVICE_ORDER_TYPES).default("PAID"),
  assignedTechId: z.string().nullable().optional(),
  items: z
    .array(
      z.object({
        serviceCatalogId: z.string().optional(),
        description: z.string(),
        quantity: z.number().int().positive(),
        price: z.number().nonnegative(),
      }),
    )
    .default([]),
  expectedDeliveryDate: z.string().optional(),
  diagnosis: z.string().optional(),
});

export type WizardFormData = z.infer<typeof wizardSchema>;

// ── Per-step schemas ───────────────────────────────────────────────────────

const step1Schema = z
  .object({
    customerName: z.string().trim().min(1, "El nombre del cliente es obligatorio"),
    customerBikeId: z.string().optional(),
    bikeInfo: z.string().optional(),
  })
  .superRefine((val, ctx) => {
    if (!val.customerBikeId && (!val.bikeInfo || !val.bikeInfo.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["bikeInfo"],
        message: "Describe la bicicleta o selecciona una registrada",
      });
    }
  });

const step2Schema = z
  .object({
    checklist: z.array(
      z.object({
        key: z.string(),
        state: z.enum(["OK", "FAIL", "NA"]),
        note: z.string().max(500),
      }),
    ),
    signatureData: z.string().nullable().optional(),
    signatureRejected: z.boolean(),
  })
  .superRefine((val, ctx) => {
    if (!val.signatureRejected && (!val.signatureData || !val.signatureData.trim())) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["signatureData"],
        message: "Se requiere la firma del cliente (o marca 'Cliente rechaza').",
      });
    }
  });

const step3Schema = z.object({
  photoUrls: z.array(z.string()).max(5),
});

const step4Schema = z.object({
  type: z.enum(SERVICE_ORDER_TYPES),
  items: z.array(
    z.object({
      serviceCatalogId: z.string().optional(),
      description: z.string(),
      quantity: z.number().int().positive(),
      price: z.number().nonnegative(),
    }),
  ),
});

// ── Step state ─────────────────────────────────────────────────────────────

type WizardStep = 1 | 2 | 3 | 4;

function stepReducer(step: WizardStep, action: { type: "NEXT" | "PREV" }): WizardStep {
  if (action.type === "NEXT") return Math.min(4, step + 1) as WizardStep;
  return Math.max(1, step - 1) as WizardStep;
}

const stepSchemas: Record<WizardStep, z.ZodTypeAny> = {
  1: step1Schema,
  2: step2Schema,
  3: step3Schema,
  4: step4Schema,
};

const STEP_LABELS = [
  "Cliente y bici",
  "Checklist y firma",
  "Fotos del estado",
  "Tipo, técnico e ítems",
] as const;

// ── Props ──────────────────────────────────────────────────────────────────

interface RecepcionWizardProps {
  technicians: TechnicianOption[];
  maintenanceServices: MaintenanceServiceOption[];
  allServices: ServiceOption[];
  userRole: string;
  prefillBike: {
    id: string;
    brand: string | null;
    model: string | null;
    serialNumber: string;
    color: string | null;
  } | null;
  prefillCustomer: {
    id: string;
    name: string;
    phone: string | null;
    bikes: { id: string; brand: string | null; model: string | null; serialNumber: string; color: string | null }[];
  } | null;
  prefillMaintenanceStatus: { nivel: string; diasRestantes: number } | null;
}

// ── Stepper ────────────────────────────────────────────────────────────────

function Stepper({ currentStep }: { currentStep: WizardStep }) {
  return (
    <nav aria-label="Progreso del wizard" className="flex items-center gap-2 mb-8">
      {STEP_LABELS.map((label, i) => {
        const step = (i + 1) as WizardStep;
        const isActive = step === currentStep;
        const isDone = step < currentStep;
        return (
          <div key={step} className="flex items-center gap-2 flex-1 min-w-0">
            <div className="flex items-center gap-2 shrink-0">
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors"
                style={{
                  background: isDone
                    ? "var(--p)"
                    : isActive
                      ? "var(--surf-highest)"
                      : "var(--surf-low)",
                  color: isDone ? "#fff" : isActive ? "var(--p)" : "var(--on-surf-var)",
                  border: isActive ? "2px solid var(--p)" : "2px solid transparent",
                }}
                aria-current={isActive ? "step" : undefined}
              >
                {isDone ? "✓" : String(step).padStart(2, "0")}
              </div>
              <span
                className="text-xs font-medium hidden sm:block"
                style={{ color: isActive ? "var(--on-surf)" : "var(--on-surf-var)" }}
              >
                {label}
              </span>
            </div>
            {i < STEP_LABELS.length - 1 && (
              <div
                className="flex-1 h-px mx-1 hidden sm:block"
                style={{ background: isDone ? "var(--p)" : "var(--surf-low)" }}
              />
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ── Wizard ─────────────────────────────────────────────────────────────────

export function RecepcionWizard({
  technicians,
  maintenanceServices,
  allServices,
  userRole,
  prefillBike,
  prefillCustomer,
  prefillMaintenanceStatus,
}: RecepcionWizardProps) {
  const router = useRouter();
  const [currentStep, dispatch] = useReducer(stepReducer, 1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step2Error, setStep2Error] = useState<string | null>(null);

  const prefillBikeInfo =
    prefillBike
      ? [prefillBike.brand, prefillBike.model].filter(Boolean).join(" ") +
        ` — VIN: ${prefillBike.serialNumber}`
      : undefined;

  const form = useForm<WizardFormData>({
    resolver: zodResolver(wizardSchema) as Resolver<WizardFormData>,
    defaultValues: {
      customerId: prefillCustomer?.id,
      customerName: prefillCustomer?.name ?? "",
      customerPhone: prefillCustomer?.phone ?? undefined,
      customerBikeId: prefillBike?.id,
      bikeInfo: prefillBikeInfo,
      addMaintenance: false,
      maintenanceServiceId: undefined,
      checklist: CHECKLIST_ITEMS.map((item) => ({ key: item.key, state: "", note: "" })),
      signatureData: undefined,
      signatureRejected: false,
      photoUrls: [],
      type: "PAID",
      assignedTechId: undefined,
      items: [],
      expectedDeliveryDate: undefined,
      diagnosis: "",
    },
  });

  const scrollTop = () => window.scrollTo({ top: 0, behavior: "smooth" });

  const handleNext = () => {
    form.clearErrors();
    setStep2Error(null);

    const result = stepSchemas[currentStep].safeParse(form.getValues());
    if (!result.success) {
      const banner = new Set<string>();
      for (const issue of result.error.issues) {
        const path = issue.path.join(".");
        if (path === "customerName" || path === "bikeInfo" || path === "signatureData") {
          form.setError(path as "customerName" | "bikeInfo" | "signatureData", {
            message: issue.message,
          });
        }
        if (path.startsWith("checklist.")) {
          banner.add("Todos los ítems del checklist deben tener un estado asignado.");
        }
        if (path === "signatureData") banner.add(issue.message);
      }
      if (currentStep === 2 && banner.size > 0) {
        setStep2Error(Array.from(banner).join(" "));
      }
      return;
    }

    dispatch({ type: "NEXT" });
    scrollTop();
  };

  const handlePrev = () => {
    form.clearErrors();
    setStep2Error(null);
    dispatch({ type: "PREV" });
    scrollTop();
  };

  const handleSubmit = async () => {
    const data = form.getValues();

    const bikeInfo = data.bikeInfo?.trim() || "";
    if (!bikeInfo) {
      toast.error("Ingresa la descripción de la bicicleta en el paso 1.");
      return;
    }

    setIsSubmitting(true);

    try {
      const payload = {
        customerId: data.customerId,
        customerName: data.customerName,
        customerPhone: data.customerPhone,
        customerBikeId: data.customerBikeId,
        bikeInfo,
        diagnosis: data.diagnosis?.trim() || null,
        type: data.type,
        assignedTechId: data.assignedTechId ?? null,
        items: data.items.map((item) => ({
          serviceCatalogId: item.serviceCatalogId,
          description: item.description,
          quantity: item.quantity,
          price: item.price,
        })),
        checklist: data.checklist.map((item) => ({
          key: item.key,
          state: item.state as "OK" | "FAIL" | "NA",
          note: item.note || null,
        })),
        signatureData: data.signatureRejected ? null : (data.signatureData ?? null),
        signatureRejected: data.signatureRejected,
        photoUrls: data.photoUrls,
        expectedDeliveryDate: data.expectedDeliveryDate || undefined,
      };

      const res = await fetch("/api/workshop/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = (await res.json()) as {
        success: boolean;
        data?: { orderId: string; folio: string };
        error?: string;
      };

      if (result.success && result.data) {
        toast.success(`Orden ${result.data.folio} creada exitosamente`);
        const labelWindow = window.open(
          `/taller/etiqueta/${result.data.orderId}`,
          "_blank",
          "noopener,noreferrer",
        );
        if (!labelWindow) {
          toast.info("Etiqueta lista", {
            action: {
              label: "Imprimir etiqueta",
              onClick: () => window.open(`/taller/etiqueta/${result.data!.orderId}`, "_blank", "noopener,noreferrer"),
            },
          });
        }
        router.push(`/workshop/${result.data.orderId}`);
      } else {
        toast.error(result.error ?? "No se pudo crear la orden");
      }
    } catch {
      toast.error("Error de conexión al crear la orden");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div>
      <Stepper currentStep={currentStep} />

      <div
        className="rounded-2xl p-6 mb-6"
        style={{ background: "var(--surf-bright)" }}
        aria-labelledby={`step${currentStep}-title`}
      >
        <div className="text-xs font-medium mb-4 tracking-wide" style={{ color: "var(--on-surf-var)" }}>
          PASO {String(currentStep).padStart(2, "0")}/04 · {STEP_LABELS[currentStep - 1]}
        </div>

        {currentStep === 1 && (
          <Step1Cliente
            control={form.control}
            setValue={form.setValue}
            getValues={form.getValues}
            errors={form.formState.errors}
            maintenanceServices={maintenanceServices}
            userRole={userRole}
            prefillBike={prefillBike}
            prefillCustomer={
              prefillCustomer
                ? {
                    id: prefillCustomer.id,
                    name: prefillCustomer.name,
                    phone: prefillCustomer.phone,
                    bikes: prefillCustomer.bikes,
                  }
                : null
            }
            prefillMaintenanceStatus={prefillMaintenanceStatus}
          />
        )}
        {currentStep === 2 && (
          <Step2Checklist
            control={form.control}
            setValue={form.setValue}
            step2Error={step2Error}
          />
        )}
        {currentStep === 3 && (
          <Step3Fotos control={form.control} setValue={form.setValue} />
        )}
        {currentStep === 4 && (
          <Step4Tipo
            control={form.control}
            setValue={form.setValue}
            getValues={form.getValues}
            errors={form.formState.errors}
            technicians={technicians}
            maintenanceServices={maintenanceServices}
            allServices={allServices}
          />
        )}
      </div>

      {/* Navigation */}
      <div className="flex items-center justify-between gap-4">
        <button
          type="button"
          onClick={handlePrev}
          disabled={currentStep === 1}
          className="px-5 py-2.5 rounded-xl text-sm font-medium transition-colors"
          style={{
            background: "var(--surf-low)",
            color: currentStep === 1 ? "var(--on-surf-var)" : "var(--on-surf)",
            opacity: currentStep === 1 ? 0.4 : 1,
            cursor: currentStep === 1 ? "not-allowed" : "pointer",
          }}
          aria-label="Paso anterior"
        >
          ← Anterior
        </button>

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={handleNext}
            className="px-5 py-2.5 rounded-xl text-sm font-semibold transition-opacity"
            style={{ background: "var(--surf-highest)", color: "var(--p)" }}
            aria-label="Siguiente paso"
          >
            Siguiente →
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-opacity"
            style={{
              background: "linear-gradient(135deg, #1b4332, #2ecc71)",
              opacity: isSubmitting ? 0.7 : 1,
              cursor: isSubmitting ? "not-allowed" : "pointer",
            }}
            aria-label="Finalizar recepción e imprimir etiqueta"
          >
            {isSubmitting ? "Creando orden..." : "Finalizar Recepción e Imprimir Etiqueta"}
          </button>
        )}
      </div>
    </div>
  );
}
