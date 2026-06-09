import { NextResponse } from "next/server";
import { depositsEnabled } from "@/lib/app-config";
import { resolveUserId } from "@/lib/auth/resolve-user";
import { getDepositIntentById, toPublic } from "@/lib/db/deposit-intents";

export const dynamic = "force-dynamic";

/** GET /api/deposits/[id] — single deposit intent for the authenticated user. */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!depositsEnabled) {
    return NextResponse.json({ error: "Deposits not available on this deployment" }, { status: 403 });
  }

  const auth = await resolveUserId(request);
  if (auth.error) return auth.error;
  const { userId } = auth;

  const { id } = await params;

  try {
    const intent = await getDepositIntentById(id, userId);
    if (!intent) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ deposit: toPublic(intent) });
  } catch (err) {
    console.error("[GET /api/deposits/[id]]", err);
    return NextResponse.json({ error: "Failed to fetch deposit" }, { status: 500 });
  }
}
