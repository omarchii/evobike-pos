"use client";

import { useState, useMemo } from "react";
import { Search, Trash2, PackagePlus, ArrowDownToLine, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { receiveInventoryAction } from "@/actions/inventory";
import { useSession } from "next-auth/react";

interface SessionUser {
    branchId: string;
}

interface ProductStock {
    branchId: string;
    quantity: number;
}

interface Product {
    id: string;
    sku: string;
    name: string;
    price: number;
    cost: number;
    stocks: ProductStock[];
}

interface ReceiptItem {
    product: Product;
    quantity: number;
    cost: number;
}

export default function ReceiptsTerminal({ initialProducts }: { initialProducts: Product[] }) {
    const { data: session } = useSession();
    const branchId = (session?.user as SessionUser)?.branchId;

    const [search, setSearch] = useState("");
    const [cart, setCart] = useState<ReceiptItem[]>([]);
    const [reference, setReference] = useState("");
    const [loading, setLoading] = useState(false);

    // Filter products
    const filteredProducts = useMemo(() => {
        if (!search) return initialProducts;
        const lowerSearch = search.toLowerCase();
        return initialProducts.filter(
            (p) => p.name.toLowerCase().includes(lowerSearch) || p.sku.toLowerCase().includes(lowerSearch)
        );
    }, [search, initialProducts]);

    const addToList = (product: Product) => {
        setCart((prev) => {
            const existing = prev.find((item) => item.product.id === product.id);
            if (existing) {
                return prev.map((item) =>
                    item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item
                );
            }
            return [...prev, { product, quantity: 1, cost: Number(product.cost) }];
        });
    };

    const updateQuantity = (productId: string, val: string) => {
        const qty = parseInt(val);
        if (isNaN(qty) || qty < 1) return;
        setCart(prev => prev.map(item => item.product.id === productId ? { ...item, quantity: qty } : item));
    };

    const updateCost = (productId: string, val: string) => {
        const cost = parseFloat(val);
        if (isNaN(cost) || cost < 0) return;
        setCart(prev => prev.map(item => item.product.id === productId ? { ...item, cost: cost } : item));
    };

    const remove = (productId: string) => {
        setCart((prev) => prev.filter((item) => item.product.id !== productId));
    };

    const totalInvestment = cart.reduce((acc, item) => acc + (item.cost * item.quantity), 0);
    const totalItems = cart.reduce((acc, item) => acc + item.quantity, 0);

    const submitReceipt = async () => {
        if (cart.length === 0) return;

        setLoading(true);
        toast.loading("Registrando entrada de mercancía...", { id: "receipt" });

        const formattedItems = cart.map(i => ({
            productVariantId: i.product.id,
            quantity: i.quantity,
            cost: i.cost
        }));

        const res = await receiveInventoryAction({
            items: formattedItems,
            reference: reference || "Ingreso Manual"
        });

        if (res.success) {
            toast.success("Mercancía ingresada correctamente", { id: "receipt" });
            setCart([]);
            setReference("");
        } else {
            toast.error(res.error || "Hubo un error al ingresar", { id: "receipt" });
        }
        setLoading(false);
    };

    return (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 h-full flex-1 min-h-0">
            {/* CATALOG */}
            <div className="lg:col-span-6 xl:col-span-7 flex flex-col bg-white dark:bg-slate-950 rounded-xl border shadow-sm min-h-0">
                <div className="p-4 border-b">
                    <div className="relative">
                        <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <Input
                            placeholder="Buscar producto a ingresar..."
                            className="pl-9 bg-slate-50 dark:bg-slate-900 border-none select-all"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
                        {filteredProducts.map((product) => {
                            const localStock = product.stocks.find((s) => s.branchId === branchId)?.quantity || 0;
                            return (
                                <div
                                    key={product.id}
                                    onClick={() => addToList(product)}
                                    className="relative p-4 rounded-xl border flex flex-col items-center text-center cursor-pointer transition-all hover:border-emerald-500 hover:shadow-md bg-white dark:bg-slate-900"
                                >
                                    <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mb-3">
                                        <Package className="h-6 w-6 text-slate-400" />
                                    </div>
                                    <div className="text-sm font-semibold mb-1 line-clamp-2">{product.name}</div>
                                    <div className="text-xs text-slate-500 mb-2">{product.sku}</div>
                                    <Badge variant="outline" className="mt-auto bg-slate-50">
                                        Existencia: {localStock}
                                    </Badge>
                                </div>
                            );
                        })}
                    </div>
                </ScrollArea>
            </div>

            {/* RECEIPT LIST */}
            <div className="lg:col-span-6 xl:col-span-5 flex flex-col bg-white dark:bg-slate-950 rounded-xl border shadow-sm min-h-0">
                <div className="p-4 border-b bg-slate-50 dark:bg-slate-900 flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                        <h2 className="font-semibold flex items-center gap-2">
                            <ArrowDownToLine className="h-5 w-5 text-emerald-600" />
                            Lista de Entrada
                        </h2>
                        <Badge variant="secondary">{cart.length} SKUs distintos</Badge>
                    </div>
                    <Input
                        placeholder="Referencia o Factura (Opcional)"
                        value={reference}
                        onChange={e => setReference(e.target.value)}
                        className="h-8 text-sm"
                    />
                </div>

                <ScrollArea className="flex-1">
                    {cart.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full text-slate-400 space-y-4 py-20">
                            <PackagePlus className="h-12 w-12 opacity-20" />
                            <p>Lista vacía. Busca y selecciona productos.</p>
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Producto</TableHead>
                                    <TableHead className="w-24">Cant.</TableHead>
                                    <TableHead className="w-24 text-right">Costo Unit.</TableHead>
                                    <TableHead className="w-10"></TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {cart.map((item) => (
                                    <TableRow key={item.product.id}>
                                        <TableCell className="font-medium text-xs">
                                            {item.product.name}
                                            <div className="text-slate-500 font-normal">{item.product.sku}</div>
                                        </TableCell>
                                        <TableCell>
                                            <Input
                                                type="number"
                                                value={item.quantity}
                                                onChange={e => updateQuantity(item.product.id, e.target.value)}
                                                className="h-8 text-center px-1"
                                                min={1}
                                            />
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1">
                                                <span className="text-slate-400">$</span>
                                                <Input
                                                    type="number"
                                                    value={item.cost}
                                                    onChange={e => updateCost(item.product.id, e.target.value)}
                                                    className="h-8 text-right px-1"
                                                    min={0}
                                                />
                                            </div>
                                        </TableCell>
                                        <TableCell>
                                            <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => remove(item.product.id)}>
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </ScrollArea>

                <div className="p-4 border-t bg-slate-50 dark:bg-slate-900">
                    <div className="flex justify-between text-sm text-slate-600 mb-2">
                        <span>Total Piezas de Entrada</span>
                        <span className="font-bold">{totalItems}</span>
                    </div>
                    <div className="flex justify-between text-base font-bold mb-4">
                        <span>Costo de Inversión</span>
                        <span className="text-emerald-600">${totalInvestment.toFixed(2)}</span>
                    </div>
                    <Button
                        className="w-full bg-emerald-600 hover:bg-emerald-700 h-12 text-md"
                        disabled={cart.length === 0 || loading}
                        onClick={submitReceipt}
                    >
                        {loading ? "Registrando..." : "Confirmar Ingreso a Inventario"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
