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

        // Search in CustomerBike for serialNumber
        const bikes = await prisma.customerBike.findMany({
            where: {
                serialNumber: {
                    contains: query,
                    mode: 'insensitive'
                }
            },
            include: {
                customer: true
            },
            take: 10
        });

        return NextResponse.json(bikes);
    } catch (error) {
        console.error("Error searching by serial:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}
