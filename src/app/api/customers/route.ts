import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { getAuthedUser } from "@/lib/auth-helpers";
import { customerCreateSchema } from "@/lib/customers/validation";
import { listableCustomerWhere } from "@/lib/customers/service";
import { normalizeForSearch } from "@/lib/customers/normalize";

// GET /api/customers — directorio (SELLER+). Soporta filtros light.
// BRIEF.md §7.2. Los filtros pesados (LTV, saldo por cobrar, etc.) se
// computan en Sub-fase C con joins; por ahora exponemos lo mínimo para
// que la shell del directorio pueda armarse.
export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);
  const showDeleted = url.searchParams.get("showDeleted") === "1";
  const isBusiness = url.searchParams.get("isBusiness");

  // showDeleted solo MANAGER+ (BRIEF §6.2).
  const canSeeDeleted = user.role === "ADMIN" || user.role === "MANAGER";
  const includeDeleted = showDeleted && canSeeDeleted;

  const where: Prisma.CustomerWhereInput = {
    ...listableCustomerWhere({ includeDeleted }),
    ...(q
      ? {
          OR: [
            { nameNormalized: { contains: normalizeForSearch(q) } },
            { phone: { contains: q } },
            { email: { contains: q, mode: "insensitive" } },
            { rfc: { contains: q.toUpperCase() } },
          ],
        }
      : {}),
    ...(isBusiness === "true" ? { isBusiness: true } : {}),
    ...(isBusiness === "false" ? { isBusiness: false } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: { name: "asc" },
      skip: offset,
      take: limit,
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        rfc: true,
        isBusiness: true,
        tags: true,
        shippingCity: true,
        shippingState: true,
        creditLimit: true,
        deletedAt: true,
        _count: { select: { bikes: true, sales: true } },
      },
    }),
    prisma.customer.count({ where }),
  ]);

  // Saldo a favor por customer desde CustomerCredit (Pack D.5 — N+1 safe).
  const customerIds = items.map((c) => c.id);
  const creditAggregates =
    customerIds.length > 0
      ? await prisma.customerCredit.groupBy({
          by: ["customerId"],
          where: { customerId: { in: customerIds }, expiredAt: null, balance: { gt: 0 } },
          _sum: { balance: true },
        })
      : [];
  const creditTotalsByCustomer = new Map<string, number>();
  for (const row of creditAggregates) {
    creditTotalsByCustomer.set(row.customerId, Number(row._sum.balance ?? 0));
  }

  return NextResponse.json({
    success: true,
    data: items.map((c) => ({
      ...c,
      balance: creditTotalsByCustomer.get(c.id) ?? 0,
      creditLimit: Number(c.creditLimit),
    })),
    pagination: { total, limit, offset },
  });
}

// POST /api/customers — crear cliente (SELLER+).
// BRIEF §4.4: reutiliza customerCreateSchema. Normaliza phone y rfc.
export async function POST(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = customerCreateSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        nameNormalized: normalizeForSearch(data.name),
        phone: data.phone ?? null,
        phone2: data.phone2 ?? null,
        email: data.email ?? null,
        birthday: data.birthday ?? null,
        isBusiness: data.isBusiness ?? false,
        communicationConsent: data.communicationConsent ?? false,
        tags: data.tags ?? [],
        shippingStreet: data.shippingStreet ?? null,
        shippingExtNum: data.shippingExtNum ?? null,
        shippingIntNum: data.shippingIntNum ?? null,
        shippingColonia: data.shippingColonia ?? null,
        shippingCity: data.shippingCity ?? null,
        shippingState: data.shippingState ?? null,
        shippingZip: data.shippingZip ?? null,
        shippingRefs: data.shippingRefs ?? null,
        rfc: data.rfc ?? null,
        razonSocial: data.razonSocial ?? null,
        regimenFiscal: data.regimenFiscal ?? null,
        usoCFDI: data.usoCFDI ?? null,
        emailFiscal: data.emailFiscal ?? null,
        fiscalStreet: data.fiscalStreet ?? null,
        fiscalExtNum: data.fiscalExtNum ?? null,
        fiscalIntNum: data.fiscalIntNum ?? null,
        fiscalColonia: data.fiscalColonia ?? null,
        fiscalCity: data.fiscalCity ?? null,
        fiscalState: data.fiscalState ?? null,
        fiscalZip: data.fiscalZip ?? null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        phone2: true,
        email: true,
        rfc: true,
        creditLimit: true,
        isBusiness: true,
      },
    });

    // Saldo a favor de un customer recién creado siempre es 0 (no hay
    // CustomerCredit asociados todavía).
    return NextResponse.json({
      success: true,
      data: {
        ...customer,
        balance: 0,
        creditLimit: Number(customer.creditLimit),
      },
    });
  } catch (err: unknown) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      const target = (err.meta?.target as string[] | undefined)?.join(", ") ?? "valor único";
      return NextResponse.json(
        { success: false, error: `Ya existe un cliente con ese ${target}` },
        { status: 409 },
      );
    }
    console.error("[api/customers POST]", err);
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
