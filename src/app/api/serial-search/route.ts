import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

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

        // Serializar campos Decimal de Customer antes de retornar como JSON
        const serialized = bikes.map((bike) => ({
            ...bike,
            customer: bike.customer
                ? {
                      ...bike.customer,
                      creditLimit: Number(bike.customer.creditLimit),
                      balance: Number(bike.customer.balance)
                  }
                : null
        }));

        return NextResponse.json(serialized);
    } catch (error) {
        console.error("Error searching by serial:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
