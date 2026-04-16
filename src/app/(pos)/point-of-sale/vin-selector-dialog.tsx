"use client";

import { useReducer, useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Bike, Search, AlertCircle } from "lucide-react";
import Link from "next/link";

export type CustomerBikeOption = {
  id: string;
  serialNumber: string;
  voltaje: string | null;
  productVariant: {
    modelo: { nombre: string };
    color: { nombre: string };
    voltaje: { label: string } | null;
  } | null;
};

interface VinSelectorDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productVariantId: string;
  onSelect: (bike: CustomerBikeOption) => void;
}

export function VinSelectorDialog({
  open,
  onOpenChange,
  productVariantId,
  onSelect,
}: VinSelectorDialogProps) {
  interface State {
    bikes: CustomerBikeOption[];
    loading: boolean;
  }
  type Action =
    | { kind: "reset" }
    | { kind: "done"; bikes: CustomerBikeOption[] };
  const [{ bikes, loading }, dispatch] = useReducer(
    (_s: State, a: Action): State => {
      if (a.kind === "reset") return { bikes: [], loading: true };
      return { bikes: a.bikes, loading: false };
    },
    { bikes: [], loading: false },
  );
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open || !productVariantId) return;
    const controller = new AbortController();
    Promise.resolve().then(() => {
      if (controller.signal.aborted) return;
      dispatch({ kind: "reset" });
      setSearch("");
      fetch(
        `/api/customer-bikes/available?productVariantId=${encodeURIComponent(productVariantId)}`,
        { signal: controller.signal },
      )
        .then((r) => r.json())
        .then((data: { success?: boolean; data?: CustomerBikeOption[] }) => {
          dispatch({ kind: "done", bikes: data.data ?? [] });
        })
        .catch(() => dispatch({ kind: "done", bikes: [] }));
    });
    return () => controller.abort();
  }, [open, productVariantId]);

  const filtered = bikes.filter((b) =>
    b.serialNumber.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="p-0 gap-0 overflow-hidden sm:max-w-md"
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
              fontSize: "1.25rem",
              fontWeight: 700,
              color: "var(--on-surf)",
            }}
          >
            Seleccionar unidad
          </DialogTitle>
          <p style={{ color: "var(--on-surf-var)", fontSize: "0.75rem" }}>
            Unidades ensambladas disponibles para asignar al cliente.
          </p>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-3">
          {/* Search */}
          <div className="relative">
            <Search
              className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: "var(--on-surf-var)" }}
            />
            <input
              type="text"
              placeholder="Buscar por serie..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                background: "var(--surf-low)",
                border: "none",
                borderRadius: "var(--r-lg)",
                color: "var(--on-surf)",
                fontSize: "0.875rem",
                height: 44,
                paddingLeft: "2.25rem",
                paddingRight: "0.75rem",
                width: "100%",
                outline: "none",
              }}
            />
          </div>

          {/* List */}
          <div style={{ maxHeight: 320, overflowY: "auto" }} className="space-y-1.5">
            {loading && (
              <div
                className="flex items-center justify-center py-8"
                style={{ color: "var(--on-surf-var)" }}
              >
                <p className="text-sm">Cargando unidades...</p>
              </div>
            )}

            {!loading && filtered.length === 0 && (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-center">
                <AlertCircle
                  className="w-8 h-8"
                  style={{ color: "var(--on-surf-var)", opacity: 0.4 }}
                />
                <p className="text-sm" style={{ color: "var(--on-surf-var)" }}>
                  {bikes.length === 0
                    ? "Sin unidades ensambladas disponibles"
                    : `Sin resultados para "${search}"`}
                </p>
                {bikes.length === 0 && (
                  <Link
                    href="/assembly"
                    onClick={() => onOpenChange(false)}
                    style={{
                      background: "var(--warn-container)",
                      color: "var(--warn)",
                      borderRadius: 9999,
                      padding: "0.4rem 1rem",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      textDecoration: "none",
                    }}
                  >
                    Ir a Montaje para ensamblar
                  </Link>
                )}
              </div>
            )}

            {!loading &&
              filtered.map((bike) => (
                <button
                  key={bike.id}
                  onClick={() => {
                    onSelect(bike);
                    onOpenChange(false);
                  }}
                  className="w-full flex items-center gap-3 transition-colors"
                  style={{
                    background: "var(--surf-low)",
                    borderRadius: "var(--r-lg)",
                    padding: "0.75rem",
                    border: "none",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--surf-high)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.background =
                      "var(--surf-low)";
                  }}
                >
                  <div
                    className="flex items-center justify-center shrink-0"
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: "var(--r-md)",
                      background: "var(--sec-container)",
                    }}
                  >
                    <Bike
                      className="w-4 h-4"
                      style={{ color: "var(--on-sec-container)" }}
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p
                      className="font-semibold text-sm truncate"
                      style={{
                        fontFamily: "var(--font-display)",
                        color: "var(--on-surf)",
                      }}
                    >
                      {bike.serialNumber}
                    </p>
                    <p
                      className="text-xs truncate"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      {bike.productVariant?.modelo.nombre} ·{" "}
                      {bike.productVariant?.color.nombre} ·{" "}
                      {bike.voltaje ?? bike.productVariant?.voltaje?.label ?? "—"}
                    </p>
                  </div>
                </button>
              ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
