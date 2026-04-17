"use client";

import { ArrowLeftRight } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

export interface RemoteStockEntry {
  branchId: string;
  branchName: string;
  quantity: number;
}

interface Props {
  productKey: string;
  productName: string;
  localStock: number;
  remoteStock: RemoteStockEntry[];
  myBranchName: string;
  onSolicitar: () => void;
}

export function RemoteStockPopover({
  productName,
  localStock,
  remoteStock,
  myBranchName,
  onSolicitar,
}: Props) {
  const hasRemoteStock = remoteStock.some((e) => e.quantity > 0);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          onClick={(e) => e.stopPropagation()}
          className="absolute flex items-center justify-center transition-opacity hover:opacity-80 active:scale-95"
          style={{
            top: 8,
            right: 8,
            zIndex: 10,
            width: 26,
            height: 26,
            borderRadius: "50%",
            background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
            backdropFilter: "blur(8px)",
            WebkitBackdropFilter: "blur(8px)",
            border: "1px solid var(--ghost-border)",
            color: "var(--on-surf-var)",
            cursor: "pointer",
          }}
          aria-label="Ver stock en otras sucursales"
        >
          <ArrowLeftRight style={{ width: 12, height: 12 }} />
        </button>
      </PopoverTrigger>

      <PopoverContent
        side="right"
        align="start"
        sideOffset={8}
        className="p-0 w-56"
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "color-mix(in srgb, var(--surf-bright) 88%, transparent)",
          backdropFilter: "blur(20px)",
          WebkitBackdropFilter: "blur(20px)",
          boxShadow: "var(--shadow)",
          borderRadius: "var(--r-lg)",
          border: "1px solid var(--ghost-border)",
        }}
      >
        <div style={{ padding: "12px 14px" }}>
          {/* Product name */}
          <p
            className="truncate"
            style={{
              fontFamily: "var(--font-display)",
              fontSize: 12,
              fontWeight: 700,
              color: "var(--on-surf)",
              marginBottom: 8,
            }}
          >
            {productName}
          </p>

          {/* Local stock row */}
          <div
            className="flex items-center justify-between"
            style={{ marginBottom: 4 }}
          >
            <span
              style={{
                fontSize: 11,
                color: "var(--on-surf-var)",
                fontFamily: "var(--font-body)",
              }}
            >
              {myBranchName}
            </span>
            <span
              style={{
                fontSize: 11,
                fontWeight: 600,
                color: localStock > 0 ? "var(--p-bright)" : "var(--ter)",
                fontFamily: "var(--font-body)",
              }}
            >
              {localStock} uds
            </span>
          </div>

          {/* Divider */}
          <div
            style={{
              borderTop: "1px solid var(--ghost-border)",
              margin: "6px 0",
            }}
          />

          {/* Remote branches */}
          {remoteStock.length === 0 ? (
            <p
              style={{
                fontSize: 11,
                color: "var(--on-surf-var)",
                fontFamily: "var(--font-body)",
                opacity: 0.7,
              }}
            >
              No disponible en otras sucursales
            </p>
          ) : (
            <>
              <div className="space-y-1" style={{ marginBottom: hasRemoteStock ? 8 : 0 }}>
                {remoteStock.map((entry) => (
                  <div
                    key={entry.branchId}
                    className="flex items-center justify-between"
                  >
                    <span
                      style={{
                        fontSize: 11,
                        color: "var(--on-surf-var)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {entry.branchName}
                    </span>
                    <span
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: entry.quantity > 0 ? "var(--sec)" : "var(--on-surf-var)",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      {entry.quantity} uds
                    </span>
                  </div>
                ))}
              </div>

              {hasRemoteStock && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onSolicitar();
                  }}
                  className="w-full transition-opacity hover:opacity-80"
                  style={{
                    background: "linear-gradient(135deg, #1b4332 0%, #2ecc71 100%)",
                    color: "#FFFFFF",
                    borderRadius: "var(--r-full)",
                    border: "none",
                    fontFamily: "var(--font-body)",
                    fontWeight: 600,
                    fontSize: "0.75rem",
                    height: 32,
                    paddingInline: "1rem",
                    cursor: "pointer",
                  }}
                >
                  Solicitar transferencia
                </button>
              )}
            </>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
