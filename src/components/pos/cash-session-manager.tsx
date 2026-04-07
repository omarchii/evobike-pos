"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { Banknote, Wallet } from "lucide-react";

export function CashSessionManager() {
    const router = useRouter();
    const [isOpen, setIsOpen] = useState(false);
    const [isClosing, setIsClosing] = useState(false);
    const [loading, setLoading] = useState(true);
    const [amount, setAmount] = useState<string>("");
    const [, setHasActiveSession] = useState(false);

    // Check on mount if the user has an open session
    useEffect(() => {
        const checkSession = async () => {
            const res = await fetch("/api/cash-register/session").then(
                (r) => r.json() as Promise<{ success: boolean; data?: { id: string } | null }>
            );
            if (res.success) {
                if (res.data) {
                    setHasActiveSession(true);
                } else {
                    setIsOpen(true); // Force them to open one
                }
            }
            setLoading(false);
        };
        checkSession();
    }, []);

    const handleOpenShift = async () => {
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt < 0) {
            toast.error("Ingresa un monto válido");
            return;
        }

        toast.loading("Abriendo turno...", { id: "cash-action" });
        const { success, error } = await fetch("/api/cash-register/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ openingAmt: amt }),
        }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);

        if (success) {
            toast.success("Turno abierto exitosamente", { id: "cash-action" });
            setHasActiveSession(true);
            setIsOpen(false);
            router.refresh();
        } else {
            toast.error(error || "Error al abrir turno", { id: "cash-action" });
        }
    };

    const handleCloseShift = async () => {
        const amt = parseFloat(amount);
        if (isNaN(amt) || amt < 0) {
            toast.error("Ingresa el monto de arqueo final");
            return;
        }

        toast.loading("Cerrando turno...", { id: "cash-action" });
        const { success, error } = await fetch("/api/cash-register/session", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ closingAmt: amt }),
        }).then((r) => r.json() as Promise<{ success: boolean; error?: string }>);

        if (success) {
            toast.success("Turno cerrado. Ya no puedes operar ventas.", { id: "cash-action" });
            setHasActiveSession(false);
            setIsClosing(false);
            setAmount("");
            router.refresh(); // Refresh page so server components know
        } else {
            toast.error(error || "Error al cerrar caja", { id: "cash-action" });
        }
    };

    if (loading) return null; // Wait until init check finishes

    return (
        <>
            {/* El botón flotante de Cerrar Caja fue removido y movido a /cash-register */}

            {/* OPEN SHIFT DIALOG (Non-dismissable) */}
            <Dialog open={isOpen} onOpenChange={() => { }}>
                <DialogContent className="sm:max-w-md [&>button]:hidden pointer-events-none">
                    <div className="pointer-events-auto">
                        <DialogHeader>
                            <DialogTitle className="flex items-center gap-2 text-xl">
                                <Wallet className="h-5 w-5 text-emerald-600" />
                                Apertura de Caja
                            </DialogTitle>
                            <DialogDescription>
                                Debes declarar el fondo inicial en caja para comenzar a operar el Punto de Venta hoy.
                            </DialogDescription>
                        </DialogHeader>
                        <div className="py-6">
                            <Label htmlFor="openingAmt" className="text-slate-500 mb-2 block">Monto en Efectivo</Label>
                            <div className="relative">
                                <span className="absolute left-3 top-2.5 text-slate-500 font-medium">$</span>
                                <Input
                                    id="openingAmt"
                                    type="number"
                                    placeholder="0.00"
                                    className="pl-7 text-lg h-12"
                                    value={amount}
                                    onChange={(e) => setAmount(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>
                        <DialogFooter>
                            <Button onClick={handleOpenShift} className="w-full h-12 text-md bg-emerald-600 hover:bg-emerald-700">
                                <Banknote className="mr-2 h-5 w-5" />
                                Iniciar Turno
                            </Button>
                        </DialogFooter>
                    </div>
                </DialogContent>
            </Dialog>


            {/* CLOSE SHIFT DIALOG */}
            <Dialog open={isClosing} onOpenChange={setIsClosing}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            Corte de Caja (Arqueo)
                        </DialogTitle>
                        <DialogDescription>
                            Declara cuánto dinero en efectivo REAL hay en la caja en este momento para cerrar tu turno.
                        </DialogDescription>
                    </DialogHeader>
                    <div className="py-6">
                        <Label htmlFor="closingAmt" className="text-slate-500 mb-2 block">Monto Final Físico</Label>
                        <div className="relative">
                            <span className="absolute left-3 top-2.5 text-slate-500 font-medium">$</span>
                            <Input
                                id="closingAmt"
                                type="number"
                                placeholder="0.00"
                                className="pl-7 text-lg h-12"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                autoFocus
                            />
                        </div>
                    </div>
                    <DialogFooter>
                        <Button variant="secondary" onClick={() => setIsClosing(false)}>Cancelar</Button>
                        <Button onClick={handleCloseShift} className="bg-red-600 hover:bg-red-700 text-white">
                            Cerrar Caja
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    );
}
