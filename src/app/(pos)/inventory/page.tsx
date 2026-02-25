import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PackageSearch, PackagePlus, ArrowRightLeft } from "lucide-react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function InventoryPage() {
    const session = await getServerSession(authOptions);
    const branchId = (session?.user as any)?.branchId;

    // Get products with their stocks in this branch
    const rawProducts = await prisma.product.findMany({
        include: {
            stocks: {
                where: { branchId: branchId }
            }
        },
        orderBy: { name: 'asc' }
    });

    const products = rawProducts.map(p => ({
        ...p,
        price: Number(p.price),
        cost: Number(p.cost),
        stock: p.stocks[0]?.quantity || 0
    }));

    return (
        <div className="h-[calc(100vh-4rem)] flex flex-col">
            <div className="mb-6 flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Inventario (Kardex)</h1>
                    <p className="text-slate-500">Gestor de existencias y valorización de almacén local.</p>
                </div>
                <div className="flex gap-3">
                    <Button variant="outline" className="text-slate-600">
                        <ArrowRightLeft className="h-4 w-4 mr-2" /> Traslados
                    </Button>
                    <Link href="/inventory/receipts">
                        <Button className="bg-emerald-600 hover:bg-emerald-700">
                            <PackagePlus className="h-4 w-4 mr-2" /> Ingresar Mercancía
                        </Button>
                    </Link>
                </div>
            </div>

            <div className="flex-1 overflow-auto bg-white dark:bg-slate-950 rounded-xl border shadow-sm">
                <Table>
                    <TableHeader className="bg-slate-50 sticky top-0">
                        <TableRow>
                            <TableHead className="w-[300px]">Producto</TableHead>
                            <TableHead>Código (SKU)</TableHead>
                            <TableHead className="text-right">Precio Venta</TableHead>
                            <TableHead className="text-right">Costo Promedio</TableHead>
                            <TableHead className="text-center">En Existencia</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {products.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="h-24 text-center text-slate-500">
                                    <div className="flex flex-col items-center justify-center space-y-2">
                                        <PackageSearch className="h-8 w-8 text-slate-300" />
                                        <span>No hay catálogo de productos registrado.</span>
                                    </div>
                                </TableCell>
                            </TableRow>
                        ) : (
                            products.map((p) => (
                                <TableRow key={p.id}>
                                    <TableCell className="font-medium">{p.name}</TableCell>
                                    <TableCell className="text-slate-500">{p.sku}</TableCell>
                                    <TableCell className="text-right font-medium text-emerald-600">
                                        ${p.price.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-right text-slate-500">
                                        ${p.cost.toFixed(2)}
                                    </TableCell>
                                    <TableCell className="text-center">
                                        <Badge variant={p.stock > 0 ? "secondary" : "destructive"}>
                                            {p.stock} pzas
                                        </Badge>
                                    </TableCell>
                                </TableRow>
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}
