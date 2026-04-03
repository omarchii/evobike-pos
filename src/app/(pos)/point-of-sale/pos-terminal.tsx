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
} from "lucide-react";
import Image from "next/image";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
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
import { processSaleAction } from "@/actions/sale";
import { createCustomer } from "@/actions/customer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

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

interface ModeloData {
  id: string;
  nombre: string;
  descripcion: string | null;
  imageUrl: string | null;
  requiere_vin: boolean;
  variants: VariantInfo[];
  minPrice: number;
  totalStockInBranch: number;
}

interface BatteryConfig {
  modeloId: string;
  voltajeId: string;
  quantity: number;
}

interface CustomerData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  balance: number;
  creditLimit: number;
}

interface PaymentMethodInput {
  method: "CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE" | "ATRATO";
  amount: number;
}

interface CartItem {
  variantId: string;
  modeloNombre: string;
  colorNombre: string;
  voltajeLabel: string;
  sku: string;
  price: number;
  quantity: number;
  isSerialized: boolean;
  serialNumber?: string;
  batterySerials?: string[];
  assemblyMode?: boolean;
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
  for (const [key, val] of Object.entries(map)) {
    if (nombre.toUpperCase().includes(key)) return val;
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

function deriveCategory(nombre: string): string {
  const upper = nombre.toUpperCase();
  if (
    upper.startsWith("SCOOTER") ||
    upper === "EVOTANK 160" ||
    upper === "EVOTANK 180"
  )
    return "Scooters";
  if (upper === "BATERÍA" || upper === "BATERIA") return "Baterías";
  if (upper.includes("ACCESORIO") || upper.includes("CASCO"))
    return "Accesorios";
  if (upper.includes("REFACCION") || upper.includes("REFACCIÓN"))
    return "Refacciones";
  return "Bicicletas";
}

const CATEGORIES = [
  "Todos",
  "Bicicletas",
  "Scooters",
  "Baterías",
  "Accesorios",
];

// ── Sub-components ─────────────────────────────────────────────────────────────

function ModelCard({
  modelo,
  isSelected,
  onSelect,
}: {
  modelo: ModeloData;
  isSelected: boolean;
  onSelect: (m: ModeloData) => void;
}) {
  const hasStock = modelo.totalStockInBranch > 0;
  return (
    <div
      role="button"
      tabIndex={hasStock ? 0 : -1}
      onClick={() => hasStock && onSelect(modelo)}
      onKeyDown={(e) =>
        (e.key === "Enter" || e.key === " ") && hasStock && onSelect(modelo)
      }
      className={`relative text-left transition-all group overflow-hidden
        ${hasStock ? "cursor-pointer hover:shadow-lg" : "opacity-60 cursor-default"}`}
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
        </div>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function PosTerminal({
  modelos,
  customers = [],
  batteryConfigs = [],
  availableBatteriesCount = 0,
  branchId,
  sellerName,
  branchName,
}: {
  modelos: ModeloData[];
  customers?: CustomerData[];
  batteryConfigs?: BatteryConfig[];
  availableBatteriesCount?: number;
  branchId: string;
  sellerName: string;
  branchName: string;
}) {
  const { data: session } = useSession();
  const router = useRouter();
  const sessionBranchId =
    (session?.user as { branchId?: string } | undefined)?.branchId ?? branchId;

  // ── Catalog state
  const [categoryFilter, setCategoryFilter] = useState("Todos");
  const [search, setSearch] = useState("");
  const [selectedModelo, setSelectedModelo] = useState<ModeloData | null>(null);

  // ── Guided config state
  const [selectedVoltajeId, setSelectedVoltajeId] = useState("");
  const [selectedColorId, setSelectedColorId] = useState("");
  const [assemblyMode, setAssemblyMode] = useState(false);
  const [vinInput, setVinInput] = useState("");
  const [vinStatus, setVinStatus] = useState<
    "idle" | "checking" | "valid" | "taken"
  >("idle");
  const [batterySerialInputs, setBatterySerialInputs] = useState<string[]>([]);
  const [batteryStatuses, setBatteryStatuses] = useState<
    Record<number, BatteryStatus>
  >({});

  // ── Cart state
  const [cart, setCart] = useState<CartItem[]>([]);

  // ── Discount state
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountPin, setDiscountPin] = useState("");
  const [pinError, setPinError] = useState(false);
  const [discountAuthorized, setDiscountAuthorized] = useState<{
    userId: string;
    name: string;
  } | null>(null);
  const [discountReason, setDiscountReason] = useState("");
  const [validatingPin, setValidatingPin] = useState(false);

  // ── Internal note
  const [internalNote, setInternalNote] = useState("");

  // ── Layaway state
  const [isLayaway, setIsLayaway] = useState(false);
  const [layawayPercent, setLayawayPercent] = useState(30);

  // ── Customer state
  const [selectedCustomerId, setSelectedCustomerId] = useState("");
  const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
  const [creatingCustomer, setCreatingCustomer] = useState(false);
  const [newCustomerForm, setNewCustomerForm] = useState({
    name: "",
    phone: "",
  });

  // ── Payment state
  const [isSplitPayment, setIsSplitPayment] = useState(false);
  const [primaryMethod, setPrimaryMethod] =
    useState<PaymentMethodInput["method"]>("CASH");
  const [secondaryMethod, setSecondaryMethod] =
    useState<PaymentMethodInput["method"]>("TRANSFER");
  const [primaryAmount, setPrimaryAmount] = useState("");
  const [isProcessing, setIsProcessing] = useState(false);

  // ── Derived: filtered modelos
  const filteredModelos = useMemo(() => {
    return modelos.filter((m) => {
      const matchesCategory =
        categoryFilter === "Todos" ||
        deriveCategory(m.nombre) === categoryFilter;
      const matchesSearch =
        !search || m.nombre.toLowerCase().includes(search.toLowerCase());
      return matchesCategory && matchesSearch;
    });
  }, [modelos, categoryFilter, search]);

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
    setVinInput("");
    setVinStatus("idle");
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

  // ── Handlers: VIN check
  const checkVin = useCallback(async (vin: string) => {
    if (vin.length < 3) {
      setVinStatus("idle");
      return;
    }
    setVinStatus("checking");
    try {
      const res = await fetch(
        `/api/serial-search?q=${encodeURIComponent(vin)}`,
      );
      const data: unknown = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        setVinStatus("taken");
      } else {
        setVinStatus("valid");
      }
    } catch {
      setVinStatus("idle");
    }
  }, []);

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

  // ── Handlers: validate manager PIN
  const handleValidatePin = async () => {
    if (!discountPin || discountAmount <= 0) return;
    setValidatingPin(true);
    setPinError(false);
    try {
      const res = await fetch("/api/managers/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: discountPin, branchId: sessionBranchId }),
      });
      const data: {
        success?: boolean;
        managerId?: string;
        managerName?: string;
      } = await res.json();
      if (data.success && data.managerId && data.managerName) {
        setDiscountAuthorized({
          userId: data.managerId,
          name: data.managerName,
        });
        setDiscountPin("");
        toast.success(`Descuento autorizado por ${data.managerName}`);
      } else {
        setPinError(true);
        setDiscountPin("");
      }
    } catch {
      setPinError(true);
    } finally {
      setValidatingPin(false);
    }
  };

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
    if (needsVin && (!vinInput || vinStatus !== "valid")) {
      toast.error("Ingresa un VIN válido antes de continuar");
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
      modeloNombre: selectedModelo.nombre,
      colorNombre: selectedVariant.colorNombre,
      voltajeLabel: selectedVariant.voltajeLabel,
      sku: selectedVariant.sku,
      price: selectedVariant.precio,
      quantity: 1,
      isSerialized: selectedModelo.requiere_vin,
      serialNumber: needsVin ? vinInput : undefined,
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
    setVinInput("");
    setVinStatus("idle");
    setBatterySerialInputs([]);
    setBatteryStatuses({});
  };

  // ── Handlers: checkout
  const handleCheckout = async () => {
    if (cart.length === 0) return;

    if (discountAmount > 0 && !discountAuthorized) {
      toast.error("El descuento requiere autorización de Manager");
      return;
    }

    if (isLayaway && !selectedCustomerId) {
      toast.error("Un apartado requiere seleccionar un cliente");
      return;
    }

    setIsProcessing(true);
    toast.loading("Procesando venta...", { id: "checkout" });

    try {
      const paymentMethods: PaymentMethodInput[] = isSplitPayment
        ? [
            { method: primaryMethod, amount: primaryAmountNum },
            { method: secondaryMethod, amount: secondaryAmountNum },
          ]
        : [
            {
              method: primaryMethod,
              amount: isLayaway ? layawayDownPayment : totalAfterDiscount,
            },
          ];

      const result = await processSaleAction({
        items: cart.map((ci) => ({
          productVariantId: ci.variantId,
          quantity: ci.quantity,
          price: ci.price,
          name: `${ci.modeloNombre} ${ci.colorNombre} ${ci.voltajeLabel}`,
          isSerialized: ci.isSerialized,
          serialNumber: ci.serialNumber,
          batterySerials: ci.batterySerials,
          assemblyMode: ci.assemblyMode,
        })),
        total: totalAfterDiscount,
        discount: discountAmount > 0 && discountAuthorized ? discountAmount : 0,
        paymentMethods,
        isLayaway,
        customerId: selectedCustomerId || undefined,
        downPayment: isLayaway ? layawayDownPayment : undefined,
        internalNote,
        discountAmount:
          discountAmount > 0 && discountAuthorized ? discountAmount : undefined,
        discountAuthorizedByUserId: discountAuthorized?.userId,
        discountAuthorizedByName: discountAuthorized?.name,
      });

      if (!result.success) {
        toast.error(result.error ?? "Error al procesar la venta", {
          id: "checkout",
        });
        return;
      }

      toast.success(
        `Venta procesada — Folio: ${result.saleId?.slice(-6).toUpperCase()}`,
        {
          id: "checkout",
        },
      );
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
    setDiscountPin("");
    setInternalNote("");
    setIsLayaway(false);
    setLayawayPercent(30);
    setSelectedCustomerId("");
    setIsSplitPayment(false);
    setPrimaryMethod("CASH");
    setPrimaryAmount("");
  };

  // ── Handlers: create customer
  const handleCreateCustomer = async () => {
    if (!newCustomerForm.name) {
      toast.error("El nombre es obligatorio");
      return;
    }
    setCreatingCustomer(true);
    const result = await createCustomer(newCustomerForm);
    if (result.success && result.customer) {
      setSelectedCustomerId(result.customer.id);
      setIsNewCustomerOpen(false);
      setNewCustomerForm({ name: "", phone: "" });
      router.refresh();
    } else {
      toast.error(result.error ?? "No se pudo crear el cliente");
    }
    setCreatingCustomer(false);
  };

  // ── Derived: can complete config
  const canCompleteConfig = useMemo((): boolean => {
    if (!selectedModelo || !selectedVoltajeId || !selectedColorId) return false;
    if (selectedModelo.requiere_vin && vinStatus !== "valid") return false;
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
    vinStatus,
    assemblyMode,
    batterySerialInputs,
    batteryStatuses,
  ]);

  // ── Derived: can process sale
  const canProcess = useMemo((): boolean => {
    if (cart.length === 0 || isProcessing) return false;
    if (discountAmount > 0 && !discountAuthorized) return false;
    if (isLayaway && !selectedCustomerId) return false;
    if (isSplitPayment && !splitCovered) return false;
    return true;
  }, [
    cart.length,
    isProcessing,
    discountAmount,
    discountAuthorized,
    isLayaway,
    selectedCustomerId,
    isSplitPayment,
    splitCovered,
  ]);

  const [folio, setFolio] = useState("");
  useEffect(() => {
    setFolio(`INV-${Date.now().toString().slice(-6)}`);
  }, []);

  // ── Selected customer
  const selectedCustomer = customers.find((c) => c.id === selectedCustomerId);

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
              key={cat}
              onClick={() => setCategoryFilter(cat)}
              className="shrink-0 px-3 py-1 rounded-full text-xs font-medium transition-all"
              style={
                categoryFilter === cat
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
              {cat}
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
          {filteredModelos.length === 0 ? (
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
              {filteredModelos.map((modelo) => (
                <ModelCard
                  key={modelo.id}
                  modelo={modelo}
                  isSelected={selectedModelo?.id === modelo.id}
                  onSelect={handleSelectModelo}
                />
              ))}
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
            className="text-[10px] font-mono mt-0.5"
            style={{ color: "var(--on-surf-var)", opacity: 0.6 }}
          >
            {folio}
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
                    borderTop: "1px solid rgba(178,204,192,0.15)",
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
                    1. SYSTEM VOLTAGE
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {voltajeOptions.map((opt) => {
                      const isVoltajeSelected = opt.id === selectedVoltajeId;
                      const hasVoltajeStock = opt.stockInBranch > 0;
                      const canAssembleOpt =
                        !hasVoltajeStock && opt.canAssemble;
                      const noOption = !hasVoltajeStock && !opt.canAssemble;
                      let pillStyle: React.CSSProperties = {};
                      if (noOption) {
                        pillStyle = {
                          background: "var(--ter-container)",
                          border: "1px solid var(--ter-container)",
                          color: "var(--on-ter-container)",
                          cursor: "not-allowed",
                        };
                      } else if (isVoltajeSelected) {
                        pillStyle = {
                          background: "var(--sec-container)",
                          border: "1px solid var(--p-bright)",
                          color: "var(--p-bright)",
                          fontWeight: 700,
                        };
                      } else if (canAssembleOpt) {
                        pillStyle = {
                          background: "transparent",
                          border: "1px solid var(--warn)",
                          color: "var(--warn)",
                        };
                      } else {
                        pillStyle = {
                          background: "transparent",
                          border: "1px solid var(--outline-var)",
                          color: "var(--on-surf-var)",
                        };
                      }
                      return (
                        <button
                          key={opt.id}
                          disabled={noOption}
                          onClick={() => handleSelectVoltaje(opt.id)}
                          className="flex items-center gap-1 transition-all"
                          style={{
                            borderRadius: 999,
                            padding: "6px 16px",
                            fontSize: 13,
                            fontWeight: isVoltajeSelected ? 600 : 500,
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
                            }}
                          >
                            Sin stock · {availableBatteriesCount} baterías
                            disponibles
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
                    borderTop: "1px solid rgba(178,204,192,0.15)",
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
                    }}
                  >
                    2. FRAME COLOR
                  </p>
                  <div className="flex flex-wrap" style={{ gap: 8 }}>
                    {colorOptions.length > 0
                      ? colorOptions.map((c) => {
                          const css = colorToCSS(c.nombre);
                          const isGradient = css.startsWith("conic");
                          const isColorSelected = c.id === selectedColorId;
                          return (
                            <button
                              key={c.id}
                              title={c.nombre}
                              onClick={() => setSelectedColorId(c.id)}
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
                                opacity: isColorSelected ? 1 : 0.5,
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

                {/* Step 3: VIN — always visible when requiere_vin */}
                {selectedModelo.requiere_vin && (
                  <>
                    <div
                      style={{
                        borderTop: "1px solid rgba(178,204,192,0.15)",
                        margin: "12px 0",
                      }}
                    />
                    <div style={{ opacity: !selectedColorId ? 0.4 : 1 }}>
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
                        3. VIN VERIFICATION
                      </p>
                      <div className="relative">
                        <input
                          disabled={!selectedColorId}
                          className="w-full focus:outline-none focus:ring-1 focus:ring-[var(--p-bright)] placeholder:text-[var(--on-surf-var)]"
                          style={{
                            background: "var(--surf-lowest)",
                            border: "none",
                            borderRadius: 12,
                            color: "var(--on-surf)",
                            padding: "10px 40px 10px 14px",
                            fontSize: 12,
                          }}
                          placeholder="Escanear o escribir VIN..."
                          value={vinInput}
                          onChange={(e) => {
                            setVinInput(e.target.value);
                            setVinStatus("idle");
                          }}
                          onBlur={() => checkVin(vinInput)}
                        />
                        <div
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                          style={{ color: "var(--on-surf-var)" }}
                        >
                          {vinStatus === "checking" && (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          )}
                          {vinStatus === "valid" && (
                            <Check
                              className="w-3.5 h-3.5"
                              style={{ color: "var(--p-bright)" }}
                            />
                          )}
                          {vinStatus === "taken" && (
                            <X
                              className="w-3.5 h-3.5"
                              style={{ color: "var(--ter)" }}
                            />
                          )}
                          {vinStatus === "idle" && (
                            <svg
                              viewBox="0 0 16 16"
                              fill="none"
                              width="16"
                              height="16"
                            >
                              <rect
                                x="2"
                                y="2"
                                width="5"
                                height="5"
                                rx="0.5"
                                stroke="var(--on-surf-var)"
                                strokeWidth="1.5"
                              />
                              <rect
                                x="9"
                                y="2"
                                width="5"
                                height="5"
                                rx="0.5"
                                stroke="var(--on-surf-var)"
                                strokeWidth="1.5"
                              />
                              <rect
                                x="2"
                                y="9"
                                width="5"
                                height="5"
                                rx="0.5"
                                stroke="var(--on-surf-var)"
                                strokeWidth="1.5"
                              />
                              <rect
                                x="3.5"
                                y="3.5"
                                width="2"
                                height="2"
                                fill="var(--on-surf-var)"
                              />
                              <rect
                                x="10.5"
                                y="3.5"
                                width="2"
                                height="2"
                                fill="var(--on-surf-var)"
                              />
                              <rect
                                x="3.5"
                                y="10.5"
                                width="2"
                                height="2"
                                fill="var(--on-surf-var)"
                              />
                              <path
                                d="M9 9h2v2H9zM13 9v4M13 13H9v-2"
                                stroke="var(--on-surf-var)"
                                strokeWidth="1.5"
                              />
                            </svg>
                          )}
                        </div>
                      </div>
                      {vinStatus === "taken" && (
                        <p
                          style={{
                            fontSize: 10,
                            color: "var(--ter)",
                            marginTop: 4,
                          }}
                        >
                          Este VIN ya está registrado en esta sucursal
                        </p>
                      )}
                    </div>
                  </>
                )}

                {/* Step 4: Battery serials — only when assembly mode */}
                {selectedColorId && assemblyMode && (
                  <>
                    <div
                      style={{
                        borderTop: "1px solid rgba(178,204,192,0.15)",
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
                        4. BATTERY SERIALS (
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
                className="flex flex-col items-center justify-center py-8 gap-2"
                style={{ color: "var(--on-surf-var)" }}
              >
                <ShoppingBag className="w-8 h-8 opacity-20" />
                <p className="text-[11px]">Selecciona un producto</p>
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
                        {item.modeloNombre}
                      </p>
                      <p
                        className="text-[11px] mt-0.5"
                        style={{ color: "var(--on-surf-var)" }}
                      >
                        {item.colorNombre} / {item.voltajeLabel}
                      </p>
                      {item.serialNumber && (
                        <p
                          className="text-[10px] font-mono mt-0.5"
                          style={{ color: "var(--on-surf-var)" }}
                        >
                          VIN: {item.serialNumber}
                        </p>
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
                    <div className="flex gap-1.5">
                      <input
                        type="password"
                        className={`flex-1 px-2 py-1.5 text-[10px] rounded-lg focus:outline-none ${pinError ? "animate-pulse" : ""}`}
                        style={{
                          background: "var(--surf-low)",
                          border: pinError
                            ? "1px solid var(--ter)"
                            : "1px solid rgba(178,204,192,0.2)",
                          color: "var(--on-surf)",
                        }}
                        placeholder="PIN Manager..."
                        value={discountPin}
                        onChange={(e) => {
                          setDiscountPin(e.target.value);
                          setPinError(false);
                        }}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleValidatePin();
                        }}
                      />
                      <button
                        onClick={handleValidatePin}
                        disabled={validatingPin || !discountPin}
                        className="px-2 py-1.5 rounded-lg text-[9px] font-medium"
                        style={{
                          background:
                            "linear-gradient(135deg, #1B4332, #2ECC71)",
                          color: "var(--on-primary)",
                          opacity: validatingPin || !discountPin ? 0.6 : 1,
                        }}
                      >
                        {validatingPin ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          "OK"
                        )}
                      </button>
                    </div>
                    {pinError && (
                      <p className="text-[9px]" style={{ color: "var(--ter)" }}>
                        PIN incorrecto
                      </p>
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
                <div className="flex gap-1.5 items-center">
                  <Select
                    value={selectedCustomerId}
                    onValueChange={setSelectedCustomerId}
                  >
                    <SelectTrigger
                      className="flex-1 h-7 text-[10px]"
                      style={{
                        background: "var(--surf-low)",
                        border: "1px solid rgba(178,204,192,0.2)",
                        color: "var(--on-surf)",
                      }}
                    >
                      <SelectValue placeholder="Cliente (opcional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">
                        Sin cliente (Mostrador)
                      </SelectItem>
                      {customers.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Dialog
                    open={isNewCustomerOpen}
                    onOpenChange={setIsNewCustomerOpen}
                  >
                    <DialogTrigger asChild>
                      <button
                        className="w-7 h-7 rounded-lg flex items-center justify-center"
                        style={{ background: "var(--surf-low)" }}
                      >
                        <Plus
                          className="w-3.5 h-3.5"
                          style={{ color: "var(--on-surf)" }}
                        />
                      </button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>Alta Rápida de Cliente</DialogTitle>
                        <DialogDescription>
                          Agrega un cliente al CRM para asignarle esta venta.
                        </DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-3 py-2">
                        <div>
                          <Label htmlFor="nc-name" className="text-xs">
                            Nombre *
                          </Label>
                          <Input
                            id="nc-name"
                            value={newCustomerForm.name}
                            onChange={(e) =>
                              setNewCustomerForm({
                                ...newCustomerForm,
                                name: e.target.value,
                              })
                            }
                            placeholder="Juan Pérez"
                          />
                        </div>
                        <div>
                          <Label htmlFor="nc-phone" className="text-xs">
                            Teléfono
                          </Label>
                          <Input
                            id="nc-phone"
                            value={newCustomerForm.phone}
                            onChange={(e) =>
                              setNewCustomerForm({
                                ...newCustomerForm,
                                phone: e.target.value,
                              })
                            }
                            placeholder="10 dígitos"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <button
                          className="px-3 py-1.5 rounded-lg text-sm"
                          style={{
                            background: "var(--surf-low)",
                            color: "var(--on-surf)",
                          }}
                          onClick={() => setIsNewCustomerOpen(false)}
                        >
                          Cancelar
                        </button>
                        <button
                          disabled={creatingCustomer}
                          onClick={handleCreateCustomer}
                          className="px-3 py-1.5 rounded-lg text-sm text-white"
                          style={{
                            background:
                              "linear-gradient(135deg, #1B4332, #2ECC71)",
                          }}
                        >
                          {creatingCustomer ? "Guardando..." : "Crear"}
                        </button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </div>

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
              borderTop: "1px solid rgba(178,204,192,0.15)",
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
                style={{ borderTop: "1px solid rgba(178,204,192,0.15)" }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: 16,
                    fontWeight: 700,
                    color: "var(--on-surf)",
                  }}
                >
                  {isLayaway ? "Anticipo" : "Total Due"}
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
                TRANSFER: "Transfer",
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
                            className={`flex flex-col items-center justify-center transition-all rounded-xl p-[14px] text-[12px] font-bold gap-[5px] relative ${
                              isActive
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
                        border: "1px solid rgba(178,204,192,0.15)",
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
              onClick={handleCheckout}
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
              ) : !canProcess && isLayaway && !selectedCustomerId ? (
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
    </div>
  );
}
