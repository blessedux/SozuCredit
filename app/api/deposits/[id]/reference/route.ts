import { NextResponse } from "next/server";
import { depositsEnabled } from "@/lib/app-config";
import { resolveUserId } from "@/lib/auth/resolve-user";
import { mergeDepositIntentMetadata } from "@/lib/db/deposit-intents";

export const dynamic = "force-dynamic";

/**
 * PATCH /api/deposits/[id]/reference
 * Lets the user attach proof-of-payment metadata (e.g. bank confirmation number, screenshot URL).
 * Only works while the intent is in awaiting_payment status.
 *
 * Body: { proof_reference?: string, note?: string }
 */
export async function PATCH(
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

  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const patch: Record<string, unknown> = {};
  if (typeof body.proof_reference === "string" && body.proof_reference.trim()) {
    patch.proof_reference = body.proof_reference.trim().slice(0, 200);
  }
  if (typeof body.note === "string" && body.note.trim()) {
    patch.note = body.note.trim().slice(0, 500);
  }
  if (Object.keys(patch).length === 0) {
    return NextResponse.json({ error: "No valid fields provided" }, { status: 400 });
  }

  try {
    await mergeDepositIntentMetadata(id, userId, patch);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("not found") || msg.includes("awaiting_payment")) {
      return NextResponse.json(
        { error: "Intent not found or cannot be updated in its current state" },
        { status: 404 },
      );
    }
    console.error("[PATCH /api/deposits/[id]/reference]", err);
    return NextResponse.json({ error: "Failed to update deposit" }, { status: 500 });
  }
}
