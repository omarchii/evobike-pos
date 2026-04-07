"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { LockKeyholeOpen } from "lucide-react";

export default function CloseRegisterButton() {
    const router = useRouter();
    const [isClosing, setIsClosing] = useState(false);
    const [amount, setAmount] = useState<string>("");

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
            setIsClosing(false);
            setAmount("");
            // User needs to go to home or will be blocked if they stay here and reload
            router.push("/dashboard");
        } else {
            toast.error(error || "Error al cerrar caja", { id: "cash-action" });
        }
    };

    return (
        <>
            <Button
                onClick={() => setIsClosing(true)}
                className="w-full bg-red-600 hover:bg-red-700 text-white h-12 text-md font-semibold"
            >
                <LockKeyholeOpen className="mr-2 h-5 w-5" />
                Hacer Corte de Caja
            </Button>

            {/* CLOSE SHIFT DIALOG */}
            <Dialog open={isClosing} onOpenChange={setIsClosing}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2 text-xl">
                            Corte de Caja (Arqueo)
                        </DialogTitle>
                        <DialogDescription>
                            Declara cuánto dinero en efectivo REAL hay en la caja del mostrador en este momento. Manda el exceso a bóveda.
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
