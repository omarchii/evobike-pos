import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const createCustomerSchema = z.object({
  name: z.string().min(1, "El nombre es obligatorio"),
  phone: z.string().min(10, "El teléfono debe tener al menos 10 dígitos"),
  phone2: z.string().optional(),
  email: z.string().email("Correo inválido").optional().or(z.literal("")),

  // Dirección para flete
  shippingStreet: z.string().optional(),
  shippingExtNum: z.string().optional(),
  shippingIntNum: z.string().optional(),
  shippingColonia: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingState: z.string().optional(),
  shippingZip: z.string().optional(),
  shippingRefs: z.string().optional(),

  // Datos de facturación
  rfc: z.string().optional(),
  razonSocial: z.string().optional(),
  regimenFiscal: z.string().optional(),
  usoCFDI: z.string().optional(),
  emailFiscal: z.string().email("Correo fiscal inválido").optional().or(z.literal("")),
  direccionFiscal: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ success: false, error: "No autorizado" }, { status: 401 });
  }

  const body: unknown = await req.json();
  const parsed = createCustomerSchema.safeParse(body);
  if (!parsed.success) {
    const firstError = parsed.error.issues[0]?.message ?? "Datos inválidos";
    return NextResponse.json({ success: false, error: firstError }, { status: 400 });
  }

  const data = parsed.data;

  try {
    const customer = await prisma.customer.create({
      data: {
        name: data.name,
        phone: data.phone || null,
        phone2: data.phone2 || null,
        email: data.email || null,
        shippingStreet: data.shippingStreet || null,
        shippingExtNum: data.shippingExtNum || null,
        shippingIntNum: data.shippingIntNum || null,
        shippingColonia: data.shippingColonia || null,
        shippingCity: data.shippingCity || null,
        shippingState: data.shippingState || null,
        shippingZip: data.shippingZip || null,
        shippingRefs: data.shippingRefs || null,
        rfc: data.rfc || null,
        razonSocial: data.razonSocial || null,
        regimenFiscal: data.regimenFiscal || null,
        usoCFDI: data.usoCFDI || null,
        emailFiscal: data.emailFiscal || null,
        direccionFiscal: data.direccionFiscal || null,
        creditLimit: 0,
        balance: 0,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        phone2: true,
        email: true,
        balance: true,
        creditLimit: true,
      },
    });

    return NextResponse.json({
      success: true,
      data: {
        ...customer,
        balance: Number(customer.balance),
        creditLimit: Number(customer.creditLimit),
      },
    });
  } catch (err: unknown) {
    if (
      typeof err === "object" &&
      err !== null &&
      "code" in err &&
      (err as { code: string }).code === "P2002"
    ) {
      return NextResponse.json(
        { success: false, error: "El teléfono ya está registrado en otro cliente" },
        { status: 409 }
      );
    }
    const message = err instanceof Error ? err.message : "Error interno";
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
