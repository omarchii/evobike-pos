import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { Prisma } from "@prisma/client";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getAuthedUser } from "@/lib/auth-helpers";
import { normalizePhoneMX } from "@/lib/customers/phone";
import { listableCustomerWhere } from "@/lib/customers/service";
import { normalizeForSearch } from "@/lib/customers/normalize";

// GET /api/customers/search
//
// Dos modos (BRIEF §7.2 y §7.3):
//
//  - Omni-search libre: ?q=...&limit=...
//      Busca nombre, teléfono, email, RFC, VIN y folio de venta.
//
//  - Detección de duplicados inline: ?match=phone|email|rfc&value=...
//      Devuelve match exacto (si existe) para que el form muestre el banner
//      "Existe un cliente con este {campo}".
//
// Ambos modos filtran soft-deleted y mergeados (BRIEF §6.2).

type SearchResult = {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  rfc: string | null;
  source: "CUSTOMER" | "CUSTOMER_BIKE" | "SALE";
  hint?: string;
};

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await getServerSession(authOptions);
  const user = getAuthedUser(session);
  if (!user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const url = new URL(req.url);
  const match = url.searchParams.get("match");
  const value = url.searchParams.get("value")?.trim() ?? "";
  const q = url.searchParams.get("q")?.trim() ?? "";
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 10), 50);
  const base = listableCustomerWhere();

  // Modo duplicate detection.
  if (match) {
    if (!value) return NextResponse.json({ success: true, data: [] });
    let where: Prisma.CustomerWhereInput;
    switch (match) {
      case "phone": {
        const norm = normalizePhoneMX(value);
        if (!norm) return NextResponse.json({ success: true, data: [] });
        where = { ...base, phone: norm };
        break;
      }
      case "email":
        where = { ...base, email: { equals: value, mode: "insensitive" } };
        break;
      case "rfc":
        where = { ...base, rfc: value.trim().toUpperCase() };
        break;
      default:
        return NextResponse.json(
          { success: false, error: "match inválido (phone | email | rfc)" },
          { status: 400 },
        );
    }
    const hits = await prisma.customer.findMany({
      where,
      take: 5,
      select: { id: true, name: true, phone: true, email: true, rfc: true },
    });
    const data: SearchResult[] = hits.map((c) => ({ ...c, source: "CUSTOMER" }));
    return NextResponse.json({ success: true, data });
  }

  // Modo omni.
  if (!q) return NextResponse.json({ success: true, data: [] });

  const qUpper = q.toUpperCase();
  const phoneTerm = normalizePhoneMX(q);

  const [byCustomer, byBike, bySale] = await Promise.all([
    prisma.customer.findMany({
      where: {
        ...base,
        OR: [
          { nameNormalized: { contains: normalizeForSearch(q) } },
          { phone: { contains: phoneTerm ?? q } },
          { email: { contains: q, mode: "insensitive" } },
          { rfc: { contains: qUpper } },
        ],
      },
      take: limit,
      select: { id: true, name: true, phone: true, email: true, rfc: true },
    }),
    // CustomerBike por VIN / serial / modelo.
    prisma.customerBike.findMany({
      where: {
        customerId: { not: null },
        OR: [
          { serialNumber: { contains: q, mode: "insensitive" } },
          { model: { contains: q, mode: "insensitive" } },
          { brand: { contains: q, mode: "insensitive" } },
        ],
        customer: base,
      },
      take: limit,
      select: {
        serialNumber: true,
        customer: { select: { id: true, name: true, phone: true, email: true, rfc: true } },
      },
    }),
    // Sale por folio.
    prisma.sale.findMany({
      where: {
        folio: { contains: q, mode: "insensitive" },
        customerId: { not: null },
        customer: base,
      },
      take: limit,
      select: {
        folio: true,
        customer: { select: { id: true, name: true, phone: true, email: true, rfc: true } },
      },
    }),
  ]);

  const map = new Map<string, SearchResult>();
  for (const c of byCustomer) map.set(c.id, { ...c, source: "CUSTOMER" });
  for (const b of byBike) {
    if (!b.customer) continue;
    if (!map.has(b.customer.id)) {
      map.set(b.customer.id, {
        ...b.customer,
        source: "CUSTOMER_BIKE",
        hint: `VIN ${b.serialNumber}`,
      });
    }
  }
  for (const s of bySale) {
    if (!s.customer) continue;
    if (!map.has(s.customer.id)) {
      map.set(s.customer.id, {
        ...s.customer,
        source: "SALE",
        hint: `Folio ${s.folio}`,
      });
    }
  }

  return NextResponse.json({ success: true, data: Array.from(map.values()).slice(0, limit) });
}
