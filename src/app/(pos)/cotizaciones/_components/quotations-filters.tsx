"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useTransition } from "react";
import { Search, X } from "lucide-react";
import { cn } from "@/lib/utils";

type StatusFilter =
  | "ALL"
  | "DRAFT"
  | "EN_ESPERA_CLIENTE"
  | "EN_ESPERA_FABRICA"
  | "PAGADA"
  | "FINALIZADA"
  | "RECHAZADA"
  | "EXPIRED";

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: "ALL", label: "Todas" },
  { value: "DRAFT", label: "Borrador" },
  { value: "EN_ESPERA_CLIENTE", label: "En espera del cliente" },
  { value: "EN_ESPERA_FABRICA", label: "En espera de fábrica" },
  { value: "PAGADA", label: "Pagada" },
  { value: "FINALIZADA", label: "Finalizada" },
  { value: "RECHAZADA", label: "Rechazada" },
  { value: "EXPIRED", label: "Expirada" },
];

interface Props {
  isAdmin: boolean;
  branches?: { id: string; name: string }[];
}

export default function QuotationsFilters({ isAdmin, branches = [] }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const currentStatus = (searchParams.get("status") as StatusFilter) ?? "ALL";
  const currentSearch = searchParams.get("q") ?? "";
  const currentBranch = searchParams.get("branchId") ?? "";

  function updateParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value && value !== "ALL") {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function clearSearch() {
    updateParam("q", "");
  }

  return (
    <div className="flex flex-col gap-3 mb-5">
      {/* Status pills */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map((opt) => {
          const isActive = currentStatus === opt.value;
          return (
            <button
              key={opt.value}
              onClick={() => updateParam("status", opt.value)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors",
                isActive
                  ? "text-[var(--on-p-container)]"
                  : "text-[var(--on-surf-var)] hover:text-[var(--on-surf)] hover:bg-[var(--surf-high)]"
              )}
              style={
                isActive
                  ? { background: "var(--p-container)" }
                  : { background: "var(--surf-lowest)" }
              }
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {/* Search + branch */}
      <div className="flex flex-wrap gap-3 items-center">
        {/* Search input */}
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search
            className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5"
            style={{ color: "var(--on-surf-var)" }}
          />
          <input
            type="text"
            placeholder="Buscar por folio o cliente..."
            defaultValue={currentSearch}
            onChange={(e) => {
              const val = e.target.value;
              const params = new URLSearchParams(searchParams.toString());
              if (val) params.set("q", val);
              else params.delete("q");
              params.delete("page");
              startTransition(() => {
                router.push(`${pathname}?${params.toString()}`);
              });
            }}
            className="w-full pl-9 pr-8 py-2 text-xs rounded-xl outline-none transition-colors"
            style={{
              background: "var(--surf-lowest)",
              color: "var(--on-surf)",
              border: "1px solid rgba(178,204,192,0.15)",
            }}
          />
          {currentSearch && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2"
              style={{ color: "var(--on-surf-var)" }}
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Branch selector — only ADMIN */}
        {isAdmin && branches.length > 0 && (
          <select
            value={currentBranch}
            onChange={(e) => updateParam("branchId", e.target.value)}
            className="px-3 py-2 text-xs rounded-xl outline-none cursor-pointer"
            style={{
              background: "var(--surf-lowest)",
              color: "var(--on-surf)",
              border: "1px solid rgba(178,204,192,0.15)",
            }}
          >
            <option value="">Todas las sucursales</option>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </select>
        )}
      </div>
    </div>
  );
}
