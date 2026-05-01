import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getCustomerCreditBalance } from "@/lib/customer-credit";

// GET /api/serial-search?q=123
export async function GET(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user) {
            return new NextResponse("Unauthorized", { status: 401 });
        }

        const { searchParams } = new URL(request.url);
        const query = searchParams.get("q");

        if (!query || query.length < 3) {
            return NextResponse.json([]);
        }

        const bikes = await prisma.customerBike.findMany({
            where: {
                serialNumber: {
                    contains: query,
                    mode: "insensitive"
                }
            },
            include: {
                customer: true
            },
            take: 10
        });

        // Saldo a favor desde CustomerCredit (Pack D.5). Hasta 10 bikes en el
        // resultado — loop secuencial es suficiente.
        const serialized = await Promise.all(
            bikes.map(async (bike) => {
                if (!bike.customer) return { ...bike, customer: null };
                const { total: creditBalance } = await getCustomerCreditBalance(
                    bike.customer.id,
                );
                return {
                    ...bike,
                    customer: {
                        ...bike.customer,
                        creditLimit: Number(bike.customer.creditLimit),
                        balance: creditBalance,
                    },
                };
            }),
        );

        return NextResponse.json(serialized);
    } catch (error) {
        console.error("Error searching by serial:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
