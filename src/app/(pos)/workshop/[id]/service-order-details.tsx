"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Bike, Wrench, User as UserIcon, Calendar, Trash2, Plus, ArrowRight, CheckCircle2, Check, ChevronsUpDown, DollarSign } from "lucide-react";
import { addServiceOrderItem, removeServiceOrderItem, updateServiceOrderStatus } from "@/actions/workshop";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ServiceOrderStatus } from "@prisma/client";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";

// Since we are passing serialized data, we define the types accordingly
export type SerializedProduct = {
    id: string;
    sku: string;
    name: string;
    price: number;
    cost: number;
};

export type SerializedOrderItem = {
    id: string;
    serviceOrderId: string;
    productVariantId: string | null;
    description: string;
    quantity: number;
    price: number;
    productVariant: SerializedProduct | null;
};

export type FullSerializedOrder = {
    id: string;
    folio: string;
    status: ServiceOrderStatus;
    customerId: string;
    bikeInfo: string | null;
    diagnosis: string | null;
    subtotal: number;
    total: number;
    createdAt: Date;
    customer: { name: string, phone: string | null };
    user: { name: string };
    customerBike: {
        serialNumber: string;
        voltaje: string | null;
        brand: string | null;
        model: string | null;
        color: string | null;
    } | null;
    items: SerializedOrderItem[];
};

export function ServiceOrderDetailsView({
    order,
    catalogProducts
}: {
    order: FullSerializedOrder,
    catalogProducts: SerializedProduct[]
}) {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [isAdvancing, setIsAdvancing] = useState(false);
    const [isDelivering, setIsDelivering] = useState(false);
    const [deliveryMethod, setDeliveryMethod] = useState<"CASH" | "CARD" | "TRANSFER">("CASH");

    const [openCombobox, setOpenCombobox] = useState(false);

    // Custom Service / Labor states
    const [manualDescription, setManualDescription] = useState("");
    const [manualPrice, setManualPrice] = useState("");

    // Product Selection states
    const [selectedProductId, setSelectedProductId] = useState<string>("");
    const [productQty, setProductQty] = useState("1");

    const isClosed = order.status === "DELIVERED" || order.status === "CANCELLED";

    const handleAddManualService = async () => {
        if (!manualDescription || !manualPrice) return;
        setLoading(true);
        toast.loading("Agregando servicio...", { id: "add-item" });

        const result = await addServiceOrderItem({
            serviceOrderId: order.id,
            description: manualDescription,
            quantity: 1,
            price: parseFloat(manualPrice)
        });

        if (result.success) {
            toast.success("Servicio agregado", { id: "add-item" });
            setManualDescription("");
            setManualPrice("");
        } else {
            toast.error(result.error || "No se pudo agregar", { id: "add-item" });
        }
        setLoading(false);
    };

    const handleAddProduct = async () => {
        if (!selectedProductId) return;
        const prod = catalogProducts.find(p => p.id === selectedProductId);
        if (!prod) return;

        setLoading(true);
        toast.loading("Agregando producto...", { id: "add-item" });

        const result = await addServiceOrderItem({
            serviceOrderId: order.id,
            productVariantId: prod.id,
            description: prod.name,
            quantity: parseInt(productQty) || 1,
            price: prod.price
        });

        if (result.success) {
            toast.success("Producto agregado", { id: "add-item" });
            setSelectedProductId("");
            setProductQty("1");
        } else {
            toast.error(result.error || "No se pudo agregar", { id: "add-item" });
        }
        setLoading(false);
    };

    const handleRemoveItem = async (itemId: string) => {
        if (!confirm("¿Eliminar este concepto de la orden?")) return;

        setLoading(true);
        toast.loading("Eliminando...", { id: "remove-item" });
        const result = await removeServiceOrderItem(itemId, order.id);

        if (result.success) {
            toast.success("Concepto eliminado", { id: "remove-item" });
        } else {
            toast.error(result.error || "No se pudo eliminar", { id: "remove-item" });
        }
        setLoading(false);
    };

    const handleDeliver = async () => {
        setIsDelivering(true);
        toast.loading("Procesando cobro y entrega...", { id: "deliver-order" });
        try {
            const response = await fetch("/api/workshop/deliver", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ serviceOrderId: order.id, paymentMethod: deliveryMethod })
            });
            const result = (await response.json()) as { success: boolean; error?: string };
            if (result.success) {
                toast.success("Orden cobrada y entregada", { id: "deliver-order" });
                router.refresh();
            } else {
                toast.error(result.error ?? "Error al entregar", { id: "deliver-order" });
            }
        } catch {
            toast.error("Error de conexión", { id: "deliver-order" });
        }
        setIsDelivering(false);
    };

    const handleAdvanceStatus = async () => {
        setIsAdvancing(true);
        const result = await updateServiceOrderStatus(order.id, order.status);
        if (result.success) {
            toast.success("Estatus actualizado");
            router.refresh();
        } else {
            toast.error(result.error || "Error al actualizar estatus");
        }
        setIsAdvancing(false);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Left Column: Order Summary */}
            <div className="lg:col-span-1 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle className="flex justify-between items-center">
                            Detalles
                            <Badge variant={order.status === "COMPLETED" ? "default" : "secondary"}>
                                {order.status}
                            </Badge>
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                        <div className="flex items-start gap-3 text-slate-600">
                            <Bike className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-slate-900">Bicicleta</p>
                                <p>{order.bikeInfo || "Sin especificar"}</p>
                                {order.customerBike?.voltaje && (
                                    <p className="text-xs text-slate-500 mt-0.5">
                                        Voltaje: {order.customerBike.voltaje}
                                        {order.customerBike.serialNumber && ` · VIN: ${order.customerBike.serialNumber}`}
                                    </p>
                                )}
                            </div>
                        </div>
                        <div className="flex items-start gap-3 text-slate-600">
                            <UserIcon className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-slate-900">Cliente</p>
                                <p>{order.customer.name}</p>
                                <p className="text-xs">{order.customer.phone}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 text-slate-600">
                            <Wrench className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-slate-900">Falla Reportada</p>
                                <p className="italic">{order.diagnosis || "N/A"}</p>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 text-slate-600">
                            <Calendar className="w-4 h-4 mt-0.5 shrink-0" />
                            <div>
                                <p className="font-medium text-slate-900">Ingreso</p>
                                <p>{new Date(order.createdAt).toLocaleString()}</p>
                                <p className="text-xs">Atendido por: {order.user.name}</p>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {!isClosed && (
                    <Card className="bg-slate-900 text-white">
                        <CardHeader>
                            <CardTitle>Acciones de Taller</CardTitle>
                        </CardHeader>
                        <CardContent>
                            {order.status === "PENDING" && (
                                <Button onClick={handleAdvanceStatus} disabled={isAdvancing} className="w-full bg-blue-600 hover:bg-blue-700">
                                    Mandar a Reparación <ArrowRight className="ml-2 w-4 h-4" />
                                </Button>
                            )}
                            {order.status === "IN_PROGRESS" && (
                                <Button onClick={handleAdvanceStatus} disabled={isAdvancing} className="w-full bg-emerald-600 hover:bg-emerald-700">
                                    Marcar como Terminada <CheckCircle2 className="ml-2 w-4 h-4" />
                                </Button>
                            )}
                            {order.status === "COMPLETED" && (
                                <div className="space-y-3">
                                    <p className="text-sm text-slate-300">
                                        Bicicleta lista. Selecciona el método de pago para cobrar y entregar.
                                    </p>
                                    <Select
                                        value={deliveryMethod}
                                        onValueChange={(v) => setDeliveryMethod(v as "CASH" | "CARD" | "TRANSFER")}
                                    >
                                        <SelectTrigger className="bg-slate-800 border-slate-700 text-white">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="CASH">Efectivo</SelectItem>
                                            <SelectItem value="CARD">Tarjeta</SelectItem>
                                            <SelectItem value="TRANSFER">Transferencia</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <Button
                                        onClick={handleDeliver}
                                        disabled={isDelivering}
                                        className="w-full bg-emerald-600 hover:bg-emerald-700"
                                    >
                                        <DollarSign className="mr-2 w-4 h-4" />
                                        Cobrar ${order.total.toFixed(2)} y Entregar
                                    </Button>
                                </div>
                            )}
                        </CardContent>
                    </Card>
                )}
            </div>

            {/* Right Column: Items & Billing */}
            <div className="lg:col-span-2 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Cargos de la Orden</CardTitle>
                        <CardDescription>Agrega mano de obra o refacciones utilizadas en la reparación.</CardDescription>
                    </CardHeader>
                    <CardContent>
                        {!isClosed && (
                            <div className="flex flex-col md:flex-row gap-4 mb-6 pb-6 border-b">
                                <div className="flex-1 space-y-2">
                                    <p className="text-sm font-medium">Mano de Obra / Servicio</p>
                                    <div className="flex gap-2">
                                        <Input
                                            placeholder="Descripción"
                                            value={manualDescription}
                                            onChange={(e) => setManualDescription(e.target.value)}
                                        />
                                        <Input
                                            type="number"
                                            placeholder="$ Precio"
                                            className="w-32"
                                            value={manualPrice}
                                            onChange={(e) => setManualPrice(e.target.value)}
                                        />
                                        <Button variant="secondary" onClick={handleAddManualService} disabled={loading}>
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>

                                <div className="flex-1 space-y-2">
                                    <p className="text-sm font-medium">Refacción de Inventario</p>
                                    <div className="flex gap-2">
                                        <Popover open={openCombobox} onOpenChange={setOpenCombobox}>
                                            <PopoverTrigger asChild>
                                                <Button
                                                    variant="outline"
                                                    role="combobox"
                                                    aria-expanded={openCombobox}
                                                    className="w-[280px] justify-between font-normal"
                                                >
                                                    {selectedProductId
                                                        ? catalogProducts.find((p) => p.id === selectedProductId)?.name
                                                        : "Elegir pieza..."}
                                                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                                                </Button>
                                            </PopoverTrigger>
                                            <PopoverContent className="w-[320px] p-0" align="start">
                                                <Command>
                                                    <CommandInput placeholder="🔎 Buscar por nombre o SKU..." />
                                                    <CommandList>
                                                        <CommandEmpty>No se encontraron piezas.</CommandEmpty>
                                                        <CommandGroup>
                                                            {catalogProducts.map((p) => (
                                                                <CommandItem
                                                                    key={p.id}
                                                                    value={`${p.name} ${p.sku}`}
                                                                    onSelect={() => {
                                                                        setSelectedProductId(p.id === selectedProductId ? "" : p.id)
                                                                        setOpenCombobox(false)
                                                                    }}
                                                                >
                                                                    <Check
                                                                        className={cn(
                                                                            "mr-2 h-4 w-4",
                                                                            selectedProductId === p.id ? "opacity-100" : "opacity-0"
                                                                        )}
                                                                    />
                                                                    <div className="flex flex-col">
                                                                        <span>{p.name}</span>
                                                                        <span className="text-xs text-slate-400 font-mono">{p.sku} | ${p.price}</span>
                                                                    </div>
                                                                </CommandItem>
                                                            ))}
                                                        </CommandGroup>
                                                    </CommandList>
                                                </Command>
                                            </PopoverContent>
                                        </Popover>
                                        <Input
                                            type="number"
                                            className="w-20"
                                            placeholder="Cant."
                                            value={productQty}
                                            onChange={(e) => setProductQty(e.target.value)}
                                        />
                                        <Button variant="secondary" onClick={handleAddProduct} disabled={loading}>
                                            <Plus className="w-4 h-4" />
                                        </Button>
                                    </div>
                                </div>
                            </div>
                        )}

                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Descripción</TableHead>
                                    <TableHead className="w-20 text-center">Cant.</TableHead>
                                    <TableHead className="w-32 text-right">Precio U.</TableHead>
                                    <TableHead className="w-32 text-right">Importe</TableHead>
                                    <TableHead className="w-16"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {order.items.map((item) => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            {item.description}
                                            {item.productVariant && <Badge variant="outline" className="ml-2 text-[10px]">{item.productVariant.sku}</Badge>}
                                        </TableCell>
                                        <TableCell className="text-center">{item.quantity}</TableCell>
                                        <TableCell className="text-right">${item.price.toFixed(2)}</TableCell>
                                        <TableCell className="text-right font-medium">${(item.quantity * item.price).toFixed(2)}</TableCell>
                                        <TableCell className="text-center">
                                            {!isClosed && (
                                                <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={() => handleRemoveItem(item.id)} disabled={loading}>
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </TableCell>
                                    </TableRow>
                                ))}
                                {order.items.length === 0 && (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center text-slate-500 h-24">
                                            No hay cargos registrados aún.
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>

                        <div className="mt-6 flex justify-end text-right">
                            <div className="w-64 space-y-2">
                                <div className="flex justify-between text-slate-500">
                                    <span>Subtotal Libre:</span>
                                    <span>${order.subtotal.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-2xl font-bold pt-2 border-t text-slate-900 dark:text-white">
                                    <span>Total:</span>
                                    <span>${order.total.toFixed(2)}</span>
                                </div>
                            </div>
                        </div>

                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
