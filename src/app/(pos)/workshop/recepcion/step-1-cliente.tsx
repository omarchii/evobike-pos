"use client";

import { useState, useEffect, useCallback } from "react";
import { useWatch } from "react-hook-form";
import type { Control, UseFormSetValue, UseFormGetValues, FieldErrors } from "react-hook-form";
import { useDebouncedCallback } from "use-debounce";
import { Search, Bike, AlertTriangle, CheckCircle, Clock, ChevronRight } from "lucide-react";
import type { WizardFormData } from "./recepcion-wizard";
import type { MaintenanceServiceOption } from "@/lib/workshop-types";

interface CustomerBike {
  id: string;
  brand: string | null;
  model: string | null;
  serialNumber: string;
  color: string | null;
}

interface CustomerResult {
  id: string;
  name: string;
  phone: string | null;
  rfc: string | null;
  bikes: CustomerBike[];
}

interface MaintenanceStatusResult {
  nivel: string;
  diasRestantes: number;
}

interface Step1Props {
  control: Control<WizardFormData>;
  setValue: UseFormSetValue<WizardFormData>;
  getValues: UseFormGetValues<WizardFormData>;
  errors: FieldErrors<WizardFormData>;
  maintenanceServices: MaintenanceServiceOption[];
  userRole: string;
  prefillBike: { id: string; brand: string | null; model: string | null; serialNumber: string; color: string | null } | null;
  prefillCustomer: { id: string; name: string; phone: string | null; bikes: CustomerBike[] } | null;
  prefillMaintenanceStatus: { nivel: string; diasRestantes: number } | null;
}

function formatBikeLabel(bike: CustomerBike): string {
  const parts = [bike.brand, bike.model].filter(Boolean).join(" ");
  return `${parts || "Bicicleta"} — VIN: ${bike.serialNumber}`;
}

function MaintenanceBanner({
  status,
  maintenanceServices,
  userRole,
  setValue,
  getValues,
}: {
  status: MaintenanceStatusResult;
  maintenanceServices: MaintenanceServiceOption[];
  userRole: string;
  setValue: UseFormSetValue<WizardFormData>;
  getValues: UseFormGetValues<WizardFormData>;
}) {
  const addMaintenance = useWatch({ name: "addMaintenance" } as { name: "addMaintenance" }) as boolean;
  const maintenanceServiceId = useWatch({ name: "maintenanceServiceId" } as { name: "maintenanceServiceId" }) as string | undefined;
  const [showServiceSelect, setShowServiceSelect] = useState(false);

  const isVencido = status.nivel === "VENCIDO";
  const isPorVencer = status.nivel === "POR_VENCER";
  const isAlCorriente = status.nivel === "AL_CORRIENTE";

  const chipColor = isVencido
    ? "var(--err)"
    : isPorVencer
      ? "#f57c00"
      : "var(--p-bright)";
  const chipBg = isVencido
    ? "rgba(211,47,47,0.12)"
    : isPorVencer
      ? "rgba(245,124,0,0.12)"
      : "rgba(46,204,113,0.12)";

  const statusLabel = isVencido
    ? "Mantenimiento vencido"
    : isPorVencer
      ? `Por vencer en ${status.diasRestantes} día${status.diasRestantes !== 1 ? "s" : ""}`
      : "Mantenimiento al día";

  const StatusIcon = isVencido ? AlertTriangle : isPorVencer ? Clock : CheckCircle;

  const toggleMaintenance = (checked: boolean) => {
    if (!checked) {
      const currentItems = getValues("items");
      const maintIds = new Set(maintenanceServices.map((s) => s.id));
      setValue("items", currentItems.filter((i) => !maintIds.has(i.serviceCatalogId ?? "")));
      if (getValues("type") === "POLICY_MAINTENANCE") setValue("type", "PAID");
      setValue("addMaintenance", false);
      setValue("maintenanceServiceId", undefined);
      setShowServiceSelect(false);
      return;
    }

    setValue("addMaintenance", true);

    if (maintenanceServices.length === 0) return;

    if (maintenanceServices.length === 1) {
      const svc = maintenanceServices[0]!;
      applyMaintenanceService(svc.id);
    } else {
      setShowServiceSelect(true);
    }
  };

  const applyMaintenanceService = (svcId: string) => {
    const svc = maintenanceServices.find((s) => s.id === svcId);
    if (!svc) return;
    setValue("maintenanceServiceId", svcId);
    const currentItems = getValues("items");
    const maintIds = new Set(maintenanceServices.map((s) => s.id));
    setValue("items", [
      ...currentItems.filter((i) => !maintIds.has(i.serviceCatalogId ?? "")),
      { serviceCatalogId: svc.id, description: svc.name, quantity: 1, price: svc.basePrice },
    ]);
    setValue("type", "POLICY_MAINTENANCE");
  };

  const noServices = maintenanceServices.length === 0;

  return (
    <div
      className="rounded-xl p-4 mt-3"
      style={{ background: chipBg, border: `1px solid ${chipColor}22` }}
      aria-label="Estado de mantenimiento preventivo"
    >
      <div className="flex items-center gap-2 mb-3">
        <StatusIcon size={16} style={{ color: chipColor }} aria-hidden />
        <span className="text-sm font-medium" style={{ color: chipColor }}>
          {statusLabel}
        </span>
        {!isAlCorriente && (
          <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: chipColor, color: "#fff" }}>
            {isVencido ? "VENCIDO" : "POR VENCER"}
          </span>
        )}
      </div>

      {!isAlCorriente && (
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={addMaintenance}
              disabled={noServices}
              onChange={(e) => toggleMaintenance(e.target.checked)}
              className="rounded"
              style={{ accentColor: "var(--p)" }}
            />
            <span
              className="text-sm"
              style={{ color: noServices ? "var(--on-surf-var)" : "var(--on-surf)" }}
            >
              ¿Agregarlo al diagnóstico inicial?
            </span>
            {noServices && (
              <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                (sin servicio configurado en esta sucursal
                {(userRole === "MANAGER" || userRole === "ADMIN") && (
                  <> — <a href="/configuracion/servicios" className="underline">configurar</a></>
                )}
                )
              </span>
            )}
          </label>

          {addMaintenance && showServiceSelect && maintenanceServices.length > 1 && (
            <select
              value={maintenanceServiceId ?? ""}
              onChange={(e) => {
                if (e.target.value) applyMaintenanceService(e.target.value);
              }}
              className="text-sm rounded-lg px-3 py-2 w-full"
              style={{ background: "var(--surf-low)", color: "var(--on-surf)", border: "1px solid var(--ghost-border, #e0e0e0)" }}
              aria-label="Seleccionar servicio de mantenimiento"
            >
              <option value="">¿Qué servicio de mantenimiento?</option>
              {maintenanceServices.map((svc) => (
                <option key={svc.id} value={svc.id}>
                  {svc.name} — ${svc.basePrice.toFixed(2)}
                </option>
              ))}
            </select>
          )}
        </div>
      )}
    </div>
  );
}

export function Step1Cliente({
  control,
  setValue,
  getValues,
  errors,
  maintenanceServices,
  userRole,
  prefillBike,
  prefillCustomer,
  prefillMaintenanceStatus,
}: Step1Props) {
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CustomerResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerResult | null>(null);
  const [bikeStatus, setBikeStatus] = useState<MaintenanceStatusResult | null>(prefillMaintenanceStatus);

  const customerBikeId = useWatch({ control, name: "customerBikeId" });

  // Initialize from prefill on mount
  useEffect(() => {
    if (prefillCustomer && prefillBike) {
      setSelectedCustomer({
        id: prefillCustomer.id,
        name: prefillCustomer.name,
        phone: prefillCustomer.phone,
        rfc: null,
        bikes: prefillCustomer.bikes,
      });
      setValue("customerId", prefillCustomer.id);
      setValue("customerName", prefillCustomer.name);
      setValue("customerPhone", prefillCustomer.phone ?? undefined);
      setValue("customerBikeId", prefillBike.id);
      setValue(
        "bikeInfo",
        [prefillBike.brand, prefillBike.model].filter(Boolean).join(" ") +
          ` — VIN: ${prefillBike.serialNumber}`,
      );
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchMaintenanceStatus = useCallback(async (bikeId: string) => {
    try {
      const res = await fetch(`/api/workshop/bikes/${bikeId}/maintenance-status`);
      if (!res.ok) return;
      const data = (await res.json()) as { success: boolean; data: MaintenanceStatusResult | null };
      if (data.success) setBikeStatus(data.data);
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    if (customerBikeId) {
      fetchMaintenanceStatus(customerBikeId);
    } else {
      setBikeStatus(null);
    }
  }, [customerBikeId, fetchMaintenanceStatus]);

  const handleSearch = useDebouncedCallback(async (q: string) => {
    if (!q || q.length < 2) {
      setSearchResults([]);
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    try {
      const res = await fetch(`/api/workshop/customers/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = (await res.json()) as { success: boolean; data: CustomerResult[] };
        setSearchResults(data.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setIsSearching(false);
    }
  }, 350);

  const selectCustomer = (customer: CustomerResult) => {
    setSelectedCustomer(customer);
    setSearchResults([]);
    setQuery("");
    setValue("customerId", customer.id);
    setValue("customerName", customer.name);
    setValue("customerPhone", customer.phone ?? undefined);
    setValue("customerBikeId", undefined);
    setValue("bikeInfo", undefined);
    setValue("addMaintenance", false);
    setValue("maintenanceServiceId", undefined);
    setBikeStatus(null);
  };

  const selectBike = (bike: CustomerBike) => {
    setValue("customerBikeId", bike.id);
    setValue(
      "bikeInfo",
      formatBikeLabel(bike),
    );
  };

  const clearCustomer = () => {
    setSelectedCustomer(null);
    setValue("customerId", undefined);
    setValue("customerName", "");
    setValue("customerPhone", undefined);
    setValue("customerBikeId", undefined);
    setValue("bikeInfo", undefined);
    setValue("addMaintenance", false);
    setValue("maintenanceServiceId", undefined);
    setBikeStatus(null);
  };

  const noBikeSelected = !customerBikeId;

  return (
    <section aria-labelledby="step1-title" className="space-y-6">
      <h2 id="step1-title" className="sr-only">
        Paso 1: Cliente y bicicleta
      </h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Customer search */}
        <div className="space-y-3">
          <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
            Cliente
          </p>

          {selectedCustomer ? (
            <div
              className="rounded-xl p-4 flex items-start justify-between gap-3"
              style={{ background: "var(--surf-low)" }}
            >
              <div>
                <p className="font-semibold text-sm" style={{ color: "var(--on-surf)" }}>
                  {selectedCustomer.name}
                </p>
                {selectedCustomer.phone && (
                  <p className="text-xs mt-0.5" style={{ color: "var(--on-surf-var)" }}>
                    {selectedCustomer.phone}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={clearCustomer}
                className="text-xs underline shrink-0"
                style={{ color: "var(--on-surf-var)" }}
              >
                Cambiar
              </button>
            </div>
          ) : (
            <div className="relative">
              <div
                className="flex items-center gap-2 rounded-xl px-3"
                style={{ background: "var(--surf-low)" }}
              >
                <Search size={14} style={{ color: "var(--on-surf-var)" }} />
                <input
                  type="text"
                  placeholder="Buscar por nombre, RFC o teléfono..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    handleSearch(e.target.value);
                  }}
                  className="flex-1 py-2.5 text-sm bg-transparent outline-none"
                  style={{ color: "var(--on-surf)" }}
                  aria-label="Buscar cliente"
                  autoComplete="off"
                />
                {isSearching && (
                  <div
                    className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "var(--p)" }}
                  />
                )}
              </div>

              {searchResults.length > 0 && (
                <div
                  className="absolute z-20 top-full mt-1 w-full rounded-xl shadow-lg overflow-hidden"
                  style={{
                    background: "var(--surf-bright)",
                    border: "1px solid var(--ghost-border, rgba(0,0,0,0.08))",
                    backdropFilter: "blur(12px)",
                  }}
                  role="listbox"
                  aria-label="Resultados de búsqueda"
                >
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onClick={() => selectCustomer(c)}
                      className="w-full text-left px-4 py-2.5 flex items-center justify-between gap-3 hover:bg-[var(--surf-low)] transition-colors"
                    >
                      <div>
                        <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
                          {c.name}
                        </p>
                        <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                          {c.phone ?? c.rfc ?? "Sin contacto"}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Bike size={12} style={{ color: "var(--on-surf-var)" }} />
                        <span className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                          {c.bikes.length}
                        </span>
                        <ChevronRight size={12} style={{ color: "var(--on-surf-var)" }} />
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Manual name fallback if not found in search */}
          {!selectedCustomer && (
            <div className="space-y-2">
              <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                ¿No está en el sistema? Ingresa el nombre manualmente:
              </p>
              <input
                type="text"
                placeholder="Nombre completo del cliente"
                value={getValues("customerName")}
                onChange={(e) => setValue("customerName", e.target.value)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--surf-low)", color: "var(--on-surf)" }}
                aria-label="Nombre del cliente"
              />
              {errors.customerName && (
                <p className="text-xs" style={{ color: "var(--err)" }}>
                  {String(errors.customerName.message)}
                </p>
              )}
              <input
                type="tel"
                placeholder="Teléfono (opcional)"
                value={getValues("customerPhone") ?? ""}
                onChange={(e) => setValue("customerPhone", e.target.value || undefined)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--surf-low)", color: "var(--on-surf)" }}
                aria-label="Teléfono del cliente"
              />
            </div>
          )}
        </div>

        {/* Right: Bike selector */}
        <div className="space-y-3">
          <p className="text-sm font-medium" style={{ color: "var(--on-surf)" }}>
            Bicicleta
          </p>

          {selectedCustomer && selectedCustomer.bikes.length > 0 ? (
            <div
              className="space-y-2 rounded-xl p-3"
              style={{ background: "var(--surf-low)" }}
              role="radiogroup"
              aria-label="Seleccionar bicicleta del cliente"
            >
              {selectedCustomer.bikes.map((bike) => {
                const isSelected = customerBikeId === bike.id;
                return (
                  <button
                    key={bike.id}
                    type="button"
                    role="radio"
                    aria-checked={isSelected}
                    onClick={() => selectBike(bike)}
                    className="w-full text-left rounded-lg px-3 py-2.5 flex items-center justify-between gap-2 transition-colors"
                    style={{
                      background: isSelected ? "var(--surf-highest)" : "transparent",
                      color: "var(--on-surf)",
                    }}
                  >
                    <div className="flex items-center gap-2">
                      <Bike
                        size={14}
                        style={{ color: isSelected ? "var(--p)" : "var(--on-surf-var)" }}
                      />
                      <div>
                        <p className="text-sm font-medium">
                          {[bike.brand, bike.model].filter(Boolean).join(" ") || "Sin modelo"}
                        </p>
                        <p className="text-xs" style={{ color: "var(--on-surf-var)" }}>
                          VIN: {bike.serialNumber}
                        </p>
                      </div>
                    </div>
                    {isSelected && (
                      <CheckCircle size={14} style={{ color: "var(--p)" }} />
                    )}
                  </button>
                );
              })}
            </div>
          ) : (
            selectedCustomer && (
              <p className="text-sm" style={{ color: "var(--on-surf-var)" }}>
                Este cliente no tiene bicicletas registradas en esta sucursal.
              </p>
            )
          )}

          {/* Maintenance banner for selected bike */}
          {customerBikeId && bikeStatus && (
            <MaintenanceBanner
              status={bikeStatus}
              maintenanceServices={maintenanceServices}
              userRole={userRole}
              setValue={setValue}
              getValues={getValues}
            />
          )}

          {/* Free text bikeInfo when no registered bike */}
          {noBikeSelected && (
            <div className="space-y-1 mt-2">
              <label className="text-xs font-medium" style={{ color: "var(--on-surf-var)" }}>
                {selectedCustomer
                  ? "Describe la bicicleta a recibir"
                  : "Descripción de la bicicleta"}
              </label>
              <input
                type="text"
                placeholder="Ej. Trek Marlin 7 Roja 2023 — VIN: ABC123"
                value={getValues("bikeInfo") ?? ""}
                onChange={(e) => setValue("bikeInfo", e.target.value || undefined)}
                className="w-full rounded-xl px-3 py-2.5 text-sm outline-none"
                style={{ background: "var(--surf-low)", color: "var(--on-surf)" }}
                aria-label="Descripción de la bicicleta"
              />
              {errors.bikeInfo && (
                <p className="text-xs" style={{ color: "var(--err)" }}>
                  {String(errors.bikeInfo.message)}
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
