import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSessionUser } from "@/lib/auth-guards";
import {
  markOpened,
  InvalidTransitionError,
} from "@/lib/whatsapp/dispatch";
import { formatPhoneForWhatsApp } from "@/lib/customers/phone";
import { prisma } from "@/lib/prisma";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const guard = requireSessionUser(session);
  if (!guard.ok) return guard.response;

  const { id } = await params;

  try {
    const msg = await markOpened(id, guard.user.id);

    const waPhone = formatPhoneForWhatsApp(msg.recipientPhone);
    const waUrl = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(msg.renderedBody)}`
      : null;

    const customer = msg.customerId
      ? await prisma.customer.findUnique({
          where: { id: msg.customerId },
          select: { phone: true },
        })
      : null;

    const phoneChanged =
      customer?.phone != null && customer.phone !== msg.recipientPhone;

    return NextResponse.json({
      success: true,
      waUrl,
      phoneChanged,
      currentPhone: phoneChanged ? customer!.phone : null,
    });
  } catch (e) {
    if (e instanceof InvalidTransitionError) {
      return NextResponse.json(
        { success: false, error: e.message },
        { status: 409 },
      );
    }
    throw e;
  }
}
