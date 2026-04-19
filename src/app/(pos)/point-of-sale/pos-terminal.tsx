"use client";

import { useState, useMemo, useCallback, useEffect } from "react";
import {
  Search,
  Plus,
  Trash2,
  Battery,
  ShoppingBag,
  Check,
  X,
  Loader2,
  ArrowLeftRight,
} from "lucide-react";
import { RemoteStockPopover } from "./_components/remote-stock-popover";
import type { RemoteStockEntry } from "./_components/remote-stock-popover";
import { RequestTransferDialog } from "./_components/request-transfer-dialog";
import type { TransferProduct } from "./_components/request-transfer-dialog";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { DiscountAuthorizationPanel } from "@/components/pos/authorization/discount-authorization-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import CustomerSelectorModal, { type CustomerOption } from "./customer-selector-modal";
import { VinSelectorDialog, type CustomerBikeOption } from "./vin-selector-dialog";
import { VoltageChangeDialog, type VoltajeOptionForDialog } from "./voltage-change-dialog";
import { FreeFormDialog } from "./free-form-dialog";

// ── Types ──────────────────────────────────────────────────────────────────────

interface VariantInfo {
  id: string;
  sku: string;
  precio: number;
  costo: number;
  stockInBranch: number;
  colorId: string;
  colorNombre: string;
  voltajeId: string;
  voltajeValor: number;
  voltajeLabel: string;
}

type ModeloCategoria =
  | "BICICLETA"
  | "TRICICLO"
  | "SCOOTER"
  | "JUGUETE"
  | "CARGA"
  | "CARGA_PESADA"
  | "BASE"
  | "PLUS";

type SimpleCategoria = "ACCESORIO" | "CARGADOR" | "REFACCION" | "BATERIA_STANDALONE";

interface SimpleProductData {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string | null;
  categoria: SimpleCategoria;
  modeloAplicable: string | null;
  precioPublico: number;
  imageUrl: string | null;
  stockInBranch: number;
}

const SIMPLE_CATEGORIA_LABELS: Record<SimpleCategoria, string> = {
  ACCESORIO: "Accesorio",
  CARGADOR: "Cargador",
  REFACCION: "Refacción",
  BATERIA_STANDALONE: "Batería",
};

interface ModeloData {
  id: string;
  nombre: string;
  descripcion: string | null;
  imageUrl: string | null;
  requiere_vin: boolean;
  categoria: ModeloCategoria | null;
  variants: VariantInfo[];
  minPrice: number;
  totalStockInBranch: number;
}

interface BatteryConfig {
  modeloId: string;
  voltajeId: string;
  quantity: number;
}

type CustomerData = CustomerOption;

interface PaymentMethodInput {
  method: "CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE" | "ATRATO";
  amount: number;
  reference?: string;
}

interface CartItem {
  variantId: string;
  modeloId: string;  // 4-D: for voltage change option lookup
  modeloNombre: string;
  colorNombre: string;
  voltajeLabel: string;
  sku: string;
  price: number;
  quantity: number;
  isSerialized: boolean;
  serialNumber?: string;
  customerBikeId?: string;  // 4-C: selected from VinSelectorDialog
  voltageChange?: { targetVoltajeId: string; targetVoltajeLabel: string };  // 4-D
  batterySerials?: string[];
  assemblyMode?: boolean;
  isFreeForm?: boolean;  // P3.5: línea libre (descripción + precio manual)
  description?: string;  // P3.5: texto del concepto libre
  simpleProductId?: string;  // P3.4: línea de SimpleProduct (accesorio/refacción/cargador/batería)
  simpleCategoria?: SimpleCategoria;  // P3.4: para render en cart
}

type BatteryStatus = "idle" | "valid" | "invalid" | "checking";

interface VoltajeOption {
  id: string;
  valor: number;
  label: string;
  // stock state
  stockInBranch: number;
  batteriesRequired: number;
  canAssemble: boolean;
}

// ── Color helpers ──────────────────────────────────────────────────────────────

function colorToCSS(nombre: string): string {
  const map: Record<string, string> = {
    NEGRO: "#1c1c1c",
    BLANCO: "#f5f5f5",
    ROJO: "#e53e3e",
    AZUL: "#3182ce",
    VERDE: "#38a169",
    AMARILLO: "#d69e2e",
    ROSA: "#ed64a6",
    MORADO: "#805ad5",
    GRIS: "#718096",
    NARANJA: "#dd6b20",
    FUCSIA: "#d53f8c",
    GUINDA: "#702459",
    CAFÉ: "#7b4f2e",
    TORNASOL: "conic-gradient(from 0deg, #ff6b6b, #a8edea, #fed6e3, #ff6b6b)",
    LILA: "#b794f4",
  };
  
  const upper = nombre.toUpperCase();
  const foundColors: string[] = [];
  
  for (const [key, val] of Object.entries(map)) {
    if (upper.includes(key)) {
      foundColors.push(val);
    }
  }

  if (foundColors.length === 1) return foundColors[0];
  if (foundColors.length >= 2) {
    const c1 = foundColors[0];
    const c2 = foundColors[1];
    if (c1.startsWith("conic") || c2.startsWith("conic")) {
      return c1.startsWith("conic") ? c1 : c2;
    }
    return `linear-gradient(135deg, ${c1} 50%, ${c2} 50%)`;
  }
  
  return "#94a3b8";
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

type CategoryFilterKey = "Todos" | ModeloCategoria | "ACCESORIOS";

const CATEGORIES: { key: CategoryFilterKey; label: string }[] = [
  { key: "Todos", label: "Todos" },
  { key: "BICICLETA", label: "Bicicletas" },
  { key: "TRICICLO", label: "Triciclos" },
  { key: "SCOOTER", label: "Scooters" },
  { key: "JUGUETE", label: "Juguetes" },
  { key: "CARGA", label: "Carga" },
  { key: "ACCESORIOS", label: "Accesorios" },
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ModelCard({
  modelo,
  isSelected,
  onSelect,
  onRequestTransfer,
}: {
  modelo: ModeloData;
  isSelected: boolean;
  onSelect: (m: ModeloData) => void;
  onRequestTransfer?: () => void;
}) {
  const hasStock = modelo.totalStockInBranch > 0;
  const canTransfer = !hasStock && !!onRequestTransfer;
  const isInteractive = hasStock || canTransfer;
  return (
    <div
      role="button"
      tabIndex={isInteractive ? 0 : -1}
      onClick={() => {
        if (hasStock) onSelect(modelo);
        else if (canTransfer) onRequestTransfer!();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (hasStock) onSelect(modelo);
        else if (canTransfer) onRequestTransfer!();
      }}
      className={`relative text-left transition-all group overflow-hidden
        ${isInteractive ? "cursor-pointer hover:shadow-lg" : "opacity-60 cursor-default"}`}
      style={{
        background: "var(--surf-lowest)",
        boxShadow: "var(--shadow)",
        borderRadius: "2rem",
        border: isSelected
          ? "2px solid var(--p-bright)"
          : "2px solid transparent",
      }}
      onMouseEnter={(e) => {
        if (hasStock && !isSelected) {
          (e.currentTarget as HTMLDivElement).style.borderColor =
            "rgba(46,204,113,0.4)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isSelected) {
          (e.currentTarget as HTMLDivElement).style.borderColor = "transparent";
        }
      }}
    >
      {/* Image area — aspect-square with object-contain */}
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          background: "var(--surf-high)",
          borderRadius: "inherit",
          overflow: "hidden",
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        }}
      >
        {modelo.imageUrl ? (
          <Image
            src={modelo.imageUrl}
            alt={modelo.nombre}
            fill
            style={{ objectFit: "contain", padding: "8px" }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <span
              className="font-bold tracking-tight"
              style={{
                fontFamily: "var(--font-display)",
                fontSize: 28,
                color: "var(--on-surf-var)",
              }}
            >
              {getInitials(modelo.nombre)}
            </span>
          </div>
        )}
        {/* Stock badge — top left */}
        <div
          className="absolute"
          style={{ top: 10, left: 10 }}
        >
          {hasStock ? (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 999,
                background: "var(--sec-container)",
                color: "var(--on-sec-container)",
              }}
            >
              {modelo.totalStockInBranch} uds
            </span>
          ) : (
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                padding: "3px 10px",
                borderRadius: 999,
                background: "var(--ter-container)",
                color: "var(--on-ter-container)",
              }}
            >
              Sin stock
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px" }}>
        <p
          className="leading-tight truncate"
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 14,
            fontWeight: 700,
            color: "var(--on-surf)",
          }}
        >
          {modelo.nombre}
        </p>
        <p
          style={{
            fontSize: 11,
            marginTop: 2,
            color: "var(--on-surf-var)",
          }}
        >
          {modelo.variants.length} variantes
        </p>
        <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
          <p
            style={{
              fontSize: 14,
              fontWeight: 700,
              color: "var(--p-bright)",
            }}
          >
            ${modelo.minPrice.toLocaleString("es-MX")}
          </p>
          {canTransfer ? (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestTransfer!(); }}
              className="flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "var(--warn)", color: "#fff", border: "none",
              }}
              aria-label={`Solicitar ${modelo.nombre}`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                onSelect(modelo);
              }}
              className="flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1B4332, #2ECC71)",
                color: "#fff",
                border: "none",
                fontSize: 18,
                lineHeight: 1,
              }}
              aria-label={`Agregar ${modelo.nombre}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function SimpleProductCard({
  sp,
  onAdd,
  onRequestTransfer,
}: {
  sp: SimpleProductData;
  onAdd: (sp: SimpleProductData) => void;
  onRequestTransfer?: () => void;
}) {
  const hasStock = sp.stockInBranch > 0;
  const canTransfer = !hasStock && !!onRequestTransfer;
  const isInteractive = hasStock || canTransfer;
  return (
    <div
      role="button"
      tabIndex={isInteractive ? 0 : -1}
      onClick={() => {
        if (hasStock) onAdd(sp);
        else if (canTransfer) onRequestTransfer!();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Enter" && e.key !== " ") return;
        if (hasStock) onAdd(sp);
        else if (canTransfer) onRequestTransfer!();
      }}
      className={`relative text-left transition-all group overflow-hidden ${isInteractive ? "cursor-pointer hover:shadow-lg" : "opacity-60 cursor-default"}`}
      style={{
        background: "var(--surf-lowest)",
        boxShadow: "var(--shadow)",
        borderRadius: "2rem",
        border: "2px solid transparent",
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          aspectRatio: "1 / 1",
          background: "var(--surf-high)",
          borderRadius: "inherit",
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
          overflow: "hidden",
        }}
      >
        {sp.imageUrl ? (
          <Image src={sp.imageUrl} alt={sp.nombre} fill style={{ objectFit: "contain", padding: "8px" }} />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <ShoppingBag className="w-8 h-8" style={{ color: "var(--on-surf-var)" }} />
          </div>
        )}
        <div className="absolute" style={{ top: 10, left: 10 }}>
          <span
            style={{
              fontSize: 10,
              fontWeight: 600,
              padding: "3px 10px",
              borderRadius: 999,
              background: hasStock ? "var(--sec-container)" : "var(--ter-container)",
              color: hasStock ? "var(--on-sec-container)" : "var(--on-ter-container)",
            }}
          >
            {hasStock ? `${sp.stockInBranch} uds` : "Sin stock"}
          </span>
        </div>
        <div className="absolute" style={{ top: 10, right: 10 }}>
          <span
            style={{
              fontSize: 9,
              fontWeight: 600,
              padding: "3px 8px",
              borderRadius: 999,
              background: "var(--surf-lowest)",
              color: "var(--on-surf-var)",
              letterSpacing: "0.05em",
            }}
          >
            {SIMPLE_CATEGORIA_LABELS[sp.categoria]}
          </span>
        </div>
      </div>
      <div style={{ padding: "14px 16px" }}>
        <p
          className="leading-tight truncate"
          style={{ fontFamily: "var(--font-display)", fontSize: 14, fontWeight: 700, color: "var(--on-surf)" }}
        >
          {sp.nombre}
        </p>
        <p style={{ fontSize: 11, marginTop: 2, color: "var(--on-surf-var)" }}>
          {sp.modeloAplicable ?? "Universal"}
        </p>
        <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
          <p style={{ fontSize: 14, fontWeight: 700, color: "var(--p-bright)" }}>
            ${sp.precioPublico.toLocaleString("es-MX")}
          </p>
          {canTransfer ? (
            <button
              onClick={(e) => { e.stopPropagation(); onRequestTransfer!(); }}
              className="flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              style={{
                width: 28, height: 28, borderRadius: "50%",
                background: "var(--warn)", color: "#fff", border: "none",
              }}
              aria-label={`Solicitar ${sp.nombre}`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
            </button>
          ) : (
            <button
              onClick={(e) => {
                e.stopPropagation();
                if (hasStock) onAdd(sp);
              }}
              className="flex items-center justify-center transition-transform hover:scale-110 active:scale-95"
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "linear-gradient(135deg, #1B4332, #2ECC71)",
                color: "#fff",
                border: "none",
              }}
              aria-label={`Agregar ${sp.nombre}`}
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

// P12-A: remote stock type shared with _components
type RemoteStockMap = Map<string, RemoteStockEntry[]>;

export default function PosTerminal({
  modelos,
  customers = [],
  batteryConfigs = [],
  availableBatteriesCount = 0,
  simpleProducts = [],
  branchId,
  sellerName,
  branchName,
  userRole,
  remoteStockEntries = [],
}: {
  modelos: ModeloData[];
  customers?: CustomerData[];
  batteryConfigs?: BatteryConfig[];
  availableBatteriesCount?: number;
  simpleProducts?: SimpleProductData[];
  branchId: string;
  sellerName: string;
  branchName: string;
  userRole: string;
  remoteStockEntries?: [string, RemoteStockEntry[]][];
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const sessionBranchId =
    (session?.user as { branchId?: string } | undefined)?.branchId ?? branchId;

  // ── Catalog state
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilterKey>("Todos");
  const [simpleModeloFilter, setSimpleModeloFilter] = useState<string>("__all__");
  const [search, setSearch] = useState("");
  const [selectedModelo, setSelectedModelo] = useState<ModeloData | null>(null);

  // ── Guided config state
  const [selectedVoltajeId, setSelectedVoltajeId] = useState("");
  const [selectedColorId, setSelectedColorId] = useState("");
  const [assemblyMode, setAssemblyMode] = useState(false);
  const [selectedCustomerBike, setSelectedCustomerBike] = useState<CustomerBikeOption | null>(null);
  const [vinDialogOpen, setVinDialogOpen] = useState(false);
  const [batterySerialInputs, setBatterySerialInputs] = useState<string[]>([]);
  const [batteryStatuses, setBatteryStatuses] = useState<
    Record<number, BatteryStatus>
  >({});

  // ── Cart state
  const [cart, setCart] = useState<CartItem[]>([]);
  const [voltageChangeTargetIdx, setVoltageChangeTargetIdx] = useState<number | null>(null);
  const [freeFormOpen, setFreeFormOpen] = useState(false);

  // ── Discount state (P5-C)
  const [discountAmount, setDiscountAmount] = useState(0);
  // authorizationId = null cuando el vendedor es MANAGER/ADMIN (self-authorize implícito)
  const [discountAuthorized, setDiscountAuthorized] = useState<{
    authorizationId: string | null;
    name: string;
  } | null>(null);
  const [discountReason, setDiscountReason] = useState("");

  const isManager = userRole === "MANAGER" || userRole === "ADMIN";

  // ── Internal note
  const [internalNote, setInternalNote] = useState("");

  // ── Layaway state
  const [isLayaway, setIsLayaway] = useState(false);
  const [layawayPercent, setLayawayPercent] = useState(30);

  // ── Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [localCustomers, setLocalCustomers] = useState<CustomerData[]>(customers);

  // ── Payment state
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [primaryMethod, setPrimaryMethod] =
    useState<PaymentMethodInput["method"]>("CASH");
  const [secondaryMethod, setSecondaryMethod] =
    useState<PaymentMethodInput["method"]>("TRANSFER");
  const [primaryAmount, setPrimaryAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Modals state
  const [paymentModalStep, setPaymentModalStep] = useState<"idle" | "primary" | "secondary">("idle");
  const [cashReceived, setCashReceived] = useState("");
  const [cardLast4, setCardLast4] = useState("");
  const [cardAuth, setCardAuth] = useState("");
  const [transferRef, setTransferRef] = useState("");
  const [transferBank, setTransferBank] = useState("");
  const [atratoReq, setAtratoReq] = useState("");
  const [atratoApproved, setAtratoApproved] = useState(false);
  const [finalPaymentMethods, setFinalPaymentMethods] = useState<PaymentMethodInput[]>([]);

  // ── Derived: filtered modelos
  const filteredModelos = useMemo(() => {
    return modelos.filter((m) => {
      const matchesCategory =
        categoryFilter === "Todos" || m.categoria === categoryFilter;
      const matchesSearch =
        !search || m.nombre.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [modelos, categoryFilter, search]);

  // ── Derived: modeloAplicable options (unique non-null values from simpleProducts)
  const modeloAplicableOptions = useMemo(() => {
    const set = new Set<string>();
    for (const sp of simpleProducts) {
      if (sp.modeloAplicable) set.add(sp.modeloAplicable);
    }
    return Array.from(set).sort();
  }, [simpleProducts]);

  // ── Derived: filtered simple products (tab Accesorios)
  const filteredSimpleProducts = useMemo(() => {
    return simpleProducts.filter((sp) => {
      const matchesModelo =
        simpleModeloFilter === "__all__" ||
        (simpleModeloFilter === "__global__" ? sp.modeloAplicable === null : sp.modeloAplicable === simpleModeloFilter);
      const matchesSearch =
        !search ||
        sp.nombre.toLowerCase().includes(search.toLowerCase()) ||
        sp.codigo.toLowerCase().includes(search.toLowerCase());
      return matchesModelo && matchesSearch;
    });
  }, [simpleProducts, simpleModeloFilter, search]);

  // ── Handler: add SimpleProduct to cart
  const handleAddSimpleProduct = useCallback((sp: SimpleProductData) => {
    if (sp.stockInBranch <= 0) {
      toast.error(`Sin stock disponible para ${sp.nombre}`);
      return;
    }
    setCart((prev) => {
      // Si ya está en el cart, incrementar cantidad (respeta stock)
      const existingIdx = prev.findIndex((ci) => ci.simpleProductId === sp.id);
      if (existingIdx >= 0) {
        const existing = prev[existingIdx];
        if (existing.quantity >= sp.stockInBranch) {
          toast.error(`Stock máximo alcanzado (${sp.stockInBranch})`);
          return prev;
        }
        return prev.map((ci, i) => (i === existingIdx ? { ...ci, quantity: ci.quantity + 1 } : ci));
      }
      return [
        ...prev,
        {
          variantId: `simple-${sp.id}`,
          modeloId: "",
          modeloNombre: sp.nombre,
          colorNombre: "",
          voltajeLabel: "",
          sku: sp.codigo,
          price: sp.precioPublico,
          quantity: 1,
          isSerialized: false,
          simpleProductId: sp.id,
          simpleCategoria: sp.categoria,
        },
      ];
    });
  }, []);

  // ── Derived: voltaje options for selected model
  const voltajeOptions = useMemo((): VoltajeOption[] => {
    if (!selectedModelo) return [];
    const seen = new Map<string, VoltajeOption>();
    for (const v of selectedModelo.variants) {
      if (!seen.has(v.voltajeId)) {
        const bConfig = batteryConfigs.find(
          (bc) =>
            bc.modeloId === selectedModelo.id && bc.voltajeId === v.voltajeId,
        );
        const required = bConfig?.quantity ?? 0;
        const stockInBranch = selectedModelo.variants
          .filter((vv) => vv.voltajeId === v.voltajeId)
          .reduce((sum, vv) => sum + vv.stockInBranch, 0);
        seen.set(v.voltajeId, {
          id: v.voltajeId,
          valor: v.voltajeValor,
          label: v.voltajeLabel,
          stockInBranch,
          batteriesRequired: required,
          canAssemble: required > 0 && availableBatteriesCount >= required,
        });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.valor - b.valor);
  }, [selectedModelo, batteryConfigs, availableBatteriesCount]);

  // ── Derived: color options filtered by voltaje
  const colorOptions = useMemo(() => {
    if (!selectedModelo || !selectedVoltajeId) return [];
    const seen = new Map<
      string,
      { id: string; nombre: string; stockInBranch: number }
    >();
    for (const v of selectedModelo.variants) {
      if (v.voltajeId !== selectedVoltajeId) continue;
      if (!seen.has(v.colorId)) {
        seen.set(v.colorId, {
          id: v.colorId,
          nombre: v.colorNombre,
          stockInBranch: v.stockInBranch,
        });
      } else {
        const existing = seen.get(v.colorId)!;
        existing.stockInBranch += v.stockInBranch;
      }
    }
    return Array.from(seen.values());
  }, [selectedModelo, selectedVoltajeId]);

  // ── Derived: selected variant
  const selectedVariant = useMemo((): VariantInfo | null => {
    if (!selectedModelo || !selectedVoltajeId || !selectedColorId) return null;
    return (
      selectedModelo.variants.find(
        (v) =>
          v.voltajeId === selectedVoltajeId && v.colorId === selectedColorId,
      ) ?? null
    );
  }, [selectedModelo, selectedVoltajeId, selectedColorId]);

  // ── Derived: batteries needed
  const requiredBatteries = useMemo((): number => {
    if (!selectedModelo || !selectedVoltajeId) return 0;
    return (
      batteryConfigs.find(
        (bc) =>
          bc.modeloId === selectedModelo.id &&
          bc.voltajeId === selectedVoltajeId,
      )?.quantity ?? 0
    );
  }, [selectedModelo, selectedVoltajeId, batteryConfigs]);

  // ── Derived: cart totals
  const subtotal = cart.reduce((a, item) => a + item.price * item.quantity, 0);
  const totalAfterDiscount =
    subtotal - (discountAuthorized ? discountAmount : 0);
  const layawayDownPayment = isLayaway
    ? Math.round((totalAfterDiscount * layawayPercent) / 100)
    : 0;

  // ── Derived: payment coverage check
  const primaryAmountNum = parseFloat(primaryAmount) || 0;
  const secondaryAmountNum = isSplitPayment
    ? totalAfterDiscount - primaryAmountNum
    : 0;
  const splitCovered =
    !isSplitPayment ||
    Math.abs(primaryAmountNum + secondaryAmountNum - totalAfterDiscount) < 0.01;

  // ── Handlers: model selection
  const handleSelectModelo = (modelo: ModeloData) => {
    setSelectedModelo(modelo);
    setSelectedVoltajeId("");
    setSelectedColorId("");
    setAssemblyMode(false);
    setSelectedCustomerBike(null);
    setVinDialogOpen(false);
    setBatterySerialInputs([]);
    setBatteryStatuses({});
  };

  // ── Handlers: voltaje selection
  const handleSelectVoltaje = (voltajeId: string) => {
    const opt = voltajeOptions.find((v) => v.id === voltajeId);
    if (!opt) return;

    // Check if it's a pure out-of-stock with no assembly option
    if (opt.stockInBranch <= 0 && !opt.canAssemble) {
      toast.error("Sin stock disponible para este voltaje");
      return;
    }

    setSelectedVoltajeId(voltajeId);
    setSelectedColorId("");
    setAssemblyMode(opt.stockInBranch <= 0 && opt.canAssemble);
    setBatterySerialInputs(Array(opt.batteriesRequired).fill(""));
    setBatteryStatuses({});
  };

  // ── Handlers: battery serial check
  const checkBatterySerial = useCallback(
    async (serial: string, index: number) => {
      if (!serial) {
        setBatteryStatuses((prev) => ({ ...prev, [index]: "idle" }));
        return;
      }
      setBatteryStatuses((prev) => ({ ...prev, [index]: "checking" }));
      try {
        const res = await fetch(
          `/api/batteries/check?serial=${encodeURIComponent(serial)}&branchId=${sessionBranchId}`,
        );
        const data: { found?: boolean; status?: string } = await res.json();
        if (data.found && data.status === "IN_STOCK") {
          setBatteryStatuses((prev) => ({ ...prev, [index]: "valid" }));
        } else {
          setBatteryStatuses((prev) => ({ ...prev, [index]: "invalid" }));
        }
      } catch {
        setBatteryStatuses((prev) => ({ ...prev, [index]: "idle" }));
      }
    },
    [sessionBranchId],
  );

  // MANAGER/ADMIN se autoautorizan: en cuanto ponen un descuento > 0, se aprueba localmente
  // con authorizationId = null. Para SELLER el panel de autorización se muestra hasta que
  // se consiga approved via PIN (presencial) o polling (remota).
  useEffect(() => {
    if (!isManager) return;
    if (discountAmount > 0 && !discountAuthorized) {
      setDiscountAuthorized({ authorizationId: null, name: sellerName || "Gerente" });
    }
    if (discountAmount === 0 && discountAuthorized) {
      setDiscountAuthorized(null);
    }
  }, [isManager, discountAmount, discountAuthorized, sellerName]);

  // ── Handlers: complete guided config → add to cart
  const handleCompleteConfig = () => {
    if (
      !selectedModelo ||
      !selectedVoltajeId ||
      !selectedColorId ||
      !selectedVariant
    )
      return;

    const needsVin = selectedModelo.requiere_vin;
    if (needsVin && !selectedCustomerBike) {
      toast.error("Selecciona una unidad antes de continuar");
      return;
    }

    if (assemblyMode) {
      const allValid = batterySerialInputs.every(
        (s, i) => s.length > 0 && batteryStatuses[i] === "valid",
      );
      if (!allValid) {
        toast.error("Todos los seriales de baterías deben ser válidos");
        return;
      }
    }

    // Check for duplicate cart item
    const existingIdx = cart.findIndex(
      (ci) => ci.variantId === selectedVariant.id,
    );
    if (existingIdx >= 0) {
      toast.info("Este producto ya está en el carrito");
      resetGuidedConfig();
      return;
    }

    const newItem: CartItem = {
      variantId: selectedVariant.id,
      modeloId: selectedModelo.id,
      modeloNombre: selectedModelo.nombre,
      colorNombre: selectedVariant.colorNombre,
      voltajeLabel: selectedVariant.voltajeLabel,
      sku: selectedVariant.sku,
      price: selectedVariant.precio,
      quantity: 1,
      isSerialized: selectedModelo.requiere_vin,
      serialNumber: needsVin ? selectedCustomerBike!.serialNumber : undefined,
      customerBikeId: needsVin ? selectedCustomerBike!.id : undefined,
      batterySerials: assemblyMode ? [...batterySerialInputs] : undefined,
      assemblyMode,
    };

    setCart((prev) => [...prev, newItem]);
    toast.success(
      `${selectedModelo.nombre} ${selectedVariant.colorNombre} ${selectedVariant.voltajeLabel} agregado`,
    );
    resetGuidedConfig();
  };

  const resetGuidedConfig = () => {
    setSelectedModelo(null);
    setSelectedVoltajeId("");
    setSelectedColorId("");
    setAssemblyMode(false);
    setSelectedCustomerBike(null);
    setVinDialogOpen(false);
    setBatterySerialInputs([]);
    setBatteryStatuses({});
  };

  // ── Handlers: start checkout sequence
  const handleStartProcess = () => {
    if (cart.length === 0) return;
    if (discountAmount > 0 && !discountAuthorized) {
      toast.error("El descuento requiere autorización de Manager");
      return;
    }
    if (!selectedCustomerId) {
      toast.error("Debes seleccionar un cliente para continuar");
      return;
    }

    setCashReceived("");
    setCardLast4("");
    setCardAuth("");
    setTransferRef("");
    setTransferBank("");
    setAtratoReq("");
    setAtratoApproved(false);
    setFinalPaymentMethods([]);

    // Calculate actual required amount if they pay with CASH and need suggestions
    // But modal handles its own input so we just open primary step
    setPaymentModalStep("primary");
  };

  const handleCheckout = async (methodsToSubmit: PaymentMethodInput[], totalChange: number = 0) => {
    setPaymentModalStep("idle");
    setIsProcessing(true);
    toast.loading("Procesando venta...", { id: "checkout" });

    try {
      const result = await fetch("/api/sales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: cart.map((ci) => ({
            productVariantId: ci.isFreeForm || ci.simpleProductId ? null : ci.variantId,
            simpleProductId: ci.simpleProductId,
            quantity: ci.quantity,
            price: ci.price,
            name: ci.isFreeForm
              ? (ci.description ?? "Concepto libre")
              : ci.simpleProductId
                ? ci.modeloNombre
                : `${ci.modeloNombre} ${ci.colorNombre} ${ci.voltajeLabel}`,
            isFreeForm: ci.isFreeForm,
            isSerialized: ci.isSerialized,
            serialNumber: ci.serialNumber,
            customerBikeId: ci.customerBikeId,
            voltageChange: ci.voltageChange
              ? { targetVoltajeId: ci.voltageChange.targetVoltajeId }
              : undefined,
            batterySerials: ci.batterySerials,
            assemblyMode: ci.assemblyMode,
          })),
          total: totalAfterDiscount,
          discount: discountAmount > 0 && discountAuthorized ? discountAmount : 0,
          paymentMethods: methodsToSubmit,
          isLayaway,
          customerId: selectedCustomerId || undefined,
          downPayment: isLayaway ? layawayDownPayment : undefined,
          internalNote,
          discountAmount:
            discountAmount > 0 && discountAuthorized ? discountAmount : undefined,
          discountAuthorizationId: discountAuthorized?.authorizationId ?? undefined,
          discountAuthorizedByName: discountAuthorized?.name,
        }),
      }).then((r) => r.json() as Promise<{ success: boolean; data?: { saleId: string; folio: string }; error?: string }>);

      if (!result.success) {
        toast.error(result.error ?? "Error al procesar la venta", {
          id: "checkout",
        });
        return;
      }

      const hasVoltageChange = cart.some((ci) => ci.voltageChange);
      toast.success(
        `Venta registrada · Folio: ${result.data!.folio}`,
        { id: "checkout", duration: 6000 },
      );
      if (hasVoltageChange) {
        toast("Reensamble pendiente", {
          description: "La póliza de garantía estará disponible al completar el reensamble en Montaje.",
          duration: 8000,
        });
      }

      if (totalChange > 0) {
        toast("ATENCIÓN: Cambio pendiente", {
          description: `Dar cambio al cliente: $${totalChange.toLocaleString("es-MX", { minimumFractionDigits: 2 })}`,
          duration: Infinity,
          style: {
            background: "var(--warn-container)",
            border: "1px solid var(--warn)",
            color: "var(--warn)",
          },
          action: {
            label: "Cambio entregado ✓",
            onClick: () => {}
          }
        });
      }

      resetCart();
    } catch {
      toast.error("Error de conexión", { id: "checkout" });
    } finally {
      setIsProcessing(false);
    }
  };

  const resetCart = () => {
    setCart([]);
    setDiscountAmount(0);
    setDiscountAuthorized(null);
    setDiscountReason("");
    setInternalNote("");
    setIsLayaway(false);
    setLayawayPercent(30);
    setSelectedCustomerId("");
    setIsSplitPayment(false);
    setPrimaryMethod("CASH");
    setPrimaryAmount("");
  };

  // ── Helper: voltaje options for a cart item (4-D voltage change) ──────────
  const getVoltajeOptionsForCartItem = (item: CartItem): VoltajeOptionForDialog[] => {
    const modelo = modelos.find((m) => m.id === item.modeloId);
    if (!modelo) return [];
    const seen = new Map<string, VoltajeOptionForDialog>();
    for (const v of modelo.variants) {
      if (!seen.has(v.voltajeId)) {
        seen.set(v.voltajeId, { id: v.voltajeId, valor: v.voltajeValor, label: v.voltajeLabel });
      }
    }
    return Array.from(seen.values()).sort((a, b) => a.valor - b.valor);
  };

  // ── Handlers: customer modal
  const handleCustomerSelect = (customer: CustomerData) => {
    setSelectedCustomerId(customer.id);
  };

  const handleCustomerCreated = (customer: CustomerData) => {
    setLocalCustomers((prev) => [...prev, customer]);
    router.refresh();
  };

  // ── Derived: can complete config
  const canCompleteConfig = useMemo((): boolean => {
    if (!selectedModelo || !selectedVoltajeId || !selectedColorId) return false;
    if (selectedModelo.requiere_vin && !selectedCustomerBike) return false;
    if (assemblyMode) {
      const allFilled = batterySerialInputs.every((s) => s.length > 0);
      const allValid = batterySerialInputs.every(
        (_, i) => batteryStatuses[i] === "valid",
      );
      if (!allFilled || !allValid) return false;
    }
    return true;
  }, [
    selectedModelo,
    selectedVoltajeId,
    selectedColorId,
    selectedCustomerBike,
    assemblyMode,
    batterySerialInputs,
    batteryStatuses,
  ]);

  // ── Derived: can process sale
  const canProcess = useMemo((): boolean => {
    if (cart.length === 0 || isProcessing) return false;
    if (!selectedCustomerId) return false;
    if (discountAmount > 0 && !discountAuthorized) return false;
    if (isSplitPayment && !splitCovered) return false;
    return true;
  }, [
    cart.length,
    isProcessing,
    discountAmount,
    discountAuthorized,
    selectedCustomerId,
    isSplitPayment,
    splitCovered,
  ]);

  // Folio is generated server-side on sale creation — nothing to derive here

  // ── Selected customer
  const selectedCustomer = localCustomers.find((c) => c.id === selectedCustomerId);

  // ── P12-A: remote stock map + transfer dialog state ───────────────────────
  // DO NOT modify cart, checkout, or payment logic below this block.
  const remoteStockMap = useMemo<RemoteStockMap>(
    () => new Map(remoteStockEntries),
    [remoteStockEntries],
  );

  const [transferDialogProduct, setTransferDialogProduct] = useState<TransferProduct | null>(null);

  const getModelRemoteStock = useCallback(
    (modelo: ModeloData): RemoteStockEntry[] => {
      const byBranch = new Map<string, RemoteStockEntry>();
      for (const v of modelo.variants) {
        for (const e of remoteStockMap.get(`v:${v.id}`) ?? []) {
          const ex = byBranch.get(e.branchId);
          if (ex) ex.quantity += e.quantity;
          else byBranch.set(e.branchId, { ...e });
        }
      }
      return Array.from(byBranch.values());
    },
    [remoteStockMap],
  );

  const buildVariantOptions = useCallback(
    (modelo: ModeloData) =>
      modelo.variants
        .map((v) => ({
          id: v.id,
          label: `${v.colorNombre} · ${v.voltajeLabel}`,
          remoteStock: remoteStockMap.get(`v:${v.id}`) ?? [],
        }))
        .filter((opt) => opt.remoteStock.length > 0),
    [remoteStockMap],
  );

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div
      className="flex gap-0 h-full overflow-hidden"
      style={{ background: "var(--surface)" }}
    >
      {/* ══ LEFT COLUMN ══════════════════════════════════════════════════════════ */}
      <div className="flex-1 min-w-0 flex flex-col overflow-hidden">
        {/* Category pills */}
        <div className="px-4 pt-3 pb-2 flex items-center gap-2 overflow-x-auto shrink-0">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => setCategoryFilter(cat.key)}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={
                categoryFilter === cat.key
                  ? {
                    background: "linear-gradient(135deg, #1B4332, #2ECC71)",
                    color: "var(--on-primary)",
                  }
                  : {
                    border: "1.5px solid var(--outline-var)",
                    color: "var(--on-surf-var)",
                    background: "transparent",
                  }
              }
            >
              {cat.label}
            </button>
          ))}
          {/* Search */}
          <div className="ml-auto relative shrink-0">
            <Search
              className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5"
              style={{ color: "var(--on-surf-var)" }}
            />
            <input
              className="pl-8 pr-3 py-1.5 text-xs rounded-full w-44 focus:outline-none focus:ring-2 focus:ring-[var(--p-bright)]"
              style={{
                background: "var(--surf-lowest)",
                color: "var(--on-surf)",
                border: "1.5px solid var(--outline-var)",
              }}
              placeholder="Buscar modelo..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Product grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 14px 14px" }}>
          {categoryFilter === "ACCESORIOS" ? (
            <>
              {/* Sub-filtro: modeloAplicable */}
              <div className="flex items-center gap-2 pt-1 pb-3 flex-wrap">
                <span className="text-[10px]" style={{ color: "var(--on-surf-var)" }}>
                  Compatible con:
                </span>
                <button
                  onClick={() => setSimpleModeloFilter("__all__")}
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
                  style={
                    simpleModeloFilter === "__all__"
                      ? { background: "var(--p-bright)", color: "var(--on-primary)" }
                      : { border: "1px solid var(--outline-var)", color: "var(--on-surf-var)", background: "transparent" }
                  }
                >
                  Todos
                </button>
                <button
                  onClick={() => setSimpleModeloFilter("__global__")}
                  className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
                  style={
                    simpleModeloFilter === "__global__"
                      ? { background: "var(--p-bright)", color: "var(--on-primary)" }
                      : { border: "1px solid var(--outline-var)", color: "var(--on-surf-var)", background: "transparent" }
                  }
                >
                  Universal
                </button>
                {modeloAplicableOptions.map((m) => (
                  <button
                    key={m}
                    onClick={() => setSimpleModeloFilter(m)}
                    className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
                    style={
                      simpleModeloFilter === m
                        ? { background: "var(--p-bright)", color: "var(--on-primary)" }
                        : { border: "1px solid var(--outline-var)", color: "var(--on-surf-var)", background: "transparent" }
                    }
                  >
                    {m}
                  </button>
                ))}
              </div>

              {filteredSimpleProducts.length === 0 ? (
                <div
                  className="flex flex-col items-center justify-center py-20 gap-3"
                  style={{ color: "var(--on-surf-var)" }}
                >
                  <ShoppingBag className="w-10 h-10 opacity-30" />
                  <p className="text-sm">Sin accesorios disponibles</p>
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-3 pt-1">
                  {filteredSimpleProducts.map((sp) => {
                    const spRemote = remoteStockMap.get(`s:${sp.id}`) ?? [];
                    return (
                      <div key={sp.id} className="relative">
                        <SimpleProductCard
                          sp={sp}
                          onAdd={handleAddSimpleProduct}
                          onRequestTransfer={
                            spRemote.length > 0 && sp.stockInBranch === 0
                              ? () =>
                                  setTransferDialogProduct({
                                    kind: "simple",
                                    id: sp.id,
                                    name: sp.nombre,
                                    remoteStock: spRemote,
                                  })
                              : undefined
                          }
                        />
                        {spRemote.length > 0 && (
                          <RemoteStockPopover
                            productKey={`s:${sp.id}`}
                            productName={sp.nombre}
                            localStock={sp.stockInBranch}
                            remoteStock={spRemote}
                            myBranchName={branchName}
                            onSolicitar={() =>
                              setTransferDialogProduct({
                                kind: "simple",
                                id: sp.id,
                                name: sp.nombre,
                                remoteStock: spRemote,
                              })
                            }
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : filteredModelos.length === 0 ? (
            <div
              className="flex flex-col items-center justify-center py-20 gap-3"
              style={{ color: "var(--on-surf-var)" }}
            >
              <Search className="w-10 h-10 opacity-30" />
              <p className="text-sm">
                Sin resultados para &ldquo;{search}&rdquo;
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-4 gap-3 pt-1">
              {filteredModelos.map((modelo) => {
                const modelRemote = getModelRemoteStock(modelo);
                const hasRemote = modelRemote.length > 0;
                const variantOpts = hasRemote ? buildVariantOptions(modelo) : [];
                return (
                  <div key={modelo.id} className="relative">
                    <ModelCard
                      modelo={modelo}
                      isSelected={selectedModelo?.id === modelo.id}
                      onSelect={handleSelectModelo}
                      onRequestTransfer={
                        hasRemote && modelo.totalStockInBranch === 0
                          ? () =>
                              setTransferDialogProduct({
                                kind: "modelo",
                                id: modelo.id,
                                name: modelo.nombre,
                                variantOptions: variantOpts,
                              })
                          : undefined
                      }
                    />
                    {hasRemote && (
                      <RemoteStockPopover
                        productKey={`m:${modelo.id}`}
                        productName={modelo.nombre}
                        localStock={modelo.totalStockInBranch}
                        remoteStock={modelRemote}
                        myBranchName={branchName}
                        onSolicitar={() =>
                          setTransferDialogProduct({
                            kind: "modelo",
                            id: modelo.id,
                            name: modelo.nombre,
                            variantOptions: variantOpts,
                          })
                        }
                      />
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ══ RIGHT COLUMN ═════════════════════════════════════════════════════════ */}
      <div
        className="w-[360px] shrink-0 flex flex-col border-l overflow-hidden"
        style={{
          background: "var(--surf-low)",
          borderLeft: "1px solid rgba(178,204,192,0.2)",
          borderColor: "rgba(178,204,192,0.2)",
        }}
      >
        {/* Panel header */}
        <div
          className="px-4 py-3.5 shrink-0 border-b"
          style={{
            background: "var(--surf-low)",
            borderColor: "rgba(178,204,192,0.2)",
          }}
        >
          <div className="flex items-center justify-between mb-1">
            <span
              className="font-bold text-[20px]"
              style={{
                fontFamily: "var(--font-display)",
                color: "var(--on-surf)",
              }}
            >
              Transacción
            </span>
            <span
              className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
              style={{
                background: "var(--sec-container)",
                color: "var(--on-sec-container)",
              }}
            >
              Caja abierta
            </span>
          </div>
          <p className="text-[11px]" style={{ color: "var(--on-surf-var)" }}>
            {sellerName} · {branchName}
          </p>
          <p
            className="text-[10px] mt-0.5"
            style={{ color: "var(--on-surf-var)", opacity: 0.6, fontFamily: "var(--font-body)" }}
          >
            Venta en proceso
          </p>
        </div>

        {/* Scrollable body */}
        <div
          style={{ flex: 1, overflowY: "auto", background: "var(--surface)" }}
        >
          <div className="py-2 space-y-2">
            {/* ── Guided config — floating card ────────────────────────────── */}
            {selectedModelo && (
              <div
                style={{
                  background: "var(--surf-high)",
                  borderRadius: 16,
                  border: "1px solid rgba(46,204,113,0.2)",
                  borderLeft: "4px solid var(--p-bright)",
                  padding: 20,
                  margin: 12,
                  boxShadow: "0 8px 32px var(--shadow)",
                }}
              >
                {/* Card header */}
                <div
                  className="flex items-center gap-2.5"
                  style={{ position: "relative" }}
                >
                  {selectedModelo.imageUrl ? (
                    <div
                      className="relative shrink-0"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        overflow: "hidden",
                      }}
                    >
                      <Image
                        src={selectedModelo.imageUrl}
                        alt={selectedModelo.nombre}
                        fill
                        style={{ objectFit: "cover" }}
                      />
                    </div>
                  ) : (
                    <div
                      className="shrink-0 flex items-center justify-center"
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 10,
                        background: "var(--surf-highest)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-display)",
                          fontSize: 15,
                          fontWeight: 700,
                          color: "var(--on-surf-var)",
                        }}
                      >
                        {getInitials(selectedModelo.nombre)}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0 pr-6">
                    <p
                      className="truncate"
                      style={{
                        fontFamily: "var(--font-display)",
                        fontSize: 13,
                        fontWeight: 700,
                        color: "var(--on-surf)",
                        lineHeight: 1.2,
                      }}
                    >
                      {selectedModelo.nombre}
                    </p>
                    <p
                      style={{
                        fontSize: 10,
                        fontWeight: 600,
                        color: "var(--p-bright)",
                        letterSpacing: "0.15em",
                        textTransform: "uppercase" as const,
                        marginTop: 2,
                      }}
                    >
                      SELECCIÓN GUIADA
                    </p>
                  </div>
                  <button
                    onClick={resetGuidedConfig}
                    className="absolute top-0 right-0 flex items-center justify-center"
                    style={{
                      width: 20,
                      height: 20,
                      color: "var(--on-surf-var)",
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                    }}
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Separator */}
                <div
                  style={{
                    borderTop: "1px solid var(--ghost-border)",
                    margin: "12px 0",
                  }}
                />

                {/* Step 1: Voltaje */}
                <div>
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--on-surf-var)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                      marginBottom: 8,
                    }}
                  >
                    1. Voltaje del sistema
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {voltajeOptions.map((opt) => {
                      const isVoltajeSelected = opt.id === selectedVoltajeId;
                      const hasVoltajeStock = opt.stockInBranch > 0;
                      const canAssembleOpt = !hasVoltajeStock && opt.canAssemble;
                      const noOption = !hasVoltajeStock && !opt.canAssemble;

                      // 3 visual states per spec
                      let pillStyle: React.CSSProperties = {};
                      if (isVoltajeSelected && hasVoltajeStock) {
                        pillStyle = {
                          background: "var(--sec-container)",
                          border: "1px solid var(--p-bright)",
                          color: "var(--p-bright)",
                          fontWeight: 700,
                        };
                      } else if (isVoltajeSelected && canAssembleOpt) {
                        pillStyle = {
                          background: "var(--warn-container)",
                          border: "1px solid var(--warn)",
                          color: "var(--warn)",
                          fontWeight: 700,
                        };
                      } else if (hasVoltajeStock) {
                        // DISPONIBLE — not selected
                        pillStyle = {
                          background: "transparent",
                          border: "1px solid var(--p-bright)",
                          color: "var(--p)",
                        };
                      } else if (canAssembleOpt) {
                        // ENSAMBLAR — amber
                        pillStyle = {
                          background: "transparent",
                          border: "1px solid var(--warn)",
                          color: "var(--warn)",
                        };
                      } else {
                        // SIN_STOCK — disabled
                        pillStyle = {
                          background: "transparent",
                          border: "1px solid rgba(178,204,192,0.2)",
                          color: "var(--on-surf-var)",
                          opacity: 0.4,
                          pointerEvents: "none" as const,
                          cursor: "not-allowed",
                        };
                      }

                      return (
                        <button
                          key={opt.id}
                          disabled={noOption}
                          onClick={() => handleSelectVoltaje(opt.id)}
                          className="flex items-center justify-center gap-1 transition-all"
                          style={{
                            borderRadius: 999,
                            padding: "6px 16px",
                            fontSize: 13,
                            fontFamily: "var(--font-body)",
                            fontWeight: isVoltajeSelected ? 700 : 500,
                            ...pillStyle,
                          }}
                        >
                          {opt.label}
                          {canAssembleOpt && (
                            <Battery className="w-3 h-3 ml-0.5" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                  {selectedVoltajeId &&
                    (() => {
                      const opt = voltajeOptions.find(
                        (v) => v.id === selectedVoltajeId,
                      );
                      if (!opt) return null;
                      if (opt.stockInBranch > 0)
                        return (
                          <p
                            style={{
                              fontSize: 11,
                              color: "var(--p-bright)",
                              marginTop: 6,
                              fontFamily: "var(--font-body)",
                            }}
                          >
                            {opt.stockInBranch} unidades disponibles
                          </p>
                        );
                      if (opt.canAssemble)
                        return (
                          <p
                            style={{
                              fontSize: 11,
                              color: "var(--warn)",
                              marginTop: 6,
                              fontFamily: "var(--font-body)",
                              lineHeight: 1.4,
                            }}
                          >
                            Esta unidad requiere ensamble a {opt.label}. Se
                            creará una orden de montaje automáticamente.
                            <br />
                            {availableBatteriesCount} baterías disponibles en
                            sucursal.
                          </p>
                        );
                      return (
                        <p
                          style={{
                            fontSize: 11,
                            color: "var(--ter)",
                            marginTop: 6,
                          }}
                        >
                          Sin stock
                        </p>
                      );
                    })()}
                </div>

                {/* Separator */}
                <div
                  style={{
                    borderTop: "1px solid var(--ghost-border)",
                    margin: "12px 0",
                  }}
                />

                {/* Step 2: Color — always visible */}
                <div
                  style={{
                    opacity: !selectedVoltajeId ? 0.4 : 1,
                    pointerEvents: !selectedVoltajeId ? "none" : undefined,
                  }}
                >
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--on-surf-var)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                      marginBottom: 8,
                      fontFamily: "var(--font-body)",
                    }}
                  >
                    2. Color del cuadro
                  </p>
                  <div className="flex flex-wrap" style={{ gap: 8 }}>
                    {colorOptions.length > 0
                      ? colorOptions.map((c) => {
                        const css = colorToCSS(c.nombre);
                        const isGradient = css.includes("gradient");
                        const isColorSelected = c.id === selectedColorId;
                        const hasColorStock = c.stockInBranch > 0;
                        return (
                          <button
                            key={c.id}
                            title={c.nombre + (hasColorStock ? "" : " — Sin stock")}
                            onClick={() => hasColorStock && setSelectedColorId(c.id)}
                            style={{
                              width: 32,
                              height: 32,
                              borderRadius: "50%",
                              flexShrink: 0,
                              ...(isGradient
                                ? { background: css }
                                : { backgroundColor: css }),
                              border: isColorSelected
                                ? "2px solid var(--p-bright)"
                                : "1px solid var(--outline-var)",
                              boxShadow: isColorSelected
                                ? "0 0 0 2px rgba(46,204,113,0.2)"
                                : "none",
                              opacity: !hasColorStock ? 0.5 : isColorSelected ? 1 : 0.8,
                              filter: !hasColorStock ? "blur(1.5px)" : "none",
                              cursor: !hasColorStock ? "not-allowed" : "pointer",
                              pointerEvents: !hasColorStock ? "none" : undefined,
                              transition: "all 0.15s",
                            }}
                          />
                        );
                      })
                      : [0, 1, 2].map((i) => (
                        <div
                          key={i}
                          style={{
                            width: 32,
                            height: 32,
                            borderRadius: "50%",
                            background: "var(--surf-low)",
                            border: "1px solid var(--outline-var)",
                          }}
                        />
                      ))}
                  </div>
                  {selectedColorId && (
                    <p
                      style={{
                        fontSize: 11,
                        color: "var(--p-bright)",
                        fontWeight: 500,
                        marginTop: 6,
                      }}
                    >
                      {
                        colorOptions.find((c) => c.id === selectedColorId)
                          ?.nombre
                      }
                      {selectedVariant
                        ? ` · $${selectedVariant.precio.toLocaleString("es-MX")}`
                        : ""}
                    </p>
                  )}
                </div>

                {/* Step 3: Unit selector — only when requiere_vin */}
                {selectedModelo.requiere_vin && (
                  <>
                    <div
                      style={{
                        borderTop: "1px solid var(--ghost-border)",
                        margin: "12px 0",
                      }}
                    />
                    <div
                      style={{
                        opacity: !selectedColorId ? 0.4 : 1,
                        pointerEvents: !selectedColorId ? "none" : undefined,
                      }}
                    >
                      <p
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "var(--on-surf-var)",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase" as const,
                          marginBottom: 8,
                        }}
                      >
                        3. UNIDAD (VIN)
                      </p>

                      {selectedCustomerBike ? (
                        /* Selected unit display */
                        <div
                          className="flex items-center gap-2"
                          style={{
                            background: "var(--sec-container)",
                            borderRadius: 10,
                            padding: "8px 12px",
                          }}
                        >
                          <Check
                            className="w-3.5 h-3.5 shrink-0"
                            style={{ color: "var(--p-bright)" }}
                          />
                          <div className="flex-1 min-w-0">
                            <p
                              className="text-xs font-mono font-semibold truncate"
                              style={{ color: "var(--on-surf)" }}
                            >
                              {selectedCustomerBike.serialNumber}
                            </p>
                            <p
                              className="text-[10px] truncate"
                              style={{ color: "var(--on-surf-var)" }}
                            >
                              {selectedCustomerBike.voltaje ??
                                selectedCustomerBike.productVariant?.voltaje?.label ??
                                "—"}
                            </p>
                          </div>
                          <button
                            onClick={() => setSelectedCustomerBike(null)}
                            className="shrink-0"
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--on-surf-var)",
                              cursor: "pointer",
                              padding: 2,
                            }}
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        /* Open selector button */
                        <button
                          disabled={!selectedColorId || !selectedVariant}
                          onClick={() => setVinDialogOpen(true)}
                          className="w-full flex items-center gap-2 transition-all"
                          style={{
                            background: "var(--surf-lowest)",
                            border: "none",
                            borderRadius: 12,
                            color: "var(--on-surf-var)",
                            padding: "10px 14px",
                            fontSize: 12,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <Search className="w-3.5 h-3.5 shrink-0" />
                          <span>Seleccionar unidad ensamblada...</span>
                        </button>
                      )}

                      {/* VinSelectorDialog */}
                      {selectedVariant && (
                        <VinSelectorDialog
                          open={vinDialogOpen}
                          onOpenChange={setVinDialogOpen}
                          productVariantId={selectedVariant.id}
                          onSelect={(bike) => setSelectedCustomerBike(bike)}
                        />
                      )}
                    </div>
                  </>
                )}

                {/* Step 4: Battery serials — only when assembly mode */}
                {selectedColorId && assemblyMode && (
                  <>
                    <div
                      style={{
                        borderTop: "1px solid var(--ghost-border)",
                        margin: "12px 0",
                      }}
                    />
                    <div>
                      <p
                        style={{
                          fontSize: 10,
                          fontWeight: 600,
                          color: "var(--on-surf-var)",
                          letterSpacing: "0.12em",
                          textTransform: "uppercase" as const,
                          marginBottom: 8,
                        }}
                      >
                        4. Series de baterías (
                        {
                          batterySerialInputs.filter(
                            (_, i) => batteryStatuses[i] === "valid",
                          ).length
                        }
                        /{requiredBatteries})
                      </p>
                      <div className="space-y-2">
                        {batterySerialInputs.map((serial, idx) => (
                          <div key={idx} className="relative">
                            <input
                              className="w-full focus:outline-none"
                              style={{
                                background: "var(--surf-low)",
                                border:
                                  batteryStatuses[idx] === "valid"
                                    ? "1px solid var(--p-bright)"
                                    : batteryStatuses[idx] === "invalid"
                                      ? "1px solid var(--ter)"
                                      : "1px solid rgba(178,204,192,0.2)",
                                borderRadius: 10,
                                color: "var(--on-surf)",
                                padding: "10px 40px 10px 14px",
                                fontSize: 12,
                              }}
                              placeholder={`Batería ${idx + 1}...`}
                              value={serial}
                              onChange={(e) => {
                                const newInputs = [...batterySerialInputs];
                                newInputs[idx] = e.target.value;
                                setBatterySerialInputs(newInputs);
                                setBatteryStatuses((prev) => ({
                                  ...prev,
                                  [idx]: "idle",
                                }));
                              }}
                              onBlur={() => checkBatterySerial(serial, idx)}
                            />
                            <div className="absolute right-3 top-1/2 -translate-y-1/2">
                              {batteryStatuses[idx] === "checking" && (
                                <Loader2
                                  className="w-3.5 h-3.5 animate-spin"
                                  style={{ color: "var(--on-surf-var)" }}
                                />
                              )}
                              {batteryStatuses[idx] === "valid" && (
                                <Check
                                  className="w-3.5 h-3.5"
                                  style={{ color: "var(--p-bright)" }}
                                />
                              )}
                              {batteryStatuses[idx] === "invalid" && (
                                <X
                                  className="w-3.5 h-3.5"
                                  style={{ color: "var(--ter)" }}
                                />
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {/* Complete config button */}
                <button
                  disabled={!canCompleteConfig}
                  onClick={handleCompleteConfig}
                  className="w-full transition-all"
                  style={{
                    marginTop: 12,
                    padding: 14,
                    borderRadius: 999,
                    background: canCompleteConfig
                      ? "var(--p-bright)"
                      : "var(--surf-highest)",
                    boxShadow: canCompleteConfig
                      ? "0 8px 24px rgba(46,204,113,0.15)"
                      : "none",
                    color: canCompleteConfig
                      ? "var(--on-p)"
                      : "var(--on-surf-var)",
                    fontFamily: "var(--font-display)",
                    fontSize: 13,
                    fontWeight: 700,
                    border: "none",
                  }}
                >
                  Completar configuración
                </button>
              </div>
            )}

            {/* ── Cart items ──────────────────────────────────────────────── */}
            {cart.length === 0 && !selectedModelo && (
              <div
                className="flex flex-col items-center justify-center py-8 gap-3"
                style={{ color: "var(--on-surf-var)" }}
              >
                <ShoppingBag className="w-8 h-8 opacity-20" />
                <p className="text-[11px]">Selecciona un producto</p>
                <button
                  onClick={() => setFreeFormOpen(true)}
                  className="flex items-center gap-1.5"
                  style={{
                    padding: "6px 14px",
                    borderRadius: 999,
                    background: "transparent",
                    border: "1.5px solid var(--p-mid)",
                    color: "var(--p)",
                    fontFamily: "var(--font-body)",
                    fontSize: 11,
                    fontWeight: 500,
                    cursor: "pointer",
                  }}
                >
                  <Plus className="w-3 h-3" />
                  Agregar concepto libre
                </button>
              </div>
            )}

            {cart.length > 0 && (
              <div style={{ opacity: selectedModelo ? 0.6 : 1 }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--on-surf-var)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                    padding: "8px 16px 4px",
                  }}
                >
                  ARTÍCULOS ({cart.length})
                </p>
                {!selectedModelo && (
                  <div style={{ padding: "0 12px 6px" }}>
                    <button
                      onClick={() => setFreeFormOpen(true)}
                      className="w-full flex items-center justify-center gap-1.5"
                      style={{
                        padding: "6px 12px",
                        borderRadius: 999,
                        background: "transparent",
                        border: "1.5px dashed var(--outline-var)",
                        color: "var(--on-surf-var)",
                        fontFamily: "var(--font-body)",
                        fontSize: 11,
                        fontWeight: 500,
                        cursor: "pointer",
                      }}
                    >
                      <Plus className="w-3 h-3" />
                      Agregar concepto libre
                    </button>
                  </div>
                )}
                {cart.map((item, idx) => (
                  <div
                    key={`${item.variantId}-${idx}`}
                    className="flex items-start gap-2"
                    style={{
                      padding: "10px 14px",
                      margin: "4px 12px",
                    }}
                  >
                    <div className="flex-1 min-w-0">
                      <p
                        className="font-bold text-[13px] truncate"
                        style={{
                          fontFamily: "var(--font-display)",
                          color: "var(--on-surf)",
                        }}
                      >
                        {item.isFreeForm ? (item.description ?? "Concepto libre") : item.modeloNombre}
                      </p>
                      {item.isFreeForm ? (
                        <p
                          className="text-[10px] mt-0.5 font-semibold"
                          style={{
                            color: "var(--on-surf-var)",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          Concepto libre
                        </p>
                      ) : item.simpleProductId ? (
                        <p
                          className="text-[10px] mt-0.5 font-semibold"
                          style={{
                            color: "var(--on-surf-var)",
                            letterSpacing: "0.08em",
                            textTransform: "uppercase",
                          }}
                        >
                          {item.simpleCategoria ? SIMPLE_CATEGORIA_LABELS[item.simpleCategoria] : "Producto"} · {item.sku}
                        </p>
                      ) : (
                        <p
                          className="text-[11px] mt-0.5"
                          style={{ color: "var(--on-surf-var)" }}
                        >
                          {item.colorNombre} / {item.voltajeLabel}
                        </p>
                      )}
                      {item.serialNumber && (
                        <p
                          className="text-[10px] font-mono mt-0.5"
                          style={{ color: "var(--on-surf-var)" }}
                        >
                          VIN: {item.serialNumber}
                        </p>
                      )}
                      {/* Voltage change chip / button (4-D) */}
                      {item.isSerialized && item.customerBikeId && (
                        item.voltageChange ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <span
                              className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full"
                              style={{ background: "var(--ter-container)", color: "var(--on-ter-container)" }}
                            >
                              ⚡ {item.voltajeLabel} → {item.voltageChange.targetVoltajeLabel}
                            </span>
                            <button
                              onClick={() =>
                                setCart((prev) =>
                                  prev.map((ci, i) =>
                                    i === idx ? { ...ci, voltageChange: undefined } : ci
                                  )
                                )
                              }
                              style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                            >
                              <span className="text-[10px]" style={{ color: "var(--ter)" }}>✕</span>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setVoltageChangeTargetIdx(idx)}
                            className="text-[10px] mt-0.5"
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              color: "var(--on-surf-var)",
                              padding: 0,
                              textDecoration: "underline",
                              textDecorationStyle: "dashed",
                            }}
                          >
                            Cambiar voltaje
                          </button>
                        )
                      )}
                      {item.assemblyMode &&
                        item.batterySerials &&
                        item.batterySerials.length > 0 && (
                          <p
                            className="text-[10px] mt-0.5"
                            style={{ color: "var(--warn)" }}
                          >
                            ⚡ {item.batterySerials.length} bat. ensambladas
                          </p>
                        )}
                      <p
                        className="font-bold text-[14px] mt-1"
                        style={{ color: "var(--p-bright)" }}
                      >
                        ${(item.price * item.quantity).toLocaleString("es-MX")}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                      <span
                        className="text-[11px] w-5 text-center"
                        style={{ color: "var(--on-surf)" }}
                      >
                        ×{item.quantity}
                      </span>
                      <button
                        onClick={() =>
                          setCart((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{
                          color: "var(--ter)",
                          background: "var(--ter-container)",
                        }}
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* ── Discount section ─────────────────────────────────────────── */}
            {cart.length > 0 && (
              <div
                className="space-y-1.5"
                style={{
                  background: "var(--surf-high)",
                  borderRadius: 10,
                  padding: "10px 14px",
                  margin: "4px 12px",
                }}
              >
                <div className="flex items-center justify-between">
                  <p
                    style={{
                      fontSize: 10,
                      fontWeight: 600,
                      color: "var(--on-surf-var)",
                      letterSpacing: "0.12em",
                      textTransform: "uppercase" as const,
                    }}
                  >
                    DESCUENTO
                  </p>
                  {discountAuthorized ? (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: "var(--sec-container)",
                        color: "var(--p-bright)",
                      }}
                    >
                      Aut. {discountAuthorized.name.split(" ")[0]}
                    </span>
                  ) : (
                    <span
                      className="text-[9px] px-1.5 py-0.5 rounded-full font-medium"
                      style={{
                        background: "var(--warn-container)",
                        color: "var(--warn)",
                      }}
                    >
                      Req. Manager
                    </span>
                  )}
                </div>
                <div className="relative">
                  <span
                    className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[10px]"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    $
                  </span>
                  <input
                    type="number"
                    min={0}
                    className="w-full pl-5 pr-2 py-1.5 text-[10px] rounded-lg focus:outline-none"
                    style={{
                      background: "var(--surf-low)",
                      border: "1px solid rgba(178,204,192,0.2)",
                      color: "var(--on-surf)",
                    }}
                    placeholder="0.00"
                    value={discountAmount || ""}
                    onChange={(e) => {
                      setDiscountAmount(parseFloat(e.target.value) || 0);
                      setDiscountAuthorized(null);
                    }}
                  />
                </div>

                {discountAmount > 0 && !discountAuthorized && (
                  <>
                    <input
                      type="text"
                      className="w-full px-2 py-1.5 text-[10px] rounded-lg focus:outline-none"
                      style={{
                        background: "var(--surf-low)",
                        border: "1px solid rgba(178,204,192,0.2)",
                        color: "var(--on-surf)",
                      }}
                      placeholder="Motivo del descuento..."
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                    />
                    {!isManager && (
                      <DiscountAuthorizationPanel
                        branchId={sessionBranchId}
                        amount={discountAmount}
                        reason={discountReason}
                        onAuthorized={(result) => {
                          setDiscountAuthorized({
                            authorizationId: result.authorizationId,
                            name: result.approverName,
                          });
                        }}
                      />
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── Internal note ────────────────────────────────────────────── */}
            {cart.length > 0 && (
              <div style={{ margin: "0 12px" }}>
                <p
                  style={{
                    fontSize: 10,
                    fontWeight: 600,
                    color: "var(--on-surf-var)",
                    letterSpacing: "0.12em",
                    textTransform: "uppercase" as const,
                    marginBottom: 6,
                  }}
                >
                  NOTA INTERNA — SOLO GERENCIA
                </p>
                <textarea
                  rows={2}
                  className="w-full px-3 py-2 text-[10px] rounded-lg resize-none focus:outline-none"
                  style={{
                    background: "var(--surf-low)",
                    border: "1px solid rgba(178,204,192,0.2)",
                    color: "var(--on-surf)",
                  }}
                  placeholder="Observaciones para gerencia..."
                  value={internalNote}
                  onChange={(e) => setInternalNote(e.target.value)}
                />
              </div>
            )}

            {/* ── Customer + Layaway ───────────────────────────────────────── */}
            {cart.length > 0 && (
              <div className="space-y-2 mx-3">
                {/* Customer selector button */}
                {selectedCustomer ? (
                  <div
                    className="flex items-center gap-2 px-3 py-2 rounded-xl"
                    style={{ background: "var(--surf-low)" }}
                  >
                    <div
                      className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0"
                      style={{ background: "rgba(46,204,113,0.15)" }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--p-bright)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                        <circle cx="12" cy="7" r="4"/>
                      </svg>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div
                        className="text-xs font-medium truncate"
                        style={{
                          fontFamily: "var(--font-display)",
                          color: "var(--on-surf)",
                        }}
                      >
                        {selectedCustomer.name}
                      </div>
                      {selectedCustomer.phone && (
                        <div
                          className="text-[10px]"
                          style={{ color: "var(--on-surf-var)" }}
                        >
                          {selectedCustomer.phone}
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => setIsCustomerModalOpen(true)}
                      className="text-[10px] px-2 py-0.5 rounded-md"
                      style={{
                        background: "var(--surf-highest)",
                        color: "var(--on-surf-var)",
                      }}
                    >
                      Cambiar
                    </button>
                    <button
                      onClick={() => setSelectedCustomerId("")}
                      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
                      style={{ color: "var(--on-surf-var)" }}
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setIsCustomerModalOpen(true)}
                    className="w-full flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm transition-all"
                    style={{
                      background: "var(--surf-low)",
                      border: "1.5px dashed rgba(46,204,113,0.35)",
                      color: "var(--p-bright)",
                    }}
                  >
                    <Plus className="w-4 h-4" />
                    <span style={{ fontFamily: "var(--font-display)", fontSize: 13 }}>
                      Seleccionar cliente
                    </span>
                    <span
                      className="ml-auto text-[10px] px-1.5 py-0.5 rounded"
                      style={{
                        background: "rgba(46,204,113,0.1)",
                        color: "var(--p-bright)",
                      }}
                    >
                      Requerido
                    </span>
                  </button>
                )}

                <CustomerSelectorModal
                  open={isCustomerModalOpen}
                  onClose={() => setIsCustomerModalOpen(false)}
                  customers={localCustomers}
                  onSelect={handleCustomerSelect}
                  onCustomerCreated={handleCustomerCreated}
                />

                {/* VoltageChangeDialog — 4-D */}
                {voltageChangeTargetIdx !== null && cart[voltageChangeTargetIdx] && (
                  <VoltageChangeDialog
                    open={voltageChangeTargetIdx !== null}
                    onOpenChange={(open) => {
                      if (!open) setVoltageChangeTargetIdx(null);
                    }}
                    currentVoltajeLabel={cart[voltageChangeTargetIdx].voltajeLabel}
                    voltajeOptions={getVoltajeOptionsForCartItem(cart[voltageChangeTargetIdx])}
                    onConfirm={(targetVoltajeId, targetVoltajeLabel) => {
                      setCart((prev) =>
                        prev.map((ci, i) =>
                          i === voltageChangeTargetIdx
                            ? { ...ci, voltageChange: { targetVoltajeId, targetVoltajeLabel } }
                            : ci
                        )
                      );
                      setVoltageChangeTargetIdx(null);
                    }}
                  />
                )}

                {/* Free-form line dialog (P3.5) */}
                <FreeFormDialog
                  open={freeFormOpen}
                  onOpenChange={setFreeFormOpen}
                  onAdd={({ description, price, quantity }) => {
                    setCart((prev) => [
                      ...prev,
                      {
                        variantId: `freeform-${Date.now()}-${prev.length}`,
                        modeloId: "",
                        modeloNombre: description,
                        colorNombre: "",
                        voltajeLabel: "",
                        sku: "",
                        price,
                        quantity,
                        isSerialized: false,
                        isFreeForm: true,
                        description,
                      },
                    ]);
                  }}
                />

                {/* Layaway toggle */}
                <div className="flex items-center justify-between">
                  <Label
                    htmlFor="layaway-toggle"
                    className="text-[10px] cursor-pointer"
                    style={{ color: "var(--on-surf-var)" }}
                  >
                    Modo apartado
                  </Label>
                  <Switch
                    id="layaway-toggle"
                    checked={isLayaway}
                    onCheckedChange={setIsLayaway}
                  />
                </div>

                {isLayaway && (
                  <div
                    className="space-y-1.5 p-2 rounded-lg"
                    style={{
                      background: "var(--warn-container)",
                      border: "1px solid var(--warn)",
                    }}
                  >
                    <p
                      className="text-[9px] font-medium"
                      style={{ color: "var(--warn)" }}
                    >
                      Anticipo: {layawayPercent}% = $
                      {layawayDownPayment.toLocaleString("es-MX")}
                    </p>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      step={5}
                      value={layawayPercent}
                      onChange={(e) =>
                        setLayawayPercent(parseInt(e.target.value))
                      }
                      className="w-full accent-[var(--p-bright)]"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* ── Fixed footer: totals + payment + CTA ──────────────────────────── */}
        {cart.length > 0 && (
          <div
            className="px-4 pt-3.5 pb-6 border-t shrink-0"
            style={{
              background: "var(--surf-low)",
              borderTop: "1px solid var(--ghost-border)",
            }}
          >
            {/* Totals */}
            <div className="space-y-1 mb-3">
              <div
                className="flex justify-between"
                style={{ fontSize: 12, color: "var(--on-surf-var)" }}
              >
                <span>Subtotal</span>
                <span style={{ color: "var(--on-surf)" }}>
                  $
                  {subtotal.toLocaleString("es-MX", {
                    minimumFractionDigits: 2,
                  })}
                </span>
              </div>
              {discountAmount > 0 && discountAuthorized && (
                <div
                  className="flex justify-between"
                  style={{ fontSize: 12, color: "var(--ter)" }}
                >
                  <span>Descuento</span>
                  <span>
                    -$
                    {discountAmount.toLocaleString("es-MX", {
                      minimumFractionDigits: 2,
                    })}
                  </span>
                </div>
              )}
              <div
                className="flex justify-between items-baseline pt-1.5"
                style={{ borderTop: "1px solid var(--ghost-border)" }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--on-surf)",
                  }}
                >
                  {isLayaway ? "Anticipo" : "Total"}
                </span>
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 22,
                    fontWeight: 700,
                    color: "var(--p-bright)",
                  }}
                >
                  $
                  {(isLayaway
                    ? layawayDownPayment
                    : totalAfterDiscount
                  ).toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </span>
              </div>
            </div>

            {/* Payment methods */}
            {(() => {
              const paymentSvgIcons: Record<string, React.ReactNode> = {
                CASH: (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    width="16"
                    height="16"
                  >
                    <rect x="1" y="4" width="14" height="8" rx="1.5" />
                    <circle cx="8" cy="8" r="2" />
                    <path d="M4 8h.01M12 8h.01" />
                  </svg>
                ),
                CARD: (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    width="16"
                    height="16"
                  >
                    <rect x="1" y="3" width="14" height="10" rx="1.5" />
                    <path d="M1 6h14" />
                    <path d="M4 10h3" />
                  </svg>
                ),
                TRANSFER: (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    width="16"
                    height="16"
                  >
                    <path d="M2 8h12M10 5l3 3-3 3M6 5L3 8l3 3" />
                  </svg>
                ),
                ATRATO: (
                  <svg
                    viewBox="0 0 16 16"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.5"
                    width="16"
                    height="16"
                  >
                    <circle cx="8" cy="8" r="6" />
                    <path d="M8 5v3l2 2" />
                  </svg>
                ),
              };
              const methodLabels: Record<string, string> = {
                CASH: "Efectivo",
                CARD: "Tarjeta",
                TRANSFER: "Transferencia",
                ATRATO: "Atrato",
              };

              return (
                <>
                  <div className="grid grid-cols-2 mb-2" style={{ gap: 6 }}>
                    {(["CASH", "CARD", "TRANSFER", "ATRATO"] as const).map(
                      (method) => {
                        const isActive = primaryMethod === method;
                        return (
                          <button
                            key={method}
                            onClick={() => setPrimaryMethod(method)}
                            className={`flex flex-col items-center justify-center transition-all rounded-xl p-[14px] text-[12px] font-bold gap-[5px] relative ${isActive
                              ? "bg-[var(--sec-container)] text-[var(--p-bright)]"
                              : "bg-[var(--surf-highest)] text-[var(--on-surf-var)] hover:bg-[var(--sec-container)] hover:text-[var(--p-bright)]"
                              }`}
                            style={{ border: "none" }}
                          >
                            {method === "ATRATO" && (
                              <span
                                style={{
                                  position: "absolute",
                                  top: 4,
                                  right: 4,
                                  fontSize: 7,
                                  fontWeight: 600,
                                  padding: "1px 4px",
                                  borderRadius: 999,
                                  background: "rgba(243,156,18,0.2)",
                                  color: "var(--warn)",
                                  lineHeight: 1.4,
                                }}
                              >
                                Pend.
                              </span>
                            )}
                            {paymentSvgIcons[method]}
                            <span>{methodLabels[method]}</span>
                          </button>
                        );
                      },
                    )}
                  </div>

                  {/* Credit balance option */}
                  {selectedCustomer &&
                    selectedCustomer.balance > 0 &&
                    !isLayaway && (
                      <button
                        onClick={() => setPrimaryMethod("CREDIT_BALANCE")}
                        className="w-full mb-2 transition-all"
                        style={{
                          padding: "8px",
                          borderRadius: 10,
                          border:
                            primaryMethod === "CREDIT_BALANCE"
                              ? "1px solid var(--p-bright)"
                              : "1px solid rgba(178,204,192,0.2)",
                          background:
                            primaryMethod === "CREDIT_BALANCE"
                              ? "var(--sec-container)"
                              : "var(--surf-high)",
                          color:
                            primaryMethod === "CREDIT_BALANCE"
                              ? "var(--p-bright)"
                              : "var(--on-surf-var)",
                          fontSize: 11,
                          fontWeight: 500,
                        }}
                      >
                        Saldo a favor (${selectedCustomer.balance.toFixed(2)})
                      </button>
                    )}

                  {/* Split payment toggle */}
                  <div
                    className="flex items-center justify-between"
                    style={{ marginBottom: isSplitPayment ? 8 : 0 }}
                  >
                    <span style={{ fontSize: 11, color: "var(--on-surf-var)" }}>
                      Dividir pago
                    </span>
                    <Switch
                      checked={isSplitPayment}
                      onCheckedChange={setIsSplitPayment}
                    />
                  </div>

                  {isSplitPayment && (
                    <div
                      className="space-y-1.5 p-2.5 rounded-xl mb-2"
                      style={{
                        background: "var(--surf-high)",
                        border: "1px solid var(--ghost-border)",
                      }}
                    >
                      <div className="flex gap-1.5 items-center">
                        <span
                          className="text-[9px] w-16 shrink-0"
                          style={{ color: "var(--on-surf-var)" }}
                        >
                          {methodLabels[primaryMethod] ?? primaryMethod}
                        </span>
                        <input
                          type="number"
                          className="flex-1 px-2 py-1 text-[10px] rounded-lg focus:outline-none"
                          style={{
                            background: "var(--surf-low)",
                            border: "1px solid rgba(178,204,192,0.2)",
                            color: "var(--on-surf)",
                          }}
                          placeholder="Monto..."
                          value={primaryAmount}
                          onChange={(e) => setPrimaryAmount(e.target.value)}
                        />
                      </div>
                      <div className="flex gap-1.5 items-center">
                        <Select
                          value={secondaryMethod}
                          onValueChange={(v) =>
                            setSecondaryMethod(v as typeof secondaryMethod)
                          }
                        >
                          <SelectTrigger
                            className="w-16 h-6 text-[9px] shrink-0 px-1"
                            style={{
                              background: "var(--surf-low)",
                              border: "1px solid rgba(178,204,192,0.2)",
                            }}
                          >
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              ["CASH", "CARD", "TRANSFER", "ATRATO"] as const
                            ).map((m) => (
                              <SelectItem key={m} value={m} className="text-xs">
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <div
                          className="flex-1 px-2 py-1 text-[10px] rounded-lg text-right"
                          style={{
                            background: "var(--surf-low)",
                            border: "1px solid rgba(178,204,192,0.2)",
                            color: "var(--on-surf-var)",
                          }}
                        >
                          ${secondaryAmountNum.toFixed(2)}
                        </div>
                      </div>
                      {splitCovered ? (
                        <p
                          className="text-[10px]"
                          style={{ color: "var(--p-bright)" }}
                        >
                          <Check className="inline w-3 h-3 mr-0.5" />
                          Cubierto
                        </p>
                      ) : (
                        <p
                          className="text-[10px]"
                          style={{ color: "var(--warn)" }}
                        >
                          Falta $
                          {(totalAfterDiscount - primaryAmountNum).toFixed(2)}
                        </p>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            {/* Process button */}
            <button
              disabled={!canProcess}
              onClick={handleStartProcess}
              className="w-full transition-all"
              style={{
                marginTop: 10,
                padding: 18,
                borderRadius: 999,
                background: canProcess
                  ? "var(--p-bright)"
                  : "var(--surf-highest)",
                color: canProcess ? "var(--on-p)" : "var(--on-surf-var)",
                fontFamily: "var(--font-display)",
                fontSize: 16,
                fontWeight: 800,
                letterSpacing: "-0.01em",
                textTransform: "uppercase" as const,
                border: "none",
                boxShadow: canProcess
                  ? "0 16px 40px rgba(46,204,113,0.2)"
                  : "none",
              }}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" /> Procesando...
                </span>
              ) : !canProcess && discountAmount > 0 && !discountAuthorized ? (
                "AUTORIZAR DESCUENTO"
              ) : !canProcess && !selectedCustomerId ? (
                "SELECCIONAR CLIENTE"
              ) : !canProcess && cart.length === 0 ? (
                "CARRITO VACÍO"
              ) : (
                "PROCESAR TRANSACCIÓN"
              )}
            </button>
          </div>
        )}
      </div>

      {/* ══ OVERLAY: PAYMENT CONFIRMATION MODALS ════════════════════════════════════ */}
      {paymentModalStep !== "idle" && (() => {
        const method = paymentModalStep === "primary" ? primaryMethod : secondaryMethod;
        const amountNum = paymentModalStep === "primary"
          ? (isLayaway && !isSplitPayment ? layawayDownPayment : (isSplitPayment ? primaryAmountNum : totalAfterDiscount))
          : secondaryAmountNum;
        
        const isCash = method === "CASH";
        const isCard = method === "CARD";
        const isTransfer = method === "TRANSFER";
        const isAtrato = method === "ATRATO";
        const isCreditBalance = method === "CREDIT_BALANCE";
        
        let headerTitle = "Confirmar pago";
        if (isCash) headerTitle = "Pago en efectivo";
        if (isCard) headerTitle = "Pago con tarjeta";
        if (isTransfer) headerTitle = "Pago por transferencia";
        if (isAtrato) headerTitle = "Financiamiento Atrato";
        if (isCreditBalance) headerTitle = "Uso de saldo a favor";

        const handleModalConfirm = () => {
           let reference: string | undefined = undefined;
           
           if (isCard) {
             const parts = [];
             if (cardLast4) parts.push(`*${cardLast4}`);
             if (cardAuth) parts.push(cardAuth);
             reference = parts.join(" | ");
             if (!reference) reference = undefined;
           } else if (isTransfer) {
             reference = transferRef;
             if (transferBank) reference = `${transferBank} - ${transferRef}`;
           } else if (isAtrato) {
             reference = atratoReq;
           }

           const newMethod: PaymentMethodInput = {
             method: method,
             amount: amountNum,
             reference
           };

           const updatedMethods = [...finalPaymentMethods, newMethod];

           if (paymentModalStep === "primary" && isSplitPayment) {
             setFinalPaymentMethods(updatedMethods);
             setPaymentModalStep("secondary");
           } else {
             // Sequence complete, process
             let totalChange = 0;
             if (updatedMethods.some(m => m.method === "CASH")) {
                const totalCashReceived = Number(cashReceived) || amountNum; 
                if (method === "CASH" && totalCashReceived > amountNum) {
                  totalChange = totalCashReceived - amountNum;
                }
             }
             handleCheckout(updatedMethods, totalChange);
           }
        };

        const handleCancel = () => {
           setPaymentModalStep("idle");
        };

        let canConfirm = true;
        if (isCash) {
          const receivedNum = Number(cashReceived);
          if (!cashReceived || receivedNum < amountNum) canConfirm = false;
        } else if (isTransfer) {
          if (!transferRef.trim()) canConfirm = false;
        } else if (isAtrato) {
          if (!atratoReq.trim() || !atratoApproved) canConfirm = false;
        }

        // dynamic quick cash amounts
        const c100 = Math.ceil(amountNum / 100) * 100;
        const c500 = Math.ceil(amountNum / 500) * 500;
        const c1000 = Math.ceil(amountNum / 1000) * 1000;
        const quickAmounts = Array.from(new Set([amountNum, c100, c500, c1000])).filter(v => v >= amountNum).slice(0, 4);

        return (
          <div style={{
            position: "fixed", inset: 0, zIndex: 100,
            background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)",
            display: "flex", alignItems: "center", justifyContent: "center"
          }}>
            <div style={{
              background: "var(--surf-lowest)",
              borderRadius: "var(--r-lg)",
              boxShadow: "var(--shadow)",
              border: "1px solid var(--ghost-border)",
              width: 380,
              padding: 24,
            }}>
              {isSplitPayment && paymentModalStep === "secondary" && (
                <div style={{ fontSize: 11, color: "var(--p-bright)", fontWeight: 600, marginBottom: 8 }}>
                  <Check className="inline w-3 h-3 mr-1" />
                  Método 1 confirmado — ahora el método 2
                </div>
              )}

              <h2 style={{ fontFamily: "var(--font-display)", fontSize: 16, fontWeight: 700, color: "var(--on-surf)" }}>
                {headerTitle}
              </h2>
              <div style={{ marginTop: 12, marginBottom: 20 }}>
                <p style={{ fontSize: 12, color: "var(--on-surf-var)" }}>Total a cobrar</p>
                <p style={{ fontFamily: "var(--font-display)", fontSize: 24, fontWeight: 800, color: "var(--p-bright)" }}>
                  ${amountNum.toLocaleString("es-MX", { minimumFractionDigits: 2 })}
                </p>
              </div>

              {isCash && (
                <div className="space-y-4">
                  <div>
                    <Label style={{ color: "var(--on-surf-var)", fontSize: 11 }}>Recibido del cliente</Label>
                    <Input 
                      type="number"
                      placeholder="$0.00"
                      value={cashReceived}
                      onChange={(e) => setCashReceived(e.target.value)}
                      style={{
                        fontSize: 20, textAlign: "center", height: 48, marginTop: 4,
                        background: "var(--surf-low)", borderColor: "rgba(178,204,192,0.2)",
                        color: "var(--on-surf)"
                      }}
                    />
                    <div className="flex gap-2 mt-2">
                       {quickAmounts.map(val => (
                          <button key={val} 
                            onClick={() => setCashReceived(val.toString())}
                            style={{ 
                              flex: 1, padding: "6px", fontSize: 12, borderRadius: 8,
                              background: "var(--surf-high)", border: "1px solid rgba(178,204,192,0.2)",
                              color: "var(--on-surf)", fontWeight: 600, transition: "background 0.2s"
                            }}
                          >
                            ${val === amountNum ? "Exacto" : val}
                          </button>
                       ))}
                    </div>
                  </div>
                  <div>
                    <Label style={{ color: "var(--on-surf-var)", fontSize: 11 }}>Cambio a entregar</Label>
                    {(() => {
                      const rec = Number(cashReceived);
                      const missing = amountNum - rec;
                      if (!cashReceived) return <p style={{ fontSize: 28, fontWeight: 700, color: "var(--on-surf-var)" }}>—</p>
                      if (missing > 0) return <p style={{ fontSize: 14, fontWeight: 600, color: "var(--warn)", marginTop: 4 }}>Falta: ${missing.toFixed(2)}</p>
                      return <p style={{ fontFamily: "var(--font-display)", fontSize: 28, fontWeight: 800, color: "var(--p-bright)", marginTop: 4 }}>
                        ${Math.abs(missing).toFixed(2)}
                      </p>
                    })()}
                  </div>
                </div>
              )}

              {isCard && (
                <div className="space-y-4">
                  <div style={{ background: "var(--surf-low)", padding: 10, borderRadius: "var(--r-md)", border: "1px solid var(--ghost-border)" }}>
                    <p style={{ fontSize: 12, color: "var(--on-surf-var)" }}>
                      Procesa el pago en el datáfono y confirma cuando el terminal indique APROBADO.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <Label style={{ fontSize: 11, color: "var(--on-surf-var)" }}>Últimos 4 dígitos</Label>
                      <Input 
                        maxLength={4} placeholder="0000"
                        value={cardLast4} onChange={e => setCardLast4(e.target.value.replace(/\D/g, ''))}
                        style={{ marginTop: 4, background: "var(--surf-low)", borderColor: "rgba(178,204,192,0.2)", color: "var(--on-surf)" }}
                      />
                    </div>
                    <div>
                      <Label style={{ fontSize: 11, color: "var(--on-surf-var)" }}>Referencia (opc)</Label>
                      <Input 
                        placeholder="Autorización"
                        value={cardAuth} onChange={e => setCardAuth(e.target.value)}
                        style={{ marginTop: 4, background: "var(--surf-low)", borderColor: "rgba(178,204,192,0.2)", color: "var(--on-surf)" }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {isTransfer && (
                <div className="space-y-4">
                  <div style={{ background: "var(--surf-low)", padding: 10, borderRadius: "var(--r-md)", border: "1px solid var(--ghost-border)" }}>
                    <p style={{ fontSize: 12, color: "var(--on-surf-var)" }}>
                      Verifica que la transferencia se haya recibido antes de confirmar.
                    </p>
                  </div>
                  <div>
                    <Label style={{ fontSize: 11, color: "var(--on-surf-var)" }}>Número de referencia <span style={{color: "var(--warn)"}}>*</span></Label>
                    <Input 
                      placeholder="Folio o número de operación"
                      value={transferRef} onChange={e => setTransferRef(e.target.value)}
                      style={{ marginTop: 4, background: "var(--surf-low)", borderColor: "rgba(178,204,192,0.2)", color: "var(--on-surf)" }}
                    />
                  </div>
                  <div>
                    <Label style={{ fontSize: 11, color: "var(--on-surf-var)" }}>Banco emisor (opcional)</Label>
                    <Input 
                      placeholder="BBVA, Banorte, SPEI..."
                      value={transferBank} onChange={e => setTransferBank(e.target.value)}
                      style={{ marginTop: 4, background: "var(--surf-low)", borderColor: "rgba(178,204,192,0.2)", color: "var(--on-surf)" }}
                    />
                  </div>
                </div>
              )}

              {isAtrato && (
                <div className="space-y-4">
                  <div style={{ background: "var(--warn-container)", color: "var(--warn)", padding: "8px 12px", borderRadius: "var(--r-md)" }}>
                    <p style={{ fontSize: 11, fontWeight: 500 }}>
                      La financiera transferirá el monto posteriormente.
                    </p>
                  </div>
                  <div>
                    <Label style={{ fontSize: 11, color: "var(--on-surf-var)" }}>Número de solicitud <span style={{color: "var(--warn)"}}>*</span></Label>
                    <Input 
                      placeholder="AT-XXXXXXXX"
                      value={atratoReq} onChange={e => setAtratoReq(e.target.value)}
                      style={{ marginTop: 4, background: "var(--surf-low)", borderColor: "rgba(178,204,192,0.2)", color: "var(--on-surf)" }}
                    />
                  </div>
                  <div className="flex items-center gap-2 mt-4" style={{ background: "var(--surf-high)", padding: 12, borderRadius: "var(--r-md)", border: "1px solid var(--ghost-border)" }}>
                    <Switch checked={atratoApproved} onCheckedChange={setAtratoApproved} />
                    <Label style={{ fontSize: 11, color: "var(--on-surf)" }}>Confirmo que Atrato aprobó esta solicitud</Label>
                  </div>
                </div>
              )}

              {isCreditBalance && (
                <div style={{ color: "var(--on-surf-var)", fontSize: 12 }}>
                  Se descontarán ${amountNum.toFixed(2)} del saldo a favor del cliente.
                </div>
              )}

              <div className="flex gap-2 mt-6">
                <button 
                  onClick={handleCancel}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 999,
                    background: "var(--surf-high)", color: "var(--on-surf)",
                    border: "1px solid rgba(178,204,192,0.2)", fontSize: 13, fontWeight: 600
                  }}
                >
                  Cancelar
                </button>
                <button 
                  onClick={handleModalConfirm}
                  disabled={!canConfirm}
                  style={{
                    flex: 1, padding: "12px", borderRadius: 999, border: "none",
                    background: canConfirm ? "linear-gradient(135deg, #1B4332, #2ECC71)" : "var(--surf-highest)", 
                    color: canConfirm ? "white" : "var(--on-surf-var)", 
                    fontSize: 13, fontWeight: 600,
                    cursor: canConfirm ? "pointer" : "not-allowed",
                    boxShadow: canConfirm ? "0 4px 14px rgba(46,204,113,0.2)" : "none"
                  }}
                >
                  Confirmar {isCash ? "y cobrar" : (isAtrato ? "Atrato" : "pago")}
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ══ P12-A: REQUEST TRANSFER DIALOG ══════════════════════════════════════ */}
      {transferDialogProduct && (
        <RequestTransferDialog
          open={!!transferDialogProduct}
          onOpenChange={(o) => { if (!o) setTransferDialogProduct(null); }}
          product={transferDialogProduct}
          myBranchId={branchId}
          myBranchName={branchName}
        />
      )}
    </div>
  );
}
