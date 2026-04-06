import { prisma } from "@/lib/prisma";
import CustomerList from "./customer-list";

export const dynamic = "force-dynamic";

export default async function CustomersPage() {
    const rawCustomers = await prisma.customer.findMany({
        orderBy: { name: 'asc' },
        include: {
            // We include counts just for some stats
            _count: {
                select: { sales: true }
            }
        }
    });

    const customers = rawCustomers.map(c => ({
        id: c.id,
        name: c.name,
        phone: c.phone,
        email: c.email,
        creditLimit: Number(c.creditLimit),
        balance: Number(c.balance),
        _count: { sales: c._count.sales },
    }));

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Directorio de Clientes</h1>
                    <p className="text-slate-500">Gestiona la información y saldos a favor de tu cartera de clientes.</p>
                </div>
            </div>

            <div className="flex-1 bg-white dark:bg-slate-950 rounded-xl border shadow-sm">
                <CustomerList initialCustomers={customers} />
            </div>
        </div>
    );
}
