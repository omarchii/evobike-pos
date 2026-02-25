"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog";
import { PlusCircle } from "lucide-react";
import { createServiceOrder } from "@/actions/workshop";
import { useDebouncedCallback } from "use-debounce";
import { Search, Info, CarFront, Bike } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

interface SerialResult {
    id: string;
    serialNumber: string;
    model: string;
    brand: string;
    customerId: string;
    customer: {
        id: string;
        name: string;
        phone: string;
    }
}

export function NewOrderDialog() {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [vinSearch, setVinSearch] = useState("");
    const [searchResults, setSearchResults] = useState<SerialResult[]>([]);
    const [isSearching, setIsSearching] = useState(false);

    const [formData, setFormData] = useState({
        customerId: "",
        customerBikeId: "",
        customerName: "",
        customerPhone: "",
        bikeInfo: "",
        diagnosis: "",
    });

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!formData.customerName || !formData.bikeInfo || !formData.diagnosis) {
            toast.error("Por favor completa los campos obligatorios.");
            return;
        }

        setLoading(true);
        toast.loading("Creando orden...", { id: "new-order" });

        const result = await createServiceOrder(formData);

        if (result.success) {
            toast.success(`Orden ${result.folio} creada exitosamente`, { id: "new-order" });
            setOpen(false);
            resetForm();
            router.refresh();
        } else {
            toast.error(result.error || "No se pudo crear la orden", { id: "new-order" });
        }
        setLoading(false);
    };

    const handleSearch = useDebouncedCallback(async (query: string) => {
        if (!query || query.length < 3) {
            setSearchResults([]);
            setIsSearching(false);
            return;
        }
        setIsSearching(true);
        try {
            const res = await fetch(`/api/serial-search?q=${query}`);
            if (res.ok) {
                const data = await res.json();
                setSearchResults(data);
            }
        } catch (error) {
            console.error("Search error", error);
        } finally {
            setIsSearching(false);
        }
    }, 400);

    const onQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setVinSearch(val);
        handleSearch(val);
    };

    const selectResult = (bike: SerialResult) => {
        setFormData({
            ...formData,
            customerId: bike.customerId,
            customerBikeId: bike.id,
            customerName: bike.customer.name,
            customerPhone: bike.customer.phone || "",
            bikeInfo: `${bike.brand || 'Bicicleta/Scooter'} ${bike.model || ''} - VIN: ${bike.serialNumber}`
        });
        setVinSearch("");
        setSearchResults([]);
        toast.success("Datos del cliente y unidad autocompletados");
    };

    // Reset function alongside state
    const resetForm = () => {
        setFormData({ customerId: "", customerBikeId: "", customerName: "", customerPhone: "", bikeInfo: "", diagnosis: "" });
        setVinSearch("");
        setSearchResults([]);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="bg-slate-900 text-white hover:bg-slate-800">
                    <PlusCircle className="mr-2 h-4 w-4" /> Nueva Orden
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[425px]">
                <form onSubmit={handleSubmit}>
                    <DialogHeader className="mb-4">
                        <DialogTitle>Registrar Servicio</DialogTitle>
                        <DialogDescription>
                            Escanea el VIN para llenar los datos automáticamente o captura la información manual.
                        </DialogDescription>
                    </DialogHeader>

                    {/* VIN SEARCH BAR */}
                    <div className="relative mb-6">
                        <div className="relative">
                            <Search className="absolute left-3 top-2.5 h-4 w-4 text-emerald-500" />
                            <Input
                                placeholder="Escanear Número de Serie (VIN)..."
                                className="pl-9 border-emerald-200 bg-emerald-50 text-emerald-900 placeholder:text-emerald-400 focus-visible:ring-emerald-500 font-semibold"
                                value={vinSearch}
                                onChange={onQueryChange}
                            />
                        </div>
                        {isSearching && (
                            <div className="absolute right-3 top-2.5 text-xs text-emerald-500 animate-pulse">Buscando...</div>
                        )}

                        {/* Search Results Dropdown */}
                        {searchResults.length > 0 && (
                            <div className="absolute z-10 w-full mt-1 bg-white border shadow-lg rounded-md max-h-60 overflow-auto">
                                {searchResults.map(bike => (
                                    <div
                                        key={bike.id}
                                        className="p-3 border-b hover:bg-slate-50 cursor-pointer flex justify-between items-center"
                                        onClick={() => selectResult(bike)}
                                    >
                                        <div>
                                            <p className="font-semibold text-sm flex items-center gap-2">
                                                <Bike className="h-4 w-4 text-slate-400" />
                                                {bike.brand} {bike.model}
                                            </p>
                                            <p className="text-xs text-slate-500 mt-1">A nombre de: <span className="font-medium">{bike.customer.name}</span></p>
                                        </div>
                                        <Badge variant="outline" className="text-[10px]">{bike.serialNumber}</Badge>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="grid gap-4 py-2 border-t pt-4">
                        <div className="grid gap-2">
                            <Label htmlFor="customerName">Nombre del Cliente *</Label>
                            <Input
                                id="customerName"
                                placeholder="Ej. Juan Pérez"
                                value={formData.customerName}
                                onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="customerPhone">Teléfono</Label>
                            <Input
                                id="customerPhone"
                                placeholder="10 dígitos"
                                value={formData.customerPhone}
                                onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="bikeInfo">Detalles Bicicleta *</Label>
                            <Input
                                id="bikeInfo"
                                placeholder="Marca, modelo, color, rodada"
                                value={formData.bikeInfo}
                                onChange={(e) => setFormData({ ...formData, bikeInfo: e.target.value })}
                            />
                        </div>
                        <div className="grid gap-2">
                            <Label htmlFor="diagnosis">Diagnóstico Inicial / Falla *</Label>
                            <Textarea
                                id="diagnosis"
                                placeholder="Zumba el balero trasero, ajuste de cambios..."
                                className="resize-none"
                                value={formData.diagnosis}
                                onChange={(e) => setFormData({ ...formData, diagnosis: e.target.value })}
                            />
                        </div>
                    </div>
                    <DialogFooter className="mt-6">
                        <Button type="button" variant="outline" onClick={() => { setOpen(false); resetForm(); }}>Cancelar</Button>
                        <Button type="submit" disabled={loading} className="bg-slate-900 hover:bg-slate-800">
                            {loading ? "Guardando..." : "Ingresar Bici"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
