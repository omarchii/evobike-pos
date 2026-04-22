"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Check, ChevronsUpDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";
import type { SerializedProduct } from "./service-order-details";
import type { StockMap } from "@/hooks/use-stock-availability";
import { StockChip } from "./stock-chip";

function formatMXN(n: number) {
  return new Intl.NumberFormat("es-MX", {
    style: "currency",
    currency: "MXN",
    minimumFractionDigits: 2,
  }).format(n);
}

type Props = {
  orderId: string;
  catalogProducts: SerializedProduct[];
  stockMap: StockMap;
};

export function AddItemForm({ orderId, catalogProducts, stockMap }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [openCombobox, setOpenCombobox] = useState(false);

  const [manualDescription, setManualDescription] = useState("");
  const [manualPrice, setManualPrice] = useState("");
  const [selectedProductId, setSelectedProductId] = useState<string>("");
  const [productQty, setProductQty] = useState("1");

  const selectedProduct = selectedProductId
    ? catalogProducts.find((p) => p.id === selectedProductId)
    : null;
  const requestedQty = Math.max(1, parseInt(productQty) || 1);
  const availableForSelected = selectedProduct
    ? (stockMap[selectedProduct.id]?.available ?? null)
    : null;

  const handleAddManualService = async () => {
    if (!manualDescription || !manualPrice) return;
    setLoading(true);
    toast.loading("Agregando servicio...", { id: "add-item" });
    const res = await fetch(`/api/workshop/orders/${orderId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        description: manualDescription,
        quantity: 1,
        price: parseFloat(manualPrice),
      }),
    });
    const data = (await res.json()) as { success: boolean; error?: string };
    if (data.success) {
      toast.success("Servicio agregado", { id: "add-item" });
      setManualDescription("");
      setManualPrice("");
      router.refresh();
    } else {
      toast.error(data.error ?? "No se pudo agregar", { id: "add-item" });
    }
    setLoading(false);
  };

  const handleAddProduct = async () => {
    if (!selectedProduct) return;
    setLoading(true);
    toast.loading("Agregando refacción...", { id: "add-item" });
    const res = await fetch(`/api/workshop/orders/${orderId}/items`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        productVariantId: selectedProduct.id,
        description: selectedProduct.name,
        quantity: requestedQty,
        price: selectedProduct.price,
      }),
    });
    const data = (await res.json()) as { success: boolean; error?: string };
    if (data.success) {
      toast.success("Refacción agregada", { id: "add-item" });
      setSelectedProductId("");
      setProductQty("1");
      router.refresh();
    } else {
      toast.error(data.error ?? "No se pudo agregar", { id: "add-item" });
    }
    setLoading(false);
  };

  return (
    <div
      className="mx-6 mb-5 p-4 rounded-xl space-y-4"
      style={{ background: "var(--surf-low)" }}
    >
      {/* Manual service */}
      <div>
        <p
          style={{
            fontSize: "0.6875rem",
            fontWeight: 500,
            color: "var(--on-surf-var)",
            marginBottom: "0.5rem",
          }}
        >
          Mano de obra / Servicio
        </p>
        <div className="flex gap-2">
          <input
            placeholder="Descripción del trabajo"
            value={manualDescription}
            onChange={(e) => setManualDescription(e.target.value)}
            style={{
              flex: 1,
              background: "var(--surf-lowest)",
              border: "none",
              borderRadius: "var(--r-md)",
              color: "var(--on-surf)",
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              height: 38,
              paddingLeft: "0.75rem",
              paddingRight: "0.75rem",
              outline: "none",
            }}
          />
          <input
            type="number"
            placeholder="$ Precio"
            value={manualPrice}
            onChange={(e) => setManualPrice(e.target.value)}
            style={{
              width: 110,
              background: "var(--surf-lowest)",
              border: "none",
              borderRadius: "var(--r-md)",
              color: "var(--on-surf)",
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              height: 38,
              paddingLeft: "0.75rem",
              paddingRight: "0.75rem",
              outline: "none",
            }}
          />
          <button
            onClick={handleAddManualService}
            disabled={loading}
            className="flex items-center justify-center transition-opacity disabled:opacity-50"
            style={{
              background: "var(--surf-highest)",
              color: "var(--p)",
              border: "none",
              borderRadius: "var(--r-md)",
              width: 38,
              height: 38,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Product from inventory */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-2">
          <p
            style={{
              fontSize: "0.6875rem",
              fontWeight: 500,
              color: "var(--on-surf-var)",
            }}
          >
            Refacción de inventario
          </p>
          {selectedProduct && (
            <StockChip qty={requestedQty} available={availableForSelected} />
          )}
        </div>
        <div className="flex gap-2">
          <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
            <PopoverTrigger asChild>
              <button
                className="flex items-center justify-between flex-1 text-sm transition-colors"
                style={{
                  background: "var(--surf-lowest)",
                  border: "none",
                  borderRadius: "var(--r-md)",
                  color: selectedProductId ? "var(--on-surf)" : "var(--on-surf-var)",
                  fontFamily: "var(--font-body)",
                  height: 38,
                  paddingLeft: "0.75rem",
                  paddingRight: "0.75rem",
                  cursor: "pointer",
                }}
              >
                <span className="text-left truncate text-sm">
                  {selectedProduct ? selectedProduct.name : "Elegir pieza..."}
                </span>
                <ChevronsUpDown className="ml-2 h-3.5 w-3.5 shrink-0 opacity-50" />
              </button>
            </PopoverTrigger>
            <PopoverContent
              className="w-[320px] p-0"
              align="start"
              style={{ borderRadius: "var(--r-lg)" }}
            >
              <Command>
                <CommandInput placeholder="Buscar por nombre o SKU..." />
                <CommandList>
                  <CommandEmpty>No se encontraron piezas.</CommandEmpty>
                  <CommandGroup>
                    {catalogProducts.map((p) => (
                      <CommandItem
                        key={p.id}
                        value={`${p.name} ${p.sku}`}
                        onSelect={() => {
                          setSelectedProductId(
                            p.id === selectedProductId ? "" : p.id,
                          );
                          setOpenCombobox(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            selectedProductId === p.id ? "opacity-100" : "opacity-0",
                          )}
                        />
                        <div className="flex flex-col">
                          <span className="text-sm">{p.name}</span>
                          <span className="text-xs opacity-50 font-mono">
                            {p.sku} · {formatMXN(p.price)}
                          </span>
                        </div>
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
          <input
            type="number"
            min="1"
            placeholder="Cant."
            value={productQty}
            onChange={(e) => setProductQty(e.target.value)}
            style={{
              width: 70,
              background: "var(--surf-lowest)",
              border: "none",
              borderRadius: "var(--r-md)",
              color: "var(--on-surf)",
              fontFamily: "var(--font-body)",
              fontSize: "0.8125rem",
              height: 38,
              paddingLeft: "0.75rem",
              paddingRight: "0.75rem",
              outline: "none",
              textAlign: "center",
            }}
          />
          <button
            onClick={handleAddProduct}
            disabled={loading || !selectedProductId}
            className="flex items-center justify-center transition-opacity disabled:opacity-50"
            style={{
              background: "var(--surf-highest)",
              color: "var(--p)",
              border: "none",
              borderRadius: "var(--r-md)",
              width: 38,
              height: 38,
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
