import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSessionUser } from "@/lib/auth-guards";
import { send, markOpened } from "@/lib/whatsapp/dispatch";
import { formatPhoneForWhatsApp } from "@/lib/customers/phone";
import { z } from "zod";

const bodySchema = z.object({
  templateKey: z.string(),
  customerId: z.string().nullable().optional(),
  recipientPhone: z.string().min(10).max(10),
  variables: z.record(z.string(), z.string()),
});

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  const guard = requireSessionUser(session);
  if (!guard.ok) return guard.response;

  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { templateKey, customerId, recipientPhone, variables } = parsed.data;

  try {
    const msg = await send({
      templateKey,
      customerId: customerId ?? null,
      recipientPhone,
      variables,
      context: { triggeredByUserId: guard.user.id, source: "manual" },
    });

    const opened = await markOpened(msg.id, guard.user.id);

    const waPhone = formatPhoneForWhatsApp(opened.recipientPhone);
    const waUrl = waPhone
      ? `https://wa.me/${waPhone}?text=${encodeURIComponent(opened.renderedBody)}`
      : null;

    return NextResponse.json({ success: true, waUrl, messageId: opened.id });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Error desconocido";
    return NextResponse.json(
      { success: false, error: message },
      { status: 400 },
    );
  }
}
