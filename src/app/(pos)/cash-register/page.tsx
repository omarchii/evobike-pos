import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Banknote, CreditCard, Landmark, Wallet } from "lucide-react";
import CloseRegisterButton from "./close-register-button";
import { Badge } from "@/components/ui/badge";

export const dynamic = "force-dynamic";

interface SessionUser {
    id: string;
    branchId: string;
    role: string;
}

export default async function CashRegisterPage() {
    const session = await getServerSession(authOptions);
    if (!session?.user) redirect("/login");

    const userId = (session.user as SessionUser).id;
    const branchId = (session.user as SessionUser).branchId;

    // Obtener sesión activa de este usuario
    const activeSession = await prisma.cashRegisterSession.findFirst({
        where: {
            userId,
            branchId,
            status: "OPEN"
        },
        include: {
            transactions: {
                orderBy: { createdAt: "desc" }
            }
        }
    });

    if (!activeSession) {
        return (
            <div className="flex flex-col items-center justify-center p-12 text-center h-[50vh]">
                <Wallet className="h-16 w-16 text-slate-300 mb-4" />
                <h1 className="text-2xl font-bold text-slate-700">Caja Cerrada</h1>
                <p className="text-slate-500 mt-2 max-w-sm">No tienes un turno abierto en este momento. La ventana flotante de apertura aparecerá si navegas a otras pantallas.</p>
            </div>
        );
    }

    // Calcular montos
    let cashSales = 0;
    let cardSales = 0;
    let transferSales = 0;

    activeSession.transactions.forEach(tx => {
        if (tx.type === "PAYMENT_IN") {
            const amt = Number(tx.amount);
            if (tx.method === "CASH") cashSales += amt;
            if (tx.method === "CARD") cardSales += amt;
            if (tx.method === "TRANSFER") transferSales += amt;
        }
    });

    const formatCurrency = (val: number) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN' }).format(val);

    // Suma final que debería haber físicamente en caja = Fondo Inicial + Ingresos en EFECTIVO.
    // (Excluimos tarjeta y transferencia porque eso no está físicamente en el cajón)
    const openingAmt = Number(activeSession.openingAmt);
    const expectedCashInDrawer = openingAmt + cashSales;

    return (
        <div className="space-y-6 max-w-5xl mx-auto">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Arqueo de Caja</h1>

            {/* INFORMATIVE SUMMARY */}
            <div className="grid gap-4 md:grid-cols-4">
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium">Fondo Inicial</CardTitle>
                        <Wallet className="h-4 w-4 text-slate-500" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold">{formatCurrency(openingAmt)}</div>
                        <p className="text-xs text-slate-500 mt-1">Reportado al abrir turno: {activeSession.openedAt.toLocaleTimeString()}</p>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-emerald-600">En Efectivo (Físico)</CardTitle>
                        <Banknote className="h-4 w-4 text-emerald-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-emerald-600">{formatCurrency(cashSales)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-blue-600">Tarjeta</CardTitle>
                        <CreditCard className="h-4 w-4 text-blue-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-blue-600">{formatCurrency(cardSales)}</div>
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                        <CardTitle className="text-sm font-medium text-purple-600">Transferencia</CardTitle>
                        <Landmark className="h-4 w-4 text-purple-600" />
                    </CardHeader>
                    <CardContent>
                        <div className="text-2xl font-bold text-purple-600">{formatCurrency(transferSales)}</div>
                    </CardContent>
                </Card>
            </div>

            {/* ACTION & TRANSACTIONS */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                <div className="col-span-1 border rounded-xl p-6 bg-white shadow-sm flex flex-col justify-between">
                    <div>
                        <h3 className="font-semibold text-lg mb-1">Cierre Operativo</h3>
                        <p className="text-slate-500 text-sm mb-6">Realiza el corte de caja antes de finalizar el día o cambiar de turno.</p>

                        <div className="bg-slate-50 p-4 rounded-lg mb-6 border border-slate-100">
                            <span className="text-slate-500 text-xs font-semibold uppercase tracking-wider block mb-1">Cálculo del Sistema:</span>
                            <span className="text-sm">Fondo Inicial: {formatCurrency(openingAmt)}</span> <br />
                            <span className="text-sm">+ Efectivo Recibido: {formatCurrency(cashSales)}</span>
                            <div className="h-px bg-slate-200 my-2"></div>
                            <span className="text-lg font-bold text-slate-900 block">Total esperado en Cajón: {formatCurrency(expectedCashInDrawer)}</span>
                        </div>
                    </div>

                    <CloseRegisterButton />
                </div>

                <div className="col-span-2 border rounded-xl p-6 bg-white shadow-sm overflow-hidden flex flex-col h-[500px]">
                    <h3 className="font-semibold text-lg mb-4">Registro de Transacciones</h3>
                    <div className="overflow-y-auto flex-1 pr-2 space-y-2">
                        {activeSession.transactions.length === 0 ? (
                            <p className="text-slate-500 py-4 text-center">No hay transacciones registradas en este turno.</p>
                        ) : (
                            activeSession.transactions.map((tx) => (
                                <div key={tx.id} className="flex justify-between items-center p-3 rounded-md bg-slate-50 border border-slate-100">
                                    <div className="flex items-center gap-3">
                                        <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${tx.method === 'CASH' ? 'bg-emerald-100 text-emerald-600' :
                                                tx.method === 'CARD' ? 'bg-blue-100 text-blue-600' :
                                                    tx.method === 'TRANSFER' ? 'bg-purple-100 text-purple-600' : 'bg-slate-100 text-slate-600'
                                            }`}>
                                            {tx.method === 'CASH' && <Banknote className="h-4 w-4" />}
                                            {tx.method === 'CARD' && <CreditCard className="h-4 w-4" />}
                                            {tx.method === 'TRANSFER' && <Landmark className="h-4 w-4" />}
                                        </div>
                                        <div>
                                            <p className="font-medium text-sm flex items-center gap-2">
                                                Cobro ({tx.method})
                                                {tx.saleId && <Badge variant="outline" className="text-[10px] px-1 h-4 bg-white border-slate-200 font-normal">Ticket Ligado</Badge>}
                                            </p>
                                            <p className="text-xs text-slate-500">{tx.createdAt.toLocaleTimeString()}</p>
                                        </div>
                                    </div>
                                    <div className="font-bold text-emerald-700">
                                        + {formatCurrency(Number(tx.amount))}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

            </div>
        </div>
    );
}
