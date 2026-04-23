"use client";

// Tab Datos del perfil (BRIEF §7.4 — Sub-fase I).
// Vista read-only con secciones colapsables, chips derivados + tags manuales,
// tabla CustomerEditLog (filtrada por rol en el loader) y sección Fusiones
// con undo dentro de ventana 30d para MANAGER+.

import Link from "next/link";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { formatDate, formatRelative } from "@/lib/format";
import { formatPhoneDisplay } from "@/lib/customers/phone";
import {
  SEGMENT_LABELS,
  SEGMENT_TOOLTIPS,
  type SegmentChip,
} from "@/lib/customers/segmentation";
import { AddTagDialog } from "./add-tag-dialog";
import { RemoveTagButton } from "./remove-tag-button";
import { UnmergeButton } from "./unmerge-button";
import type { ProfileBase } from "@/lib/customers/profile-data";
import type { DatosData, EditLogRow } from "@/lib/customers/profile-finanzas-data";

interface Props {
  customerId: string;
  base: ProfileBase;
  segments: SegmentChip[];
  data: DatosData;
  canManage: boolean; // MANAGER+ puede editar tags, deshacer fusiones
}

const FIELD_LABELS: Record<string, string> = {
  name: "Nombre",
  phone: "Teléfono",
  phone2: "Teléfono secundario",
  email: "Correo",
  rfc: "RFC",
  razonSocial: "Razón social",
  regimenFiscal: "Régimen fiscal",
  usoCFDI: "Uso CFDI",
  emailFiscal: "Correo fiscal",
  direccionFiscal: "Dirección fiscal",
  creditLimit: "Límite de crédito",
  birthday: "Fecha de nacimiento",
  isBusiness: "Es empresa",
  communicationConsent: "Consentimiento",
  tags: "Tags",
  shippingStreet: "Calle",
  shippingExtNum: "Num Ext",
  shippingIntNum: "Num Int",
  shippingColonia: "Colonia",
  shippingCity: "Ciudad",
  shippingState: "Estado",
  shippingZip: "CP",
  shippingRefs: "Referencias envío",
  odometerKm: "Odómetro (km)",
  __unmerge__: "Fusión revertida",
  __merge__: "Fusión",
};

function labelForField(field: string): string {
  return FIELD_LABELS[field] ?? field;
}

function ageFromBirthday(b: Date | null): number | null {
  if (!b) return null;
  const now = new Date();
  let years = now.getFullYear() - b.getFullYear();
  const m = now.getMonth() - b.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < b.getDate())) years -= 1;
  return years;
}

export function TabDatos({
  customerId,
  base,
  segments,
  data,
  canManage,
}: Props): React.JSX.Element {
  const age = ageFromBirthday(base.birthday);
  const customerSince = data.base.createdAt;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center justify-between gap-3">
        <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
          Vista de solo lectura. Para editar, usa el botón a la derecha.
        </p>
        <Link
          href={`/customers/${customerId}/editar`}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold"
          style={{
            borderRadius: "var(--r-full)",
            background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
            color: "var(--on-p)",
            fontFamily: "var(--font-display)",
          }}
        >
          <Icon name="more" size={12} />
          Editar datos
        </Link>
      </header>

      <Section title="Identidad" defaultOpen>
        <Field label="Nombre completo" value={base.name} />
        <Field
          label="Fecha de nacimiento"
          value={
            base.birthday
              ? `${formatDate(base.birthday, "medium")}${age != null ? ` · ${age} años` : ""}`
              : null
          }
        />
        <Field label="Cliente desde" value={formatDate(customerSince, "medium")} />
        <Field
          label="Tipo"
          value={base.isBusiness ? "Empresa" : "Persona física"}
        />
        {data.base.razonSocial && base.isBusiness && (
          <Field label="Razón social" value={data.base.razonSocial} />
        )}
      </Section>

      <Section title="Contacto" defaultOpen>
        <Field
          label="Teléfono principal"
          value={base.phone ? formatPhoneDisplay(base.phone) : null}
        />
        <Field
          label="Teléfono secundario"
          value={base.phone2 ? formatPhoneDisplay(base.phone2) : null}
        />
        {data.base.phonePrevious && (
          <Field
            label="Teléfono anterior"
            value={formatPhoneDisplay(data.base.phonePrevious)}
            muted
          />
        )}
        <Field label="Correo" value={base.email} />
        <div className="flex items-center gap-2 text-xs">
          <span
            className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
            style={{ color: "var(--on-surf-var)", minWidth: 140 }}
          >
            Consentimiento
          </span>
          {base.communicationConsent ? (
            <Chip variant="success" label="Aceptado" />
          ) : (
            <Chip variant="error" label="No aceptado" />
          )}
        </div>
      </Section>

      <Section title="Datos fiscales">
        <Field label="RFC" value={base.rfc} mono />
        <Field label="Razón social" value={data.base.razonSocial} />
        <Field label="Régimen fiscal" value={data.base.regimenFiscal} />
        <Field label="Uso CFDI" value={data.base.usoCFDI} />
        <Field label="Correo fiscal" value={data.base.emailFiscal} />
        <Field label="Dirección fiscal" value={data.base.direccionFiscal} />
      </Section>

      <Section title="Dirección de envío">
        <Field label="Calle" value={data.base.shippingStreet} />
        <Field label="Num Ext" value={data.base.shippingExtNum} />
        <Field label="Num Int" value={data.base.shippingIntNum} />
        <Field label="Colonia" value={data.base.shippingColonia} />
        <Field label="Ciudad" value={base.shippingCity} />
        <Field label="Estado" value={base.shippingState} />
        <Field label="CP" value={data.base.shippingZip} />
        <Field label="Referencias" value={data.base.shippingRefs} />
      </Section>

      <Section title="Segmentación" defaultOpen>
        <div className="flex flex-col gap-3">
          <div>
            <p
              className="text-[0.625rem] uppercase tracking-[0.05em] font-medium mb-1.5"
              style={{ color: "var(--on-surf-var)" }}
            >
              Chips automáticos
            </p>
            {segments.length === 0 ? (
              <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                Sin chips derivados para este cliente.
              </p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {segments.map((s) => (
                  <span key={s} title={SEGMENT_TOOLTIPS[s]}>
                    <Chip variant="neutral" label={SEGMENT_LABELS[s]} />
                  </span>
                ))}
              </div>
            )}
          </div>
          <div>
            <p
              className="text-[0.625rem] uppercase tracking-[0.05em] font-medium mb-1.5"
              style={{ color: "var(--on-surf-var)" }}
            >
              Tags manuales
            </p>
            <div className="flex flex-wrap items-center gap-1.5">
              {base.tags.length === 0 && (
                <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                  Sin tags asignados.
                </span>
              )}
              {base.tags.map((t) => (
                <span
                  key={t}
                  className="inline-flex items-center gap-1 rounded-[var(--r-full)] px-2 py-0.5 text-[0.625rem] font-medium tracking-[0.04em] uppercase"
                  style={{
                    background: "color-mix(in srgb, var(--data-3) 18%, transparent)",
                    color: "var(--on-surf)",
                  }}
                >
                  <Icon name="bookmark" size={10} />
                  {t}
                  {canManage && <RemoveTagButton customerId={customerId} tag={t} />}
                </span>
              ))}
              {canManage && (
                <AddTagDialog customerId={customerId} existingTags={base.tags} />
              )}
            </div>
          </div>
        </div>
      </Section>

      <Section
        title={`Historial de cambios (${data.editLog.length})`}
        hint={!canManage ? "Solo tus propias ediciones" : undefined}
      >
        <EditLogTable entries={data.editLog} />
      </Section>

      {data.mergedSources.length > 0 && (
        <Section title={`Fusiones recibidas (${data.mergedSources.length})`} defaultOpen>
          <ul className="flex flex-col gap-2">
            {data.mergedSources.map((m) => (
              <li
                key={m.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--r-md)] px-3 py-2"
                style={{ background: "var(--surf-low)" }}
              >
                <div className="flex flex-col min-w-0">
                  <span
                    className="text-sm font-semibold truncate"
                    style={{ color: "var(--on-surf)" }}
                  >
                    {m.name}
                  </span>
                  <span
                    className="text-[0.6875rem]"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    {m.phone ? formatPhoneDisplay(m.phone) : "Sin teléfono"}
                    {m.email ? ` · ${m.email}` : ""}
                  </span>
                  <span
                    className="text-[0.6875rem] mt-0.5"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    Fusionado {formatRelative(m.mergedAt)}
                  </span>
                </div>
                {canManage && (
                  <UnmergeButton
                    sourceId={m.id}
                    sourceName={m.name}
                    daysUntilUndoExpires={m.daysUntilUndoExpires}
                  />
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  hint,
  defaultOpen,
  children,
}: {
  title: string;
  hint?: string;
  defaultOpen?: boolean;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <details
      open={defaultOpen}
      className="rounded-[var(--r-lg)] p-4"
      style={{ background: "var(--surf-lowest)" }}
    >
      <summary
        className="cursor-pointer flex items-center justify-between gap-2 list-none"
        style={{ color: "var(--on-surf)" }}
      >
        <span className="flex items-center gap-2">
          <span
            className="text-sm font-semibold tracking-[-0.01em]"
            style={{ fontFamily: "var(--font-display)" }}
          >
            {title}
          </span>
          {hint && (
            <span
              className="text-[0.6875rem]"
              style={{ color: "var(--on-surf-var)" }}
            >
              {hint}
            </span>
          )}
        </span>
        <Icon name="chevronDown" size={14} />
      </summary>
      <div className="mt-3 flex flex-col gap-2">{children}</div>
    </details>
  );
}

function Field({
  label,
  value,
  mono,
  muted,
}: {
  label: string;
  value: string | null | undefined;
  mono?: boolean;
  muted?: boolean;
}): React.JSX.Element {
  const filled = value != null && value !== "";
  return (
    <div className="flex items-start gap-2 text-xs py-0.5">
      <span
        className="text-[0.6875rem] uppercase tracking-[0.05em] font-medium"
        style={{ color: "var(--on-surf-var)", minWidth: 140 }}
      >
        {label}
      </span>
      <span
        className={mono ? "font-mono" : ""}
        style={{
          color: filled && !muted ? "var(--on-surf)" : "var(--on-surf-var)",
        }}
      >
        {filled ? value : "—"}
      </span>
    </div>
  );
}

function EditLogTable({ entries }: { entries: EditLogRow[] }): React.JSX.Element {
  if (entries.length === 0) {
    return (
      <p className="text-xs py-4 text-center" style={{ color: "var(--on-surf-var)" }}>
        Sin cambios registrados.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" style={{ color: "var(--on-surf)" }}>
        <thead>
          <tr style={{ color: "var(--on-surf-var)" }}>
            <Th>Fecha</Th>
            <Th>Campo</Th>
            <Th>Cambio</Th>
            <Th>Motivo</Th>
            <Th>Autor</Th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr
              key={e.id}
              style={{ borderTop: "1px solid var(--surf-low)" }}
            >
              <Td>
                <span className="whitespace-nowrap" style={{ color: "var(--on-surf-var)" }}>
                  {formatDate(e.createdAt)}
                </span>
              </Td>
              <Td>
                <span className="font-semibold">{labelForField(e.field)}</span>
                {e.customerBikeId && (
                  <span
                    className="ml-1 text-[0.625rem] uppercase tracking-[0.04em]"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    · bici
                  </span>
                )}
              </Td>
              <Td>
                <div className="flex items-center gap-1.5 max-w-[320px]">
                  <span
                    className="truncate"
                    style={{ color: "var(--on-surf-var)" }}
                    title={e.oldValue ?? ""}
                  >
                    {e.oldValue ?? "—"}
                  </span>
                  <Icon name="arrowRight" size={10} />
                  <span
                    className="truncate font-medium"
                    style={{ color: "var(--on-surf)" }}
                    title={e.newValue ?? ""}
                  >
                    {e.newValue ?? "—"}
                  </span>
                </div>
              </Td>
              <Td>
                <span
                  className="line-clamp-2 max-w-[240px]"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  {e.reason ?? "—"}
                </span>
              </Td>
              <Td>
                <span style={{ color: "var(--on-surf-var)" }}>
                  {e.authorName ?? "—"}
                </span>
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <th className="py-2 px-2 text-left text-[0.625rem] uppercase tracking-[0.05em] font-medium">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }): React.JSX.Element {
  return <td className="py-2 px-2 align-top">{children}</td>;
}
