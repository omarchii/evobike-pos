"use client";

import Link from "next/link";
import { DetailHeader } from "@/components/reportes/shell";
import { Icon, type IconName } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";

type WizardStep = {
  index: number;
  title: string;
  description: string;
  icon: IconName;
  options: string[];
};

const STEPS: WizardStep[] = [
  {
    index: 1,
    title: "Tipo de exportación",
    description: "Qué documento contable necesitas generar",
    icon: "invoice",
    options: ["Pólizas contables", "Balanza de comprobación", "Catálogo de cuentas", "Auxiliares"],
  },
  {
    index: 2,
    title: "Período",
    description: "Rango de fechas incluidas en la exportación",
    icon: "calendar",
    options: ["Mes en curso", "Mes anterior", "Trimestre", "Personalizado"],
  },
  {
    index: 3,
    title: "Formato",
    description: "Estándar contable de salida",
    icon: "export",
    options: ["XML CFDI (SAT)", "Excel", "PDF"],
  },
  {
    index: 4,
    title: "Confirmar y generar",
    description: "Revisa los datos y genera el archivo",
    icon: "check",
    options: ["Generar exportación"],
  },
];

export function ExportacionContableView() {
  return (
    <div className="mx-auto max-w-5xl px-6 pb-12">
      <DetailHeader
        title="Exportación contable"
        subtitle="Pólizas, balanza y CFDI para integración con tu contador"
      />

      {/* Aviso superior */}
      <div
        className="mb-8 rounded-[var(--r-lg)] p-5"
        style={{
          background: "var(--p-container)",
          color: "var(--on-p-container)",
        }}
      >
        <div className="flex items-start gap-3">
          <span className="mt-0.5 shrink-0">
            <Icon name="bell" size={20} strokeWidth={1.5} />
          </span>
          <div className="min-w-0">
            <p className="font-semibold mb-1" style={{ fontFamily: "var(--font-display)" }}>
              Módulo en desarrollo
            </p>
            <p className="text-sm leading-relaxed opacity-90">
              La generación automática de CFDI XML y pólizas contables requiere integración con un PAC certificado. Esta vista muestra el flujo propuesto; el backend se habilitará en una versión posterior. Mientras tanto, puedes descargar datos en CSV desde los reportes existentes.
            </p>
          </div>
        </div>
      </div>

      {/* Wizard visual */}
      <div className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2
            className="text-sm font-semibold uppercase tracking-[0.08em] text-[var(--on-surf-var)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Flujo propuesto
          </h2>
          <Chip variant="info" label="Próximamente" />
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          {STEPS.map((step) => (
            <WizardCard key={step.index} step={step} />
          ))}
        </div>
      </div>

      {/* Alternativa disponible */}
      <div className="rounded-[var(--r-lg)] bg-[var(--surf-lowest)] p-6 shadow-[var(--shadow)]">
        <div className="mb-3 flex items-center gap-2">
          <span className="text-[var(--p-bright)]">
            <Icon name="download" size={18} strokeWidth={1.75} />
          </span>
          <h3
            className="text-base font-semibold text-[var(--on-surf)]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            Alternativa disponible hoy
          </h3>
        </div>
        <p className="mb-4 text-sm text-[var(--on-surf-var)] leading-relaxed">
          El reporte de <strong>Ventas e ingresos</strong> incluye exportación a CSV, Excel y PDF con el detalle por venta, método de pago y vendedor. Tu contador puede usar ese archivo como insumo mientras habilitamos CFDI.
        </p>
        <Link
          href="/reportes/ventas-e-ingresos"
          className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--p-bright)] px-4 py-2 text-sm font-medium text-[var(--on-p)] transition-opacity hover:opacity-90"
        >
          Ir a Ventas e ingresos
          <Icon name="arrowRight" size={14} strokeWidth={2} />
        </Link>
      </div>
    </div>
  );
}

function WizardCard({ step }: { step: WizardStep }) {
  return (
    <div
      className="relative rounded-[var(--r-lg)] bg-[var(--surf-lowest)] p-5 shadow-[var(--shadow)] opacity-70"
      aria-disabled="true"
    >
      <div className="mb-3 flex items-start justify-between">
        <div className="flex items-center gap-3">
          <span
            className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--surf-high)] text-[var(--on-surf-var)] text-xs font-semibold"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {step.index}
          </span>
          <span className="text-[var(--p-bright)]">
            <Icon name={step.icon} size={18} strokeWidth={1.5} />
          </span>
        </div>
      </div>

      <p
        className="text-[1rem] font-semibold leading-tight text-[var(--on-surf)] mb-1"
        style={{ fontFamily: "var(--font-display)" }}
      >
        {step.title}
      </p>
      <p className="mb-4 text-[0.8125rem] text-[var(--on-surf-var)] leading-snug">
        {step.description}
      </p>

      <div className="flex flex-wrap gap-1.5">
        {step.options.map((opt) => (
          <span
            key={opt}
            className="rounded-[var(--r-full)] bg-[var(--surf-high)] px-2.5 py-1 text-[0.6875rem] text-[var(--on-surf-var)]"
          >
            {opt}
          </span>
        ))}
      </div>
    </div>
  );
}
