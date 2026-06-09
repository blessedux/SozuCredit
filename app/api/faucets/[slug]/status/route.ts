import { NextResponse } from "next/server";
import { computeFaucetAvailability, getFaucetBySlug, toPublicFaucet } from "@/lib/db/faucets";
import { getStellarWallet } from "@/lib/turnkey/stellar-wallet";
import type { FaucetStatusResponse } from "@/lib/faucet/types";

export const dynamic = "force-dynamic";

/**
 * GET /api/faucets/[slug]/status — faucet info + availability.
 * Public: works without auth (NFC tap lands here before onboarding).
 * When an x-user-id header is present, user/wallet cooldown is included.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;

  try {
    const faucet = await getFaucetBySlug(slug);
    if (!faucet) {
      return NextResponse.json({ error: "Faucet not found" }, { status: 404 });
    }

    // Optional user context for the user-cooldown rule.
    const userId = request.headers.get("x-user-id")?.trim() || null;
    let walletAddress: string | null = null;
    if (userId) {
      const wallet = await getStellarWallet(userId, true).catch(() => null);
      walletAddress = wallet?.publicKey?.trim().toUpperCase() ?? null;
    }

    const availability = await computeFaucetAvailability(faucet, {
      userId,
      walletAddress,
    });

    const response: FaucetStatusResponse = {
      faucet: toPublicFaucet(faucet),
      availability,
    };
    return NextResponse.json(response);
  } catch (err) {
    console.error("[GET /api/faucets/[slug]/status]", err);
    return NextResponse.json({ error: "Failed to fetch faucet status" }, { status: 500 });
  }
}
