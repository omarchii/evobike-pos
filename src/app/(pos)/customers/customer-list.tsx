"use client";

import { useState } from "react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, User, CreditCard, Banknote, Landmark } from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { addCustomerBalance } from "@/actions/customer";

interface CustomerItem {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    balance: number;
    creditLimit: number;
    _count?: { sales: number };
}

export default function CustomerList({ initialCustomers }: { initialCustomers: CustomerItem[] }) {
    const router = useRouter();
    const [search, setSearch] = useState("");
    const [selectedCustomer, setSelectedCustomer] = useState<CustomerItem | null>(null);
    const [topupAmount, setTopupAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER">("CASH");
    const [isTopupOpen, setIsTopupOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const filtered = initialCustomers.filter(c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.phone && c.phone.includes(search))
    );

    const openTopup = (customer: CustomerItem) => {
        setSelectedCustomer(customer);
        setTopupAmount("");
        setIsTopupOpen(true);
    };

    const submitTopup = async () => {
        if (!selectedCustomer) return;

        const amt = parseFloat(topupAmount);
        if (isNaN(amt) || amt <= 0) {
            toast.error("Monto inválido para recarga");
            return;
        }

        setLoading(true);
        toast.loading("Procesando recarga...", { id: "topup" });

        const res = await addCustomerBalance({
            customerId: selectedCustomer.id,
            amount: amt,
            method: paymentMethod
        });

        if (res.success) {
            toast.success("Saldo recargado exitosamente", { id: "topup" });
            setIsTopupOpen(false);
            router.refresh();
        } else {
            toast.error(res.error || "No se pudo procesar la recarga", { id: "topup" });
        }
        setLoading(false);
    };

    return (
        <div className="flex flex-col h-full">
            <div className="p-4 border-b flex items-center justify-between">
                <div className="relative w-72">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                    <Input
                        placeholder="Buscar cliente por nombre o teléfono..."
                        className="pl-9"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                    />
                </div>
                <Button className="bg-emerald-600 hover:bg-emerald-700">
                    <Plus className="mr-2 h-4 w-4" /> Nuevo Cliente
                </Button>
            </div>

            <div className="flex-1 overflow-auto p-0">
                <Table>
                    <TableHeader className="bg-slate-50 sticky top-0">
                        <TableRow>
                            <TableHead className="w-[300px]">Cliente</TableHead>
                            <TableHead>Contacto</TableHead>
                            <TableHead className="text-center">Compras Históricas</TableHead>
                            <TableHead className="text-right">Límite Crédito</TableHead>
                            <TableHead className="text-right">Saldo a Favor</TableHead>
                            <TableHead className="text-right">Acciones</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filtered.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={6} className="h-24 text-center text-slate-500">
                                    No se encontraron clientes.
                                </TableCell>
                            </TableRow>
                        ) : (
                            filtered.map((c) => (
                                <TableRow key={c.id}>
                                    <TableCell className="font-medium">
                                        <div className="flex items-center gap-2">
                                            <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 shrink-0">
                                                <User className="h-4 w-4" />
                                            </div>
                                            <Link href={`/customers/${c.id}`} className="hover:underline text-emerald-600 font-bold truncate">
                                                {c.name}
                                            </Link>
                                        </div>
                                    </TableCell>
                                    <TableCell>
                                        <div className="text-sm">{c.phone || "Sin teléfono"}</div>
                                        <div className="text-xs text-slate-500">{c.email}</div>
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant="secondary">{c._count?.sales || 0} Ventas</Badge>
                                    </TableCell>
                                    <TableCell className="text-right text-slate-500 font-medium">
                                        ${c.creditLimit.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Badge variant={c.balance > 0 ? "default" : "outline"} className={c.balance > 0 ? "bg-emerald-100 text-emerald-700 border-emerald-200" : ""}>
                                            ${c.balance.toFixed(2)}
                                        </Badge>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button variant="outline" size="sm" onClick={() => openTopup(c)}>
                                            <Plus className="h-3 w-3 mr-1" /> Abonar
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>

            {/* Topup Modal */}
            <Dialog open={isTopupOpen} onOpenChange={setIsTopupOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Recargar Saldo a Favor</DialogTitle>
                        <DialogDescription>
                            El cliente <span className="font-bold text-slate-900">{selectedCustomer?.name}</span> depositará dinero por anticipado en su cuenta.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedCustomer && (
                        <div className="py-4 space-y-6">
                            <div className="flex justify-between items-center bg-slate-50 p-4 rounded-lg border">
                                <span className="text-sm font-medium text-slate-500">Saldo Actual</span>
                                <span className="text-xl font-bold">${selectedCustomer.balance.toFixed(2)}</span>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium">Monto a Recargar</label>
                                <Input
                                    type="number"
                                    placeholder="Ej. 1500"
                                    value={topupAmount}
                                    onChange={(e) => setTopupAmount(e.target.value)}
                                    className="text-lg"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium">Método de Pago (Entrada a Caja)</label>
                                <div className="grid grid-cols-3 gap-3">
                                    <Button
                                        variant={paymentMethod === "CASH" ? "default" : "outline"}
                                        className="h-16 flex flex-col gap-1"
                                        onClick={() => setPaymentMethod("CASH")}
                                    >
                                        <Banknote className="h-4 w-4" /> Efectivo
                                    </Button>
                                    <Button
                                        variant={paymentMethod === "CARD" ? "default" : "outline"}
                                        className="h-16 flex flex-col gap-1"
                                        onClick={() => setPaymentMethod("CARD")}
                                    >
                                        <CreditCard className="h-4 w-4" /> Tarjeta
                                    </Button>
                                    <Button
                                        variant={paymentMethod === "TRANSFER" ? "default" : "outline"}
                                        className="h-16 flex flex-col gap-1"
                                        onClick={() => setPaymentMethod("TRANSFER")}
                                    >
                                        <Landmark className="h-4 w-4" /> Transf.
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsTopupOpen(false)}>Cancelar</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitTopup} disabled={loading}>
                            {loading ? "Procesando..." : "Confirmar Recepción"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

        </div>
    );
}
