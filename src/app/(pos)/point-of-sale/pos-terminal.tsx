"use client";

import { useState, useMemo } from "react";
import { Product, Stock, Branch } from "@prisma/client";
import { Search, Plus, Minus, Trash2, ShoppingCart, CreditCard, Banknote, Landmark, Package, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { processSaleAction } from "@/actions/sale";
import { createCustomer } from "@/actions/customer";

type OmittedProduct = Omit<Product, 'price' | 'cost'>;

type ProductWithStock = OmittedProduct & {
    price: number;
    cost: number;
    stocks: (Stock & { branch: Branch })[];
};

interface CartItem {
    product: ProductWithStock;
    quantity: number;
    price: number;
    serialNumber?: string;
}

export default function PosTerminal({
    initialProducts,
    customers = []
}: {
    initialProducts: ProductWithStock[],
    customers?: any[]
}) {
    const { data: session } = useSession();
    const router = useRouter();
    const branchId = (session?.user as any)?.branchId;

    // Local State
    const [search, setSearch] = useState("");
    const [cart, setCart] = useState<CartItem[]>([]);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);
    const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER" | "CREDIT_BALANCE">("CASH");

    // New Customer State
    const [isNewCustomerOpen, setIsNewCustomerOpen] = useState(false);
    const [creatingCustomer, setCreatingCustomer] = useState(false);
    const [newCustomerForm, setNewCustomerForm] = useState({ name: "", phone: "" });

    // Layaway States
    const [isLayaway, setIsLayaway] = useState(false);
    const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
    const [downPayment, setDownPayment] = useState<string>("");

    // Filtering products based on search input
    const filteredProducts = useMemo(() => {
        if (!search) return initialProducts;
        const lowerSearch = search.toLowerCase();
        return initialProducts.filter(
            (p) =>
                p.name.toLowerCase().includes(lowerSearch) ||
                p.sku.toLowerCase().includes(lowerSearch)
        );
    }, [search, initialProducts]);

    // Cart operations
    const addToCart = (product: ProductWithStock) => {
        // Basic stock validation (simplified for UI, real validation happens on server)
        const localStock = product.stocks.find(s => s.branchId === branchId)?.quantity || 0;

        setCart((prev) => {
            const existing = prev.find((item) => item.product.id === product.id);

            if (existing) {
                if (existing.quantity >= localStock && !product.isSerialized) {
                    toast.error("Stock insuficiente en esta sucursal");
                    return prev;
                }
                return prev.map((item) =>
                    item.product.id === product.id
                        ? { ...item, quantity: item.quantity + 1 }
                        : item
                );
            }

            if (localStock <= 0) {
                toast.error("Producto agotado en esta sucursal");
                return prev;
            }

            return [...prev, { product, quantity: 1, price: Number(product.price) }];
        });
    };

    const updateQuantity = (productId: string, delta: number) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.product.id === productId) {
                    const newQuantity = item.quantity + delta;
                    if (newQuantity < 1) return item; // Handled by remove
                    return { ...item, quantity: newQuantity };
                }
                return item;
            })
        );
    };

    const updateSerialNumber = (productId: string, serial: string) => {
        setCart((prev) =>
            prev.map((item) => {
                if (item.product.id === productId) {
                    return { ...item, serialNumber: serial };
                }
                return item;
            })
        );
    };

    const removeFromCart = (productId: string) => {
        setCart((prev) => prev.filter((item) => item.product.id !== productId));
    };

    // Totals calculation
    const subtotal = cart.reduce((acc, item) => acc + item.price * item.quantity, 0);
    const tax = subtotal * 0.16; // 16% IVA standard in MX
    const total = subtotal + tax;

    const handleCheckout = async () => {
        let downPaymentNum: number | undefined = undefined;
        if (isLayaway) {
            if (!selectedCustomerId) {
                toast.error("Debes seleccionar un cliente para Apartar", { id: "checkout" });
                return;
            }
            downPaymentNum = parseFloat(downPayment);
            if (isNaN(downPaymentNum) || downPaymentNum <= 0 || downPaymentNum > total) {
                toast.error("Monto de abono inicial no válido", { id: "checkout" });
                return;
            }
        }

        setIsCheckoutOpen(false); // Close dialog immediately
        toast.loading("Procesando venta...", { id: "checkout" });

        try {
            const response = await processSaleAction({
                items: cart.map(item => ({
                    productId: item.product.id,
                    name: item.product.name,
                    quantity: item.quantity,
                    price: item.price,
                    isSerialized: item.product.isSerialized,
                    serialNumber: item.serialNumber
                })),
                total: total,
                paymentMethod: paymentMethod,
                isLayaway,
                customerId: selectedCustomerId && selectedCustomerId !== "none" ? selectedCustomerId : undefined,
                downPayment: isLayaway ? downPaymentNum : undefined,
            });

            if (!response.success) {
                toast.error(response.error || "Hubo un error al procesar la venta", { id: "checkout" });
                return;
            }

            toast.success(`Venta procesada exitosamente por $${total.toFixed(2)}`, {
                description: `Método: ${paymentMethod} | Folio: ${response.saleId?.slice(0, 8)}`,
                id: "checkout"
            });

            setCart([]);
            setIsLayaway(false);
            setDownPayment("");
            setSelectedCustomerId("");
        } catch (error) {
            toast.error("Error de conexión al servidor", { id: "checkout" });
        }
    };

    const handleCreateCustomer = async () => {
        if (!newCustomerForm.name) {
            toast.error("El nombre es obligatorio");
            return;
        }

        setCreatingCustomer(true);
        toast.loading("Creando cliente...", { id: "create-customer" });

        const result = await createCustomer(newCustomerForm);

        if (result.success && result.customer) {
            toast.success("Cliente creado exitosamente", { id: "create-customer" });

            // Auto-select the new customer
            setSelectedCustomerId(result.customer.id);
            setIsNewCustomerOpen(false);
            setNewCustomerForm({ name: "", phone: "" });

            // Refresh to get the updated customer list in props
            router.refresh();
        } else {
            toast.error(result.error || "No se pudo crear el cliente", { id: "create-customer" });
        }
        setCreatingCustomer(false);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full flex-1">

            {/* LEFT COLUMN: Catalog and Search */}
            <div className="lg:col-span-7 xl:col-span-8 flex flex-col bg-white dark:bg-slate-950 rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar por código (SKU) o nombre de producto..."
                            className="pl-9 bg-slate-50 dark:bg-slate-900 border-none select-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            autoFocus
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                    <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-4">
                        {filteredProducts.map((product) => {
                            const localStock = product.stocks.find(s => s.branchId === branchId)?.quantity || 0;
                            const hasStock = localStock > 0;

                            return (
                                <div
                                    key={product.id}
                                    onClick={() => hasStock && addToCart(product)}
                                    className={`relative p-4 rounded-xl border flex flex-col items-center text-center cursor-pointer transition-all hover:shadow-md ${hasStock
                                        ? "bg-white dark:bg-slate-900 hover:border-emerald-500"
                                        : "bg-slate-50 dark:bg-slate-900/50 opacity-60 cursor-not-allowed grayscale-[0.8]"
                                        }`}
                                >
                                    <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                        <Package className="h-8 w-8 text-slate-400" />
                                    </div>
                                    <div className="text-sm font-semibold mb-1 line-clamp-2">{product.name}</div>
                                    <div className="text-xs text-slate-500 mb-2">{product.sku}</div>
                                    <Badge variant={hasStock ? "default" : "destructive"} className="mt-auto">
                                        {hasStock ? `${localStock} en stock` : "Agotado"}
                                    </Badge>
                                    <div className="mt-2 text-emerald-600 dark:text-emerald-400 font-bold">
                                        ${Number(product.price).toFixed(2)}
                                    </div>
                                </div>
                            );
                        })}

                        {filteredProducts.length === 0 && (
                            <div className="col-span-full py-12 text-center text-slate-500">
                                No se encontraron productos con "{search}"
                            </div>
                        )}
                    </div>
                </ScrollArea>
            </div>

            {/* RIGHT COLUMN: Cart and Checkout */}
            <div className="lg:col-span-5 xl:col-span-4 flex flex-col bg-white dark:bg-slate-950 rounded-xl border shadow-sm overflow-hidden">
                <div className="p-4 border-b bg-slate-50 dark:bg-slate-900 flex items-center justify-between">
                    <h2 className="font-semibold flex items-center gap-2">
                        <ShoppingCart className="h-5 w-5" />
                        Ticket Actual
                    </h2>
                    <Badge variant="secondary">{cart.length} Artículos</Badge>
                </div>

                <ScrollArea className="flex-1">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 py-20">
                            <ShoppingCart className="h-12 w-12 opacity-20" />
                            <p>El carrito está vacío</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="w-24 text-center">Cant.</TableHead>
                                    <TableHead className="w-24 text-right">Monto</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cart.map((item) => (
                                    <TableRow key={item.product.id}>
                                        <TableCell className="font-medium text-xs">
                                            {item.product.name}
                                            <div className="text-slate-500 font-normal">{item.product.sku}</div>
                                            {item.product.isSerialized && (
                                                <Input
                                                    className="h-7 text-xs mt-2 w-full"
                                                    placeholder="Escanear Núm. Serie VIN"
                                                    value={item.serialNumber || ""}
                                                    onChange={(e) => updateSerialNumber(item.product.id, e.target.value)}
                                                />
                                            )}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center justify-center space-x-2">
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => updateQuantity(item.product.id, -1)}
                                                    disabled={item.quantity <= 1}
                                                >
                                                    <Minus className="h-3 w-3" />
                                                </Button>
                                                <span className="text-sm w-4 text-center">{item.quantity}</span>
                                                <Button
                                                    variant="outline"
                                                    size="icon"
                                                    className="h-6 w-6"
                                                    onClick={() => updateQuantity(item.product.id, 1)}
                                                >
                                                    <Plus className="h-3 w-3" />
                                                </Button>
                                            </div>
                                        </TableCell>
                                        <TableCell className="text-right">
                                            <div className="text-sm font-semibold">
                                                ${(item.price * item.quantity).toFixed(2)}
                                            </div>
                                            <Button
                                                variant="ghost"
                                                size="sm"
                                                className="h-6 px-2 text-red-500 hover:text-red-700 hover:bg-red-50 mx-auto mt-1"
                                                onClick={() => removeFromCart(item.product.id)}
                                            >
                                                <Trash2 className="h-3 w-3 mr-1" /> Remove
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </ScrollArea>

                {/* Totals & Checkout Button */}
                <div className="p-4 border-t bg-slate-50 dark:bg-slate-900 space-y-3">
                    <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>Subtotal</span>
                        <span>${subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-sm text-slate-600 dark:text-slate-400">
                        <span>IVA (16%)</span>
                        <span>${tax.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-xl pt-2 border-t">
                        <span>Total</span>
                        <span className="text-emerald-600 dark:text-emerald-400">${total.toFixed(2)}</span>
                    </div>

                    <Dialog open={isCheckoutOpen} onOpenChange={setIsCheckoutOpen}>
                        <DialogTrigger asChild>
                            <Button
                                className="w-full text-lg h-14 mt-4 bg-emerald-600 hover:bg-emerald-700 text-white"
                                disabled={cart.length === 0}
                            >
                                Cobrar Ticket
                            </Button>
                        </DialogTrigger>
                        <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                                <DialogTitle>Finalizar Venta</DialogTitle>
                                <DialogDescription>
                                    Configura los detalles y el pago para un total de <span className="font-bold text-slate-900 dark:text-white">${total.toFixed(2)}</span>.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="flex items-center space-x-2 py-2 mb-2">
                                <Switch id="layaway-mode" checked={isLayaway} onCheckedChange={setIsLayaway} />
                                <Label htmlFor="layaway-mode" className="font-semibold text-emerald-600">Registrar como Apartado</Label>
                            </div>

                            {/* Always allow selecting a customer, mandatory for layaways */}
                            <div className="space-y-2 mb-4">
                                <Label>Cliente {isLayaway ? "*" : "(Opcional)"}</Label>
                                <div className="flex gap-2">
                                    <Select value={selectedCustomerId} onValueChange={setSelectedCustomerId}>
                                        <SelectTrigger className="flex-1">
                                            <SelectValue placeholder="Seleccionar cliente..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="none" className="text-slate-400">Sin cliente (Venta Mostrador)</SelectItem>
                                            {customers?.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                                        </SelectContent>
                                    </Select>

                                    <Dialog open={isNewCustomerOpen} onOpenChange={setIsNewCustomerOpen}>
                                        <DialogTrigger asChild>
                                            <Button variant="outline" size="icon" className="shrink-0">
                                                <Plus className="h-4 w-4" />
                                            </Button>
                                        </DialogTrigger>
                                        <DialogContent className="sm:max-w-[425px]">
                                            <DialogHeader>
                                                <DialogTitle>Alta Rápida de Cliente</DialogTitle>
                                                <DialogDescription>
                                                    Agrega un nuevo cliente al CRM para asignarle esta venta o apartado.
                                                </DialogDescription>
                                            </DialogHeader>
                                            <div className="grid gap-4 py-4">
                                                <div className="grid gap-2">
                                                    <Label htmlFor="name">Nombre Completo *</Label>
                                                    <Input
                                                        id="name"
                                                        value={newCustomerForm.name}
                                                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, name: e.target.value })}
                                                        placeholder="Juan Pérez"
                                                    />
                                                </div>
                                                <div className="grid gap-2">
                                                    <Label htmlFor="phone">Teléfono Móvil (WhatsApp)</Label>
                                                    <Input
                                                        id="phone"
                                                        value={newCustomerForm.phone}
                                                        onChange={(e) => setNewCustomerForm({ ...newCustomerForm, phone: e.target.value })}
                                                        placeholder="10 dígitos"
                                                    />
                                                </div>
                                            </div>
                                            <DialogFooter>
                                                <Button type="button" variant="outline" onClick={() => setIsNewCustomerOpen(false)}>Cancelar</Button>
                                                <Button type="button" onClick={handleCreateCustomer} disabled={creatingCustomer}>
                                                    {creatingCustomer ? "Guardando..." : "Crear Cliente"}
                                                </Button>
                                            </DialogFooter>
                                        </DialogContent>
                                    </Dialog>
                                </div>
                            </div>

                            {isLayaway && (
                                <div className="grid gap-4 py-2 mb-4 bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
                                    <div className="space-y-2">
                                        <Label>Abono Inicial *</Label>
                                        <Input type="number" placeholder="Ej. 500" value={downPayment} onChange={e => setDownPayment(e.target.value)} />
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 py-2">
                                <Button
                                    variant={paymentMethod === "CASH" ? "default" : "outline"}
                                    className={`h-24 flex flex-col items-center justify-center gap-2 ${paymentMethod === "CASH" ? "ring-2 ring-primary ring-offset-2" : ""}`}
                                    onClick={() => setPaymentMethod("CASH")}
                                >
                                    <Banknote className="h-6 w-6" />
                                    <span className="text-xs">Efectivo</span>
                                </Button>
                                <Button
                                    variant={paymentMethod === "CARD" ? "default" : "outline"}
                                    className={`h-24 flex flex-col items-center justify-center gap-2 ${paymentMethod === "CARD" ? "ring-2 ring-primary ring-offset-2" : ""}`}
                                    onClick={() => setPaymentMethod("CARD")}
                                >
                                    <CreditCard className="h-6 w-6" />
                                    <span className="text-xs">Tarjeta</span>
                                </Button>
                                <Button
                                    variant={paymentMethod === "TRANSFER" ? "default" : "outline"}
                                    className={`h-24 flex flex-col items-center justify-center gap-2 ${paymentMethod === "TRANSFER" ? "ring-2 ring-primary ring-offset-2" : ""}`}
                                    onClick={() => setPaymentMethod("TRANSFER")}
                                >
                                    <Landmark className="h-6 w-6" />
                                    <span className="text-xs">Transferencia</span>
                                </Button>
                                {(() => {
                                    // Check if selected customer has enough balance to cover standard sale
                                    const selectedCustomer = customers?.find(c => c.id === selectedCustomerId);
                                    if (!isLayaway && selectedCustomer && selectedCustomer.balance >= total) {
                                        return (
                                            <Button
                                                variant={paymentMethod === "CREDIT_BALANCE" ? "default" : "outline"}
                                                className={`h-24 flex flex-col items-center justify-center gap-2 border-emerald-500 text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 ${paymentMethod === "CREDIT_BALANCE" ? "bg-emerald-600 text-white ring-2 ring-emerald-500 ring-offset-2 hover:bg-emerald-700 hover:text-white" : ""}`}
                                                onClick={() => setPaymentMethod("CREDIT_BALANCE")}
                                            >
                                                <User className="h-6 w-6" />
                                                <span className="text-[10px] text-center leading-tight">Saldo a Favor<br />(${selectedCustomer.balance.toFixed(2)})</span>
                                            </Button>
                                        );
                                    }
                                    return null;
                                })()}
                            </div>

                            <DialogFooter className="sm:justify-end">
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => setIsCheckoutOpen(false)}
                                >
                                    Cancelar
                                </Button>
                                <Button
                                    type="button"
                                    onClick={handleCheckout}
                                    className="bg-emerald-600 hover:bg-emerald-700"
                                >
                                    Confirmar Venta
                                </Button>
                            </DialogFooter>
                        </DialogContent>
                    </Dialog>

                </div>
            </div>
        </div>
    );
}
