"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Banknote, CreditCard, Landmark, Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function AddBalanceDialog({ customerId, customerName, currentBalance }: { customerId: string, customerName: string, currentBalance: number }) {
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const [amount, setAmount] = useState("");
    const [paymentMethod, setPaymentMethod] = useState<"CASH" | "CARD" | "TRANSFER">("CASH");
    const [loading, setLoading] = useState(false);

    const handleSubmit = async () => {
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt <= 0) {
            toast.error("Monto inválido para recarga");
            return;
        }

        setLoading(true);
        toast.loading("Procesando recarga...", { id: "topup" });

        const res = await fetch(`/api/customers/${customerId}/balance`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ amount: amt, method: paymentMethod }),
        }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);

        if (res.success) {
            toast.success("Saldo recargado exitosamente", { id: "topup" });
            setOpen(false);
            setAmount("");
            router.refresh();
        } else {
            toast.error(res.error || "No se pudo procesar la recarga", { id: "topup" });
        }
        setLoading(false);
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-medium">
                    <Plus className="h-4 w-4 mr-2" /> Recargar Saldo
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Recargar Saldo a Favor</DialogTitle>
                    <DialogDescription>
                        El cliente <span className="font-bold text-slate-900 dark:text-white">{customerName}</span> depositará dinero por anticipado en su cuenta.
                    </DialogDescription>
                </DialogHeader>

                <div className="py-4 space-y-6">
                    <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-900 p-4 rounded-lg border">
                        <span className="text-sm font-medium text-slate-500">Saldo Actual</span>
                        <span className="text-xl font-bold text-slate-900 dark:text-white">${currentBalance.toFixed(2)}</span>
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium">Monto a Recargar</label>
                        <Input
                            type="number"
                            placeholder="Ej. 1500"
                            value={amount}
                            onChange={(e) => setAmount(e.target.value)}
                            className="text-lg"
                        />
                    </div>

                    <div className="space-y-3">
                        <label className="text-sm font-medium">Método de Pago (Entrada a Caja)</label>
                        <div className="grid grid-cols-3 gap-3">
                            <Button
                                variant={paymentMethod === "CASH" ? "default" : "outline"}
                                className={`h-16 flex flex-col gap-1 ${paymentMethod === "CASH" ? "ring-2 ring-primary" : ""}`}
                                onClick={() => setPaymentMethod("CASH")}
                            >
                                <Banknote className="h-4 w-4" /> Efectivo
                            </Button>
                            <Button
                                variant={paymentMethod === "CARD" ? "default" : "outline"}
                                className={`h-16 flex flex-col gap-1 ${paymentMethod === "CARD" ? "ring-2 ring-primary" : ""}`}
                                onClick={() => setPaymentMethod("CARD")}
                            >
                                <CreditCard className="h-4 w-4" /> Tarjeta
                            </Button>
                            <Button
                                variant={paymentMethod === "TRANSFER" ? "default" : "outline"}
                                className={`h-16 flex flex-col gap-1 ${paymentMethod === "TRANSFER" ? "ring-2 ring-primary" : ""}`}
                                onClick={() => setPaymentMethod("TRANSFER")}
                            >
                                <Landmark className="h-4 w-4" /> Transf.
                            </Button>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button variant="ghost" onClick={() => setOpen(false)}>Cancelar</Button>
                    <Button className="bg-emerald-600 hover:bg-emerald-700 text-white" onClick={handleSubmit} disabled={loading}>
                        {loading ? "Procesando..." : "Confirmar Recepción"}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
