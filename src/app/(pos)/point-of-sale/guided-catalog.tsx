"use client";

import { useState, useEffect } from "react";
import { Search, Package, ChevronLeft, Zap, Palette, Box, CheckCircle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";

// ---------- Types ----------
type Modelo = {
    id: string;
    nombre: string;
    descripcion: string | null;
    requiere_vin: boolean;
    imagenPrincipal: string | null;
    variantesCount: number;
    precioDesde: number;
};

type Color = {
    id: string;
    nombre: string;
};

type Voltaje = {
    id: string;
    valor: number;
    label: string;
    precioPublico: number;
    sku: string;
    configuracionId: string;
    stockTotal: number;
};

type CartProduct = {
    id: string; // configuracionId
    name: string;
    sku: string;
    price: number;
    cost: number;
    isSerialized: boolean;
    stocks: { branchId: string; quantity: number }[];
};

interface GuidedCatalogProps {
    branchId: string;
    onAddToCart: (product: CartProduct) => void;
}

// ---------- Color Circle ----------
// Map color names to approximate visual colors
function colorToCSS(nombre: string): string {
    const map: Record<string, string> = {
        "NEGRO": "#1c1c1c", "BLANCO": "#f5f5f5", "ROJO": "#e53e3e",
        "AZUL": "#3182ce", "VERDE": "#38a169", "AMARILLO": "#d69e2e",
        "ROSA": "#ed64a6", "MORADO": "#805ad5", "GRIS": "#718096",
        "NARANJA": "#dd6b20", "FUCSIA": "#d53f8c", "GUINDA": "#702459",
        "CAFÉ": "#7b4f2e", "TORNASOL": "conic-gradient(from 0deg, #ff6b6b, #a8edea, #fed6e3, #ff6b6b)",
        "LILA": "#b794f4",
    };
    for (const [key, val] of Object.entries(map)) {
        if (nombre.toUpperCase().includes(key)) return val;
    }
    return "#94a3b8"; // slate default
}

// ---------- Step Indicators ----------
function StepIndicator({ step, currentStep }: { step: number; currentStep: number }) {
    const done = currentStep > step;
    const active = currentStep === step;
    return (
        <div className={`flex items-center justify-center w-7 h-7 rounded-full text-xs font-bold border-2 transition-all
            ${done ? "bg-emerald-500 border-emerald-500 text-white" :
            active ? "bg-white border-indigo-500 text-indigo-600" :
            "bg-slate-100 border-slate-200 text-slate-400"}`}>
            {done ? <CheckCircle className="w-4 h-4" /> : step}
        </div>
    );
}

// ---------- Main Component ----------
export default function GuidedCatalog({ branchId, onAddToCart }: GuidedCatalogProps) {
    const [step, setStep] = useState<1 | 2 | 3>(1);
    const [search, setSearch] = useState("");

    const [modelos, setModelos] = useState<Modelo[]>([]);
    const [loadingModelos, setLoadingModelos] = useState(true);

    const [selectedModelo, setSelectedModelo] = useState<Modelo | null>(null);
    const [colores, setColores] = useState<Color[]>([]);
    const [loadingColores, setLoadingColores] = useState(false);

    const [selectedColor, setSelectedColor] = useState<Color | null>(null);
    const [voltajes, setVoltajes] = useState<Voltaje[]>([]);
    const [loadingVoltajes, setLoadingVoltajes] = useState(false);

    // Fetch models on mount
    useEffect(() => {
        fetch("/api/modelos")
            .then(r => r.json())
            .then(setModelos)
            .catch(() => toast.error("Error cargando modelos"))
            .finally(() => setLoadingModelos(false));
    }, []);

    // Fetch colors when modelo selected
    const selectModelo = async (modelo: Modelo) => {
        setSelectedModelo(modelo);
        setStep(2);
        setSearch("");
        setLoadingColores(true);
        try {
            const res = await fetch(`/api/modelos/${modelo.id}/colores`);
            const data = await res.json();
            setColores(data);
        } catch {
            toast.error("Error cargando colores");
        } finally {
            setLoadingColores(false);
        }
    };

    // Fetch voltajes when color selected
    const selectColor = async (color: Color) => {
        setSelectedColor(color);
        setStep(3);
        setLoadingVoltajes(true);
        try {
            const res = await fetch(`/api/modelos/${selectedModelo!.id}/colores/${color.id}/voltajes`);
            const data = await res.json();
            setVoltajes(data);
        } catch {
            toast.error("Error cargando voltajes");
        } finally {
            setLoadingVoltajes(false);
        }
    };

    const selectVoltaje = (voltaje: Voltaje) => {
        if (voltaje.stockTotal <= 0) {
            toast.error("Sin stock disponible en ninguna sucursal");
            return;
        }
        const product: CartProduct = {
            id: voltaje.configuracionId,
            name: `${selectedModelo!.nombre} ${selectedColor!.nombre} ${voltaje.label}`,
            sku: voltaje.sku,
            price: voltaje.precioPublico,
            cost: 0,
            isSerialized: selectedModelo!.requiere_vin,
            // We pass a fake stocks array with the branchId so cart stock-check works
            stocks: [{ branchId, quantity: voltaje.stockTotal }],
        };
        onAddToCart(product);
        // Reset to step 1 after adding
        goBack(1);
    };

    const goBack = (toStep: 1 | 2 | 3) => {
        setStep(toStep);
        setSearch("");
        if (toStep <= 1) { setSelectedModelo(null); setColores([]); setSelectedColor(null); setVoltajes([]); }
        if (toStep <= 2) { setSelectedColor(null); setVoltajes([]); }
    };

    // ---------- Filtered lists ----------
    const q = search.toLowerCase();
    const filteredModelos = modelos.filter(m =>
        m.nombre.toLowerCase().includes(q)
    );
    const filteredColores = colores.filter(c =>
        c.nombre.toLowerCase().includes(q)
    );

    // ---------- Render ----------
    return (
        <div className="flex flex-col h-full overflow-hidden">
            {/* Step bar */}
            <div className="px-4 pt-4 pb-3 border-b bg-slate-50 dark:bg-slate-900 flex items-center gap-3 text-xs font-medium">
                <button onClick={() => step >= 2 && goBack(1)} className={`flex items-center gap-2 transition-opacity ${step >= 2 ? "cursor-pointer hover:opacity-70" : "pointer-events-none"}`}>
                    <StepIndicator step={1} currentStep={step} />
                    <span className={step === 1 ? "text-indigo-600 font-bold" : "text-slate-500"}>Modelo</span>
                </button>
                <div className="h-px flex-1 bg-slate-200" />
                <button onClick={() => step === 3 && goBack(2)} className={`flex items-center gap-2 transition-opacity ${step === 3 ? "cursor-pointer hover:opacity-70" : "pointer-events-none"}`}>
                    <StepIndicator step={2} currentStep={step} />
                    <span className={step === 2 ? "text-indigo-600 font-bold" : "text-slate-500"}>Color</span>
                </button>
                <div className="h-px flex-1 bg-slate-200" />
                <div className="flex items-center gap-2 pointer-events-none">
                    <StepIndicator step={3} currentStep={step} />
                    <span className={step === 3 ? "text-indigo-600 font-bold" : "text-slate-500"}>Voltaje / Precio</span>
                </div>
            </div>

            {/* Breadcrumb */}
            {(selectedModelo || selectedColor) && (
                <div className="px-4 py-2 flex items-center gap-1.5 text-xs text-slate-500 border-b bg-white dark:bg-slate-950">
                    <button onClick={() => goBack(1)} className="hover:text-indigo-600 font-medium">Modelos</button>
                    {selectedModelo && <>
                        <ChevronLeft className="w-3 h-3 rotate-180" />
                        <button onClick={() => goBack(2)} className={`${step === 2 ? "text-slate-800 font-semibold" : "hover:text-indigo-600"}`}>{selectedModelo.nombre}</button>
                    </>}
                    {selectedColor && <>
                        <ChevronLeft className="w-3 h-3 rotate-180" />
                        <span className="text-slate-800 font-semibold">{selectedColor.nombre}</span>
                    </>}
                </div>
            )}

            {/* Search */}
            {step < 3 && (
                <div className="p-3 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder={step === 1 ? "Buscar modelo..." : "Buscar color..."}
                            className="pl-9 bg-slate-50 dark:bg-slate-900 border-none"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>
            )}

            {/* ========== STEP 1: Modelos ========== */}
            {step === 1 && (
                <ScrollArea className="flex-1 p-4">
                    {loadingModelos ? (
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                            {[...Array(6)].map((_, i) => (
                                <div key={i} className="aspect-square rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                            {filteredModelos.map(modelo => (
                                <button
                                    key={modelo.id}
                                    onClick={() => selectModelo(modelo)}
                                    className="p-4 rounded-xl border bg-white dark:bg-slate-900 hover:border-indigo-400 hover:shadow-md transition-all text-left flex flex-col items-center text-center group"
                                >
                                    <div className="w-full aspect-square bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center mb-3 overflow-hidden">
                                        {modelo.imagenPrincipal ? (
                                            <img src={modelo.imagenPrincipal} alt={modelo.nombre} className="object-cover w-full h-full group-hover:scale-105 transition-transform" />
                                        ) : (
                                            <Package className="h-10 w-10 text-slate-300" />
                                        )}
                                    </div>
                                    <p className="text-sm font-bold mb-1 line-clamp-2">{modelo.nombre}</p>
                                    <p className="text-xs text-slate-500 mb-2">{modelo.variantesCount} variantes</p>
                                    <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
                                        Desde ${modelo.precioDesde.toLocaleString("es-MX")}
                                    </Badge>
                                </button>
                            ))}
                            {filteredModelos.length === 0 && (
                                <div className="col-span-full py-12 text-center text-slate-400">
                                    No se encontró ningún modelo con &ldquo;{search}&rdquo;
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>
            )}

            {/* ========== STEP 2: Colores ========== */}
            {step === 2 && (
                <ScrollArea className="flex-1 p-4">
                    {loadingColores ? (
                        <div className="grid grid-cols-3 sm:grid-cols-4 gap-4">
                            {[...Array(8)].map((_, i) => (
                                <div key={i} className="h-24 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                            ))}
                        </div>
                    ) : (
                        <div className="grid grid-cols-3 sm:grid-cols-4 xl:grid-cols-5 gap-3">
                            {filteredColores.map(color => {
                                const css = colorToCSS(color.nombre);
                                const isGradient = css.startsWith("conic");
                                return (
                                    <button
                                        key={color.id}
                                        onClick={() => selectColor(color)}
                                        className="p-3 rounded-xl border bg-white dark:bg-slate-900 hover:border-indigo-400 hover:shadow-md transition-all text-center group"
                                    >
                                        <div
                                            className="w-12 h-12 rounded-full mx-auto mb-2 border-2 border-slate-200 group-hover:border-indigo-400 group-hover:scale-110 transition-all shadow-sm"
                                            style={isGradient ? { background: css } : { backgroundColor: css }}
                                        />
                                        <p className="text-xs font-semibold leading-tight line-clamp-2">{color.nombre}</p>
                                    </button>
                                );
                            })}
                            {filteredColores.length === 0 && (
                                <div className="col-span-full py-12 text-center text-slate-400">
                                    No se encontró el color &ldquo;{search}&rdquo;
                                </div>
                            )}
                        </div>
                    )}
                </ScrollArea>
            )}

            {/* ========== STEP 3: Voltajes / Precio ========== */}
            {step === 3 && (
                <ScrollArea className="flex-1 p-4">
                    {loadingVoltajes ? (
                        <div className="space-y-3">
                            {[...Array(3)].map((_, i) => (
                                <div key={i} className="h-20 rounded-xl bg-slate-100 dark:bg-slate-800 animate-pulse" />
                            ))}
                        </div>
                    ) : voltajes.length === 0 ? (
                        <div className="py-12 text-center text-slate-400">
                            No hay configuraciones para esta combinación.
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {voltajes.map(v => {
                                const hasStock = v.stockTotal > 0;
                                return (
                                    <button
                                        key={v.id}
                                        onClick={() => selectVoltaje(v)}
                                        disabled={!hasStock}
                                        className={`w-full flex items-center justify-between p-4 rounded-xl border text-left transition-all
                                            ${hasStock
                                                ? "bg-white dark:bg-slate-900 hover:border-indigo-400 hover:shadow-md cursor-pointer"
                                                : "bg-slate-50 dark:bg-slate-900/50 opacity-50 cursor-not-allowed"}`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center font-bold text-sm ${
                                                v.valor >= 72 ? "bg-purple-100 text-purple-700" :
                                                v.valor >= 60 ? "bg-blue-100 text-blue-700" :
                                                v.valor > 0 ? "bg-amber-100 text-amber-700" :
                                                "bg-slate-100 text-slate-600"
                                            }`}>
                                                {v.valor > 0 ? `${v.valor}V` : "N/A"}
                                            </div>
                                            <div>
                                                <p className="font-semibold text-sm">{v.label}</p>
                                                <p className="text-xs text-slate-400 font-mono">{v.sku}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-xl font-bold text-emerald-600">
                                                ${v.precioPublico.toLocaleString("es-MX")}
                                            </p>
                                            <Badge variant={hasStock ? "outline" : "destructive"} className="text-xs mt-1">
                                                {hasStock ? `${v.stockTotal} en stock` : "Agotado"}
                                            </Badge>
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </ScrollArea>
            )}
        </div>
    );
}
