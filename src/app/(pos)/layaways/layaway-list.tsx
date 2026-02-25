"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter
} from "@/components/ui/dialog";
import { ArchiveRestore, User, Calendar, CreditCard, ShoppingBag, ArrowRight, Banknote } from "lucide-react";
import { toast } from "sonner";
import { registerLayawayPayment } from "@/actions/layaway";
import { useRouter } from "next/navigation";

export default function LayawayList({ initialLayaways }: { initialLayaways: any[] }) {
    const router = useRouter();
    const [layaways, setLayaways] = useState(initialLayaways);
    const [selectedLayaway, setSelectedLayaway] = useState<any>(null);
    const [paymentAmount, setPaymentAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER">("CASH");
    const [isPaymentOpen, setIsPaymentOpen] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleOpenPayment = (l: any) => {
        setSelectedLayaway(l);
        const pending = l.total - l.totalPaid;
        setPaymentAmount(pending.toString()); // Default to liquidating
        setIsPaymentOpen(true);
    };

    const submitPayment = async () => {
        const amt = parseFloat(paymentAmount);
        const pending = selectedLayaway.total - selectedLayaway.totalPaid;

        if (isNaN(amt) || amt <= 0 || amt > pending) {
            toast.error("Monto inválido. Verifica el abono.");
            return;
        }

        setLoading(true);
        toast.loading("Registrando pago...", { id: "payment" });

        const res = await registerLayawayPayment({
            saleId: selectedLayaway.id,
            amount: amt,
            method: paymentMethod
        });

        if (res.success) {
            toast.success("Abono registrado correctamente", { id: "payment" });
            setIsPaymentOpen(false);
            setPaymentAmount("");
            router.refresh(); // Tells Next.js to re-fetch the server page, triggering UI update
        } else {
            toast.error(res.error || "No se pudo registrar el pago", { id: "payment" });
        }
        setLoading(false);
    };

    if (layaways.length === 0) {
        return (
            <div className="flex-1 flex flex-col items-center justify-center border-2 border-dashed rounded-xl p-12 text-slate-400">
                <ArchiveRestore className="h-16 w-16 mb-4 opacity-50" />
                <h3 className="text-lg font-medium text-slate-900 dark:text-white">Sin apartados activos</h3>
                <p>No tienes cuentas pendientes por cobrar en esta sucursal.</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {layaways.map(l => {
                const pending = l.total - l.totalPaid;
                const pct = Math.min(100, Math.max(0, (l.totalPaid / l.total) * 100));

                return (
                    <Card key={l.id} className="flex flex-col border-emerald-100 shadow-sm overflow-hidden relative">
                        {/* Progress Bar background hint */}
                        <div className="absolute top-0 left-0 h-1 bg-emerald-500 transition-all duration-1000" style={{ width: `${pct}%` }} />

                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
                                    {l.folio}
                                </Badge>
                                <span className="text-xs text-slate-500">
                                    {new Date(l.createdAt).toLocaleDateString()}
                                </span>
                            </div>
                            <CardTitle className="text-base mt-3 flex items-start gap-2">
                                <User className="h-4 w-4 mt-0.5 text-slate-400" />
                                {l.customer?.name || "Cliente General"}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-sm space-y-4 flex-1">
                            <div className="bg-slate-50 dark:bg-slate-900 p-3 rounded-lg space-y-2">
                                <div className="flex justify-between text-slate-500 text-xs">
                                    <span>Valor Total</span>
                                    <span>${l.total.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between text-emerald-600 font-medium text-xs">
                                    <span>Abonado</span>
                                    <span>${l.totalPaid.toFixed(2)}</span>
                                </div>
                                <div className="flex justify-between font-bold text-slate-900 dark:text-white pt-2 border-t">
                                    <span>Restante</span>
                                    <span>${pending.toFixed(2)}</span>
                                </div>
                            </div>

                            <div className="space-y-1">
                                <p className="text-xs text-slate-500 font-semibold mb-2 flex items-center gap-1">
                                    <ShoppingBag className="h-3 w-3" /> Artículos ({l.items.length})
                                </p>
                                {l.items.slice(0, 2).map((item: any) => (
                                    <div key={item.id} className="text-xs text-slate-600 truncate flex justify-between">
                                        <span className="truncate pr-2">{item.quantity}x {item.product.name}</span>
                                    </div>
                                ))}
                                {l.items.length > 2 && (
                                    <div className="text-xs text-slate-400 italic">... y {l.items.length - 2} más</div>
                                )}
                            </div>
                        </CardContent>
                        <CardFooter className="pt-0 p-4">
                            <Button className="w-full bg-emerald-600 hover:bg-emerald-700" onClick={() => handleOpenPayment(l)}>
                                Registrar Abono <ArrowRight className="h-3 w-3 ml-2" />
                            </Button>
                        </CardFooter>
                    </Card>
                );
            })}

            {/* Payment Modal */}
            <Dialog open={isPaymentOpen} onOpenChange={setIsPaymentOpen}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Abonar a Cuenta</DialogTitle>
                        <DialogDescription>
                            Registra un pago parcial para la orden {selectedLayaway?.folio}.
                        </DialogDescription>
                    </DialogHeader>
                    {selectedLayaway && (
                        <div className="py-4 space-y-6">
                            <div className="flex justify-between text-xl font-bold p-4 bg-slate-50 rounded-lg border">
                                <span>Saldo Restante:</span>
                                <span>${(selectedLayaway.total - selectedLayaway.totalPaid).toFixed(2)}</span>
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium">Monto a Pagar</label>
                                <Input
                                    type="number"
                                    value={paymentAmount}
                                    onChange={(e) => setPaymentAmount(e.target.value)}
                                    className="text-lg"
                                />
                            </div>

                            <div className="space-y-3">
                                <label className="text-sm font-medium">Método de Pago</label>
                                <div className="grid grid-cols-2 gap-3">
                                    <Button
                                        variant={paymentMethod === "CASH" ? "default" : "outline"}
                                        onClick={() => setPaymentMethod("CASH")}
                                    >
                                        <Banknote className="mr-2 h-4 w-4" /> Efectivo
                                    </Button>
                                    <Button
                                        variant={paymentMethod === "CARD" ? "default" : "outline"}
                                        onClick={() => setPaymentMethod("CARD")}
                                    >
                                        <CreditCard className="mr-2 h-4 w-4" /> Tarjeta / Transf.
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant="ghost" onClick={() => setIsPaymentOpen(false)}>Cancelar</Button>
                        <Button className="bg-emerald-600 hover:bg-emerald-700" onClick={submitPayment} disabled={loading}>
                            {loading ? "Procesando..." : "Confirmar Abono"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
