"use client";

// Tab Bicis del perfil de cliente (BRIEF §7.4 — Sub-fase F).
// Cada CustomerBike se renderiza como una card ancha con 3 secciones
// (identidad · datos técnicos · acciones) + 3 accordions (baterías /
// voltajes / mantenimientos) + modal Editar odómetro.
//
// Kebab: Editar odómetro (funcional) + enlace a Taller. Los flujos de
// cambio de voltaje / batería / baja viven en el módulo de Taller, por
// lo que no los duplicamos aquí (la comentario explica la intención del
// BRIEF y prevé el paso por workshop).

import Link from "next/link";
import { useState } from "react";
import { Icon } from "@/components/primitives/icon";
import { Chip } from "@/components/primitives/chip";
import { formatDate, formatMXN, formatRelative } from "@/lib/format";
import type {
  BikeCardData,
  BikeBatteryRecord,
  BikeVoltageRecord,
  BikeMaintenanceRecord,
  BikeOdometerRecord,
} from "@/lib/customers/profile-tabs-data";
import { EditOdometerDialog } from "./edit-odometer-dialog";

interface Props {
  customerId: string;
  customerName: string;
  bikes: BikeCardData[];
  role: string;
}

const MAINT_VARIANT = {
  AL_CORRIENTE: "success",
  POR_VENCER: "warn",
  VENCIDO: "error",
} as const;

const MAINT_LABEL = {
  AL_CORRIENTE: "Al corriente",
  POR_VENCER: "Por vencer",
  VENCIDO: "Vencido",
} as const;

const SO_TYPE_LABEL: Record<string, string> = {
  PAID: "Pagada",
  WARRANTY: "Garantía",
  COURTESY: "Cortesía",
  POLICY_MAINTENANCE: "Mant. póliza",
};

const SO_STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En proceso",
  COMPLETED: "Completada",
  DELIVERED: "Entregada",
  CANCELLED: "Cancelada",
};

export function TabBicis({
  customerId,
  customerName,
  bikes,
  role,
}: Props): React.JSX.Element {
  void customerName;
  const canEditOdo = role !== "SELLER"; // BRIEF: TECHNICIAN+ edita odómetro

  if (bikes.length === 0) {
    return (
      <section
        className="rounded-[var(--r-lg)] p-10 flex flex-col items-center gap-3 text-center"
        style={{ background: "var(--surf-lowest)" }}
      >
        <span
          className="h-12 w-12 rounded-[var(--r-lg)] flex items-center justify-center"
          style={{
            background: "color-mix(in srgb, var(--p) 12%, transparent)",
            color: "var(--p)",
          }}
        >
          <Icon name="bike" size={20} />
        </span>
        <h3
          className="text-base font-semibold tracking-[-0.01em]"
          style={{ color: "var(--on-surf)", fontFamily: "var(--font-display)" }}
        >
          Este cliente no tiene bicis registradas
        </h3>
        <p className="text-sm max-w-md" style={{ color: "var(--on-surf-var)" }}>
          Al vender o recibir una unidad con VIN a este cliente, aparecerá
          automáticamente en este tab.
        </p>
        <Link
          href={`/point-of-sale?customerId=${customerId}`}
          className="mt-2 inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold"
          style={{
            borderRadius: "var(--r-full)",
            background: "var(--surf-high)",
            color: "var(--on-surf)",
            fontFamily: "var(--font-display)",
          }}
        >
          <Icon name="sales" size={13} /> Nueva venta
        </Link>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {bikes.map((bike) => (
        <BikeCard
          key={bike.id}
          bike={bike}
          customerId={customerId}
          canEditOdo={canEditOdo}
        />
      ))}
    </div>
  );
}

function BikeCard({
  bike,
  customerId,
  canEditOdo,
}: {
  bike: BikeCardData;
  customerId: string;
  canEditOdo: boolean;
}): React.JSX.Element {
  void customerId;
  const [expanded, setExpanded] = useState<"BAT" | "VOLT" | "MANT" | null>(null);

  const isOverdueMant = bike.maintenance?.nivel === "VENCIDO";
  const maintChipVariant = bike.maintenance
    ? MAINT_VARIANT[bike.maintenance.nivel]
    : undefined;

  return (
    <section
      className="rounded-[var(--r-lg)] p-5 flex flex-col gap-4"
      style={{ background: "var(--surf-lowest)" }}
    >
      {isOverdueMant && (
        <div
          className="flex items-center gap-3 px-4 py-3"
          style={{
            background: "var(--ter-container)",
            borderRadius: "var(--r-md)",
            borderLeft: "3px solid var(--ter)",
          }}
        >
          <Icon name="alert" size={16} />
          <div className="flex-1 min-w-0">
            <p
              className="text-sm font-semibold"
              style={{ color: "var(--on-ter-container)" }}
            >
              Mantenimiento programado — revisión pendiente para VIN{" "}
              {bike.serialNumber}
            </p>
            {bike.maintenance && (
              <p
                className="text-xs"
                style={{ color: "var(--on-ter-container)" }}
              >
                {Math.abs(bike.maintenance.diasRestantes)} día
                {Math.abs(bike.maintenance.diasRestantes) === 1 ? "" : "s"}{" "}
                vencidos · próxima estimada{" "}
                {formatDate(bike.maintenance.proximaFecha, "medium")}
              </p>
            )}
          </div>
          <Link
            href={`/workshop/recepcion?customerBikeId=${bike.id}`}
            className="shrink-0 px-3 py-1.5 text-xs font-semibold"
            style={{
              borderRadius: "var(--r-full)",
              background: "var(--surf-bright)",
              color: "var(--on-surf)",
              fontFamily: "var(--font-display)",
            }}
          >
            Agendar cita
          </Link>
        </div>
      )}

      <div className="grid grid-cols-[220px_1fr_200px] max-[900px]:grid-cols-1 gap-5 items-start">
        {/* Izquierda — identidad */}
        <div className="flex flex-col gap-3">
          <div
            className="aspect-[4/3] rounded-[var(--r-md)] overflow-hidden flex items-center justify-center"
            style={{ background: "var(--surf-high)" }}
          >
            {bike.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={bike.imageUrl}
                alt={`${bike.brand ?? ""} ${bike.model ?? ""}`.trim()}
                className="w-full h-full object-contain"
              />
            ) : (
              <Icon name="bike" size={42} />
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            <Chip
              variant={
                bike.operationalStatus === "IN_WORKSHOP" ? "warn" : "success"
              }
              label={
                bike.operationalStatus === "IN_WORKSHOP"
                  ? "En taller"
                  : "Operativa"
              }
            />
            {bike.maintenance && maintChipVariant && (
              <Chip
                variant={maintChipVariant}
                label={MAINT_LABEL[bike.maintenance.nivel]}
              />
            )}
          </div>
        </div>

        {/* Centro — datos técnicos */}
        <div className="flex flex-col gap-4 min-w-0">
          <div>
            <h3
              className="text-lg font-bold tracking-[-0.01em]"
              style={{
                color: "var(--on-surf)",
                fontFamily: "var(--font-display)",
              }}
            >
              {[bike.brand, bike.model].filter(Boolean).join(" ") ||
                "Vehículo sin modelo"}
            </h3>
            <p
              className="text-xs font-mono mt-0.5"
              style={{ color: "var(--on-surf-var)" }}
            >
              VIN {bike.serialNumber}
            </p>
          </div>

          <dl className="grid grid-cols-2 max-[600px]:grid-cols-1 gap-x-6 gap-y-3 text-xs">
            <DataLine label="Color" value={bike.color ?? "—"} />
            <DataLine label="Voltaje" value={bike.voltaje ?? "—"} />
            <div className="flex flex-col gap-0.5 min-w-0">
              <dt
                className="text-[0.625rem] uppercase tracking-[0.05em] font-medium"
                style={{ color: "var(--on-surf-var)" }}
              >
                Odómetro
              </dt>
              <dd
                className="text-sm font-semibold flex items-center gap-1.5 tabular-nums"
                style={{ color: "var(--on-surf)" }}
              >
                {bike.odometerKm != null
                  ? `${bike.odometerKm.toLocaleString("es-MX")} km`
                  : "No registrado"}
                {canEditOdo && (
                  <EditOdometerDialog
                    bikeId={bike.id}
                    currentValue={bike.odometerKm}
                    trigger={
                      <button
                        type="button"
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 text-[0.625rem] font-medium"
                        style={{
                          borderRadius: "var(--r-sm)",
                          background: "var(--surf-high)",
                          color: "var(--on-surf-var)",
                        }}
                        title="Editar odómetro"
                      >
                        <Icon name="sliders" size={11} /> Editar
                      </button>
                    }
                  />
                )}
              </dd>
              {bike.odometerHistory.length > 0 && (
                <span
                  className="text-[0.625rem] mt-0.5"
                  style={{ color: "var(--on-surf-var)" }}
                  title={bike.odometerHistory
                    .map(
                      (h) =>
                        `${formatDate(h.createdAt, "short")}: ${h.oldValue ?? "—"} → ${
                          h.newValue ?? "—"
                        } km${h.authorName ? ` (${h.authorName})` : ""}`,
                    )
                    .join("\n")}
                >
                  {bike.odometerHistory.length} cambio
                  {bike.odometerHistory.length === 1 ? "" : "s"} registrado
                  {bike.odometerHistory.length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <DataLine
              label="Batería actual"
              value={bike.currentBatterySerial ?? "Sin asignación"}
            />
            <DataLine
              label="Último mantenimiento"
              value={
                bike.lastMaintenanceAt
                  ? `${bike.lastMaintenanceFolio} · ${formatRelative(bike.lastMaintenanceAt)}`
                  : "Sin historial"
              }
            />
            <DataLine
              label="Fecha de compra"
              value={
                bike.purchaseDate ? formatDate(bike.purchaseDate, "medium") : "—"
              }
            />
          </dl>
        </div>

        {/* Derecha — acciones */}
        <div className="flex flex-col gap-2">
          <Link
            href={`/workshop/recepcion?customerBikeId=${bike.id}`}
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold"
            style={{
              borderRadius: "var(--r-full)",
              background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
              color: "var(--on-p)",
              fontFamily: "var(--font-display)",
            }}
          >
            <Icon name="wrench" size={13} />
            Nueva orden
          </Link>
          {bike.hasAssemblyHistory && (
            <Link
              href={`/workshop?bikeId=${bike.id}`}
              className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium"
              style={{
                borderRadius: "var(--r-full)",
                background: "var(--surf-high)",
                color: "var(--on-surf)",
              }}
            >
              <Icon name="box" size={13} />
              Ver ensamble
            </Link>
          )}
          <span
            className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium opacity-50 cursor-not-allowed"
            style={{
              borderRadius: "var(--r-full)",
              background: "var(--surf-high)",
              color: "var(--on-surf-var)",
            }}
            title="La ficha PDF por bici llega en Sub-fase K"
          >
            <Icon name="download" size={13} />
            Historial PDF
          </span>
        </div>
      </div>

      {/* Accordions */}
      <div className="flex flex-col gap-1.5">
        <AccordionRow
          label={`Historial de baterías (${bike.batteries.length})`}
          icon="box"
          expanded={expanded === "BAT"}
          onToggle={() => setExpanded(expanded === "BAT" ? null : "BAT")}
        >
          <BatteriesList records={bike.batteries} />
        </AccordionRow>
        <AccordionRow
          label={`Historial de voltaje (${bike.voltages.length})`}
          icon="commission"
          expanded={expanded === "VOLT"}
          onToggle={() => setExpanded(expanded === "VOLT" ? null : "VOLT")}
        >
          <VoltagesList records={bike.voltages} />
        </AccordionRow>
        <AccordionRow
          label={`Historial de mantenimientos (${bike.maintenances.length})`}
          icon="wrench"
          expanded={expanded === "MANT"}
          onToggle={() => setExpanded(expanded === "MANT" ? null : "MANT")}
        >
          <MaintenancesList records={bike.maintenances} />
        </AccordionRow>

        {bike.odometerHistory.length > 0 && (
          <OdometerHistoryInline records={bike.odometerHistory} />
        )}
      </div>
    </section>
  );
}

function DataLine({
  label,
  value,
}: {
  label: string;
  value: string;
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-0.5 min-w-0">
      <dt
        className="text-[0.625rem] uppercase tracking-[0.05em] font-medium"
        style={{ color: "var(--on-surf-var)" }}
      >
        {label}
      </dt>
      <dd
        className="text-sm font-semibold truncate"
        style={{ color: "var(--on-surf)" }}
        title={value}
      >
        {value}
      </dd>
    </div>
  );
}

function AccordionRow({
  label,
  icon,
  expanded,
  onToggle,
  children,
}: {
  label: string;
  icon: "box" | "commission" | "wrench";
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}): React.JSX.Element {
  return (
    <div
      className="rounded-[var(--r-md)]"
      style={{ background: "var(--surf-low)" }}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-4 py-2.5"
      >
        <span
          className="flex items-center gap-2 text-xs font-semibold"
          style={{ color: "var(--on-surf)" }}
        >
          <Icon name={icon} size={13} />
          {label}
        </span>
        <span
          style={{
            transition: "transform .2s",
            transform: expanded ? "rotate(180deg)" : "rotate(0)",
            color: "var(--on-surf-var)",
          }}
        >
          <Icon name="chevronDown" size={14} />
        </span>
      </button>
      {expanded && (
        <div className="px-4 pb-3 pt-1 text-xs">{children}</div>
      )}
    </div>
  );
}

function BatteriesList({
  records,
}: {
  records: BikeBatteryRecord[];
}): React.JSX.Element {
  if (records.length === 0) {
    return <EmptyLine message="Sin asignaciones de batería registradas." />;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {records.map((r) => (
        <li
          key={r.id}
          className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-sm)]"
          style={{ background: "var(--surf-lowest)" }}
        >
          <span
            className="h-1.5 w-1.5 rounded-full shrink-0"
            style={{
              background: r.isCurrent ? "var(--sec)" : "var(--on-surf-var)",
            }}
          />
          <span
            className="font-mono font-semibold shrink-0"
            style={{ color: "var(--on-surf)" }}
          >
            {r.batterySerial}
          </span>
          <span style={{ color: "var(--on-surf-var)" }}>
            {formatDate(r.assignedAt, "short")}
            {r.unassignedAt
              ? ` → ${formatDate(r.unassignedAt, "short")}`
              : " → actualmente instalada"}
          </span>
          {r.voltageAtInstall && (
            <Chip variant="neutral" label={r.voltageAtInstall} />
          )}
          {r.notes && (
            <span
              className="truncate"
              style={{ color: "var(--on-surf-var)" }}
              title={r.notes}
            >
              {r.notes}
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

function VoltagesList({
  records,
}: {
  records: BikeVoltageRecord[];
}): React.JSX.Element {
  if (records.length === 0) {
    return <EmptyLine message="Sin cambios de voltaje registrados." />;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {records.map((r) => (
        <li
          key={r.id}
          className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-sm)]"
          style={{ background: "var(--surf-lowest)" }}
        >
          <span
            className="font-semibold shrink-0"
            style={{ color: "var(--on-surf)" }}
          >
            {r.fromVoltage} → {r.toVoltage}
          </span>
          <Chip
            variant={r.reason === "PRE_SALE" ? "info" : "neutral"}
            label={r.reason === "PRE_SALE" ? "Pre-venta" : "Post-venta"}
          />
          <span style={{ color: "var(--on-surf-var)" }}>
            {formatDate(r.createdAt, "short")}
            {r.authorName ? ` · ${r.authorName}` : ""}
          </span>
        </li>
      ))}
    </ul>
  );
}

function MaintenancesList({
  records,
}: {
  records: BikeMaintenanceRecord[];
}): React.JSX.Element {
  if (records.length === 0) {
    return <EmptyLine message="Sin órdenes de taller registradas." />;
  }
  return (
    <ul className="flex flex-col gap-1.5">
      {records.map((r) => (
        <li
          key={r.id}
          className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-sm)]"
          style={{ background: "var(--surf-lowest)" }}
        >
          <Link
            href={`/workshop/${r.id}`}
            className="font-semibold shrink-0 hover:underline"
            style={{ color: "var(--on-surf)" }}
          >
            {r.folio}
          </Link>
          <Chip
            variant={r.type === "WARRANTY" ? "info" : "neutral"}
            label={SO_TYPE_LABEL[r.type] ?? r.type}
          />
          <Chip
            variant={
              r.status === "DELIVERED"
                ? "success"
                : r.status === "CANCELLED"
                  ? "error"
                  : "warn"
            }
            label={SO_STATUS_LABEL[r.status] ?? r.status}
          />
          <span
            className="tabular-nums"
            style={{ color: "var(--on-surf-var)" }}
          >
            {formatDate(r.createdAt, "short")}
          </span>
          <span
            className="truncate flex-1 min-w-0"
            style={{ color: "var(--on-surf-var)" }}
          >
            {r.serviceLabels.join(" · ") || "Sin detalle"}
          </span>
          <span
            className="tabular-nums font-semibold shrink-0"
            style={{ color: "var(--on-surf)" }}
          >
            {formatMXN(r.total)}
          </span>
        </li>
      ))}
    </ul>
  );
}

function OdometerHistoryInline({
  records,
}: {
  records: BikeOdometerRecord[];
}): React.JSX.Element {
  return (
    <details
      className="rounded-[var(--r-md)]"
      style={{ background: "var(--surf-low)" }}
    >
      <summary
        className="px-4 py-2 text-xs font-semibold flex items-center gap-2 cursor-pointer list-none"
        style={{ color: "var(--on-surf)" }}
      >
        <Icon name="sliders" size={13} />
        Historial de odómetro ({records.length})
      </summary>
      <ul className="px-4 pb-3 flex flex-col gap-1 text-xs">
        {records.map((r) => (
          <li
            key={r.id}
            className="flex items-center gap-3 px-3 py-2 rounded-[var(--r-sm)]"
            style={{ background: "var(--surf-lowest)" }}
          >
            <span
              className="tabular-nums font-semibold"
              style={{ color: "var(--on-surf)" }}
            >
              {r.oldValue ?? "—"} → {r.newValue ?? "—"} km
            </span>
            <span style={{ color: "var(--on-surf-var)" }}>
              {formatDate(r.createdAt, "short")}
              {r.authorName ? ` · ${r.authorName}` : ""}
            </span>
            {r.reason && (
              <span
                className="truncate flex-1 min-w-0"
                style={{ color: "var(--on-surf-var)" }}
                title={r.reason}
              >
                {r.reason}
              </span>
            )}
          </li>
        ))}
      </ul>
    </details>
  );
}

function EmptyLine({ message }: { message: string }): React.JSX.Element {
  return (
    <p className="py-2" style={{ color: "var(--on-surf-var)" }}>
      {message}
    </p>
  );
}
