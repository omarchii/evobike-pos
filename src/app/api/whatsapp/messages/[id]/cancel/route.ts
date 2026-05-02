import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { requireSessionUser } from "@/lib/auth-guards";
import { cancel, InvalidTransitionError } from "@/lib/whatsapp/dispatch";
import { z } from "zod";

const bodySchema = z.object({
  reason: z.string().min(1, "Motivo requerido"),
});

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  const guard = requireSessionUser(session);
  if (!guard.ok) return guard.response;

  const { id } = await params;
  const parsed = bodySchema.safeParse(await req.json());
  if (!parsed.success) {
    return NextResponse.json(
      { success: false, error: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    await cancel(id, parsed.data.reason);
    return NextResponse.json({ success: true });
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
